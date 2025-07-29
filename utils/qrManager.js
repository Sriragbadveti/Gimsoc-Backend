const QRCode = require('qrcode');
const { QRCode: QRCodeModel } = require('../models/qrCodeModel');

class QRManager {
  constructor() {
    this.activeConnections = new Map(); // ticketId -> WebSocket connections
    this.updateInterval = null;
    this.startQRUpdates();
  }



  // Generate dynamic QR code with user details
  async generateDynamicQR(ticketId) {
    try {
      // Fetch user details from database
      const { UserTicket } = require('../models/userModel');
      const userTicket = await UserTicket.findById(ticketId);
      
      if (!userTicket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const qrData = {
        ticketId: ticketId,
        fullName: userTicket.fullName,
        ticketType: userTicket.ticketType,
        ticketCategory: userTicket.ticketCategory,
        email: userTicket.email,
        timestamp: Date.now()
      };

      // Generate QR code using hosted service for email compatibility
      const qrDataString = JSON.stringify(qrData);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrDataString)}&format=png&margin=1&ecc=H`;

      console.log(`🔍 Generated QR for ticket ${ticketId} - Name: ${userTicket.fullName}, Type: ${userTicket.ticketType}`);
      return { qrCode: qrCodeUrl, qrData };
    } catch (error) {
      console.error('❌ Error generating dynamic QR:', error);
      throw error;
    }
  }

  // Validate QR code on scan
  async validateQRCode(scannedData, ipAddress, userAgent) {
    try {
      const { ticketId, fullName, ticketType, email } = scannedData;

      // Basic validation - check if required fields exist
      if (!ticketId || !fullName || !ticketType) {
        await this.recordScan(ticketId, ipAddress, userAgent, false, 'missing_fields');
        return { valid: false, reason: 'missing_fields', message: 'QR code missing required information' };
      }

      // Verify ticket exists in database
      const { UserTicket } = require('../models/userModel');
      const userTicket = await UserTicket.findById(ticketId);
      
      if (!userTicket) {
        await this.recordScan(ticketId, ipAddress, userAgent, false, 'ticket_not_found');
        return { valid: false, reason: 'ticket_not_found', message: 'Ticket not found in database' };
      }

      // Record successful scan
      await this.recordScan(ticketId, ipAddress, userAgent, true, 'valid');

      return { 
        valid: true, 
        ticketId,
        fullName: userTicket.fullName,
        ticketType: userTicket.ticketType,
        ticketCategory: userTicket.ticketCategory,
        email: userTicket.email,
        message: 'QR code validated successfully',
        scannedAt: Date.now()
      };
    } catch (error) {
      console.error('❌ Error validating QR code:', error);
      return { valid: false, reason: 'validation_error', message: 'Error validating QR code' };
    }
  }

  // Record scan attempt
  async recordScan(ticketId, ipAddress, userAgent, isValid, reason) {
    try {
      await QRCodeModel.findOneAndUpdate(
        { ticketId },
        {
          $push: {
            scanHistory: {
              scannedAt: Date.now(),
              ipAddress,
              userAgent,
              isValid,
              reason
            }
          }
        },
        { upsert: true }
      );
    } catch (error) {
      console.error('❌ Error recording scan:', error);
    }
  }

  // Update QR codes for all active tickets
  async updateAllQRCodes() {
    try {
      console.log('🔄 Starting QR code update cycle...');
      
      // Get all active QR codes
      const activeQRCodes = await QRCodeModel.find({ isActive: true });
      
      for (const qrRecord of activeQRCodes) {
        try {
          const { qrCode, qrData } = await this.generateDynamicQR(qrRecord.ticketId.toString());
          
          // Update database
          await QRCodeModel.findByIdAndUpdate(qrRecord._id, {
            currentQR: qrCode,
            qrData: qrData,
            lastQRUpdate: Date.now(),
            $inc: { qrUpdateCount: 1 }
          });
          
          // Broadcast to connected clients
          this.broadcastQRUpdate(qrRecord.ticketId.toString(), qrCode, qrData);
          
          console.log(`✅ Updated QR code for ticket ${qrRecord.ticketId}`);
        } catch (error) {
          console.error(`❌ Error updating QR for ticket ${qrRecord.ticketId}:`, error);
        }
      }
      
      console.log(`✅ QR update cycle completed. Updated ${activeQRCodes.length} tickets.`);
    } catch (error) {
      console.error('❌ Error in QR update cycle:', error);
    }
  }

  // Start periodic QR updates
  startQRUpdates() {
    const interval = parseInt(process.env.QR_UPDATE_INTERVAL) || 300000; // 5 minutes default
    this.updateInterval = setInterval(() => {
      this.updateAllQRCodes();
    }, interval);
    
    console.log(`🔄 QR update scheduler started. Interval: ${interval}ms`);
  }

  // Stop QR updates
  stopQRUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      console.log('🛑 QR update scheduler stopped');
    }
  }

  // WebSocket connection management
  addConnection(ticketId, ws) {
    if (!this.activeConnections.has(ticketId)) {
      this.activeConnections.set(ticketId, new Set());
    }
    this.activeConnections.get(ticketId).add(ws);
    console.log(`🔗 WebSocket connected for ticket ${ticketId}`);
  }

  removeConnection(ticketId, ws) {
    const connections = this.activeConnections.get(ticketId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.activeConnections.delete(ticketId);
      }
    }
    console.log(`🔌 WebSocket disconnected for ticket ${ticketId}`);
  }

  // Broadcast QR updates to connected clients
  broadcastQRUpdate(ticketId, qrCode, qrData) {
    const connections = this.activeConnections.get(ticketId);
    if (connections) {
      const message = JSON.stringify({
        type: 'qr_update',
        qrCode: qrCode,
        qrData: qrData,
        timestamp: Date.now()
      });
      
      connections.forEach(ws => {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      });
      
      console.log(`📡 Broadcasted QR update to ${connections.size} clients for ticket ${ticketId}`);
    }
  }

  // Get QR code for a ticket
  async getQRCode(ticketId) {
    try {
      let qrRecord = await QRCodeModel.findOne({ ticketId });
      
      if (!qrRecord) {
        // Create new QR record
        const { qrCode, qrData } = await this.generateDynamicQR(ticketId.toString());
        qrRecord = await QRCodeModel.create({
          ticketId,
          currentQR: qrCode,
          qrData: qrData,
          lastQRUpdate: Date.now(),
          qrUpdateCount: 1,
          isActive: true
        });
      } else if (Date.now() > qrRecord.qrData.expiry) {
        // Update expired QR code
        const { qrCode, qrData } = await this.generateDynamicQR(ticketId.toString());
        await QRCodeModel.findByIdAndUpdate(qrRecord._id, {
          currentQR: qrCode,
          qrData: qrData,
          lastQRUpdate: Date.now(),
          $inc: { qrUpdateCount: 1 }
        });
        qrRecord.currentQR = qrCode;
        qrRecord.qrData = qrData;
      }
      
      return qrRecord;
    } catch (error) {
      console.error('❌ Error getting QR code:', error);
      throw error;
    }
  }

  // Get scan history for a ticket
  async getScanHistory(ticketId) {
    try {
      const qrRecord = await QRCodeModel.findOne({ ticketId });
      return qrRecord ? qrRecord.scanHistory : [];
    } catch (error) {
      console.error('❌ Error getting scan history:', error);
      return [];
    }
  }
}

module.exports = QRManager; 