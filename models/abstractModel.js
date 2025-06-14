// models/abstractModel.js
const mongoose = require("mongoose")

const abstractSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true },
  whatsapp: { type: String, required: true },

  hasTicket: { type: String, required: true },
  ticketId: { type: String },

  title: { type: String, required: true },
  category: { type: String, required: true },
  authors: { type: String, required: true },
  presentingAuthor: { type: String, required: true },
  isPresentingAuthorSame: { type: String, required: true },

  abstractFileURL: { type: String, required: true }, // Store file path or public URL

  originalityConsent: { type: Boolean, required: true },
  disqualificationConsent: { type: Boolean, required: true },
  permissionConsent: { type: Boolean, required: true },

  submittedAt: { type: Date, default: Date.now },
})

module.exports =  mongoose.model("Abstract", abstractSchema)