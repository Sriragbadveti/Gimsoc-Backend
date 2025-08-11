const express = require("express");
const VolunteerApplication = require("../models/volunteerModel.js");

const router = express.Router();

// Increase limits for large payloads
router.use(express.json({ limit: "2mb" }));
router.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Disclaimer middleware - ensure users explicitly accept no-AI policy if provided later
const requireUniqueChoices = (req, res, next) => {
  try {
    const { firstChoice, secondChoice, thirdChoice } = req.body || {};
    const choices = [firstChoice, secondChoice, thirdChoice]
      .filter(Boolean)
      .filter((c) => c !== "I don't want to choose any more teams");
    const set = new Set(choices);
    if (choices.length !== set.size) {
      return res.status(400).json({
        success: false,
        message: "Volunteer team choices must be unique across 1st, 2nd and 3rd choices.",
      });
    }
    if (!firstChoice) {
      return res.status(400).json({ success: false, message: "First choice is required." });
    }
    if (set.size > 3) {
      return res.status(400).json({ success: false, message: "At most three team choices allowed." });
    }
    next();
  } catch (e) {
    return res.status(400).json({ success: false, message: "Invalid team choice data." });
  }
};

// POST /api/volunteer/submit
router.post("/submit", requireUniqueChoices, async (req, res) => {
  try {
    const data = req.body || {};

    // Basic required validation
    const requiredFields = [
      "email",
      "fullName",
      "whatsappNumber",
      "university",
      "whatMakesYouUnique",
      "handleConstructiveCriticism",
      "dateOfArrival",
      "dateOfDeparture",
      "firstChoice",
    ];
    for (const f of requiredFields) {
      if (!data[f] || (typeof data[f] === "string" && !data[f].trim())) {
        return res.status(400).json({ success: false, message: `${f} is required.` });
      }
    }

    // Check if email already exists
    const existingApplication = await VolunteerApplication.findOne({ email: data.email.toLowerCase() });
    if (existingApplication) {
      return res.status(409).json({ 
        success: false, 
        message: "An application with this email address already exists. Each email can only submit one volunteer application." 
      });
    }

    // Convert dates
    if (data.dateOfArrival) data.dateOfArrival = new Date(data.dateOfArrival);
    if (data.dateOfDeparture) data.dateOfDeparture = new Date(data.dateOfDeparture);

    // Save
    const doc = new VolunteerApplication({ ...data, source: "web" });
    await doc.save();

    return res.status(201).json({ success: true, message: "Application submitted successfully." });
  } catch (error) {
    console.error("Volunteer application submit error:", error);
    
    // Check for duplicate key error (MongoDB unique constraint)
    if (error.code === 11000 && error.keyPattern?.email) {
      return res.status(409).json({ 
        success: false, 
        message: "An application with this email address already exists. Each email can only submit one volunteer application." 
      });
    }
    
    return res.status(500).json({ success: false, message: error.message || "Internal server error" });
  }
});

module.exports = router;