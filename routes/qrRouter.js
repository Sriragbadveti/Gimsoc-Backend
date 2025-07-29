const express = require('express');
const router = express.Router();
const QRCodeModel = require('../models/qrCodeModel');
const UserTicket = require('../models/userModel');
const qrManager = require('../utils/qrManager');

// Route to get QR code for a specific ticket
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    console.log('🔍 QR Router: Getting QR code for ticket:', ticketId);
    
    const qrCode = await qrManager.getQRCode(ticketId);
    
    if (!qrCode) {
      return res.status(404).json({ message: 'QR code not found' });
    }
    
    console.log('✅ QR Router: QR code found and returned');
    res.json(qrCode);
  } catch (error) {
    console.error('❌ QR Router: Error getting QR code:', error);
    res.status(500).json({ message: 'Error getting QR code' });
  }
});

// Route to update all QR codes
router.post('/update-all', async (req, res) => {
  try {
    console.log('🔄 QR Router: Updating all QR codes...');
    await qrManager.updateAllQRCodes();
    res.json({ message: 'All QR codes updated successfully' });
  } catch (error) {
    console.error('❌ QR Router: Error updating QR codes:', error);
    res.status(500).json({ message: 'Error updating QR codes' });
  }
});

// Route to get scan history for a ticket
router.get('/scan-history/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const scanHistory = await qrManager.getScanHistory(ticketId);
    res.json(scanHistory);
  } catch (error) {
    console.error('❌ QR Router: Error getting scan history:', error);
    res.status(500).json({ message: 'Error getting scan history' });
  }
});

module.exports = router; 