const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const UserTicket = require("../models/userModel");
const { sendTicketConfirmationEmail } = require("../utils/emailService");
const mongoose = require('mongoose');

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

// Add this function before the ticket submission route
async function bookTicketWithTransaction(ticketData) {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { ticketType, subType } = ticketData;
    
    // Get ticket limits
    let overallLimit = null;
    let overallQuery = {};
    
    if (ticketType === "Standard+2") {
      overallLimit = 150;
      overallQuery = { ticketType: "Standard+2" };
    } else if (ticketType === "Standard+3") {
      overallLimit = 150;
      overallQuery = { ticketType: "Standard+3" };
    } else if (ticketType === "Standard+4" || ticketType === "Standard") {
      overallLimit = 150;
      overallQuery = { $or: [ { ticketType: "Standard+4" }, { ticketType: "Standard" } ] };
    } else if (ticketType && (ticketType.startsWith("Doctor") || ticketType.includes("Doctor"))) {
      overallLimit = 30;
      overallQuery = { ticketType: { $regex: /Doctor/i } };
    } else if (ticketType && ticketType.startsWith("International")) {
      overallLimit = 50;
      overallQuery = { ticketType: { $regex: /^International/i } };
    } else if (ticketType && ticketType.toLowerCase().includes("gala")) {
      overallLimit = 150;
      overallQuery = { ticketType: { $regex: /gala/i } };
    }
    
    // Check availability WITH LOCK
    if (overallLimit !== null) {
      const currentCount = await UserTicket.countDocuments({
        ...overallQuery,
        paymentStatus: { $ne: "rejected" }
      }, { session });
      
      if (currentCount >= overallLimit) {
        await session.abortTransaction();
        return { 
          success: false, 
          error: "Tickets for this category are sold out." 
        };
      }
    }
    
    // Check internal member limits
    let internalLimit = null;
    let internalQuery = {};
    
    if (subType === "Executive") {
      internalLimit = 60;
      internalQuery = { subType: "Executive" };
    } else if (subType === "TSU") {
      internalLimit = 50;
      internalQuery = { subType: "TSU" };
    } else if (subType === "GEOMEDI") {
      if (ticketType === "Standard+2") {
        internalLimit = 30;
        internalQuery = { subType: "GEOMEDI", ticketType: "Standard+2" };
      }
    }
    
    if (internalLimit !== null) {
      const internalCount = await UserTicket.countDocuments({
        ...internalQuery,
        paymentStatus: { $ne: "rejected" }
      }, { session });
      
      if (internalCount >= internalLimit) {
        await session.abortTransaction();
        return { 
          success: false, 
          error: "Internal member tickets are sold out." 
        };
      }
    }
    
    // Check email uniqueness
    const existing = await UserTicket.findOne({ 
      email: ticketData.email,
      paymentStatus: { $ne: "rejected" }
    }, { session });
    
    if (existing) {
      await session.abortTransaction();
      return { 
        success: false, 
        error: "This email has already been used to book a ticket." 
      };
    }
    
    // Create ticket in transaction
    const ticket = new UserTicket(ticketData);
    await ticket.save({ session });
    
    // Commit transaction
    await session.commitTransaction();
    
    return { 
      success: true, 
      ticket: ticket 
    };
    
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

// Test endpoint for connectivity
router.get("/test", (req, res) => {
  res.json({ message: "Ticket router is working", timestamp: new Date().toISOString() });
});

// Get ticket data by ID
router.get("/ticket/:ticketId", async (req, res) => {
  try {
    const { ticketId } = req.params;
    
    const ticket = await UserTicket.findById(ticketId);
    
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" });
    }
    
    res.json({
      ticketId: ticket._id,
      fullName: ticket.fullName,
      email: ticket.email,
      ticketType: ticket.ticketType,
      ticketCategory: ticket.ticketCategory,
      createdAt: ticket.createdAt
    });
  } catch (error) {
    console.error("❌ Error fetching ticket:", error);
    res.status(500).json({ error: "Server error" });
  }
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
    } else if (ticketType && (ticketType.startsWith("Doctor") || ticketType.includes("Doctor"))) {
      overallLimit = 30;
      overallQuery = { ticketType: { $regex: /Doctor/i } };
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
    
  } catch (err) {
    console.error("❌ Error checking ticket limits:", err);
    return res.status(500).json({ message: "Error checking ticket limits." });
  }
  
  // --- EMAIL UNIQUENESS CHECK ---
  try {
    const email = req.body.email;
    if (email) {
      // Check for existing non-rejected tickets
      const existing = await UserTicket.findOne({ 
        email,
        paymentStatus: { $ne: "rejected" }
      });
      if (existing) {
        return res.status(409).json({ message: "This email has already been used to book a ticket." });
      }
      
      // Additional check for recent submissions (within last 30 seconds) to prevent duplicates
      const recentSubmission = await UserTicket.findOne({
        email,
        paymentStatus: { $ne: "rejected" },
        createdAt: { $gte: new Date(Date.now() - 30000) } // Last 30 seconds
      });
      if (recentSubmission) {
        return res.status(409).json({ message: "A ticket submission is already in progress. Please wait a moment and try again." });
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
      password: password, // Keep original password
      dashboardPassword: dashboardPassword, // Save dashboard password separately
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

    console.log("💾 Saving ticket to database with transaction...");
    console.log("📊 Ticket data to save:", {
      ticketType: newTicket.ticketType,
      ticketCategory: newTicket.ticketCategory,
      subType: newTicket.subType,
      email: newTicket.email,
      fullName: newTicket.fullName,
      hasPassword: !!newTicket.password,
      hasFiles: !!newTicket.headshotUrl || !!newTicket.paymentProofUrl
    });
    
    // Use transaction-based booking
    const bookingResult = await bookTicketWithTransaction(newTicket);
    
    if (!bookingResult.success) {
      return res.status(409).json({ message: bookingResult.error });
    }
    
    console.log("✅ Ticket saved successfully with ID:", bookingResult.ticket._id);
    
    // Send confirmation email only after successful database save
    console.log("📧 Sending confirmation email...");
    let emailSent = false;
    try {
      const emailResult = await sendTicketConfirmationEmail({
        fullName: bookingResult.ticket.fullName,
        email: bookingResult.ticket.email,
        ticketType: bookingResult.ticket.ticketType,
        ticketCategory: bookingResult.ticket.ticketCategory,
        ticketId: bookingResult.ticket._id.toString()
      });
      
      if (emailResult.success) {
        console.log("✅ Confirmation email sent successfully");
        emailSent = true;
      } else {
        console.log("⚠️ Email sending failed, but ticket was saved:", emailResult.error);
      }
    } catch (emailError) {
      console.log("⚠️ Email sending error, but ticket was saved:", emailError);
    }
    
    console.log("🎉 Sending success response...");
    res.status(201).json({ 
      message: "Ticket submitted successfully", 
      id: bookingResult.ticket._id,
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