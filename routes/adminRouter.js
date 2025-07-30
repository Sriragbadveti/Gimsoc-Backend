const express = require("express");
const { google } = require("googleapis");
const Abstract  = require("../models/abstractModel.js");
const UserTicket = require("../models/userModel.js"); 
const { sendTicketApprovalEmail, sendTicketRejectionEmail } = require("../utils/emailService.js");
const { adminAuthMiddleware } = require("../middlewares/adminAuthMiddleware.js");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose"); // Added for system status

const router = express.Router();

// Handle OPTIONS requests for admin routes
router.options('*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Google Sheets API setup
let auth;
if (process.env.GOOGLE_CREDENTIALS_BASE64) {
  // Use base64 encoded credentials from environment variable
  const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
} else {
  // Use key file (for local development)
  auth = new google.auth.GoogleAuth({
    keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

// Test endpoint for debugging
router.get("/test-sheets", async (req, res) => {
  try {
    console.log("🧪 Testing Google Sheets connection...");
    
    // Test environment variables
    console.log("🔑 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64 exists:", !!process.env.GOOGLE_CREDENTIALS_BASE64);
    console.log("- GOOGLE_SHEET_ID exists:", !!process.env.GOOGLE_SHEET_ID);
    
    if (!process.env.GOOGLE_CREDENTIALS_BASE64) {
      return res.status(500).json({ error: "GOOGLE_CREDENTIALS_BASE64 not found" });
    }
    
    if (!process.env.GOOGLE_SHEET_ID) {
      return res.status(500).json({ error: "GOOGLE_SHEET_ID not found" });
    }
    
    // Test credentials parsing
    try {
      const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
      console.log("✅ Credentials parsed successfully");
      console.log("- Client email:", credentials.client_email);
    } catch (parseError) {
      console.error("❌ Failed to parse credentials:", parseError);
      return res.status(500).json({ error: "Failed to parse credentials: " + parseError.message });
    }
    
    // Test Google Sheets API connection
    const sheets = google.sheets({ version: "v4", auth });
    
    try {
      const response = await sheets.spreadsheets.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID
      });
      console.log("✅ Successfully connected to Google Sheets");
      console.log("- Spreadsheet title:", response.data.properties.title);
      console.log("- Number of sheets:", response.data.sheets.length);
      
      res.json({
        success: true,
        message: "Google Sheets connection successful",
        spreadsheetTitle: response.data.properties.title,
        sheetCount: response.data.sheets.length
      });
    } catch (sheetsError) {
      console.error("❌ Google Sheets API error:", sheetsError);
      return res.status(500).json({ 
        error: "Google Sheets API error: " + sheetsError.message,
        details: sheetsError.response?.data || sheetsError
      });
    }
    
  } catch (error) {
    console.error("❌ Test endpoint error:", error);
    res.status(500).json({ error: "Test failed: " + error.message });
  }
});

// GET ALL TICKETS for ADMIN dashboard
router.get("/getalltickets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("🔍 Fetching all tickets...");
    // Assuming your model is named UserTicket
    const tickets = await UserTicket.find()
      .sort({ createdAt: -1 }) // latest tickets first
      .lean();

    console.log("📊 Found tickets:", tickets.length);
    tickets.forEach((ticket, index) => {
      console.log(`Ticket ${index + 1}:`, {
        id: ticket._id,
        name: ticket.fullName,
        status: ticket.paymentStatus || "null/undefined"
      });
    });

    // Map tickets to include all detailed information
    const processedTickets = tickets.map(ticket => ({
      _id: ticket._id,
      ticketType: ticket.ticketType,
      ticketCategory: ticket.ticketCategory,
      subType: ticket.subType,
      fullName: ticket.fullName,
      email: ticket.email,
      whatsapp: ticket.whatsapp,
      dashboardPassword: ticket.dashboardPassword,
      workshopPackage: ticket.workshopPackage,
      paymentStatus: ticket.paymentStatus,
      headshotUrl: ticket.headshotUrl || null,
      paymentProofUrl: ticket.paymentProofUrl || null,
      universityName: ticket.universityName,
      semester: ticket.semester,
      medicalQualification: ticket.medicalQualification,
      specialty: ticket.specialty,
      currentWorkplace: ticket.currentWorkplace,
      countryOfPractice: ticket.countryOfPractice,
      nationality: ticket.nationality,
      countryOfResidence: ticket.countryOfResidence,
      passportNumber: ticket.passportNumber,
      needsVisaSupport: ticket.needsVisaSupport,
      emergencyContactName: ticket.emergencyContactName,
      emergencyContactRelationship: ticket.emergencyContactRelationship,
      emergencyContactPhone: ticket.emergencyContactPhone,
      foodPreference: ticket.foodPreference,
      dietaryRestrictions: ticket.dietaryRestrictions,
      accessibilityNeeds: ticket.accessibilityNeeds,
      galaDinner: ticket.galaDinner,
      isTsuStudent: ticket.isTsuStudent,
      tsuEmail: ticket.tsuEmail,
      isGimsocMember: ticket.isGimsocMember,
      membershipCode: ticket.membershipCode,
      infoAccurate: ticket.infoAccurate,
      mediaConsent: ticket.mediaConsent,
      policies: ticket.policies,
      emailConsent: ticket.emailConsent,
      whatsappConsent: ticket.whatsappConsent,
      paymentMethod: ticket.paymentMethod,
      discountConfirmation: ticket.discountConfirmation,
      paypalOrderId: ticket.paypalOrderId, // Add PayPal order ID for international tickets
      attendees: ticket.attendees?.map(att => ({
        name: att.name,
        email: att.email,
        headshotUrl: att.headshotUrl || null,
      })) || [],
      createdAt: ticket.createdAt,
    }));

    return res.status(200).json(processedTickets);
  } catch (err) {
    console.error("Error fetching tickets for admin:", err);
    res.status(500).json({ message: "Failed to fetch tickets" });
  }
});

