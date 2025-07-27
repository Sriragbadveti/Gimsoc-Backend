require("dotenv").config();
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const Admin = require("./models/adminModel");

// Connect to MongoDB
mongoose.connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc", {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ Connected to MongoDB"))
.catch(err => console.error("❌ MongoDB connection error:", err));

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

async function setupAdmins() {
  try {
    console.log("🔧 Setting up admin users...");

    for (const adminData of adminUsers) {
      // Check if admin already exists
      const existingAdmin = await Admin.findOne({ email: adminData.email });
      
      if (existingAdmin) {
        console.log(`⚠️  Admin already exists: ${adminData.email}`);
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(adminData.password, 12);

      // Create admin user
      const admin = new Admin({
        email: adminData.email,
        password: hashedPassword,
        role: adminData.role,
        isActive: true
      });

      await admin.save();
      console.log(`✅ Created admin: ${adminData.email} (${adminData.role})`);
    }

    console.log("🎉 Admin setup completed!");
    
    // List all admins
    const allAdmins = await Admin.find({}, { email: 1, role: 1, isActive: 1 });
    console.log("\n📋 Current admin users:");
    allAdmins.forEach(admin => {
      console.log(`- ${admin.email} (${admin.role}) - ${admin.isActive ? 'Active' : 'Inactive'}`);
    });

  } catch (error) {
    console.error("❌ Error setting up admins:", error);
  } finally {
    mongoose.connection.close();
  }
}

setupAdmins(); 