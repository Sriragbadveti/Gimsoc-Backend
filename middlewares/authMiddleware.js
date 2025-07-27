const express = require("express");
const router = express.Router();
const User = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secret = process.env.JWT_SECRET || "your-secret-key";

module.exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;
    console.log("🔍 Auth middleware - Token:", token ? "Present" : "Missing");

    if (!token) {
      console.log("❌ No token found in cookies");
      return res.status(400).send({ message: "Token not received" });
    }

    const decoded = jwt.verify(token, secret);
    console.log("🔍 Decoded token ID:", decoded.id);
    
    // First, get the user from LoginActivity to get their email
    const LoginActivity = require("../models/loginActivityModel.js");
    const loginUser = await LoginActivity.findById(decoded.id);
    console.log("🔍 LoginActivity user found:", loginUser ? "Yes" : "No");

    if (!loginUser) {
      console.log("❌ No user found in LoginActivity with ID:", decoded.id);
      return res.status(400).send({ message: "User not found with this token" });
    }

    console.log("🔍 LoginActivity user email:", loginUser.email);

    // Then, find the corresponding user in UserTicket model by email
    const user = await User.findOne({ email: loginUser.email });
    console.log("🔍 UserTicket user found:", user ? "Yes" : "No");

    if (!user) {
      console.log("❌ No ticket found for email:", loginUser.email);
      return res.status(400).send({ message: "No ticket found for this user" });
    }

    console.log("✅ Auth successful for user:", user.email);

    req.user = {
      id: user._id,
      email: user.email,
    };

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(500).send({ message: "Internal server error" });
  }
};

// Dashboard authentication middleware
module.exports.dashboardAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.dashboardToken;
    console.log("🔍 Dashboard auth middleware - Token:", token ? "Present" : "Missing");
    console.log("🔍 All cookies:", req.cookies);

    if (!token) {
      console.log("❌ No dashboard token found in cookies");
      return res.status(401).json({ message: "Dashboard access token not found" });
    }

    console.log("🔍 Attempting to verify token with secret:", secret);
    const decoded = jwt.verify(token, secret);
    console.log("🔍 Decoded dashboard token:", decoded);
    
    // Find the user directly in UserTicket model
    const user = await User.findById(decoded.userId);
    console.log("🔍 Dashboard user found:", user ? "Yes" : "No");

    if (!user) {
      console.log("❌ No user found with ID:", decoded.userId);
      return res.status(401).json({ message: "Invalid dashboard token" });
    }

    // Check if ticket is approved by checking payment status
    if (user.paymentStatus !== "completed") {
      console.log("❌ Ticket not approved for user:", user.email, "Status:", user.paymentStatus);
      return res.status(403).json({ 
        message: "Your ticket is not yet approved. Please wait for approval email." 
      });
    }

    console.log("✅ Dashboard auth successful for user:", user.email);

    req.user = {
      id: user._id,
      email: user.email,
      fullName: user.fullName,
      ticketType: user.ticketType,
      ticketCategory: user.ticketCategory,
    };

    next();
  } catch (error) {
    console.error("❌ Dashboard auth middleware error:", error);
    res.status(401).json({ message: "Invalid dashboard token" });
  }
};