// GET TICKET SUMMARY STATISTICS (excluding rejected tickets)
router.get("/ticket-summary", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Fetching ticket summary statistics...");
    
    // Get counts - pending and completed count towards limits, rejected don't
    const summary = {
      total: await UserTicket.countDocuments({ paymentStatus: { $ne: "rejected" } }),
      pending: await UserTicket.countDocuments({ paymentStatus: "pending" }),
      completed: await UserTicket.countDocuments({ paymentStatus: "completed" }),
      rejected: await UserTicket.countDocuments({ paymentStatus: "rejected" }),
      
      // Ticket type breakdown (pending and completed count towards limits)
      standardPlus2: await UserTicket.countDocuments({ 
        ticketType: "Standard+2", 
        paymentStatus: { $ne: "rejected" } 
      }),
      standardPlus3: await UserTicket.countDocuments({ 
        ticketType: "Standard+3", 
        paymentStatus: { $ne: "rejected" }
      }),
      standardPlus4: await UserTicket.countDocuments({ 
        $or: [{ ticketType: "Standard+4" }, { ticketType: "Standard" }],
        paymentStatus: { $ne: "rejected" } 
      }),
      doctor: await UserTicket.countDocuments({ 
        ticketType: { $regex: /^Doctor/i }, 
        paymentStatus: { $ne: "rejected" } 
      }),
      international: await UserTicket.countDocuments({ 
        ticketType: { $regex: /^International/i }, 
        paymentStatus: { $ne: "rejected" } 
      }),
      
      // Subtype breakdown (pending and completed count towards limits)
      executive: await UserTicket.countDocuments({ 
        subType: "Executive", 
        paymentStatus: { $ne: "rejected" } 
      }),
      tsu: await UserTicket.countDocuments({ 
        subType: "TSU", 
        paymentStatus: { $ne: "rejected" } 
      }),
      geomedi: await UserTicket.countDocuments({ 
        subType: "GEOMEDI", 
        ticketType: "Standard+2",
        paymentStatus: { $ne: "rejected" } 
      }),
      
      // Gala dinner counts (including automatic inclusions for all-inclusive doctor tickets)
      galaTickets: await UserTicket.countDocuments({ 
        galaDinner: { $regex: /Yes/i },
        paymentStatus: { $ne: "rejected" } 
      }),
      galaLimit: 150
    };
    
    console.log("📊 Ticket summary:", summary);
    return res.status(200).json(summary);
  } catch (err) {
    console.error("Error fetching ticket summary:", err);
    res.status(500).json({ message: "Failed to fetch ticket summary" });
  }
});

// Note: Files are now stored in Cloudinary, not local storage

