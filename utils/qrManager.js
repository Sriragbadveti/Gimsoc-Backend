const QRCode = require('qrcode');
const mongoose = require('mongoose');
const { QRCode: QRCodeModel, UsedQR } = require('../models/qrCodeModel');

class QRManager {
  constructor() {
    this.activeConnections = new Map(); // ticketId -> WebSocket connections
    this.updateInterval = null;
    this.startQRUpdates();
  }

  generateNonce() {
    return `nonce_${Math.random().toString(36).substring(2, 15)}`;
  }

  generateSignature(ticketId, timestamp) {
    return `sig_${ticketId}_${timestamp}`;
  }

  // Generate dynamic QR code with user data included
  async generateDynamicQR(ticketId, userData = null) {
    try {
      const timestamp = Date.now();
      const expiry = timestamp + (5 * 60 * 1000); // 5 minutes
      const nonce = this.generateNonce();
      const signature = this.generateSignature(ticketId, timestamp);

      // Create QR data with user information
      const qrData = {
        ticketId: ticketId,
        timestamp: timestamp,
        expiry: expiry,
        signature: signature,
        nonce: nonce
      };

      // Add user information if provided
      if (userData) {
        qrData.fullName = userData.fullName;
        qrData.email = userData.email;
        qrData.ticketType = userData.ticketType;
        qrData.ticketCategory = userData.ticketCategory;
      }

      // Generate QR code locally using qrcode library
      const qrDataString = JSON.stringify(qrData);
      const qrCodeDataUrl = await QRCode.toDataURL(qrDataString, {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        quality: 0.92,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      console.log(`🔍 Generated dynamic QR for ticket ${ticketId}`);
      console.log(`📋 QR Data includes user info:`, userData ? 'Yes' : 'No');
      return { qrCode: qrCodeDataUrl, qrData };
    } catch (error) {
      console.error('❌ Error generating dynamic QR:', error);
      throw error;
    }
  }

  // Validate QR code on scan
  async validateQRCode(scannedData, ipAddress, userAgent) {
    try {
      const { ticketId, timestamp, signature, nonce, expiry } = scannedData;

      // Check if QR code is expired
      if (Date.now() > expiry) {
        await this.recordScan(ticketId, ipAddress, userAgent, false, 'expired');
        return { valid: false, reason: 'expired', message: 'QR code has expired' };
      }

      // Verify signature
      const expectedSignature = this.generateSignature(ticketId, timestamp);
      if (signature !== expectedSignature) {
        await this.recordScan(ticketId, ipAddress, userAgent, false, 'invalid_signature');
        return { valid: false, reason: 'invalid_signature', message: 'Invalid QR code signature' };
      }

      // Check if already used (prevent replay attacks)
      const usedQR = await UsedQR.findOne({ nonce });
      if (usedQR) {
        await this.recordScan(ticketId, ipAddress, userAgent, false, 'already_used');
        return { valid: false, reason: 'already_used', message: 'QR code already scanned' };
      }

      // Mark as used
      await UsedQR.create({ 
        nonce, 
        ticketId, 
        scannedAt: Date.now(),
        ipAddress,
        userAgent
      });

      // Record successful scan
      await this.recordScan(ticketId, ipAddress, userAgent, true, 'valid');

      return { 
        valid: true, 
        ticketId,
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

  // Update all QR codes (for dynamic updates)
  async updateAllQRCodes() {
    try {
      console.log('🔄 Updating all QR codes...');
      
      // Get all tickets from database
      const UserTicket = require('../models/userModel');
      const tickets = await UserTicket.find({ paymentStatus: 'completed' });
      
      for (const ticket of tickets) {
        try {
          const userData = {
            fullName: ticket.fullName,
            email: ticket.email,
            ticketType: ticket.ticketType,
            ticketCategory: ticket.ticketCategory
          };
          
          const { qrCode, qrData } = await this.generateDynamicQR(ticket._id.toString(), userData);
          
          // Store updated QR code
          await QRCodeModel.findOneAndUpdate(
            { ticketId: ticket._id.toString() },
            { 
              qrCode,
              qrData,
              lastUpdated: Date.now()
            },
            { upsert: true }
          );
          
          // Broadcast to connected clients
          this.broadcastQRUpdate(ticket._id.toString(), qrCode, qrData);
          
        } catch (error) {
          console.error(`❌ Error updating QR for ticket ${ticket._id}:`, error);
        }
      }
      
      console.log(`✅ Updated ${tickets.length} QR codes`);
    } catch (error) {
      console.error('❌ Error updating QR codes:', error);
    }
  }

  // Start QR updates
  startQRUpdates() {
    console.log('🔄 Starting QR code updates...');
    this.updateInterval = setInterval(() => {
      this.updateAllQRCodes();
    }, 5 * 60 * 1000); // Update every 5 minutes
  }

  // Stop QR updates
  stopQRUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ Stopped QR code updates');
    }
  }

  // Add WebSocket connection
  addConnection(ticketId, ws) {
    if (!this.activeConnections.has(ticketId)) {
      this.activeConnections.set(ticketId, new Set());
    }
    this.activeConnections.get(ticketId).add(ws);
    console.log(`🔗 Added WebSocket connection for ticket ${ticketId}`);
  }

  // Remove WebSocket connection
  removeConnection(ticketId, ws) {
    const connections = this.activeConnections.get(ticketId);
    if (connections) {
      connections.delete(ws);
      if (connections.size === 0) {
        this.activeConnections.delete(ticketId);
      }
      console.log(`🔌 Removed WebSocket connection for ticket ${ticketId}`);
    }
  }

  // Broadcast QR update to connected clients
  broadcastQRUpdate(ticketId, qrCode, qrData) {
    const connections = this.activeConnections.get(ticketId);
    if (connections) {
      connections.forEach(ws => {
        try {
          ws.send(JSON.stringify({
            type: 'qr_update',
            ticketId,
            qrCode,
            qrData
          }));
        } catch (error) {
          console.error('❌ Error broadcasting QR update:', error);
          this.removeConnection(ticketId, ws);
        }
      });
    }
  }

  // Get QR code for a specific ticket
  async getQRCode(ticketId) {
    try {
      // First try to get from cache
      let qrCodeDoc = await QRCodeModel.findOne({ ticketId });
      
      if (!qrCodeDoc) {
        // Generate new QR code
        const UserTicket = require('../models/userModel');
        const ticket = await UserTicket.findById(ticketId);
        
        if (!ticket) {
          throw new Error('Ticket not found');
        }
        
        const userData = {
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory
        };
        
        const { qrCode, qrData } = await this.generateDynamicQR(ticketId, userData);
        
        // Store in cache
        qrCodeDoc = await QRCodeModel.create({
          ticketId,
          qrCode,
          qrData,
          lastUpdated: Date.now()
        });
      }
      
      return qrCodeDoc;
    } catch (error) {
      console.error('❌ Error getting QR code:', error);
      throw error;
    }
  }

  // Get scan history for a ticket
  async getScanHistory(ticketId) {
    try {
      const qrCodeDoc = await QRCodeModel.findOne({ ticketId });
      return qrCodeDoc ? qrCodeDoc.scanHistory : [];
    } catch (error) {
      console.error('❌ Error getting scan history:', error);
      return [];
    }
  }
}

module.exports = QRManager; 