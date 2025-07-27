const jwt = require('jsonwebtoken');
const Admin = require('../models/adminModel');

const adminAuthMiddleware = async (req, res, next) => {
  try {
    // Get token from cookies
    const adminToken = req.cookies.adminToken;

    if (!adminToken) {
      console.log("❌ No admin token found in cookies");
      return res.status(401).json({ message: "No token found" });
    }

    // Verify token
    const decoded = jwt.verify(adminToken, process.env.JWT_SECRET);
    console.log("✅ Admin token verified for user:", decoded.email);

    // Find admin user
    const admin = await Admin.findById(decoded.adminId);
    if (!admin || !admin.isActive) {
      console.log("❌ Admin not found or inactive:", decoded.email);
      return res.status(401).json({ message: "Invalid token" });
    }

    // Add admin info to request
    req.admin = {
      id: admin._id,
      email: admin.email,
      role: admin.role
    };

    console.log("✅ Admin authenticated:", admin.email, "Role:", admin.role);
    next();
  } catch (error) {
    console.error("❌ Admin auth middleware error:", error);
    return res.status(401).json({ message: "Invalid token" });
  }
};

module.exports = { adminAuthMiddleware }; 