// Test endpoint to check file URLs in database
router.get("/file-urls", adminAuthMiddleware, async (req, res) => {
  try {
    const tickets = await UserTicket.find({}, { headshotUrl: 1, paymentProofUrl: 1, fullName: 1 }).limit(5);
    const abstracts = await Abstract.find({}, { abstractFileURL: 1, title: 1 }).limit(5);
    
    res.json({
      tickets: tickets.map(t => ({ 
        fullName: t.fullName, 
        headshotUrl: t.headshotUrl, 
        paymentProofUrl: t.paymentProofUrl 
      })),
      abstracts: abstracts.map(a => ({ 
        title: a.title, 
        abstractFileURL: a.abstractFileURL 
      }))
    });
  } catch (error) {
    console.error("Error fetching file URLs:", error);
    res.status(500).json({ message: "Failed to fetch file URLs" });
  }
});

router.patch("/approveticket/:ticketId", adminAuthMiddleware, async (req, res) => {
  const { ticketId } = req.params;
  const { paymentStatus } = req.body;

  console.log("🔧 Updating ticket status:", { ticketId, paymentStatus });

  try {
    const ticket = await UserTicket.findById(ticketId);

    if (!ticket) {
      console.log("❌ Ticket not found:", ticketId);
      return res.status(404).json({ message: "Ticket not found" });
    }

    console.log("📊 Current ticket status:", ticket.paymentStatus);
    console.log("📊 New status to set:", paymentStatus);

    ticket.paymentStatus = paymentStatus;
    await ticket.save();

    console.log("✅ Ticket status updated successfully. New status:", ticket.paymentStatus);

    // Send email based on status
    if (paymentStatus === "completed") {
      try {
        await sendTicketApprovalEmail({
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory,
        });
        
        // Update email tracking for approval
        await UserTicket.findByIdAndUpdate(id, {
          $set: {
            'emailTracking.approvalEmailSent': true,
            'emailTracking.approvalEmailSentAt': new Date(),
            'emailTracking.lastEmailError': null,
            'emailTracking.lastEmailErrorAt': null
          }
        });
        
        console.log("✅ Approval email sent successfully to:", ticket.email);
      } catch (emailError) {
        console.error("❌ Failed to send approval email:", emailError);
        
        // Update email tracking for approval failure
        await UserTicket.findByIdAndUpdate(id, {
          $set: {
            'emailTracking.lastEmailError': emailError.message || 'Approval email failed',
            'emailTracking.lastEmailErrorAt': new Date()
          }
        });
      }
    } else if (paymentStatus === "rejected") {
      try {
        await sendTicketRejectionEmail({
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory,
        });
        
        // Update email tracking for rejection
        await UserTicket.findByIdAndUpdate(id, {
          $set: {
            'emailTracking.rejectionEmailSent': true,
            'emailTracking.rejectionEmailSentAt': new Date(),
            'emailTracking.lastEmailError': null,
            'emailTracking.lastEmailErrorAt': null
          }
        });
        
        console.log("✅ Rejection email sent successfully to:", ticket.email);
      } catch (emailError) {
        console.error("❌ Failed to send rejection email:", emailError);
        
        // Update email tracking for rejection failure
        await UserTicket.findByIdAndUpdate(id, {
          $set: {
            'emailTracking.lastEmailError': emailError.message || 'Rejection email failed',
            'emailTracking.lastEmailErrorAt': new Date()
          }
        });
      }
    }

    return res.status(200).json({ message: "Ticket status updated successfully", ticket });
  } catch (error) {
    console.error("Error updating ticket status:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// ✅ NEW: GET ALL ABSTRACT SUBMISSIONS
router.get("/getallabstracts", adminAuthMiddleware, async (req, res) => {
  try {
    const abstracts = await Abstract.find().sort({ createdAt: -1 }).lean();

    const processedAbstracts = abstracts.map((abs) => ({
      _id: abs._id,
      fullName: abs.fullName,
      email: abs.email,
      whatsapp: abs.whatsapp,
      title: abs.title,
      category: abs.category,
      authors: abs.authors,
      presentingAuthor: abs.presentingAuthor,
      isPresentingAuthorSame: abs.isPresentingAuthorSame,
      hasTicket: abs.hasTicket,
      ticketId: abs.ticketId || null,
      abstractFileURL: abs.abstractFileURL ? new URL(abs.abstractFileURL, process.env.BASE_URL).href : null,
      originalityConsent: abs.originalityConsent,
      disqualificationConsent: abs.disqualificationConsent,
      permissionConsent: abs.permissionConsent,
      createdAt: abs.createdAt,
    }));

    res.status(200).json(processedAbstracts);
  } catch (err) {
    console.error("Error fetching abstracts:", err);
    res.status(500).json({ message: "Failed to fetch abstracts" });
  }
});

// Export tickets to Google Sheets
router.post("/export-to-sheets", adminAuthMiddleware, async (req, res) => {
  try {
    console.log("📊 Starting Google Sheets export...");
    console.log("🔍 Environment check:");
    console.log("- GOOGLE_CREDENTIALS_BASE64:", process.env.GOOGLE_CREDENTIALS_BASE64 ? "Set" : "Not set");
    console.log("- GOOGLE_SHEET_ID:", process.env.GOOGLE_SHEET_ID || "Not set");
    
    const { tickets, date } = req.body;
    
    if (!tickets || !Array.isArray(tickets)) {
      console.log("❌ Invalid tickets data received");
      return res.status(400).json({ 
        success: false, 
        message: "Invalid tickets data" 
      });
    }

    console.log(`📋 Processing ${tickets.length} tickets...`);

    // Test auth setup
    console.log("🔐 Testing authentication...");
    let auth;
    try {
      if (process.env.GOOGLE_CREDENTIALS_BASE64) {
        console.log("🔐 Using base64 credentials...");
        const credentials = JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_BASE64, 'base64').toString());
        auth = new google.auth.GoogleAuth({
          credentials,
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      } else {
        console.log("🔐 Using key file...");
        auth = new google.auth.GoogleAuth({
          keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH || "./google-credentials.json",
          scopes: ["https://www.googleapis.com/auth/spreadsheets"],
        });
      }
      console.log("✅ Authentication setup successful");
    } catch (authError) {
      console.error("❌ Authentication setup failed:", authError);
      return res.status(500).json({ 
        success: false, 
        message: "Authentication setup failed: " + authError.message 
      });
    }

    // Get Google Sheets API client
    console.log("📊 Initializing Google Sheets client...");
    const sheets = google.sheets({ version: "v4", auth });
    
    // Create or get the spreadsheet
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    if (!spreadsheetId) {
      console.log("❌ GOOGLE_SHEET_ID not configured");
      return res.status(500).json({ 
        success: false, 
        message: "Google Sheet ID not configured" 
      });
    }

    // Filter out rejected tickets
    const validTickets = tickets.filter(ticket => ticket.paymentStatus !== "rejected");
    console.log(`📊 Filtered tickets: ${validTickets.length} valid out of ${tickets.length} total`);
    
    // Prepare data for export
    const headers = [
      "Ticket ID",
      "Full Name", 
      "Email",
      "Ticket Type",
      "Ticket Category",
      "Sub Type",
      "Payment Status",
      "Gala Dinner",
      "Workshop Package",
      "Food Preference",
      "Dietary Restrictions",
      "Accessibility Needs",
      "Medical Qualification",
      "Specialty",
      "Current Workplace",
      "Country of Practice",
      "Is TSU Student",
      "Is GIMSOC Member",
      "Membership Code",
      "TSU Email",
      "Semester",
      "Nationality",
      "Country of Residence",
      "Passport Number",
      "Needs Visa Support",
      "University Name",
      "Year of Study",
      "Emergency Contact Name",
      "Emergency Contact Relationship",
      "Emergency Contact Phone",
      "Created At",
      "Updated At"
    ];

    const rows = validTickets.map(ticket => [
      ticket._id || ticket.id,
      ticket.fullName || "",
      ticket.email || "",
      ticket.ticketType || "",
      ticket.ticketCategory || "",
      ticket.subType || "",
      ticket.paymentStatus || "",
      ticket.galaDinner || "",
      ticket.workshopPackage || "",
      ticket.foodPreference || "",
      ticket.dietaryRestrictions || "",
      ticket.accessibilityNeeds || "",
      ticket.medicalQualification || "",
      ticket.specialty || "",
      ticket.currentWorkplace || "",
      ticket.countryOfPractice || "",
      ticket.isTsuStudent ? "Yes" : "No",
      ticket.isGimsocMember ? "Yes" : "No",
      ticket.membershipCode || "",
      ticket.tsuEmail || "",
      ticket.semester || "",
      ticket.nationality || "",
      ticket.countryOfResidence || "",
      ticket.passportNumber || "",
      ticket.needsVisaSupport || "",
      ticket.universityName || "",
      ticket.yearOfStudy || "",
      ticket.emergencyContactName || "",
      ticket.emergencyContactRelationship || "",
      ticket.emergencyContactPhone || "",
      ticket.createdAt ? new Date(ticket.createdAt).toLocaleString() : "",
      ticket.updatedAt ? new Date(ticket.updatedAt).toLocaleString() : ""
    ]);

    // Create sheet name with date
    // Create valid sheet name (replace hyphens with underscores)
    const rawDate = date || new Date().toISOString().split('T')[0];
    const sheetName = `Tickets_${rawDate.replace(/-/g, '_')}`;
    console.log(`📊 Using sheet name: ${sheetName}`);
    
    try {
      // First, check if the sheet exists
      console.log("🔍 Checking if sheet exists...");
      const spreadsheetInfo = await sheets.spreadsheets.get({
        spreadsheetId
      });
      
      const sheetExists = spreadsheetInfo.data.sheets.some(sheet => 
        sheet.properties.title === sheetName
      );
      
      if (!sheetExists) {
        console.log("📄 Sheet doesn't exist, creating new sheet...");
        // Create the sheet
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          resource: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: sheetName
                  }
                }
              }
            ]
          }
        });
        console.log("✅ New sheet created successfully");
      } else {
        console.log("✅ Sheet already exists");
      }
      
      // Clear existing data and add headers
      console.log("🧹 Clearing existing data...");
      await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: sheetName,
      });
      console.log("✅ Data cleared successfully");

      // Add headers and data
      console.log("📝 Writing data to sheet...");
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        resource: {
          values: [headers, ...rows]
        }
      });
      console.log("✅ Data written successfully");
    } catch (sheetError) {
      console.error("❌ Sheet operation failed:", sheetError);
      console.error("❌ Error details:", {
        message: sheetError.message,
        code: sheetError.code,
        status: sheetError.status,
        response: sheetError.response?.data
      });
      return res.status(500).json({ 
        success: false, 
        message: "Sheet operation failed: " + sheetError.message,
        details: {
          code: sheetError.code,
          status: sheetError.status,
          response: sheetError.response?.data
        }
      });
    }

    // Format headers (make them bold)
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: await getSheetId(sheets, spreadsheetId, sheetName),
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length
              },
              cell: {
                userEnteredFormat: {
                  textFormat: {
                    bold: true
                  },
                  backgroundColor: {
                    red: 0.2,
                    green: 0.6,
                    blue: 0.9
                  }
                }
              },
              fields: "userEnteredFormat"
            }
          }
        ]
      }
    });

    const sheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0`;
    const specificSheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=0&range=${sheetName}!A1`;
    
    console.log(`✅ Successfully exported ${rows.length} valid tickets to Google Sheets`);
    console.log(`📊 Sheet URL: ${sheetUrl}`);
    console.log(`📊 Sheet name: ${sheetName}`);
    console.log(`📊 Data range: A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`);
    
    res.json({
      success: true,
      exportedCount: rows.length,
      totalTickets: tickets.length,
      validTickets: validTickets.length,
      rejectedTickets: tickets.length - validTickets.length,
      sheetUrl: sheetUrl,
      specificSheetUrl: specificSheetUrl,
      sheetName: sheetName,
      dataRange: `A1:${String.fromCharCode(65 + headers.length - 1)}${rows.length + 1}`,
      message: `Successfully exported ${rows.length} valid tickets to Google Sheets in sheet '${sheetName}' (excluded ${tickets.length - validTickets.length} rejected tickets)`
    });

  } catch (error) {
    console.error("❌ Error exporting to Google Sheets:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Failed to export to Google Sheets"
    });
  }
});

