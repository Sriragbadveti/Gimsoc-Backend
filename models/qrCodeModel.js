const mongoose = require('mongoose');

const usedQRSchema = new mongoose.Schema({
  nonce: { 
    type: String, 
    required: true, 
    unique: true 
  },
  ticketId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'UserTicket', 
    required: true 
  },
  scannedAt: { 
    type: Date, 
    default: Date.now 
  },
  ipAddress: String,
  userAgent: String,
  isValid: {
    type: Boolean,
    default: true
  },
  reason: String // For invalid scans
});

const qrCodeSchema = new mongoose.Schema({
  ticketId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'UserTicket',
    required: true
  },
  currentQR: String,
  qrData: {
    ticketId: String,
    timestamp: Number,
    expiry: Number,
    signature: String,
    nonce: String
  },
  lastQRUpdate: {
    type: Date,
    default: Date.now
  },
  qrUpdateCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  scanHistory: [{
    scannedAt: Date,
    ipAddress: String,
    userAgent: String,
    isValid: Boolean,
    reason: String
  }]
});

module.exports = {
  UsedQR: mongoose.model('UsedQR', usedQRSchema),
  QRCode: mongoose.model('QRCode', qrCodeSchema)
}; 