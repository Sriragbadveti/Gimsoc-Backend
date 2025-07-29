const axios = require('axios');

async function checkAdminsViaAPI() {
  try {
    console.log("🔍 Checking admins collection via API...");
    
    // Call the check-admins endpoint
    const response = await axios.get('https://gimsoc-backend.onrender.com/api/admin-auth/check-admins', {
      timeout: 30000 // 30 second timeout
    });
    
    if (response.data.success) {
      console.log("✅ Admin check successful!");
      console.log(`📊 Total admins in database: ${response.data.totalAdmins}`);
      
      if (response.data.existingAdmins.length > 0) {
        console.log("\n📋 Existing admins:");
        response.data.existingAdmins.forEach((admin, index) => {
          console.log(`${index + 1}. Email: ${admin.email}`);
          console.log(`   Role: ${admin.role || 'Not set'}`);
          console.log(`   Active: ${admin.isActive !== false ? 'Yes' : 'No'}`);
          console.log(`   Created: ${admin.createdAt || 'Not set'}`);
        });
      } else {
        console.log("❌ No admins found in the collection");
      }
      
      console.log("\n🎯 Target emails check:");
      response.data.targetEmails.forEach(email => {
        const exists = !response.data.missingEmails.includes(email);
        console.log(`${exists ? '✅' : '❌'} ${email} ${exists ? '(exists)' : '(missing)'}`);
      });
      
      if (response.data.missingEmails.length > 0) {
        console.log(`\n⚠️  Missing ${response.data.missingEmails.length} admin(s):`);
        response.data.missingEmails.forEach(email => console.log(`- ${email}`));
        
        console.log("\n💡 To add missing admins, you can:");
        console.log("1. Use the setup-admins API endpoint");
        console.log("2. Manually add them to your database");
        console.log("3. Use MongoDB Compass to add them");
      } else {
        console.log("\n✅ All target emails are present!");
        console.log("🎉 Your admin system is ready to use!");
      }
      
    } else {
      console.log("❌ Admin check failed:", response.data.message);
    }
    
  } catch (error) {
    console.error("❌ Error checking admins via API:", error.message);
    if (error.response) {
      console.error("Response data:", error.response.data);
    }
  }
}

checkAdminsViaAPI(); 