// System status endpoint
router.get("/system-status", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    
    // Get database connection status
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Get email queue status
    const emailQueueStatus = emailQueue.getStatus();
    
    // Get memory usage
    const memUsage = process.memoryUsage();
    
    // Get uptime
    const uptime = process.uptime();
    
    res.json({
      timestamp: new Date().toISOString(),
      system: {
        uptime: Math.floor(uptime),
        memory: {
          rss: Math.round(memUsage.rss / 1024 / 1024) + ' MB',
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + ' MB',
          heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024) + ' MB'
        }
      },
      database: {
        status: dbStatus,
        connectionPool: {
          maxPoolSize: 50,
          minPoolSize: 10
        }
      },
      emailQueue: emailQueueStatus,
      performance: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch
      }
    });
  } catch (error) {
    console.error("❌ Error getting system status:", error);
    res.status(500).json({ error: "Failed to get system status" });
  }
});

// Clear email queue endpoint
router.post("/clear-email-queue", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    const clearedCount = emailQueue.clearQueue();
    
    res.json({
      message: "Email queue cleared successfully",
      clearedCount: clearedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error clearing email queue:", error);
    res.status(500).json({ error: "Failed to clear email queue" });
  }
});

// Get failed emails endpoint
router.get("/failed-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    const failedEmails = emailQueue.getFailedEmails();
    
    res.json({
      failedEmails: failedEmails,
      count: failedEmails.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error getting failed emails:", error);
    res.status(500).json({ error: "Failed to get failed emails" });
  }
});

