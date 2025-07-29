const express = require('express');
const WebSocket = require('ws');
const QRManager = require('../utils/qrManager');
const { RateLimiterMemory } = require('rate-limiter-flexible');

const router = express.Router();

// Initialize QR Manager
const qrManager = new QRManager();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ 
    message: 'QR router is working!', 
    timestamp: new Date().toISOString(),
    features: ['dynamic_qr', 'websocket', 'validation', 'rate_limiting']
  });
});

// Test QR generation endpoint
router.get('/test/generate/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { qrCode, qrData } = await qrManager.generateDynamicQR(ticketId);
    
    res.json({
      ticketId,
      qrCode,
      qrData,
      qrDataString: JSON.stringify(qrData),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Error generating test QR:', error);
    res.status(500).json({ error: 'Failed to generate test QR' });
  }
});

// Rate limiter for QR validation
const rateLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 10, // Number of requests
  duration: 60, // Per 60 seconds
});

// Rate limiting middleware
const rateLimitMiddleware = async (req, res, next) => {
  try {
    await rateLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    res.status(429).json({
      error: 'Too many requests',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
};

// Validate QR code
router.post('/validate', rateLimitMiddleware, async (req, res) => {
  try {
    const { qrData } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    if (!qrData) {
      return res.status(400).json({
        valid: false,
        reason: 'missing_data',
        message: 'QR data is required'
      });
    }

    // Parse QR data
    let scannedData;
    try {
      scannedData = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({
        valid: false,
        reason: 'invalid_format',
        message: 'Invalid QR code format'
      });
    }

    // Validate QR code
    const result = await qrManager.validateQRCode(scannedData, ipAddress, userAgent);
    
    console.log(`🔍 QR validation result for ticket ${scannedData.ticketId}:`, result.valid ? '✅ Valid' : '❌ Invalid');
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in QR validation:', error);
    res.status(500).json({
      valid: false,
      reason: 'server_error',
      message: 'Server error during validation'
    });
  }
});

// Test QR validation endpoint (without rate limiting)
router.post('/test/validate', async (req, res) => {
  try {
    const { qrData } = req.body;
    const ipAddress = req.ip;
    const userAgent = req.get('User-Agent');

    console.log('🧪 Test QR validation request:', { qrData, ipAddress, userAgent });

    if (!qrData) {
      return res.status(400).json({
        valid: false,
        reason: 'missing_data',
        message: 'QR data is required'
      });
    }

    // Parse QR data
    let scannedData;
    try {
      scannedData = JSON.parse(qrData);
    } catch (error) {
      return res.status(400).json({
        valid: false,
        reason: 'invalid_format',
        message: 'Invalid QR code format'
      });
    }

    console.log('🧪 Parsed QR data:', scannedData);

    // Validate QR code
    const result = await qrManager.validateQRCode(scannedData, ipAddress, userAgent);
    
    console.log(`🧪 Test QR validation result for ticket ${scannedData.ticketId}:`, result);
    
    res.json(result);
  } catch (error) {
    console.error('❌ Error in test QR validation:', error);
    res.status(500).json({
      valid: false,
      reason: 'server_error',
      message: 'Server error during validation'
    });
  }
});

// Get QR code for a ticket
router.get('/ticket/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const qrRecord = await qrManager.getQRCode(ticketId);
    
    if (!qrRecord) {
      return res.status(404).json({
        error: 'Ticket not found'
      });
    }
    
    res.json({
      ticketId: qrRecord.ticketId,
      qrCode: qrRecord.currentQR,
      qrData: qrRecord.qrData,
      lastUpdate: qrRecord.lastQRUpdate,
      updateCount: qrRecord.qrUpdateCount,
      isActive: qrRecord.isActive
    });
  } catch (error) {
    console.error('❌ Error getting QR code:', error);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// Get scan history for a ticket
router.get('/ticket/:ticketId/history', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const scanHistory = await qrManager.getScanHistory(ticketId);
    
    res.json({
      ticketId,
      scanHistory: scanHistory.map(scan => ({
        scannedAt: scan.scannedAt,
        ipAddress: scan.ipAddress,
        userAgent: scan.userAgent,
        isValid: scan.isValid,
        reason: scan.reason
      }))
    });
  } catch (error) {
    console.error('❌ Error getting scan history:', error);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// Admin: Get all QR codes
router.get('/admin/all', async (req, res) => {
  try {
    const { QRCode } = require('../models/qrCodeModel');
    const qrCodes = await QRCode.find({}).populate('ticketId');
    
    res.json({
      total: qrCodes.length,
      qrCodes: qrCodes.map(qr => ({
        id: qr._id,
        ticketId: qr.ticketId,
        lastUpdate: qr.lastQRUpdate,
        updateCount: qr.qrUpdateCount,
        isActive: qr.isActive,
        scanCount: qr.scanHistory ? qr.scanHistory.length : 0
      }))
    });
  } catch (error) {
    console.error('❌ Error getting all QR codes:', error);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// Admin: Force QR update for a ticket
router.post('/admin/update/:ticketId', async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const { qrCode, qrData } = await qrManager.generateDynamicQR(ticketId);
    
    // Update database
    const { QRCode } = require('../models/qrCodeModel');
    await QRCode.findOneAndUpdate(
      { ticketId },
      {
        currentQR: qrCode,
        qrData: qrData,
        lastQRUpdate: Date.now(),
        $inc: { qrUpdateCount: 1 }
      },
      { upsert: true }
    );
    
    // Broadcast to connected clients
    qrManager.broadcastQRUpdate(ticketId, qrCode, qrData);
    
    res.json({
      success: true,
      message: 'QR code updated successfully',
      ticketId,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('❌ Error forcing QR update:', error);
    res.status(500).json({
      error: 'Server error'
    });
  }
});

// WebSocket server setup
const setupWebSocket = (server) => {
  const wss = new WebSocket.Server({ 
    server,
    path: '/ws/qr'
  });

  wss.on('connection', (ws, req) => {
    console.log('🔗 New WebSocket connection');
    
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message);
        
        if (data.type === 'subscribe' && data.ticketId) {
          // Subscribe to QR updates for this ticket
          qrManager.addConnection(data.ticketId, ws);
          ws.ticketId = data.ticketId;
          
          // Send current QR code immediately
          qrManager.getQRCode(data.ticketId).then(qrRecord => {
            if (qrRecord) {
              ws.send(JSON.stringify({
                type: 'qr_update',
                qrCode: qrRecord.currentQR,
                qrData: qrRecord.qrData,
                timestamp: Date.now()
              }));
            }
          });
          
          console.log(`📡 Client subscribed to ticket ${data.ticketId}`);
        }
      } catch (error) {
        console.error('❌ WebSocket message error:', error);
      }
    });
    
    ws.on('close', () => {
      if (ws.ticketId) {
        qrManager.removeConnection(ws.ticketId, ws);
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error);
    });
  });
  
  console.log('🔌 WebSocket server started on /ws/qr');
  return wss;
};

module.exports = { router, setupWebSocket, qrManager }; 