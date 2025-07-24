const express = require("express");
const router = express.Router();
const { authMiddleware } = require("../middlewares/authMiddleware.js");
const UserTicket = require("../models/userModel.js");

router.get("/getprofileinfo", authMiddleware, async (req, res) => {
  try {
    const email = req.user?.email;

    if (!email) {
      return res.status(400).json({ error: "Email not found in token." });
    }

    const user = await UserTicket.findOne({ email }).sort({ createdAt: -1 });

    if (!user) {
      return res.status(404).json({ 
        error: "No ticket found for this user. Please book a ticket first to access the dashboard.",
        code: "NO_TICKET"
      });
    }

    res.json({
      fullName: user.fullName || "No Name",
      headshotUrl: user.headshotUrl
        ? `http://localhost:8000/${user.headshotUrl}`
        : "/placeholder.svg",
      university:
        user.universityName ||
        user.currentWorkplace ||
        user.university ||
        "N/A",
      email: user.email,
      whatsapp: user.whatsapp || "N/A",
      ticketType: user.ticketType || "N/A",
      ticketId: user._id.toString(),
      workshopPackage: user.workshopPackage || "None",
      nationality: user.nationality || "N/A",
      countryOfResidence: user.countryOfResidence || "N/A",
      qrCode: user.qrCode || "",
    });
  } catch (error) {
    console.error("❌ Error in getprofileinfo:", error);
    res.status(500).json({ error: "Server error while fetching profile." });
  }
});

router.get("/check-dashboard-access", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const ticket = await UserTicket.findOne({ userId });

    if (!ticket) {
      return res.status(403).json({ message: "No ticket found. Access denied." });
    }

    res.status(200).json({ access: true });
  } catch (err) {
    res.status(500).json({ message: "Internal Server Error" });
  }
});

module.exports = router;