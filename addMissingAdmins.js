const axios = require('axios');

// Admin users to add
const adminUsers = [
  {
    email: "medconconferencegimsoc@gmail.com",
    password: "medcon25@admin",
    role: "super_admin"
  },
  {
    email: "gunchashaikh11@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "muhamadbarakat20@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "nupuraajesh@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "saja.mohamed.1@iliauni.edu.ge",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "nikhilalizaby@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "mennah.emam@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  },
  {
    email: "mandrika311@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  }
];

async function addMissingAdmins() {
  try {
    console.log("🔧 Adding missing admin users...");
    console.log("📧 Authorized emails to add:");
    adminUsers.forEach(admin => {
      console.log(`- ${admin.email} (${admin.role})`);
    });
    
    console.log("\n💡 Since your server might not be running, here are the manual steps:");
    console.log("\n📋 Method 1: Using MongoDB Compass");
    console.log("1. Open MongoDB Compass");
    console.log("2. Connect to your database: mongodb+srv://srirag:1234@gimsoc.ur5fjtj.mongodb.net/gimsoc");
    console.log("3. Navigate to the 'admins' collection");
    console.log("4. Add the following documents:");
    
    // Generate the documents to add
    const bcrypt = require('bcryptjs');
    
    for (const adminData of adminUsers) {
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      console.log(`\n📝 Document for ${adminData.email}:`);
      console.log(`{`);
      console.log(`  "email": "${adminData.email}",`);
      console.log(`  "password": "${hashedPassword}",`);
      console.log(`  "role": "${adminData.role}",`);
      console.log(`  "isActive": true,`);
      console.log(`  "createdAt": new Date()`);
      console.log(`}`);
    }
    
    console.log("\n📋 Method 2: Using MongoDB Shell");
    console.log("1. Connect to your MongoDB database");
    console.log("2. Run this command:");
    console.log("use gimsoc");
    console.log("db.admins.insertMany([");
    
    for (let i = 0; i < adminUsers.length; i++) {
      const adminData = adminUsers[i];
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      console.log(`  {`);
      console.log(`    email: "${adminData.email}",`);
      console.log(`    password: "${hashedPassword}",`);
      console.log(`    role: "${adminData.role}",`);
      console.log(`    isActive: true,`);
      console.log(`    createdAt: new Date()`);
      console.log(`  }${i < adminUsers.length - 1 ? ',' : ''}`);
    }
    
    console.log("])");
    
    console.log("\n🎯 After adding the admins:");
    console.log("1. Test login at /admin-login on your website");
    console.log("2. Use any of the emails with password: medcon25@admin");
    console.log("3. You should be redirected to the admin dashboard");
    
  } catch (error) {
    console.error("❌ Error generating admin data:", error);
  }
}

addMissingAdmins(); 