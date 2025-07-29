const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const mongoose = require("mongoose");
const { RateLimiterMemory } = require("rate-limiter-flexible");
const UserTicket = require("../models/userModel");
const { sendTicketConfirmationEmail } = require("../utils/emailService");
const emailQueue = require("../utils/emailQueue");

const router = express.Router();

// Rate limiter for ticket submissions
const ticketSubmissionLimiter = new RateLimiterMemory({
  keyGenerator: (req) => req.ip,
  points: 15, // 10 submissions per IP (increased from 5)
  duration: 600, // Per 10 minutes (increased from 5 minutes)
});

// Rate limiting middleware for ticket submissions
const ticketSubmissionRateLimit = async (req, res, next) => {
  try {
    await ticketSubmissionLimiter.consume(req.ip);
    next();
  } catch (rejRes) {
    console.log(`🚫 Rate limit exceeded for IP: ${req.ip}`);
    res.status(429).json({
      error: 'Too many ticket submissions. Please wait 10 minutes before trying again.',
      retryAfter: Math.round(rejRes.msBeforeNext / 1000)
    });
  }
};

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer setup for Cloudinary uploads
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { 
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: (req, file, cb) => {
    // Allow only JPEG and PNG images
    if (file.mimetype === 'image/jpeg' || file.mimetype === 'image/jpg' || file.mimetype === 'image/png') {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG and PNG images are allowed'), false);
    }
  }
});

// Utility: Convert string-like booleans to actual Boolean values
const toBool = (val) => val === "Yes" || val === "true" || val === true;

// Utility: Upload file to Cloudinary with timeout and retry
const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Cloudinary upload timeout'));
    }, 30000); // 30 second timeout
    
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `gimsoc/${folder}`,
        resource_type: "auto",
        quality: "auto", // Optimize image quality
        fetch_format: "auto", // Auto-optimize format
      },
      (error, result) => {
        clearTimeout(timeout);
        if (result) {
          console.log(`✅ File uploaded to Cloudinary: ${result.secure_url}`);
          resolve(result.secure_url);
        } else {
          console.error(`❌ Cloudinary upload failed:`, error);
          reject(error);
        }
      }
    );
    
    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};

// Test endpoint for connectivity
router.get("/test", (req, res) => {
  res.json({ message: "Ticket router is working", timestamp: new Date().toISOString() });
});

// Test endpoint for debugging ticket submission
router.post("/test-submission", (req, res) => {
  console.log("🧪 Test submission endpoint called");
  console.log("📋 Request body:", req.body);
  console.log("📋 Request headers:", req.headers);
  
  res.json({ 
    message: "Test submission received", 
    body: req.body,
    timestamp: new Date().toISOString() 
  });
});

// Test email endpoint
router.post("/test-email", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    
    console.log("🧪 Testing Brevo email service with:", email);
    
    const emailResult = await sendTicketConfirmationEmail({
      fullName: "Test User",
      email: email,
      ticketType: "Test Ticket",
      ticketCategory: "Test Category",
      ticketId: "test-123"
    });
    
    if (emailResult.success) {
      res.json({ 
        message: "Test email sent successfully", 
        email: email,
        success: true 
      });
    } else {
      res.status(500).json({ 
        message: "Test email failed", 
        error: emailResult.error,
        success: false 
      });
    }
  } catch (error) {
    console.error("❌ Test email error:", error);
    res.status(500).json({ 
      message: "Test email error", 
      error: error.message,
      success: false 
    });
  }
});

