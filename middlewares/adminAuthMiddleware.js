const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel.js");
const secret = process.env.JWT_SECRET || "your-secret-key";

// Admin authentication middleware
const adminAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.adminToken;
    console.log("🔍 Admin auth middleware - Token:", token ? "Present" : "Missing");
    console.log("🔍 All cookies:", req.cookies);

    if (!token) {
      console.log("❌ No admin token found in cookies");
      return res.status(401).json({ message: "Admin access token not found" });
    }

    console.log("🔍 Attempting to verify admin token with secret:", secret);
    const decoded = jwt.verify(token, secret);
    console.log("🔍 Decoded admin token:", decoded);
    
    // Find the admin directly in Admin model
    const admin = await Admin.findById(decoded.adminId);
    console.log("🔍 Admin found:", admin ? "Yes" : "No");

    if (!admin) {
      console.log("❌ No admin found with ID:", decoded.adminId);
      return res.status(401).json({ message: "Invalid admin token" });
    }

    // Check if admin is active
    if (!admin.isActive) {
      console.log("❌ Admin account is inactive:", admin.email);
      return res.status(403).json({ 
        message: "Your admin account is inactive. Please contact the administrator." 
      });
    }

    console.log("✅ Admin auth successful for user:", admin.email);

    req.admin = {
      id: admin._id,
      email: admin.email,
      role: admin.role,
    };

    next();
  } catch (error) {
    console.error("❌ Admin auth middleware error:", error);
    res.status(401).json({ message: "Invalid admin token" });
  }
};

module.exports = { adminAuthMiddleware }; 