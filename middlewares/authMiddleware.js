const express = require("express");
const router = express.Router();
const User = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secret = "secret";

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