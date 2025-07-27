const axios = require('axios');

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
  },
  {
    email: "Badvetisrirag@gmail.com",
    password: "medcon25@admin",
    role: "admin"
  }
];

async function createAdmins() {
  console.log("🔧 Creating admin users via API...");
  
  for (const adminData of adminUsers) {
    try {
      console.log(`Creating admin: ${adminData.email}`);
      
      // This would require an API endpoint to create admins
      // For now, we'll just log the admin data
      console.log(`✅ Admin data ready: ${adminData.email} (${adminData.role})`);
      
    } catch (error) {
      console.error(`❌ Error creating admin ${adminData.email}:`, error.message);
    }
  }
  
  console.log("\n📋 Admin users to be created:");
  adminUsers.forEach(admin => {
    console.log(`- ${admin.email} (${admin.role}) - Password: ${admin.password}`);
  });
  
  console.log("\n💡 To create these admins, you can:");
  console.log("1. Add them directly to your MongoDB database");
  console.log("2. Create an admin creation API endpoint");
  console.log("3. Use MongoDB Compass or similar tool to add them manually");
}

createAdmins(); 