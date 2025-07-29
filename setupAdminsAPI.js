const axios = require('axios');

async function setupAdminsViaAPI() {
  try {
    console.log("🔧 Setting up admin users via API...");
    
    // Call the setup-admins endpoint
    const response = await axios.post('https://gimsoc-backend.onrender.com/api/admin-auth/setup-admins', {}, {
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data.success) {
      console.log("✅ Admin setup successful!");
      console.log(`📊 Created: ${response.data.created} admins`);
      console.log(`📊 Skipped: ${response.data.skipped} admins (already existed)`);
      console.log(`📊 Total: ${response.data.total} admins in database`);
      
      console.log("\n📋 Admin users:");
      response.data.admins.forEach(admin => {
        console.log(`- ${admin.email} (${admin.role}) - ${admin.isActive ? 'Active' : 'Inactive'}`);
      });
      
      console.log("\n🎉 Setup completed! You can now:");
      console.log("1. Go to /admin-login on your website");
      console.log("2. Login with any of the admin emails");
      console.log("3. Use password: medcon25@admin");
      
    } else {
      console.log("❌ Admin setup failed:", response.data.message);
    }
    
  } catch (error) {
    console.error("❌ Error setting up admins via API:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

setupAdminsViaAPI(); 