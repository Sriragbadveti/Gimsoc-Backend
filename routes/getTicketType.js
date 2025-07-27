const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const Abstract = require("../models/abstractModel.js");

const router = express.Router();

// ✅ Ensure folder exists
const uploadDir = "uploads/abstracts";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File upload setup using multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${file.fieldname}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// @route   POST /api/abstract/submission
// @desc    Submit abstract form
router.post("/submission", upload.single("abstractFile"), async (req, res) => {
  try {
    const {
      fullName,
      email,
      whatsapp,
      hasTicket,
      ticketId,
      title,
      category,
      authors,
      presentingAuthor,
      isPresentingAuthorSame,
      originalityConsent,
      disqualificationConsent,
      permissionConsent,
    } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: "File is required" });
    }

    const newAbstract = new Abstract({
      fullName,
      email,
      whatsapp,
      hasTicket,
      ticketId: hasTicket === "Yes" ? ticketId : null,
      title,
      category,
      authors,
      presentingAuthor,
      isPresentingAuthorSame,
      abstractFileURL: `/uploads/abstracts/${req.file.filename}`,
      originalityConsent,
      disqualificationConsent,
      permissionConsent,
    });

    await newAbstract.save();
    res.status(201).json({ message: "Abstract submitted successfully" });
  } catch (err) {
    console.error("Abstract submission failed", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;