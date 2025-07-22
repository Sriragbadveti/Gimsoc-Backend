// Test QR code generation
const QRManager = require('./utils/qrManager');

async function testQRGeneration() {
  try {
    console.log('🧪 Testing QR code generation...');
    
    const qrManager = new QRManager();
    const testTicketId = 'test123456789';
    
    console.log('📋 Test Ticket ID:', testTicketId);
    
    // Test dynamic QR generation
    const { qrCode, qrData } = await qrManager.generateDynamicQR(testTicketId);
    
    console.log('✅ QR Code generated successfully!');
    console.log('🔗 QR Code URL:', qrCode);
    console.log('📊 QR Data:', JSON.stringify(qrData, null, 2));
    
    // Test if QR code URL is accessible
    const response = await fetch(qrCode);
    if (response.ok) {
      console.log('✅ QR Code image is accessible!');
    } else {
      console.log('❌ QR Code image is not accessible');
    }
    
  } catch (error) {
    console.error('❌ Error testing QR generation:', error);
  }
}

testQRGeneration(); 