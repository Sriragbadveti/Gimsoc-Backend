const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const UserTicket = require("../models/userModel");
const { sendTicketConfirmationEmail } = require("../utils/emailService");

const router = express.Router();

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
    // Allow images and PDFs
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only images and PDFs are allowed'), false);
    }
  }
});

// Utility: Convert string-like booleans to actual Boolean values
const toBool = (val) => val === "Yes" || val === "true" || val === true;

// Utility: Upload file to Cloudinary
const uploadToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `gimsoc/${folder}`,
        resource_type: "auto",
      },
      (error, result) => {
        if (result) {
          resolve(result.secure_url);
        } else {
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

// Route to handle ticket submissions
router.post("/submit", upload.any(), async (req, res) => {
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

  // --- TICKET LIMIT CHECKS ---
  try {
    const ticketType = req.body.ticketType;
    let limit = null;
    let query = {};
    if (ticketType === "Standard+2") {
      limit = 150;
      query = { ticketType: "Standard+2" };
    } else if (ticketType === "Standard+3") {
      limit = 300;
      query = { ticketType: "Standard+3" };
    } else if (ticketType === "Standard+4" || ticketType === "Standard") {
      // Some forms may use Standard for Std+4
      limit = 150;
      query = { $or: [ { ticketType: "Standard+4" }, { ticketType: "Standard" } ] };
    } else if (ticketType && ticketType.startsWith("Doctor")) {
      limit = 30;
      query = { ticketType: { $regex: /^Doctor/i } };
    } else if (ticketType && ticketType.startsWith("International")) {
      limit = 50;
      query = { ticketType: { $regex: /^International/i } };
    }
    if (limit !== null) {
      const count = await UserTicket.countDocuments(query);
      if (count >= limit) {
        return res.status(409).json({ message: "Tickets for this category are sold out." });
      }
    }
  } catch (err) {
    console.error("❌ Error checking ticket limits:", err);
    return res.status(500).json({ message: "Error checking ticket limits." });
  }
  
  // --- EMAIL UNIQUENESS CHECK ---
  try {
    const email = req.body.email;
    if (email) {
      const existing = await UserTicket.findOne({ email });
      if (existing) {
        return res.status(409).json({ message: "This email has already been used to book a ticket." });
      }
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
      email: req.body.email,
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
    else if (ticketType === "Doctor") {
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

    const newTicket = new UserTicket({
      ticketType,
      ticketCategory: ticketCategoryValue,
      subType: subTypeValue,
      email,
      whatsapp,
      password,
      workshopPackage,
      foodPreference,
      dietaryRestrictions,
      accessibilityNeeds,
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
      email: newTicket.email,
      fullName: newTicket.fullName,
      hasFiles: !!newTicket.headshotUrl || !!newTicket.paymentProofUrl
    });
    
    // Add timeout to prevent hanging
    const savePromise = newTicket.save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database save timeout')), 10000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
    console.log("✅ Ticket saved successfully with ID:", newTicket._id);
    
    // Send confirmation email
    console.log("📧 Sending confirmation email...");
    try {
      const emailResult = await sendTicketConfirmationEmail({
        fullName: newTicket.fullName,
        email: newTicket.email,
        ticketType: newTicket.ticketType,
        ticketCategory: newTicket.ticketCategory
      });
      
      if (emailResult.success) {
        console.log("✅ Confirmation email sent successfully");
      } else {
        console.log("⚠️ Email sending failed, but ticket was saved:", emailResult.error);
      }
    } catch (emailError) {
      console.log("⚠️ Email sending error, but ticket was saved:", emailError);
    }
    
    console.log("🎉 Sending success response...");
    res.status(201).json({ message: "Ticket submitted successfully", id: newTicket._id });
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