const express = require("express");
const UserTicket = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { dashboardAuthMiddleware } = require("../middlewares/authMiddleware");
const secret = process.env.JWT_SECRET || "your-secret-key";

const router = express.Router();

// Test endpoint to check cookies
router.get("/test-cookies", (req, res) => {
  console.log("🍪 Test cookies endpoint hit");
  console.log("🍪 All cookies:", req.cookies);
  console.log("🍪 Dashboard token:", req.cookies.dashboardToken ? "Present" : "Missing");
  res.json({ 
    message: "Cookie test", 
    hasDashboardToken: !!req.cookies.dashboardToken,
    allCookies: Object.keys(req.cookies)
  });
});

// Dashboard login route
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Dashboard login attempt:", { email, hasPassword: !!password });

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    // Find user by email
    const user = await UserTicket.findOne({ email });

    if (!user) {
      console.log("❌ User not found:", email);
      return res.status(401).json({ 
        message: "Invalid email or password" 
      });
    }

    // Check if dashboard password matches (stored as plain text as requested)
    if (user.dashboardPassword !== password) {
      console.log("❌ Dashboard password mismatch for user:", email);
      return res.status(401).json({ 
        message: "Invalid email or password" 
      });
    }

    // Check if ticket is approved by checking payment status
    if (user.paymentStatus !== "completed") {
      console.log("❌ Ticket not approved for user:", email, "Status:", user.paymentStatus);
      return res.status(403).json({ 
        message: "Your ticket is not yet approved. Please wait for approval email." 
      });
    }

    // Create JWT token for dashboard access
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        ticketType: user.ticketType,
        ticketCategory: user.ticketCategory
      },
      secret,
      { expiresIn: "24h" }
    );

    // Set JWT token as HTTP-only cookie
    res.cookie("dashboardToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      // Remove domain restriction for now to test
      // domain: process.env.NODE_ENV === "production" ? ".medcongimsoc.com" : undefined,
      path: "/",
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log("✅ Dashboard login successful for user:", email);
    console.log("🍪 Cookie set with token length:", token.length);

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        ticketType: user.ticketType,
        ticketCategory: user.ticketCategory,
      },
    });

  } catch (error) {
    console.error("❌ Dashboard login error:", error);
    res.status(500).json({ 
      message: "Internal server error" 
    });
  }
});

// Check dashboard authentication status
router.get("/check-auth", async (req, res) => {
  try {
    console.log("🔍 Auth check request received");
    console.log("🔍 Request cookies:", req.cookies);

    const token = req.cookies.dashboardToken;
    if (!token) {
      console.log("❌ No dashboard token found in cookies");
      return res.status(401).json({ authenticated: false, message: "No token found" });
    }

    console.log("🔍 Token found, attempting to verify...");
    let decoded;
    try {
      decoded = jwt.verify(token, secret);
      console.log("🔍 Token verified successfully, userId:", decoded.userId);
    } catch (err) {
      console.log("❌ Token verification failed:", err.message);
      return res.status(401).json({ authenticated: false, message: "Invalid token" });
    }

    // Find the user by decoded userId
    console.log("🔍 Looking for user with ID:", decoded.userId);
    const user = await UserTicket.findById(decoded.userId).lean();
    if (!user) {
      console.log("❌ User not found in database with ID:", decoded.userId);
      return res.status(401).json({ authenticated: false, message: "User not found" });
    }

    console.log("✅ User found:", { email: user.email, paymentStatus: user.paymentStatus });

    // Check if ticket is approved by checking payment status
    if (user.paymentStatus !== "completed") {
      console.log("❌ Ticket not approved for user:", user.email, "Status:", user.paymentStatus);
      return res.status(403).json({ 
        authenticated: false, 
        message: "Your ticket is not yet approved. Please wait for approval email." 
      });
    }

    console.log("✅ Ticket approved, sending success response");
    res.json({ 
      authenticated: true, 
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        ticketType: user.ticketType,
        ticketCategory: user.ticketCategory,
      }
    });
  } catch (error) {
    console.error("❌ Auth check error:", error);
    res.status(500).json({ authenticated: false, message: "Internal server error" });
  }
});

// Get user profile info (unprotected - uses email parameter)
router.get("/profile", async (req, res) => {
  try {
    const { email } = req.query;
    
    if (!email) {
      console.log("❌ No email provided in query parameters");
      return res.status(400).json({ message: "Email parameter is required" });
    }

    console.log("🔍 Profile request received for email:", email);

    // Find the user by email
    const user = await UserTicket.findOne({ email }).lean();
    
    if (!user) {
      console.log("❌ User not found in database with email:", email);
      return res.status(404).json({ message: "User not found" });
    }

    console.log("✅ User found:", { email: user.email, fullName: user.fullName });

    // Remove sensitive fields
    delete user.password;
    delete user.dashboardPassword;

    res.json({ user });

  } catch (error) {
    console.error("❌ Get profile error:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Check dashboard access route
router.get("/check-dashboard-access", async (req, res) => {
  try {
    const token = req.cookies.token;
    
    if (!token) {
      return res.json({ access: false });
    }

    const decoded = jwt.verify(token, secret);
    
    // Find the user from LoginActivity to get their email
    const LoginActivity = require("../models/loginActivityModel.js");
    const loginUser = await LoginActivity.findById(decoded.id);
    
    if (!loginUser) {
      return res.json({ access: false });
    }

    // Check if user has a ticket
    const user = await UserTicket.findOne({ email: loginUser.email });
    
    if (!user) {
      return res.json({ access: false });
    }

    // Check if ticket is approved by checking payment status
    if (user.paymentStatus !== "completed") {
      console.log("❌ Ticket not approved for user:", user.email, "Status:", user.paymentStatus);
      return res.json({ access: false, message: "Ticket not approved" });
    }
    
    res.json({ access: true });
    
  } catch (error) {
    console.error("❌ Check dashboard access error:", error);
    res.json({ access: false });
  }
});

// Logout route
router.post("/logout", (req, res) => {
  res.clearCookie("dashboardToken", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
  });
  res.json({ message: "Logged out successfully" });
});

module.exports = router;