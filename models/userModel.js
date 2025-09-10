const mongoose = require("mongoose");

const userTicketSchema = new mongoose.Schema({
  // Required for classification
  ticketType: String, // Add ticketType field
  ticketCategory: {
    type: String,
    enum: ["Standard", "All-Inclusive", "Doctor", /* "International", */ "Executive & Subcom", "Online", "Basic"],
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
  
  // Online/Basic specific fields
  isStudent: String,
  fieldOfStudy: String,
  examPreparation: String,
  otherExam: String,
  country: String,
  timeZone: String,
  sourceOfInfo: String,
  otherSource: String,
  isDfcMember: String,

  // International
  // nationality: String,
  // countryOfResidence: String,
  // passportNumber: String,
  // needsVisaSupport: String,
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
  
  // Additional consent fields for new ticket types
  declarationAccurate: Boolean,
  policyCompliance: Boolean,

  // Payment
  paymentMethod: String,
  discountConfirmation: Boolean,
  workshopPackage: String,
  // paypalOrderId: String, // Store PayPal order ID for international tickets
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "rejected"],
    default: "pending"
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("UserTicket", userTicketSchema);