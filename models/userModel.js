const mongoose = require("mongoose");

const userTicketSchema = new mongoose.Schema({
  // Required for classification
  ticketType: String, // Add ticketType field
  ticketCategory: {
    type: String,
    enum: ["Standard", "All-Inclusive", "Doctor", "International", "Executive & Subcom"],
    required: true,
  },
  subType: {
    type: String,
    enum: ["GIMSOC", "Non-GIMSOC", "TSU", "GEOMEDI", "3-Day", "7-Day", "Standard", "All-Inclusive", "Group", "Executive"],
  },

  // Common User Info
  fullName: String,
  email: { type: String, required: true },
  whatsapp: String,
  password: String, // optional, if needed
  dashboardPassword: String, // password specifically for dashboard access

  // Medical / Academic
  universityName: String,
  yearOfStudy: String,
  semester: String,
  medicalQualification: String,
  specialty: String,
  currentWorkplace: String,
  countryOfPractice: String,

  // International
  nationality: String,
  countryOfResidence: String,
  passportNumber: String,
  needsVisaSupport: String,
  emergencyContactName: String,
  emergencyContactRelationship: String,
  emergencyContactPhone: String,

  // Uploads
  headshotUrl: String,
  studentIdProofUrl: String,
  paymentProofUrl: String,

  // Preferences & Consent
  foodPreference: String,
  dietaryRestrictions: String,
  accessibilityNeeds: String,
  galaDinner: String, // Add gala dinner field

  isTsuStudent: Boolean,
  tsuEmail: String,
  isGimsocMember: Boolean,
  membershipCode: String,

  infoAccurate: Boolean,
  mediaConsent: Boolean,
  policies: Boolean,
  emailConsent: Boolean,
  whatsappConsent: Boolean,

  // Payment
  paymentMethod: String,
  discountConfirmation: Boolean,
  workshopPackage: String,
  paypalOrderId: String, // Store PayPal order ID for international tickets
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "rejected"],
    default: "pending"
  },

  // Email Tracking
  emailTracking: {
    confirmationEmailSent: {
      type: Boolean,
      default: false
    },
    confirmationEmailSentAt: {
      type: Date,
      default: null
    },
    confirmationEmailAttempts: {
      type: Number,
      default: 0
    },
    approvalEmailSent: {
      type: Boolean,
      default: false
    },
    approvalEmailSentAt: {
      type: Date,
      default: null
    },
    rejectionEmailSent: {
      type: Boolean,
      default: false
    },
    rejectionEmailSentAt: {
      type: Date,
      default: null
    },
    lastEmailError: {
      type: String,
      default: null
    },
    lastEmailErrorAt: {
      type: Date,
      default: null
    },
    emailQueueJobIds: [{
      type: String
    }]
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserTicket", userTicketSchema);