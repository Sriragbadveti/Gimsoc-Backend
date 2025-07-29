const { sendTicketConfirmationEmail } = require('./utils/emailService');

async function testTSUEmail() {
  console.log('🧪 Testing TSU ticket email service...');
  
  try {
    const testData = {
      fullName: 'Test TSU Student',
      email: 'test@example.com', // Replace with your email for testing
      ticketType: 'Standard+2',
      ticketCategory: 'Standard',
      ticketId: 'test-tsu-123'
    };
    
    console.log('📧 Sending test email with data:', testData);
    
    const result = await sendTicketConfirmationEmail(testData);
    
    if (result.success) {
      console.log('✅ TSU email test successful!');
      console.log('📧 Email sent to:', testData.email);
    } else {
      console.log('❌ TSU email test failed:');
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ TSU email test error:', error);
  }
}

testTSUEmail(); 