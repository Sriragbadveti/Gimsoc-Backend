const express = require('express');
const UserTicket = require('../models/userModel');
const router = express.Router();

// Get real-time ticket limits
router.get('/limits', async (req, res) => {
  try {
    const limits = await getCurrentTicketLimits();
    res.json(limits);
  } catch (error) {
    console.error('Error fetching ticket limits:', error);
    res.status(500).json({ error: 'Failed to fetch limits' });
  }
});

async function getCurrentTicketLimits() {
  const limits = {};
  
  // Gala tickets
  const galaCount = await UserTicket.countDocuments({
    ticketType: { $regex: /gala/i },
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.gala = {
    max: 150,
    current: galaCount,
    available: Math.max(0, 150 - galaCount),
    soldOut: galaCount >= 150
  };
  
  // Standard+2 tickets
  const standardPlus2Count = await UserTicket.countDocuments({
    ticketType: "Standard+2",
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.standardPlus2 = {
    max: 150,
    current: standardPlus2Count,
    available: Math.max(0, 150 - standardPlus2Count),
    soldOut: standardPlus2Count >= 150
  };
  
  // Standard+3 tickets
  const standardPlus3Count = await UserTicket.countDocuments({
    ticketType: "Standard+3",
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.standardPlus3 = {
    max: 150,
    current: standardPlus3Count,
    available: Math.max(0, 150 - standardPlus3Count),
    soldOut: standardPlus3Count >= 150
  };
  
  // Standard+4/Standard tickets
  const standardCount = await UserTicket.countDocuments({
    $or: [{ ticketType: "Standard+4" }, { ticketType: "Standard" }],
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.standard = {
    max: 150,
    current: standardCount,
    available: Math.max(0, 150 - standardCount),
    soldOut: standardCount >= 150
  };
  
  // Doctor tickets
  const doctorCount = await UserTicket.countDocuments({
    ticketType: { $regex: /Doctor/i },
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.doctor = {
    max: 30,
    current: doctorCount,
    available: Math.max(0, 30 - doctorCount),
    soldOut: doctorCount >= 30
  };
  
  // International tickets
  const internationalCount = await UserTicket.countDocuments({
    ticketType: { $regex: /^International/i },
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.international = {
    max: 50,
    current: internationalCount,
    available: Math.max(0, 50 - internationalCount),
    soldOut: internationalCount >= 50
  };
  
  // Internal member limits
  const executiveCount = await UserTicket.countDocuments({
    subType: "Executive",
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.executive = {
    max: 60,
    current: executiveCount,
    available: Math.max(0, 60 - executiveCount),
    soldOut: executiveCount >= 60
  };
  
  const tsuCount = await UserTicket.countDocuments({
    subType: "TSU",
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.tsu = {
    max: 50,
    current: tsuCount,
    available: Math.max(0, 50 - tsuCount),
    soldOut: tsuCount >= 50
  };
  
  const geomediCount = await UserTicket.countDocuments({
    subType: "GEOMEDI",
    ticketType: "Standard+2",
    paymentStatus: { $ne: "rejected" }
  });
  
  limits.geomedi = {
    max: 30,
    current: geomediCount,
    available: Math.max(0, 30 - geomediCount),
    soldOut: geomediCount >= 30
  };
  
  return limits;
}

module.exports = router; 