// Get gala dinner availability
router.get("/gala-availability", async (req, res) => {
  try {
    // Count all tickets with gala dinner selected (excluding rejected ones)
    const galaCount = await UserTicket.countDocuments({
      galaDinner: { $regex: /Yes/i },
      paymentStatus: { $ne: "rejected" }
    });
    
    const galaLimit = 150;
    const available = galaLimit - galaCount;
    
    res.json({
      totalLimit: galaLimit,
      currentCount: galaCount,
      available: available,
      isAvailable: available > 0
    });
  } catch (error) {
    console.error("❌ Error checking gala availability:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get ticket data by ID
router.get("/ticket/:ticketId", async (req, res) => {
  try {
    console.log("🔍 Ticket endpoint called");
    const { ticketId } = req.params;
    console.log("🔍 Fetching ticket with ID:", ticketId);
    console.log("🔍 Request params:", req.params);
    
    // Convert string ticketId to ObjectId if it's a valid ObjectId string
    let objectId;
    
    try {
      objectId = new mongoose.Types.ObjectId(ticketId);
      console.log("✅ Converted to ObjectId:", objectId);
    } catch (error) {
      console.log("❌ Invalid ObjectId format:", ticketId, error.message);
      return res.status(400).json({ error: "Invalid ticket ID format" });
    }
    
    console.log("🔍 Searching for ticket with ObjectId:", objectId);
    const ticket = await UserTicket.findById(objectId);
    
    if (!ticket) {
      console.log("❌ Ticket not found in database");
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    console.log("✅ Ticket found:", {
      id: ticket._id,
      fullName: ticket.fullName,
      email: ticket.email
    });
    
    res.json({
      ticketId: ticket._id,
      fullName: ticket.fullName,
      email: ticket.email,
      ticketType: ticket.ticketType,
      ticketCategory: ticket.ticketCategory,
      createdAt: ticket.createdAt
    });
  } catch (error) {
    console.error("❌ Error fetching ticket:", error.message);
    console.error("❌ Error stack:", error.stack);
    res.status(500).json({ error: "Server error" });
  }
});

// Route to handle ticket submissions
router.post("/submit", ticketSubmissionRateLimit, upload.any(), async (req, res) => {
  console.log("🚀 Ticket submission started at:", new Date().toISOString());
  
  // Handle multer errors
  if (req.fileValidationError) {
    console.log("❌ File validation error:", req.fileValidationError);
    return res.status(400).json({ message: req.fileValidationError });
  }
  
  if (req.fileTooLarge) {
    console.log("❌ File too large");
    return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
  }

  // Log the incoming request for debugging
  console.log("📋 Request body keys:", Object.keys(req.body));
  console.log("📋 Email from request:", req.body.email);
  console.log("📋 Full name from request:", req.body.fullName);
  console.log("📋 Ticket type from request:", req.body.ticketType);
  console.log("📋 Sub type from request:", req.body.subType);
  console.log("📋 Gala dinner from request:", req.body.galaDinner, "Type:", typeof req.body.galaDinner);

  // --- TICKET LIMIT CHECKS ---
  let finalGalaDinner = req.body.galaDinner; // Declare outside try-catch for use later
  
  try {
    const ticketType = req.body.ticketType;
    const subType = req.body.subType;
    let overallLimit = null;
    let overallQuery = {};
    
    // Overall ticket type limits
    if (ticketType === "Standard+2") {
      overallLimit = 150;
      overallQuery = { ticketType: "Standard+2" };
    } else if (ticketType === "Standard+3") {
      overallLimit = 300;
      overallQuery = { ticketType: "Standard+3" };
    } else if (ticketType === "Standard+4" || ticketType === "Standard") {
      // Some forms may use Standard for Std+4
      overallLimit = 150;
      overallQuery = { $or: [ { ticketType: "Standard+4" }, { ticketType: "Standard" } ] };
    } else if (ticketType && ticketType.startsWith("Doctor")) {
      overallLimit = 30;
      overallQuery = { ticketType: { $regex: /^Doctor/i } };
    } else if (ticketType && ticketType.startsWith("International")) {
      overallLimit = 50;
      overallQuery = { ticketType: { $regex: /^International/i } };
    }
    
    // Check overall ticket type limit
    if (overallLimit !== null) {
      // Count all tickets except rejected ones (pending and completed count towards limit)
      const overallCount = await UserTicket.countDocuments({
        ...overallQuery,
        paymentStatus: { $ne: "rejected" }
      });
      if (overallCount >= overallLimit) {
        return res.status(409).json({ message: "Tickets for this category are sold out." });
      }
    }
    
    // Internal member type limits
    let internalLimit = null;
    let internalQuery = {};
    
    if (subType === "Executive") {
      // GIMSOC Executive & Subcommittee limit across all ticket types
      internalLimit = 60;
      internalQuery = { subType: "Executive" };
    } else if (subType === "TSU") {
      // TSU limit across all ticket types
      internalLimit = 50;
      internalQuery = { subType: "TSU" };
    } else if (subType === "GEOMEDI") {
      // GEOMEDI limit only on Standard+2
      if (ticketType === "Standard+2") {
        internalLimit = 30;
        internalQuery = { subType: "GEOMEDI", ticketType: "Standard+2" };
      }
    }
    
    // Check internal member type limit
    if (internalLimit !== null) {
      // Count all tickets except rejected ones (pending and completed count towards limit)
      const internalCount = await UserTicket.countDocuments({
        ...internalQuery,
        paymentStatus: { $ne: "rejected" }
      });
      if (internalCount >= internalLimit) {
        let limitMessage = "";
        if (subType === "Executive") {
          limitMessage = "Executive & Subcommittee tickets are sold out.";
        } else if (subType === "TSU") {
          limitMessage = "TSU student tickets are sold out.";
        } else if (subType === "GEOMEDI") {
          limitMessage = "GEOMEDI student tickets for Standard+2 are sold out.";
        }
        return res.status(409).json({ message: limitMessage });
      }
    }
    
    // --- GALA DINNER LIMIT CHECK ---
    const galaDinner = req.body.galaDinner;
    const workshopPackage = req.body.workshopPackage;
    
    // Check if this is an all-inclusive doctor ticket (which automatically includes gala)
    const isAllInclusiveDoctor = ticketType && ticketType.includes("Doctor") && 
                                (workshopPackage === "All-Inclusive" || 
                                 (galaDinner && galaDinner.includes("Yes")));
    
    // For all-inclusive doctor tickets, automatically set gala dinner to "Yes"
    if (isAllInclusiveDoctor && (!galaDinner || !galaDinner.includes("Yes"))) {
      finalGalaDinner = "Yes, I would like to attend the Gala Dinner (+40 GEL)";
      console.log("🎭 Auto-including gala dinner for all-inclusive doctor ticket");
    }
    
    if (finalGalaDinner && finalGalaDinner.includes("Yes")) {
      // Count all tickets with gala dinner selected (excluding rejected ones)
      const galaCount = await UserTicket.countDocuments({
        galaDinner: { $regex: /Yes/i },
        paymentStatus: { $ne: "rejected" }
      });
      
      const galaLimit = 150;
      if (galaCount >= galaLimit) {
        return res.status(409).json({ message: "Gala dinner tickets are sold out." });
      }
    }
    
  } catch (err) {
    console.error("❌ Error checking ticket limits:", err);
    return res.status(500).json({ message: "Error checking ticket limits." });
  }
  
  // --- EMAIL UNIQUENESS CHECK ---
  try {
    const email = req.body.email;
    const emailLower = email ? email.toLowerCase().trim() : null;
    console.log("🔍 Checking email uniqueness for:", emailLower);
    
    if (emailLower) {
      // Check for existing non-rejected tickets (case-insensitive)
      const existing = await UserTicket.findOne({ 
        email: { $regex: new RegExp(`^${emailLower}$`, 'i') },
        paymentStatus: { $ne: "rejected" }
      });
      
      if (existing) {
        console.log("❌ Email already exists:", emailLower);
        return res.status(409).json({ message: "This email has already been used to book a ticket." });
      }
      
      // Additional check for recent submissions (within last 30 seconds) to prevent duplicates
      const recentSubmission = await UserTicket.findOne({
        email: { $regex: new RegExp(`^${emailLower}$`, 'i') },
        paymentStatus: { $ne: "rejected" },
        createdAt: { $gte: new Date(Date.now() - 30000) } // Last 30 seconds
      });
      
      if (recentSubmission) {
        console.log("❌ Recent submission found for email:", emailLower);
        return res.status(409).json({ message: "A ticket submission is already in progress. Please wait a moment and try again." });
      }
      
      console.log("✅ Email uniqueness check passed for:", emailLower);
    } else {
      console.log("⚠️ No email provided for uniqueness check");
    }
  } catch (err) {
    console.error("❌ Error checking email uniqueness:", err);
    return res.status(500).json({ message: "Error checking email uniqueness." });
  }
  
  try {
    console.log("🎫 Ticket submission received:", {
      ticketType: req.body.ticketType,
      ticketCategory: req.body.ticketCategory,
      subType: req.body.subType,
      fullName: req.body.fullName,
      email: req.body.email ? req.body.email.toLowerCase().trim() : null,
      dashboardPassword: req.body.dashboardPassword ? "***PROVIDED***" : "NOT PROVIDED",
      workshopPackage: req.body.workshopPackage,
      isGimsocMember: req.body.isGimsocMember,
      isTsuStudent: req.body.isTsuStudent
    });
    
    console.log("📋 Full request body:", req.body);
    console.log("📋 Request headers:", req.headers);
    console.log("📁 Number of files received:", req.files ? req.files.length : 0);
    
    const filesMap = {};
    if (req.files && req.files.length > 0) {
      console.log("📁 Uploading files to Cloudinary...");
      for (const file of req.files) {
        console.log("📁 Processing file:", {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });
        
        try {
          const cloudinaryUrl = await uploadToCloudinary(file, "tickets");
          filesMap[file.fieldname] = cloudinaryUrl;
          console.log(`✅ File ${file.fieldname} uploaded to Cloudinary:`, cloudinaryUrl);
        } catch (uploadError) {
          console.error(`❌ Failed to upload ${file.fieldname}:`, uploadError);
          throw new Error(`Failed to upload ${file.fieldname}: ${uploadError.message}`);
        }
      }
    }
    
    console.log("📁 Files uploaded:", filesMap);

    const {
      ticketType,
      ticketCategory,
      subType,
      email,
      whatsapp,
      password,
      dashboardPassword,
      workshopPackage,
      foodPreference,
      dietaryRestrictions,
      accessibilityNeeds,
      paymentMethod,
      discountConfirmation,
      infoAccurate,
      mediaConsent,
      policies,
      emailConsent,
      whatsappConsent,
      fullName,
      medicalQualification,
      specialty,
      currentWorkplace,
      countryOfPractice,
      isTsuStudent,
      isGimsocMember,
      membershipCode,
      tsuEmail,
      semester,
      nationality,
      countryOfResidence,
      passportNumber,
      needsVisaSupport,
      universityName,
      yearOfStudy,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      attendees,
    } = req.body;

    // Handle different ticket types
    let ticketCategoryValue = ticketCategory;
    let subTypeValue = subType;
    
    // For Executive tickets, map the ticketType to the correct category
    if (ticketType === "Executive") {
      ticketCategoryValue = "Executive & Subcom";
      subTypeValue = subType || "Standard"; // Default to Standard if not specified
    }
    // For Doctor tickets, map the ticketType to the correct category
    else if (ticketType && ticketType.startsWith("Doctor")) {
      ticketCategoryValue = "Doctor";
      subTypeValue = "Standard"; // Default for Doctor tickets
    }
    // For Group tickets, map the ticketType to the correct category
    else if (ticketType === "Group") {
      ticketCategoryValue = "Standard"; // Group tickets are Standard category
      subTypeValue = "Group"; // Special subtype for group tickets
    }
    // For Standard tickets (like Standard+4), keep as is
    else if (ticketType === "Standard") {
      ticketCategoryValue = "Standard";
      subTypeValue = subType; // Use the subType as provided
    }
    // For Standard+3 tickets, map to Standard category
    else if (ticketType === "Standard+3") {
      ticketCategoryValue = "Standard";
      subTypeValue = subType; // Use the subType as provided
    }
    
    console.log("🔧 Processing ticket:", {
      originalTicketType: ticketType,
      mappedTicketCategory: ticketCategoryValue,
      mappedSubType: subTypeValue
    });
    
    // Accept direct Cloudinary URLs from frontend if present
    const headshotUrl = req.body.headshotUrl && req.body.headshotUrl.startsWith('http')
      ? req.body.headshotUrl
      : filesMap.headshot || null;
    const paymentProofUrl = req.body.paymentProofUrl && req.body.paymentProofUrl.startsWith('http')
      ? req.body.paymentProofUrl
      : filesMap.paymentProof || null;
    const studentIdProofUrl = req.body.studentIdProofUrl && req.body.studentIdProofUrl.startsWith('http')
      ? req.body.studentIdProofUrl
      : filesMap.studentIdProof || null;

    // Convert all email fields to lowercase for consistency
    const emailLower = email ? email.toLowerCase().trim() : null;
    const tsuEmailLower = tsuEmail ? tsuEmail.toLowerCase().trim() : null;
    const geomediEmailLower = req.body.geomediEmail ? req.body.geomediEmail.toLowerCase().trim() : null;

    const newTicket = new UserTicket({
      ticketType,
      ticketCategory: ticketCategoryValue,
      subType: subTypeValue,
      email: emailLower,
      whatsapp,
      password: password, // Keep original password
      dashboardPassword: dashboardPassword, // Save dashboard password separately
      workshopPackage,
      foodPreference,
      dietaryRestrictions,
      accessibilityNeeds,
      galaDinner: finalGalaDinner || null, // Use final gala dinner value (auto-included for all-inclusive doctor tickets)
      paymentMethod,
      discountConfirmation: toBool(discountConfirmation),
      infoAccurate: toBool(infoAccurate),
      mediaConsent: toBool(mediaConsent),
      policies: toBool(policies),
      emailConsent: toBool(emailConsent),
      whatsappConsent: toBool(whatsappConsent),
      fullName,
      medicalQualification,
      specialty,
      currentWorkplace,
      countryOfPractice,
      isTsuStudent: toBool(isTsuStudent),
      isGimsocMember: toBool(isGimsocMember),
      membershipCode: membershipCode || null,
      tsuEmail: tsuEmailLower,
      semester,
      nationality,
      countryOfResidence,
      passportNumber,
      needsVisaSupport,
      universityName,
      yearOfStudy,
      emergencyContactName,
      emergencyContactRelationship,
      emergencyContactPhone,
      headshotUrl,
      paymentProofUrl,
      studentIdProofUrl,
    });

    // 🧠 Handle group ticket attendees
    if (ticketType === "Group" && attendees) {
      const parsedAttendees = JSON.parse(attendees);
      newTicket.attendees = parsedAttendees.map((att, index) => ({
        ...att,
        isGimsocMember: toBool(att.isGimsocMember),
        mediaConsent: toBool(att.mediaConsent),
        infoAccurate: toBool(att.infoAccurate),
        policies: toBool(att.policies),
        emailConsent: toBool(att.emailConsent),
        whatsappConsent: toBool(att.whatsappConsent),
        headshotUrl: filesMap[`headshot-${index}`] || null,
      }));
    }

    console.log("💾 Saving ticket to database...");
    console.log("📊 Ticket data to save:", {
      ticketType: newTicket.ticketType,
      ticketCategory: newTicket.ticketCategory,
      subType: newTicket.subType,
      email: newTicket.email, // This will now be lowercase
      fullName: newTicket.fullName,
      hasPassword: !!newTicket.password,
      hasFiles: !!newTicket.headshotUrl || !!newTicket.paymentProofUrl
    });
    
    // Add timeout to prevent hanging
    const savePromise = newTicket.save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database save timeout')), 10000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
    console.log("✅ Ticket saved successfully with ID:", newTicket._id);
    
    // Queue confirmation email for processing
    console.log("📧 Queuing confirmation email...");
    const emailData = {
      fullName: newTicket.fullName,
      email: newTicket.email,
      ticketType: newTicket.ticketType,
      ticketCategory: newTicket.ticketCategory,
      ticketId: newTicket._id.toString()
    };
    
    const emailJobId = emailQueue.addToQueue(emailData);
    console.log(`📧 Email queued with job ID: ${emailJobId}`);
    
    // Email will be processed asynchronously, so we don't wait for it
    const emailSent = true; // We assume it will be sent successfully
    
    console.log("🎉 Sending success response...");
    res.status(201).json({ 
      message: "Ticket submitted successfully", 
      id: newTicket._id,
      emailSent: emailSent 
    });
    console.log("✅ Response sent successfully");
  } catch (error) {
    console.error("❌ Error in ticket submission:", error);
    
    // Handle specific error types
    if (error.name === 'ValidationError') {
      console.error("Validation errors:", error.errors);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`)
      });
    }
    
    if (error.message === 'Database save timeout') {
      console.error("Database save timed out");
      return res.status(500).json({ message: "Database operation timed out. Please try again." });
    }
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
    }
    
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ message: "Too many files. Maximum 5 files allowed." });
    }
    
    res.status(500).json({ message: "Server error while submitting ticket" });
  }
});

module.exports = router;