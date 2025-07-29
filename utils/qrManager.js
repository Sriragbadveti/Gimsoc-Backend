const mongoose = require('mongoose');
const QRCodeModel = require('../models/qrCodeModel');

class QRManager {
  constructor() {
    this.connections = new Set();
    this.updateInterval = null;
    this.isUpdating = false;
  }

  generateNonce() {
    return `nonce_${Math.random().toString(36).substring(2, 15)}`;
  }

  generateSignature(ticketId, timestamp) {
    return `sig_${ticketId}_${timestamp}`;
  }

  // Generate dynamic QR code
  async generateDynamicQR(ticketId) {
    try {
      const timestamp = Date.now();
      const expiry = timestamp + (5 * 60 * 1000); // 5 minutes
      const nonce = this.generateNonce();
      const signature = this.generateSignature(ticketId, timestamp);

      // Create QR data
      const qrData = {
        ticketId: ticketId,
        timestamp: timestamp,
        expiry: expiry,
        signature: signature,
        nonce: nonce
      };

      // Generate QR code using hosted service
      const qrDataString = JSON.stringify(qrData);
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrDataString)}`;

      console.log(`🔍 Generated dynamic QR for ticket ${ticketId}`);
      return { qrCode: qrCodeUrl, qrData };
    } catch (error) {
      console.error('❌ Error generating dynamic QR:', error);
      throw error;
    }
  }

  async updateAllQRCodes() {
    if (this.isUpdating) {
      console.log('⚠️ QR update already in progress, skipping...');
      return;
    }

    this.isUpdating = true;
    try {
      console.log('🔄 Updating all QR codes...');
      
      // Fetch all completed tickets
      const UserTicket = require('../models/userModel');
      const tickets = await UserTicket.find({ paymentStatus: "completed" });
      console.log(`📊 Found ${tickets.length} completed tickets to update`);

      for (const ticket of tickets) {
        try {
          // Generate new QR code
          const { qrCode, qrData } = await this.generateDynamicQR(ticket._id.toString());

          // Update or create QR code record
          await QRCodeModel.findOneAndUpdate(
            { ticketId: ticket._id.toString() },
            {
              ticketId: ticket._id.toString(),
              qrCode: qrCode,
              qrData: qrData,
              lastUpdated: new Date()
            },
            { upsert: true, new: true }
          );

          console.log(`✅ Updated QR for ticket ${ticket._id}`);
        } catch (error) {
          console.error(`❌ Error updating QR for ticket ${ticket._id}:`, error);
        }
      }

      // Broadcast updates to connected clients
      this.broadcastQRUpdate();
      console.log('✅ All QR codes updated successfully');
    } catch (error) {
      console.error('❌ Error updating QR codes:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  async getQRCode(ticketId) {
    try {
      // First try to get from QRCode collection
      let qrRecord = await QRCodeModel.findOne({ ticketId: ticketId });
      
      if (!qrRecord) {
        // If not found, generate new QR code
        const { qrCode, qrData } = await this.generateDynamicQR(ticketId);
        
        // Save to QRCode collection
        qrRecord = await QRCodeModel.create({
          ticketId: ticketId,
          qrCode: qrCode,
          qrData: qrData,
          lastUpdated: new Date()
        });
      }
      
      return qrRecord;
    } catch (error) {
      console.error('❌ Error getting QR code:', error);
      throw error;
    }
  }

  stopQRUpdates() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
      console.log('⏹️ QR updates stopped');
    }
  }

  addConnection(connection) {
    this.connections.add(connection);
    console.log(`🔗 Client connected. Total connections: ${this.connections.size}`);
  }

  removeConnection(connection) {
    this.connections.delete(connection);
    console.log(`🔌 Client disconnected. Total connections: ${this.connections.size}`);
  }

  broadcastQRUpdate() {
    const message = JSON.stringify({ type: 'qr_update', timestamp: Date.now() });
    this.connections.forEach(connection => {
      if (connection.readyState === 1) { // WebSocket.OPEN
        connection.send(message);
      }
    });
  }

  async getScanHistory(ticketId) {
    try {
      const qrRecord = await QRCodeModel.findOne({ ticketId: ticketId });
      return qrRecord ? qrRecord.scanHistory || [] : [];
    } catch (error) {
      console.error('❌ Error getting scan history:', error);
      return [];
    }
  }
}

module.exports = new QRManager(); 