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

// Route to handle ticket submissions
router.post("/submit", upload.any(), async (req, res) => {
  try {
    // Collect uploaded files
    const filesMap = {};
    req.files.forEach(file => {
      filesMap[file.fieldname] = file.filename;
    });
    const existingTicket = await UserTicket.findOne({ email: req.body.email });


    const {
      ticketType,
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

    const newTicket = new UserTicket({
      ticketType,
      email,
      whatsapp,
      password,
      workshopPackage,
      foodPreference,
      dietaryRestrictions,
      accessibilityNeeds,
      paymentMethod,
      discountConfirmation,
      infoAccurate: infoAccurate === "true",
      mediaConsent: mediaConsent === "true",
      policies: policies === "true",
      emailConsent: emailConsent === "true",
      whatsappConsent: whatsappConsent === "true",
      fullName,
      medicalQualification,
      specialty,
      currentWorkplace,
      countryOfPractice,
      isTsuStudent: isTsuStudent === "true",
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

    // If group ticket, parse attendees and assign headshots
    if (ticketType === "Group" && attendees) {
      const parsedAttendees = JSON.parse(attendees);
      newTicket.attendees = parsedAttendees.map((att, index) => ({
        ...att,
        headshotUrl: filesMap[`headshot-${index}`] || null,
        infoAccurate: att.infoAccurate === "true",
        mediaConsent: att.mediaConsent === "true",
        policies: att.policies === "true",
        emailConsent: att.emailConsent === "true",
        whatsappConsent: att.whatsappConsent === "true",
      }));
    }

    await newTicket.save();
    res.status(201).json({ message: "Ticket submitted successfully", id: newTicket._id });
  } catch (error) {
    console.error("❌ Error in ticket submission:", error);
    res.status(500).json({ message: "Server error while submitting ticket" });
  }
});

module.exports = router;