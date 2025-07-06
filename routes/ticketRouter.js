const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const UserTicket = require("../models/userModel");

const router = express.Router();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "../uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer setup
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

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

// Route to handle ticket submissions
router.post("/submit", upload.any(), async (req, res) => {
  // Handle multer errors
  if (req.fileValidationError) {
    return res.status(400).json({ message: req.fileValidationError });
  }
  
  if (req.fileTooLarge) {
    return res.status(400).json({ message: "File too large. Maximum size is 10MB." });
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
      req.files.forEach(file => {
        console.log("📁 Processing file:", {
          fieldname: file.fieldname,
          originalname: file.originalname,
          mimetype: file.mimetype,
          size: file.size
        });
        filesMap[file.fieldname] = file.filename;
      });
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
    
    console.log("🔧 Processing ticket:", {
      originalTicketType: ticketType,
      mappedTicketCategory: ticketCategoryValue,
      mappedSubType: subTypeValue
    });
    
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
      headshotUrl: filesMap.headshot || null,
      paymentProofUrl: filesMap.paymentProof || null,
      studentIdProofUrl: filesMap.studentIdProof || null,
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
    
    // Add timeout to prevent hanging
    const savePromise = newTicket.save();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database save timeout')), 10000)
    );
    
    await Promise.race([savePromise, timeoutPromise]);
    console.log("✅ Ticket saved successfully with ID:", newTicket._id);
    res.status(201).json({ message: "Ticket submitted successfully", id: newTicket._id });
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