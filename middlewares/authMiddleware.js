const express = require("express");
const router = express.Router();
const User = require("../models/userModel.js");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const secret = "secret";

module.exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(400).send({ message: "Token not received" });
    }

    const decoded = jwt.verify(token, secret);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(400).send({ message: "User not found with this token" });
    }

    req.user = {
      id: user._id,
      email: user.email, // ✅ add this
    };

    next();
  } catch (error) {
    res.status(500).send({ message: "Internal server error" });
  }
};