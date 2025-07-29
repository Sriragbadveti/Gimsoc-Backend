const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./models/adminModel");

// Admin users to create
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

async function createAdminUsers() {
  try {
    console.log("🔧 Creating admin users...");
    console.log("📧 Authorized emails:");
    adminUsers.forEach(admin => {
      console.log(`- ${admin.email} (${admin.role})`);
    });
    console.log("🔑 Default password for all admins: medcon25@admin");
    console.log("\n💡 To add these admins to your database, you can:");
    console.log("1. Use MongoDB Compass to manually add them");
    console.log("2. Use the MongoDB shell to add them");
    console.log("3. Create an API endpoint to add them");
    console.log("\n📋 Admin data to add:");
    
    for (const adminData of adminUsers) {
      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 12);
      
      console.log(`\n📝 Admin: ${adminData.email}`);
      console.log(`Role: ${adminData.role}`);
      console.log(`Hashed Password: ${hashedPassword}`);
      console.log(`Active: true`);
    }
    
    console.log("\n🎯 Next steps:");
    console.log("1. Connect to your MongoDB database");
    console.log("2. Create a collection named 'admins'");
    console.log("3. Add the above admin documents to the collection");
    console.log("4. Test login at /admin-login with any of the emails");
    
  } catch (error) {
    console.error("❌ Error creating admin users:", error);
  }
}

createAdminUsers(); 