// Retry failed emails endpoint
router.post("/retry-failed-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    const retriedCount = emailQueue.retryFailedEmails();
    
    res.json({
      message: "Failed emails added back to queue",
      retriedCount: retriedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error retrying failed emails:", error);
    res.status(500).json({ error: "Failed to retry failed emails" });
  }
});

// Clear failed emails endpoint
router.post("/clear-failed-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const emailQueue = require("../utils/emailQueue");
    const clearedCount = emailQueue.clearFailedEmails();
    
    res.json({
      message: "Failed emails list cleared successfully",
      clearedCount: clearedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error clearing failed emails:", error);
    res.status(500).json({ error: "Failed to clear failed emails" });
  }
});

// Test email endpoint for debugging
router.post("/test-email", adminAuthMiddleware, async (req, res) => {
  try {
    const { email, fullName } = req.body;
    
    if (!email || !fullName) {
      return res.status(400).json({ error: "Email and fullName are required" });
    }

    const emailQueue = require("../utils/emailQueue");
    const testEmailData = {
      fullName: fullName,
      email: email,
      ticketType: "Test Email",
      ticketCategory: "Admin Test",
      ticketId: "TEST_" + Date.now()
    };

    const jobId = emailQueue.addToQueue(testEmailData);
    
    res.json({
      message: "Test email queued successfully",
      jobId: jobId,
      emailData: testEmailData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// Email Audit - Get all users with their email status
router.get("/email-audit", adminAuthMiddleware, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;
    
    // Filter options
    const filter = {};
    if (req.query.emailStatus) {
      switch (req.query.emailStatus) {
        case 'sent':
          filter['emailTracking.confirmationEmailSent'] = true;
          break;
        case 'not_sent':
          filter['emailTracking.confirmationEmailSent'] = { $ne: true };
          break;
        case 'failed':
          filter['emailTracking.lastEmailError'] = { $ne: null };
          break;
      }
    }
    
    if (req.query.paymentStatus) {
      filter.paymentStatus = req.query.paymentStatus;
    }
    
    if (req.query.search) {
      filter.$or = [
        { fullName: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const tickets = await UserTicket.find(filter)
      .select('fullName email ticketType ticketCategory paymentStatus createdAt emailTracking')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalCount = await UserTicket.countDocuments(filter);
    
    // Calculate email statistics
    const emailStats = await UserTicket.aggregate([
      { $match: {} },
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          confirmationEmailsSent: {
            $sum: { $cond: [{ $eq: ['$emailTracking.confirmationEmailSent', true] }, 1, 0] }
          },
          approvalEmailsSent: {
            $sum: { $cond: [{ $eq: ['$emailTracking.approvalEmailSent', true] }, 1, 0] }
          },
          rejectionEmailsSent: {
            $sum: { $cond: [{ $eq: ['$emailTracking.rejectionEmailSent', true] }, 1, 0] }
          },
          usersWithErrors: {
            $sum: { $cond: [{ $ne: ['$emailTracking.lastEmailError', null] }, 1, 0] }
          },
          pendingUsers: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'pending'] }, 1, 0] }
          },
          completedUsers: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'completed'] }, 1, 0] }
          },
          rejectedUsers: {
            $sum: { $cond: [{ $eq: ['$paymentStatus', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = emailStats[0] || {
      totalUsers: 0,
      confirmationEmailsSent: 0,
      approvalEmailsSent: 0,
      rejectionEmailsSent: 0,
      usersWithErrors: 0,
      pendingUsers: 0,
      completedUsers: 0,
      rejectedUsers: 0
    };

    // Add calculated fields
    stats.confirmationEmailsNotSent = stats.totalUsers - stats.confirmationEmailsSent;
    stats.confirmationEmailSuccessRate = stats.totalUsers > 0 
      ? ((stats.confirmationEmailsSent / stats.totalUsers) * 100).toFixed(2) + '%'
      : '0%';

    res.json({
      tickets: tickets,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount: totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      },
      statistics: stats,
      filters: {
        emailStatus: req.query.emailStatus || 'all',
        paymentStatus: req.query.paymentStatus || 'all',
        search: req.query.search || ''
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting email audit:", error);
    res.status(500).json({ error: "Failed to get email audit data" });
  }
});

// Email Audit - Get users who haven't received confirmation emails
router.get("/users-without-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const tickets = await UserTicket.find({
      $or: [
        { 'emailTracking.confirmationEmailSent': { $ne: true } },
        { 'emailTracking.confirmationEmailSent': { $exists: false } }
      ]
    })
    .select('fullName email ticketType ticketCategory paymentStatus createdAt emailTracking')
    .sort({ createdAt: -1 });

    res.json({
      count: tickets.length,
      tickets: tickets,
      message: `Found ${tickets.length} users who haven't received confirmation emails`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting users without emails:", error);
    res.status(500).json({ error: "Failed to get users without emails" });
  }
});

// Email Audit - Get users with email errors
router.get("/users-with-email-errors", adminAuthMiddleware, async (req, res) => {
  try {
    const tickets = await UserTicket.find({
      'emailTracking.lastEmailError': { $ne: null }
    })
    .select('fullName email ticketType ticketCategory paymentStatus createdAt emailTracking')
    .sort({ 'emailTracking.lastEmailErrorAt': -1 });

    res.json({
      count: tickets.length,
      tickets: tickets,
      message: `Found ${tickets.length} users with email errors`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error getting users with email errors:", error);
    res.status(500).json({ error: "Failed to get users with email errors" });
  }
});

// Bulk resend confirmation emails to users who haven't received them
router.post("/resend-confirmation-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const { ticketIds, resendAll } = req.body;
    
    let filter = {};
    
    if (resendAll) {
      // Resend to all users who haven't received confirmation emails
      filter = {
        $or: [
          { 'emailTracking.confirmationEmailSent': { $ne: true } },
          { 'emailTracking.confirmationEmailSent': { $exists: false } }
        ]
      };
    } else if (ticketIds && Array.isArray(ticketIds)) {
      // Resend to specific ticket IDs
      filter = { _id: { $in: ticketIds } };
    } else {
      return res.status(400).json({ 
        error: "Either provide ticketIds array or set resendAll to true" 
      });
    }

    const tickets = await UserTicket.find(filter)
      .select('fullName email ticketType ticketCategory _id');

    if (tickets.length === 0) {
      return res.json({
        message: "No tickets found matching the criteria",
        queuedCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    const emailQueue = require("../utils/emailQueue");
    let queuedCount = 0;
    const queuedTickets = [];

    for (const ticket of tickets) {
      const emailData = {
        fullName: ticket.fullName,
        email: ticket.email,
        ticketType: ticket.ticketType,
        ticketCategory: ticket.ticketCategory,
        ticketId: ticket._id.toString()
      };

      const jobId = emailQueue.addToQueue(emailData);
      queuedCount++;
      queuedTickets.push({
        ticketId: ticket._id,
        email: ticket.email,
        fullName: ticket.fullName,
        jobId: jobId
      });
    }

    res.json({
      message: `Successfully queued ${queuedCount} confirmation emails for resending`,
      queuedCount: queuedCount,
      queuedTickets: queuedTickets,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error resending confirmation emails:", error);
    res.status(500).json({ error: "Failed to resend confirmation emails" });
  }
});

// Resend approval/rejection emails based on current payment status
router.post("/resend-status-emails", adminAuthMiddleware, async (req, res) => {
  try {
    const { ticketIds, emailType } = req.body; // emailType: 'approval' or 'rejection'
    
    if (!ticketIds || !Array.isArray(ticketIds)) {
      return res.status(400).json({ error: "ticketIds array is required" });
    }

    if (!emailType || !['approval', 'rejection'].includes(emailType)) {
      return res.status(400).json({ 
        error: "emailType must be either 'approval' or 'rejection'" 
      });
    }

    const requiredStatus = emailType === 'approval' ? 'completed' : 'rejected';
    const tickets = await UserTicket.find({
      _id: { $in: ticketIds },
      paymentStatus: requiredStatus
    });

    if (tickets.length === 0) {
      return res.json({
        message: `No tickets found with ${requiredStatus} status`,
        sentCount: 0,
        timestamp: new Date().toISOString()
      });
    }

    const { sendTicketApprovalEmail, sendTicketRejectionEmail } = require("../utils/emailService.js");
    const sendFunction = emailType === 'approval' ? sendTicketApprovalEmail : sendTicketRejectionEmail;
    
    let sentCount = 0;
    const results = [];

    for (const ticket of tickets) {
      try {
        await sendFunction({
          fullName: ticket.fullName,
          email: ticket.email,
          ticketType: ticket.ticketType,
          ticketCategory: ticket.ticketCategory,
        });

        // Update email tracking
        const updateField = emailType === 'approval' 
          ? 'emailTracking.approvalEmailSent' 
          : 'emailTracking.rejectionEmailSent';
        const updateDateField = emailType === 'approval'
          ? 'emailTracking.approvalEmailSentAt'
          : 'emailTracking.rejectionEmailSentAt';

        await UserTicket.findByIdAndUpdate(ticket._id, {
          $set: {
            [updateField]: true,
            [updateDateField]: new Date(),
            'emailTracking.lastEmailError': null,
            'emailTracking.lastEmailErrorAt': null
          }
        });

        sentCount++;
        results.push({
          ticketId: ticket._id,
          email: ticket.email,
          status: 'sent'
        });

      } catch (error) {
        console.error(`❌ Failed to send ${emailType} email to ${ticket.email}:`, error);
        
        await UserTicket.findByIdAndUpdate(ticket._id, {
          $set: {
            'emailTracking.lastEmailError': error.message || `${emailType} email failed`,
            'emailTracking.lastEmailErrorAt': new Date()
          }
        });

        results.push({
          ticketId: ticket._id,
          email: ticket.email,
          status: 'failed',
          error: error.message
        });
      }
    }

    res.json({
      message: `Resent ${sentCount} ${emailType} emails out of ${tickets.length} tickets`,
      sentCount: sentCount,
      totalCount: tickets.length,
      results: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error resending status emails:", error);
    res.status(500).json({ error: "Failed to resend status emails" });
  }
});

// Parse and analyze email logs from Render logs
router.post("/analyze-render-logs", adminAuthMiddleware, async (req, res) => {
  try {
    const { logText } = req.body;
    
    if (!logText) {
      return res.status(400).json({ error: "logText is required" });
    }

    const EmailLogger = require("../utils/emailLogger");
    
    // Extract email logs from the provided log text
    const emailLogs = EmailLogger.extractEmailLogs(logText);
    
    if (emailLogs.length === 0) {
      return res.json({
        message: "No email logs found in the provided text",
        emailLogs: [],
        summary: null,
        timestamp: new Date().toISOString()
      });
    }

    // Analyze the extracted logs
    const analysis = EmailLogger.analyzeEmailLogs(emailLogs);
    
    res.json({
      message: `Found ${emailLogs.length} email log entries`,
      emailLogs: emailLogs,
      summary: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error analyzing render logs:", error);
    res.status(500).json({ error: "Failed to analyze render logs" });
  }
});

// Get email logs from local file (if available)
router.get("/email-logs", adminAuthMiddleware, async (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const EmailLogger = require("../utils/emailLogger");
    
    const logFile = path.join(__dirname, '../logs/email.log');
    
    if (!fs.existsSync(logFile)) {
      return res.json({
        message: "No local email log file found. Use /analyze-render-logs to analyze Render logs.",
        emailLogs: [],
        summary: null,
        timestamp: new Date().toISOString()
      });
    }

    const logText = fs.readFileSync(logFile, 'utf8');
    const emailLogs = EmailLogger.extractEmailLogs(logText);
    const analysis = EmailLogger.analyzeEmailLogs(emailLogs);
    
    res.json({
      message: `Found ${emailLogs.length} email log entries from local file`,
      emailLogs: emailLogs,
      summary: analysis,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error("❌ Error reading email logs:", error);
    res.status(500).json({ error: "Failed to read email logs" });
  }
});

// Helper function to get sheet ID
async function getSheetId(sheets, spreadsheetId, sheetName) {
  try {
    const response = await sheets.spreadsheets.get({
      spreadsheetId
    });
    
    const sheet = response.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : 0;
  } catch (error) {
    console.error("Error getting sheet ID:", error);
    return 0;
  }
}

module.exports = router;