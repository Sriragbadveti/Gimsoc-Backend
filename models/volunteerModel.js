const mongoose = require("mongoose");

const TeamChoices = [
  "LOGISTICS TEAM - Volunteer",
  "PR and MARKETING TEAM - Volunteer",
  "ORGANIZATION and PROGRAMME PLANNING TEAM - Volunteer",
  "WORKSHOP TEAM - Volunteer",
  "REGISTRATION and ATTENDEES SERVICES TEAM - Volunteer",
  "IT and TECH SUPPORT TEAM - Volunteer",
  "I don't want to choose any more teams",
];

const UniversityChoices = [
  "Geomedi University",
  "Ivane Javakhishvili Tbilisi State University (TSU)",
  "Tbilisi State Medical University (TSMU)",
  "Georgian American University (GAU)",
  "Georgian National University (SEU)",
  "Caucasus International University (CIU)",
  "Alte University",
  "David Tvildiani Medical University (DTMU)",
  "New Vision University (NVU)",
  "Ilia State University (ISU)",
  "East European University (EEU)",
  "Tbilisi Medical Academy (TMA)",
  "Grigol Robakidze University (GRUNI)",
  "Ken Walker International University",
  "European University (EU)",
  "University of Georgia (UG)",
];

const mixed = mongoose.Schema.Types.Mixed;

const volunteerApplicationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, index: true },
    isGimsocMember: { type: Boolean, default: false },
    gimsocMembershipId: { type: String },

    fullName: { type: String, required: true },
    whatsappNumber: { type: String, required: true },
    university: { type: String, enum: UniversityChoices, required: true },

    whatMakesYouUnique: { type: String, required: true },
    handleConstructiveCriticism: { type: String, required: true },

    dateOfArrival: { type: Date, required: true },
    dateOfDeparture: { type: Date, required: true },

    firstChoice: { type: String, enum: TeamChoices, required: true },
    secondChoice: { type: String, enum: TeamChoices },
    thirdChoice: { type: String, enum: TeamChoices },

    logisticsResponses: { type: mixed },
    prMarketingResponses: { type: mixed },
    organizationResponses: { type: mixed },
    workshopResponses: { type: mixed },
    registrationResponses: { type: mixed },
    itTechResponses: { type: mixed },

    source: { type: String, default: "web" },
  },
  { timestamps: true }
);

// Additional validation to ensure choices are unique (excluding "I don't want to choose any more teams")
volunteerApplicationSchema.pre("save", function (next) {
  const self = this;
  const choices = [self.firstChoice, self.secondChoice, self.thirdChoice]
    .filter(Boolean)
    .filter((c) => c !== "I don't want to choose any more teams");

  const uniqueChoices = new Set(choices);
  if (choices.length !== uniqueChoices.size) {
    return next(new Error("Volunteer team choices must be unique."));
  }

  if (!self.firstChoice) {
    return next(new Error("At least one team choice is required."));
  }

  if (uniqueChoices.size > 3) {
    return next(new Error("You can select at most three team choices."));
  }

  next();
});

module.exports = mongoose.model("VolunteerApplication", volunteerApplicationSchema);