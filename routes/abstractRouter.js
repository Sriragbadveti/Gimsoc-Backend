// routes/abstractRoutes.js
const express = require("express");
const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");
const streamifier = require("streamifier");
const Abstract = require("../models/abstractModel.js");
const router = express.Router();

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer memory storage (for streaming to Cloudinary)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // Max 10MB
});

// @route   POST /api/abstracts
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

    // Upload file to Cloudinary
    const streamUpload = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: "gimsoc/abstracts",
            resource_type: "raw",
          },
          (error, result) => {
            if (result) {
              resolve(result);
            } else {
              reject(error);
            }
          }
        );
        streamifier.createReadStream(req.file.buffer).pipe(stream);
      });
    };

    const result = await streamUpload();

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
      abstractFileURL: result.secure_url,
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