const QRCode = require('qrcode');

async function testQRCode() {
  try {
    const testData = {
      ticketId: "test123",
      fullName: "Test User",
      email: "test@example.com",
      ticketType: "Standard+2",
      ticketCategory: "Standard",
      timestamp: new Date().toISOString()
    };
    
    const qrData = JSON.stringify(testData);
    console.log('📋 Test QR Data:', qrData);
    
    const qrCodeBase64 = await QRCode.toDataURL(qrData, {
      type: 'image/png',
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 200,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });
    
    console.log('✅ QR Code generated successfully!');
    console.log('📏 Length:', qrCodeBase64.length);
    console.log('🔗 Starts with:', qrCodeBase64.substring(0, 50));
    console.log('📧 Full data URL:', qrCodeBase64);
    
  } catch (error) {
    console.error('❌ QR Code generation failed:', error);
  }
}

testQRCode(); 