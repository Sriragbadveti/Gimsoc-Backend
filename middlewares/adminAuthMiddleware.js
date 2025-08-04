const jwt = require("jsonwebtoken");
const Admin = require("../models/adminModel.js");
const secret = process.env.JWT_SECRET || "your-secret-key";

// Admin authentication middleware
const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Check for token in cookies first, then in Authorization header
    let token = req.cookies.adminToken;
    // Silent auth - only log on errors

    if (!token && req.headers.authorization) {
      // Extract token from Authorization header (Bearer token)
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
        // Silent token extraction
      }
    }

    if (!token) {
      console.log("❌ No admin token found in cookies or Authorization header");
      return res.status(401).json({ message: "Admin access token not found" });
    }

    // Silent token verification
    const decoded = jwt.verify(token, secret);
    
    // Find the admin directly in Admin model
    const admin = await Admin.findById(decoded.adminId);
    // Silent admin lookup

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

    // Silent successful auth - only log on errors

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