const express = require('express');
const app = express();

// Test basic Express setup
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`✅ Test server running on port ${PORT}`);
});

// Test QR router import
try {
  const { router: qrRouter } = require('./routes/qrRouter.js');
  console.log('✅ QR router imported successfully');
} catch (error) {
  console.error('❌ QR router import failed:', error.message);
}

// Test QR manager import
try {
  const QRManager = require('./utils/qrManager.js');
  console.log('✅ QR manager imported successfully');
} catch (error) {
  console.error('❌ QR manager import failed:', error.message);
} 