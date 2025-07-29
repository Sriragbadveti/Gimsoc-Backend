const express = require("express");
const router = express.Router();
const Admin = require("../models/adminModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-secret-key";

// Admin login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Admin login attempt:", { email, hasPassword: !!password });

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Find admin by email (case-insensitive)
    const admin = await Admin.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!admin) {
      console.log("❌ Admin not found:", email);
      return res.status(401).json({ 
        message: "Invalid email or password" 
      });
    }

    // Check if admin is active
    if (!admin.isActive) {
      console.log("❌ Admin account is inactive:", email);
      return res.status(403).json({ 
        message: "Your admin account is inactive. Please contact the administrator." 
      });
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      console.log("❌ Admin password mismatch for user:", email);
      return res.status(401).json({ 
        message: "Invalid email or password" 
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Create JWT token for admin access
    const token = jwt.sign(
      { 
        adminId: admin._id, 
        email: admin.email,
        role: admin.role
      },
      secret,
      { expiresIn: "24h" }
    );

    // Set JWT token as HTTP-only cookie
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log("✅ Admin login successful for user:", email);
    console.log("🍪 Admin cookie set with token length:", token.length);

    res.json({
      message: "Admin login successful",
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      },
    });

  } catch (error) {
    console.error("❌ Admin login error:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
});

// Check admin authentication status
router.get("/check-auth", async (req, res) => {
  try {
    console.log("🔍 Admin auth check request received");
    console.log("🔍 Request cookies:", req.cookies);

    const token = req.cookies.adminToken;
    if (!token) {
      console.log("❌ No admin token found in cookies");
      return res.status(401).json({ authenticated: false, message: "No admin token found" });
    }

    console.log("🔍 Admin token found, attempting to verify...");
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
      console.log("🔍 Admin token verified successfully, adminId:", decoded.adminId);
    } catch (err) {
      console.log("❌ Admin token verification failed:", err.message);
      return res.status(401).json({ authenticated: false, message: "Invalid admin token" });
    }

    // Find the admin by decoded adminId
    console.log("🔍 Looking for admin with ID:", decoded.adminId);
    const admin = await Admin.findById(decoded.adminId).lean();
    if (!admin) {
      console.log("❌ Admin not found in database with ID:", decoded.adminId);
      return res.status(401).json({ authenticated: false, message: "Admin not found" });
    }

    // Check if admin is active
    if (!admin.isActive) {
      console.log("❌ Admin account is inactive:", admin.email);
      return res.status(403).json({ 
        authenticated: false, 
        message: "Your admin account is inactive. Please contact the administrator." 
      });
    }

    console.log("✅ Admin auth successful:", { email: admin.email, role: admin.role });

    res.json({ 
      authenticated: true, 
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role,
      }
    });
  } catch (error) {
    console.error("❌ Admin auth check error:", error);
    res.status(500).json({ authenticated: false, message: "Internal server error" });
  }
});

// Admin logout route
router.post("/logout", async (req, res) => {
  try {
    console.log("🚪 Admin logout request received");
    
    // Clear the admin token cookie
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    console.log("✅ Admin logout successful");
    res.json({ message: "Admin logout successful" });
  } catch (error) {
    console.error("❌ Admin logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Check existing admins endpoint
router.get("/check-admins", async (req, res) => {
  try {
    console.log("🔍 Checking existing admins...");
    
    const admins = await Admin.find({}).lean();
    
    console.log(`📊 Found ${admins.length} admin(s) in the collection`);
    
    const targetEmails = [
      "medconconferencegimsoc@gmail.com",
      "gunchashaikh11@gmail.com",
      "muhamadbarakat20@gmail.com",
      "nupuraajesh@gmail.com",
      "saja.mohamed.1@iliauni.edu.ge",
      "nikhilalizaby@gmail.com",
      "mennah.emam@gmail.com",
      "mandrika311@gmail.com"
    ];
    
    const existingEmails = admins.map(admin => admin.email.toLowerCase());
    const missingEmails = targetEmails.filter(email => 
      !existingEmails.includes(email.toLowerCase())
    );
    
    res.json({
      success: true,
      totalAdmins: admins.length,
      existingAdmins: admins,
      targetEmails: targetEmails,
      missingEmails: missingEmails,
      allTargetEmailsPresent: missingEmails.length === 0
    });
    
  } catch (error) {
    console.error("❌ Error checking admins:", error);
    res.status(500).json({ 
      success: false,
      message: "Error checking admins: " + error.message 
    });
  }
});

// Setup admin users endpoint (for initial setup)
router.post("/setup-admins", async (req, res) => {
  try {
    console.log("🔧 Setting up admin users via API...");
    
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

    let createdCount = 0;
    let skippedCount = 0;

    for (const adminData of adminUsers) {
      try {
        // Check if admin already exists (case-insensitive)
        const existingAdmin = await Admin.findOne({ 
          email: { $regex: new RegExp(`^${adminData.email}$`, 'i') }
        });
        
        if (existingAdmin) {
          console.log(`⚠️  Admin already exists: ${adminData.email}`);
          skippedCount++;
          continue;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(adminData.password, 12);

        // Create admin user
        const admin = new Admin({
          email: adminData.email.toLowerCase().trim(),
          password: hashedPassword,
          role: adminData.role,
          isActive: true
        });

        await admin.save();
        console.log(`✅ Created admin: ${adminData.email} (${adminData.role})`);
        createdCount++;
      } catch (error) {
        console.error(`❌ Error creating admin ${adminData.email}:`, error.message);
      }
    }

    console.log(`🎉 Admin setup completed! Created: ${createdCount}, Skipped: ${skippedCount}`);
    
    // List all admins
    const allAdmins = await Admin.find({}, { email: 1, role: 1, isActive: 1 });
    console.log("\n📋 Current admin users:");
    allAdmins.forEach(admin => {
      console.log(`- ${admin.email} (${admin.role}) - ${admin.isActive ? 'Active' : 'Inactive'}`);
    });

    res.json({
      success: true,
      message: `Admin setup completed! Created: ${createdCount}, Skipped: ${skippedCount}`,
      created: createdCount,
      skipped: skippedCount,
      total: allAdmins.length,
      admins: allAdmins
    });

  } catch (error) {
    console.error("❌ Error setting up admins:", error);
    res.status(500).json({ 
      success: false,
      message: "Error setting up admins: " + error.message 
    });
  }
});

module.exports = router; 