const mongoose = require("mongoose");

const workshopRegistrationSchema = new mongoose.Schema(
  {
    // Workshop Information
    workshopId: { 
      type: String, 
      required: true,
      enum: ["amboss", "biome", "scientific-series", "project-img", "vaccine-voices", "silent-siege", "uae-licensing", "linkedin-proficiency"]
    },
    workshopTitle: { type: String, required: true },
    
    // Personal Information
    fullName: { type: String, required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    whatsapp: { type: String, required: true },
    country: { type: String, required: true },
    
    // Academic Information
    university: { type: String, required: true },
    otherUniversity: { type: String }, // For "Other" option
    currentSemester: { 
      type: String, 
      required: true,
      enum: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12", "Graduated"]
    },
    
    // GIMSOC Membership
    isGimsocMember: { 
      type: String, 
      required: true,
      enum: ["Yes", "No"]
    },
    gimsocCode: { type: String }, // Required if isGimsocMember is "Yes"
    
    // MEDCON Attendance
    isMedconAttendee: { 
      type: String, 
      required: true,
      enum: ["Yes", "No"]
    },
    
    // Scientific Series Specific Fields
    selectedScientificSeries: { type: String }, // For scientific-series workshop
    paymentProof: { type: String }, // File path for payment proof
    
    // Registration Metadata
    registrationDate: { type: Date, default: Date.now },
    source: { type: String, default: "web" },
    status: { 
      type: String, 
      default: "pending",
      enum: ["pending", "confirmed", "cancelled"]
    },
    
    // Additional Notes
    notes: { type: String },
  },
  { 
    timestamps: true,
    // Add compound index for email + workshopId to prevent duplicate registrations
    indexes: [
      { email: 1, workshopId: 1 }, // Unique constraint will be added
      { workshopId: 1, registrationDate: -1 }, // For admin queries
      { email: 1 }, // For user queries
    ]
  }
);

// Add unique compound index to prevent duplicate registrations
workshopRegistrationSchema.index({ email: 1, workshopId: 1 }, { unique: true });

// Pre-save validation
workshopRegistrationSchema.pre("save", function (next) {
  // Validate GIMSOC code requirement
  if (this.isGimsocMember === "Yes" && (!this.gimsocCode || this.gimsocCode.trim() === "")) {
    return next(new Error("GIMSOC membership code is required when you are a GIMSOC member."));
  }
  
  // Validate scientific series selection
  if (this.workshopId === "scientific-series" && (!this.selectedScientificSeries || this.selectedScientificSeries.trim() === "")) {
    return next(new Error("Scientific series selection is required for this workshop."));
  }
  
  // Validate payment proof for paid events
  if (this.workshopId === "scientific-series" && this.selectedScientificSeries && !this.selectedScientificSeries.includes("Free") && !this.paymentProof) {
    return next(new Error("Payment proof is required for paid scientific series events."));
  }
  
  next();
});

// Virtual for workshop details
workshopRegistrationSchema.virtual("workshopDetails").get(function() {
  const workshops = {
    "amboss": {
      title: "The AMBOSS Compass: Navigating the USMLE Pathway",
      date: "22nd October 2025",
      organization: "AMBOSS"
    },
    "biome": {
      title: "Biome - Leading Minds in Gut Health",
      date: "7th September, 2025",
      organization: "Biome"
    },
    "scientific-series": {
      title: "From Curiosity to Conference -- The Researcher's Toolkit",
      date: "Multiple dates (Sept 14, 21, 28)",
      organization: "INSPECT-LB, MEDICA-RI, Scientific Department"
    },
    "project-img": {
      title: "From Isolation to Solidarity: Social Impacts of Infectious Disease",
      date: "1st October 2025",
      organization: "Project IMG"
    },
    "vaccine-voices": {
      title: "Vaccine Voices: Addressing Hesitancy, Protecting Futures",
      date: "5th October, 2025",
      organization: "Doctors for a Cause (DFC)"
    },
    "silent-siege": {
      title: "Silent Siege: Navigating AMR and Mold Epidemics",
      date: "12th October, 2025",
      organization: "The CDC"
    },
    "uae-licensing": {
      title: "Pathway to Practice – UAE Medical Licensing",
      date: "15th October, 2025",
      organization: "UAE Medical Licensing"
    },
    "linkedin-proficiency": {
      title: "Career Snap 360 - Your Guide to LinkedIn Proficiency",
      date: "21st October, 2025",
      organization: "Career Development"
    }
  };
  
  return workshops[this.workshopId] || null;
});

module.exports = mongoose.model("WorkshopRegistration", workshopRegistrationSchema);


