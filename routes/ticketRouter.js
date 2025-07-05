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

const upload = multer({ storage });

// Utility: Convert string-like booleans to actual Boolean values
const toBool = (val) => val === "Yes" || val === "true" || val === true;

// Route to handle ticket submissions
router.post("/submit", upload.any(), async (req, res) => {
  try {
    console.log("🎫 Ticket submission received:", {
      ticketType: req.body.ticketType,
      ticketCategory: req.body.ticketCategory,
      subType: req.body.subType,
      fullName: req.body.fullName,
      email: req.body.email
    });
    
    const filesMap = {};
    req.files.forEach(file => {
      filesMap[file.fieldname] = file.filename;
    });
    
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
    await newTicket.save();
    console.log("✅ Ticket saved successfully with ID:", newTicket._id);
    res.status(201).json({ message: "Ticket submitted successfully", id: newTicket._id });
  } catch (error) {
    console.error("❌ Error in ticket submission:", error);
    
    // Handle validation errors specifically
    if (error.name === 'ValidationError') {
      console.error("Validation errors:", error.errors);
      return res.status(400).json({ 
        message: "Validation error", 
        errors: Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`)
      });
    }
    
    res.status(500).json({ message: "Server error while submitting ticket" });
  }
});

module.exports = router;