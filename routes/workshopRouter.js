const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const WorkshopRegistration = require("../models/workshopModel.js");

const router = express.Router();

// Ensure uploads directory exists
const uploadDir = "uploads/workshops";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// File upload setup for payment proofs
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const timestamp = Date.now();
    const workshopId = req.body.workshopId || "unknown";
    cb(null, `workshop-${workshopId}-${timestamp}-${file.fieldname}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // Max 5MB for payment proofs
  fileFilter: (req, file, cb) => {
    // Only allow PDF files for payment proofs
    if (file.fieldname === "paymentProof" && file.mimetype === "application/pdf") {
      cb(null, true);
    } else if (file.fieldname !== "paymentProof") {
      cb(null, true); // Allow other fields
    } else {
      cb(new Error("Only PDF files are allowed for payment proof"), false);
    }
  },
});

// POST /api/workshop/register
router.post("/register", upload.single("paymentProof"), async (req, res) => {
  try {
    const {
      workshopId,
      workshopTitle,
      fullName,
      email,
      whatsapp,
      country,
      university,
      otherUniversity,
      currentSemester,
      isGimsocMember,
      gimsocCode,
      isMedconAttendee,
      selectedScientificSeries,
    } = req.body;

    // Basic validation
    const requiredFields = [
      "workshopId",
      "workshopTitle", 
      "fullName",
      "email",
      "whatsapp",
      "country",
      "university",
      "currentSemester",
      "isGimsocMember",
      "isMedconAttendee"
    ];

    for (const field of requiredFields) {
      if (!req.body[field] || (typeof req.body[field] === "string" && !req.body[field].trim())) {
        return res.status(400).json({ 
          success: false, 
          message: `${field} is required.` 
        });
      }
    }

    // Check for duplicate registration
    const existingRegistration = await WorkshopRegistration.findOne({ 
      email: email.toLowerCase().trim(), 
      workshopId 
    });

    if (existingRegistration) {
      return res.status(409).json({ 
        success: false, 
        message: "You have already registered for this workshop." 
      });
    }

    // Handle file upload for payment proof
    let paymentProofPath = null;
    if (req.file) {
      paymentProofPath = `/uploads/workshops/${req.file.filename}`;
    }

    // Create registration data
    const registrationData = {
      workshopId,
      workshopTitle,
      fullName: fullName.trim(),
      email: email.toLowerCase().trim(),
      whatsapp: whatsapp.trim(),
      country: country.trim(),
      university: university.trim(),
      currentSemester,
      isGimsocMember,
      isMedconAttendee,
      source: "web"
    };

    // Add optional fields
    if (otherUniversity && otherUniversity.trim()) {
      registrationData.otherUniversity = otherUniversity.trim();
    }
    
    if (gimsocCode && gimsocCode.trim()) {
      registrationData.gimsocCode = gimsocCode.trim();
    }
    
    if (selectedScientificSeries && selectedScientificSeries.trim()) {
      registrationData.selectedScientificSeries = selectedScientificSeries.trim();
    }
    
    if (paymentProofPath) {
      registrationData.paymentProof = paymentProofPath;
    }

    // Save registration
    const registration = new WorkshopRegistration(registrationData);
    await registration.save();

    // Send success response
    res.status(201).json({ 
      success: true, 
      message: "Workshop registration submitted successfully!",
      registrationId: registration._id
    });

  } catch (error) {
    console.error("Workshop registration error:", error);
    
    // Handle validation errors
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({ 
        success: false, 
        message: errors.join(", ") 
      });
    }
    
    // Handle duplicate key error
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false, 
        message: "You have already registered for this workshop." 
      });
    }
    
    // Handle file upload errors
    if (error.message && error.message.includes("Only PDF files")) {
      return res.status(400).json({ 
        success: false, 
        message: "Only PDF files are allowed for payment proof." 
      });
    }
    
    res.status(500).json({ 
      success: false, 
      message: "Internal server error. Please try again later." 
    });
  }
});

// GET /api/workshop/registrations (Admin only - will be protected by admin middleware)
router.get("/registrations", async (req, res) => {
  try {
    const { workshopId, status, page = 1, limit = 50 } = req.query;
    
    // Build filter
    const filter = {};
    if (workshopId && workshopId !== "all") {
      filter.workshopId = workshopId;
    }
    if (status && status !== "all") {
      filter.status = status;
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch registrations with pagination
    const registrations = await WorkshopRegistration.find(filter)
      .sort({ registrationDate: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalCount = await WorkshopRegistration.countDocuments(filter);

    // Get workshop statistics
    const workshopStats = await WorkshopRegistration.aggregate([
      {
        $group: {
          _id: "$workshopId",
          count: { $sum: 1 },
          workshopTitle: { $first: "$workshopTitle" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.json({
      success: true,
      registrations,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        hasNext: skip + registrations.length < totalCount,
        hasPrev: parseInt(page) > 1
      },
      workshopStats
    });

  } catch (error) {
    console.error("Error fetching workshop registrations:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch workshop registrations." 
    });
  }
});

// GET /api/workshop/stats (Admin only)
router.get("/stats", async (req, res) => {
  try {
    // Get overall statistics
    const totalRegistrations = await WorkshopRegistration.countDocuments();
    
    // Get registrations by workshop
    const workshopBreakdown = await WorkshopRegistration.aggregate([
      {
        $group: {
          _id: "$workshopId",
          count: { $sum: 1 },
          workshopTitle: { $first: "$workshopTitle" }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get registrations by status
    const statusBreakdown = await WorkshopRegistration.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Get registrations by university
    const universityBreakdown = await WorkshopRegistration.aggregate([
      {
        $group: {
          _id: "$university",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get recent registrations (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentRegistrations = await WorkshopRegistration.countDocuments({
      registrationDate: { $gte: sevenDaysAgo }
    });

    res.json({
      success: true,
      stats: {
        totalRegistrations,
        recentRegistrations,
        workshopBreakdown,
        statusBreakdown,
        universityBreakdown
      }
    });

  } catch (error) {
    console.error("Error fetching workshop stats:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to fetch workshop statistics." 
    });
  }
});

// PUT /api/workshop/registrations/:id/status (Admin only)
router.put("/registrations/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !["pending", "confirmed", "cancelled"].includes(status)) {
      return res.status(400).json({ 
        success: false, 
        message: "Invalid status. Must be pending, confirmed, or cancelled." 
      });
    }

    const updateData = { status };
    if (notes) {
      updateData.notes = notes;
    }

    const registration = await WorkshopRegistration.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    if (!registration) {
      return res.status(404).json({ 
        success: false, 
        message: "Registration not found." 
      });
    }

    res.json({
      success: true,
      message: "Registration status updated successfully.",
      registration
    });

  } catch (error) {
    console.error("Error updating registration status:", error);
    res.status(500).json({ 
      success: false, 
      message: "Failed to update registration status." 
    });
  }
});

module.exports = router;
