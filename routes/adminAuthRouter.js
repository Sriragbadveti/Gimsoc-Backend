const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');
const { adminAuthMiddleware } = require('../middlewares/adminAuthMiddleware');

const router = express.Router();

// Admin Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Admin login attempt for:", email);

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Find admin by email
    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin) {
      console.log("❌ Admin not found:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Check if admin is active
    if (!admin.isActive) {
      console.log("❌ Admin account inactive:", email);
      return res.status(401).json({ message: "Account is deactivated" });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      console.log("❌ Invalid password for admin:", email);
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate JWT token
    const token = jwt.sign(
      { 
        adminId: admin._id, 
        email: admin.email,
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    // Set HTTP-only cookie
    res.cookie('adminToken', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });

    console.log("✅ Admin login successful:", admin.email, "Role:", admin.role);

    res.status(200).json({
      message: "Admin login successful",
      admin: {
        id: admin._id,
        email: admin.email,
        role: admin.role
      }
    });

  } catch (error) {
    console.error("❌ Admin login error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Admin Logout
router.post('/logout', (req, res) => {
  try {
    console.log("🔐 Admin logout request");
    
    // Clear admin token cookie
    res.clearCookie('adminToken');
    
    console.log("✅ Admin logout successful");
    res.status(200).json({ message: "Admin logout successful" });
  } catch (error) {
    console.error("❌ Admin logout error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Check admin authentication status
router.get('/check-auth', adminAuthMiddleware, (req, res) => {
  try {
    console.log("✅ Admin authentication check successful:", req.admin.email);
    res.status(200).json({
      message: "Admin authenticated",
      admin: {
        id: req.admin.id,
        email: req.admin.email,
        role: req.admin.role
      }
    });
  } catch (error) {
    console.error("❌ Admin auth check error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Get admin profile
router.get('/profile', adminAuthMiddleware, async (req, res) => {
  try {
    const admin = await Admin.findById(req.admin.id).select('-password');
    
    if (!admin) {
      return res.status(404).json({ message: "Admin not found" });
    }

    console.log("✅ Admin profile fetched:", admin.email);
    res.status(200).json({ admin });
  } catch (error) {
    console.error("❌ Get admin profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = router; 