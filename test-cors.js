const axios = require('axios');

async function testCORS() {
  try {
    console.log('🧪 Testing CORS configuration...');
    
    // Test the CORS endpoint
    const response = await axios.get('https://gimsoc-backend.onrender.com/api/test-cors', {
      headers: {
        'Origin': 'https://www.medcongimsoc.com'
      }
    });
    
    console.log('✅ CORS test successful:', response.data);
  } catch (error) {
    console.error('❌ CORS test failed:', error.response?.data || error.message);
  }
}

testCORS(); 