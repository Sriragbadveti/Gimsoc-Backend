const axios = require('axios');

async function setupAdmins() {
  try {
    console.log("🚀 Calling admin setup API...");
    
    const response = await axios.post(
      'https://gimsoc-backend.onrender.com/api/admin-auth/setup-admins',
      {},
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    console.log("✅ API Response:", response.data);
    
    if (response.data.totalCreated > 0) {
      console.log(`🎉 Successfully created ${response.data.totalCreated} admin users!`);
      console.log("Created admins:", response.data.created);
    }
    
    if (response.data.totalExisting > 0) {
      console.log(`⚠️  ${response.data.totalExisting} admin users already existed`);
      console.log("Existing admins:", response.data.existing);
    }

  } catch (error) {
    console.error("❌ Error calling setup API:", error.response?.data || error.message);
  }
}

setupAdmins(); 