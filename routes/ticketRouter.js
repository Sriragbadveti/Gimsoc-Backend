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
const { checkTicketLimits, acquireSaleLocks, saleLockKeys, GALA_LIMIT } = require("../utils/ticketLimits");
const { withKeys } = require("../utils/keyedMutex");

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

// Utility: Upload file to Cloudinary with quality limits and timeout
const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Cloudinary upload timeout'));
    }, 30000); // 30 second timeout
    
    // Determine file type and set appropriate quality settings
    const isImage = file.mimetype.startsWith('image/');
    const isVideo = file.mimetype.startsWith('video/');
    
    const uploadOptions = {
      folder: `gimsoc/${folder}`,
      resource_type: "auto",
      quality: "auto:low", // Force low quality for faster uploads
      fetch_format: "auto",
      transformation: []
    };
    
    // Add specific transformations for images
    if (isImage) {
      uploadOptions.transformation.push({
        quality: "auto:low",
        fetch_format: "auto",
        width: 1200, // Limit max width
        height: 1200, // Limit max height
        crop: "limit" // Maintain aspect ratio
      });
    }
    
    // Add specific transformations for videos
    if (isVideo) {
      uploadOptions.transformation.push({
        quality: "auto:low",
        fetch_format: "auto",
        width: 1280, // Limit max width
        height: 720, // Limit max height
        crop: "limit"
      });
    }
    
    console.log(`📁 Uploading ${file.originalname} (${file.mimetype}) with quality settings:`, uploadOptions);
    
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        clearTimeout(timeout);
        if (result) {
          console.log(`✅ File uploaded to Cloudinary: ${result.secure_url} (Size: ${result.bytes} bytes)`);
          resolve(result.secure_url);
        } else {
          console.error(`❌ Cloudinary upload failed for ${file.originalname}:`, error);
          reject(new Error(`Failed to upload ${file.originalname}: ${error?.message || 'Unknown error'}`));
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
// Polled by every open booking page; a 5-second cache keeps it off the database.
// (The real sold-out check still happens inside the purchase transaction.)
let galaCache = { at: 0, count: 0 };
router.get("/gala-availability", async (req, res) => {
  try {
    if (Date.now() - galaCache.at > 5000) {
      const count = await UserTicket.countDocuments({
        galaDinner: { $regex: /Yes/i },
        paymentStatus: { $ne: "rejected" }
      });
      galaCache = { at: Date.now(), count };
    }
    const available = GALA_LIMIT - galaCache.count;
    res.json({
      totalLimit: GALA_LIMIT,
      currentCount: galaCache.count,
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
      paypalOrderId: ticket.paypalOrderId, // Add PayPal order ID to response
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
  console.log("📋 Request IP:", req.ip);
  console.log("📋 Request body keys:", Object.keys(req.body));
  console.log("📋 Files received:", req.files ? req.files.length : 0);
  
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
  console.log("📋 Ticket type from request:", req.body.ticketType, "Type:", typeof req.body.ticketType);
  console.log("📋 Sub type from request:", req.body.subType);
  console.log("📋 Gala dinner from request:", req.body.galaDinner, "Type:", typeof req.body.galaDinner);

  // --- TICKET LIMIT + EMAIL CHECKS (fast fail before uploading files) ---
  // The authoritative re-check runs inside a transaction right before the ticket is saved.
  let finalGalaDinner = req.body.galaDinner; // Declare outside try-catch for use later
  let limitArgs;
  try {
    let ticketType = req.body.ticketType;
    if (!ticketType) {
      return res.status(400).json({ message: "Missing ticket type in request." });
    }
    if (Array.isArray(ticketType)) ticketType = ticketType[0];

    const galaDinner = req.body.galaDinner;
    const workshopPackage = req.body.workshopPackage;
    // All-inclusive doctor tickets automatically include the gala dinner
    const isAllInclusiveDoctor = typeof ticketType === 'string' && ticketType.includes("Doctor") &&
      (workshopPackage === "All-Inclusive" || (galaDinner && galaDinner.includes("Yes")));
    if (isAllInclusiveDoctor && (!galaDinner || !galaDinner.includes("Yes"))) {
      finalGalaDinner = "Yes, I would like to attend the Gala Dinner (+40 GEL)";
    }
    if (ticketType === "Gala Add-On") {
      finalGalaDinner = "Yes, I would like to attend the Gala Dinner (+40 GEL)";
    }

    limitArgs = {
      ticketType,
      subType: req.body.subType,
      wantsGala: !!(finalGalaDinner && String(finalGalaDinner).includes("Yes")),
      email: req.body.email ? String(req.body.email).toLowerCase().trim() : null,
    };
    const refusal = await checkTicketLimits(limitArgs);
    if (refusal) return res.status(refusal.status).json({ message: refusal.message });
  } catch (err) {
    console.error("❌ Error checking ticket limits:", err);
    return res.status(500).json({ message: "Error checking ticket limits." });
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
        
        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
          console.error(`❌ File ${file.originalname} is too large: ${file.size} bytes`);
          return res.status(400).json({ 
            message: "Validation error", 
            errors: [`File ${file.originalname} is too large. Maximum size is 5MB.`],
            details: [{ field: "files", message: `File ${file.originalname} is too large`, value: file.size }]
          });
        }
        
        // Validate file type
        const allowedTypes = [
          'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
          'application/pdf', 'application/msword', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (!allowedTypes.includes(file.mimetype)) {
          console.error(`❌ File ${file.originalname} has invalid type: ${file.mimetype}`);
          return res.status(400).json({ 
            message: "Validation error", 
            errors: [`File ${file.originalname} has invalid type. Allowed types: JPEG, PNG, WebP, PDF, DOC, DOCX`],
            details: [{ field: "files", message: `Invalid file type: ${file.mimetype}`, value: file.mimetype }]
          });
        }
        
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

    // Validate that all required files were uploaded successfully based on ticket type
    let requiredFiles = ['paymentProof']; // All tickets require payment proof
    
    // Add headshot requirement only for non-Online tickets, except Gala Add-On
    if (req.body.ticketType !== 'Online' && req.body.ticketType !== 'Gala Add-On') {
      requiredFiles.push('headshot');
    }
    
    const missingFiles = [];
    
    for (const requiredFile of requiredFiles) {
      if (!filesMap[requiredFile] && !req.body[`${requiredFile}Url`]) {
        missingFiles.push(requiredFile);
      }
    }
    
    if (missingFiles.length > 0) {
      console.error("❌ Missing required files:", missingFiles);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: [`Missing required files: ${missingFiles.join(', ')}`],
        details: [{ field: "files", message: `Missing required files: ${missingFiles.join(', ')}`, value: missingFiles }]
      });
    }
    
    console.log("✅ All required files uploaded successfully");

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
    else if (ticketType && typeof ticketType === 'string' && ticketType.startsWith("Doctor")) {
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
    // For International tickets, map the ticketType to the correct category
    // else if (ticketType && typeof ticketType === 'string' && ticketType.startsWith("International")) {
    //   ticketCategoryValue = "International";
    //   subTypeValue = "Standard"; // Default for International tickets
    // }
    
    console.log("🔧 Processing ticket:", {
      originalTicketType: ticketType,
      mappedTicketCategory: ticketCategoryValue,
      mappedSubType: subTypeValue
    });
    
    console.log("📊 Ticket data received:", {
      ticketType: req.body.ticketType,
      ticketCategory: req.body.ticketCategory,
      email: req.body.email,
      fullName: req.body.fullName,
      paymentMethod: req.body.paymentMethod
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

    // Fix galaDinner field - ensure it's a string, not an array
    let galaDinnerValue = finalGalaDinner;
    console.log("🔍 Original galaDinner value:", finalGalaDinner, "Type:", typeof finalGalaDinner);
    
    if (Array.isArray(galaDinnerValue)) {
      // If it's an array, take the first non-empty value
      galaDinnerValue = galaDinnerValue.find(val => val && val.trim() !== '') || null;
      console.log("🔧 Fixed galaDinner array to string:", galaDinnerValue);
    } else if (typeof galaDinnerValue === 'string' && galaDinnerValue.startsWith('[')) {
      // If it's a string representation of an array, parse it
      try {
        const parsedArray = JSON.parse(galaDinnerValue);
        galaDinnerValue = Array.isArray(parsedArray) ? parsedArray[0] || null : galaDinnerValue;
        console.log("🔧 Fixed galaDinner JSON string to string:", galaDinnerValue);
      } catch (e) {
        console.log("🔧 Could not parse galaDinner as JSON, using as-is:", galaDinnerValue);
      }
    }
    
    console.log("🔧 Final galaDinner value:", galaDinnerValue, "Type:", typeof galaDinnerValue);

    // Helper function to ensure string fields are not arrays
    const ensureString = (value, fieldName) => {
      if (Array.isArray(value)) {
        const stringValue = value.find(val => val && val.trim() !== '') || null;
        console.log(`🔧 Fixed ${fieldName} array to string:`, stringValue);
        return stringValue;
      } else if (typeof value === 'string' && value.startsWith('[')) {
        try {
          const parsedArray = JSON.parse(value);
          const stringValue = Array.isArray(parsedArray) ? parsedArray[0] || null : value;
          console.log(`🔧 Fixed ${fieldName} JSON string to string:`, stringValue);
          return stringValue;
        } catch (e) {
          console.log(`🔧 Could not parse ${fieldName} as JSON, using as-is:`, value);
          return value;
        }
      }
      return value;
    };

    const newTicket = new UserTicket({
      ticketType,
      ticketCategory: ticketCategoryValue,
      subType: subTypeValue,
      email: emailLower,
      whatsapp: ensureString(whatsapp, "whatsapp"),
      password: password, // Keep original password
      dashboardPassword: dashboardPassword, // Save dashboard password separately
      workshopPackage: ensureString(workshopPackage, "workshopPackage"),
      foodPreference: ensureString(foodPreference, "foodPreference"),
      dietaryRestrictions: ensureString(dietaryRestrictions, "dietaryRestrictions"),
      accessibilityNeeds: ensureString(accessibilityNeeds, "accessibilityNeeds"),
      galaDinner: galaDinnerValue, // Use the fixed gala dinner value
      paymentMethod: ensureString(paymentMethod, "paymentMethod"),
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
      // Store PayPal order ID for international tickets with PayPal payment
      // ...(ticketType && typeof ticketType === 'string' && ticketType.startsWith("International") && req.body.paymentMethod === "Credit/Debit Card" && req.body.paypalOrderId && {
      //   paypalOrderId: req.body.paypalOrderId
      // })
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
    
    // Re-check caps and save atomically. withTransaction retries on write conflicts, so
    // concurrent buyers for the last seats are serialised instead of all slipping through.
    // Buyers competing for the same cap queue up in-process first, so they don't all open
    // transactions at once and abort each other in a retry storm.
    const savePromise = withKeys(saleLockKeys(limitArgs), () =>
      mongoose.connection.transaction(async (session) => {
        await acquireSaleLocks(limitArgs, session);
        const refusal = await checkTicketLimits(limitArgs, session);
        if (refusal) return refusal;
        await newTicket.save({ session });
        return null;
      })
    );
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database save timeout')), 10000)
    );

    const refusal = await Promise.race([savePromise, timeoutPromise]);
    if (refusal) return res.status(refusal.status).json({ message: refusal.message });
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