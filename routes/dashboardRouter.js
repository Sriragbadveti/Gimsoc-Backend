const express = require("express");
const UserTicket = require("../models/userModel");
const jwt = require("jsonwebtoken");
const { dashboardAuthMiddleware } = require("../middlewares/authMiddleware");
const secret = process.env.JWT_SECRET || "your-secret-key";

const router = express.Router();

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

    // Check if ticket is approved (we'll add an approval status field later)
    // For now, we'll assume all tickets are approved
    const isApproved = true; // This will be replaced with actual approval logic

    if (!isApproved) {
      console.log("❌ Ticket not approved for user:", email);
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
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    console.log("✅ Dashboard login successful for user:", email);

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

// Get user profile info (protected route)
router.get("/profile", dashboardAuthMiddleware, async (req, res) => {
  try {
    console.log("🔍 Profile request - User ID:", req.user?.id);
    
    if (!req.user || !req.user.id) {
      console.log("❌ No user found in request");
      return res.status(401).json({ 
        message: "User not authenticated" 
      });
    }

    const user = await UserTicket.findById(req.user.id);

    if (!user) {
      console.log("❌ User not found in database:", req.user.id);
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    res.json({
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        ticketType: user.ticketType,
        ticketCategory: user.ticketCategory,
        subType: user.subType,
        whatsapp: user.whatsapp,
        universityName: user.universityName,
        semester: user.semester,
        medicalQualification: user.medicalQualification,
        specialty: user.specialty,
        currentWorkplace: user.currentWorkplace,
        countryOfPractice: user.countryOfPractice,
        nationality: user.nationality,
        countryOfResidence: user.countryOfResidence,
        passportNumber: user.passportNumber,
        needsVisaSupport: user.needsVisaSupport,
        emergencyContactName: user.emergencyContactName,
        emergencyContactRelationship: user.emergencyContactRelationship,
        emergencyContactPhone: user.emergencyContactPhone,
        foodPreference: user.foodPreference,
        dietaryRestrictions: user.dietaryRestrictions,
        accessibilityNeeds: user.accessibilityNeeds,
        headshotUrl: user.headshotUrl,
        paymentProofUrl: user.paymentProofUrl,
        createdAt: user.createdAt,
      },
    });

  } catch (error) {
    console.error("❌ Get profile error:", error);
    
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ 
        message: "Invalid token" 
      });
    }
    
    res.status(500).json({ 
      message: "Internal server error" 
    });
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

    // For now, assume all tickets have dashboard access
    // This can be enhanced later with approval status
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