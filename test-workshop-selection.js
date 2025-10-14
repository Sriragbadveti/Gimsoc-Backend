require("dotenv").config();
const mongoose = require("mongoose");
const axios = require("axios");
const WorkshopSession = require("./models/workshopSessionModel.js");
const WorkshopSelection = require("./models/workshopSelectionModel.js");
const UserTicket = require("./models/userModel.js");

async function main() {
  const base = process.env.TEST_BASE || "http://localhost:5000";
  await mongoose.connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc");

  try {
    // Create sample approved users for Std+2/3/4
    const users = [
      { email: "std2@example.com", ticketType: "Standard+2" },
      { email: "std3@example.com", ticketType: "Standard+3" },
      { email: "std4@example.com", ticketType: "Standard+4" },
    ];

    for (const u of users) {
      await UserTicket.findOneAndUpdate(
        { email: u.email },
        { $set: { email: u.email, ticketType: u.ticketType, ticketCategory: u.ticketType, paymentStatus: "completed" } },
        { upsert: true }
      );
    }

    // Ensure sessions exist
    const tsuCount = await WorkshopSession.countDocuments({ venue: "TSU" });
    const nvuCount = await WorkshopSession.countDocuments({ venue: "NVU" });
    console.log("Sessions:", { TSU: tsuCount, NVU: nvuCount });

    // Fetch sessions for Std+2
    const s2 = await axios.get(`${base}/api/workshops/sessions?email=std2@example.com`);
    console.log("Std+2 sessions:", s2.data.sessions.length);
    // Pick 1 on Day1, 1 on Day2 (e.g., T1-A, T2-D)
    let resp = await axios.post(`${base}/api/workshops/select`, { email: "std2@example.com", selections: ["T1-A", "T2-D"] });
    console.log("Std+2 select:", resp.data.message);

    // Fetch sessions for Std+3
    const s3 = await axios.get(`${base}/api/workshops/sessions?email=std3@example.com`);
    console.log("Std+3 sessions:", s3.data.sessions.length);
    // Pick 3 total with min 1/day, avoid linked conflicts (N1A-A, N2B-B, N5-C)
    resp = await axios.post(`${base}/api/workshops/select`, { email: "std3@example.com", selections: ["N1A-A", "N2B-B", "N5-C"] });
    console.log("Std+3 select:", resp.data.message);

    // Fetch sessions for Std+4
    const s4 = await axios.get(`${base}/api/workshops/sessions?email=std4@example.com`);
    console.log("Std+4 sessions:", s4.data.sessions.length);
    // Pick exactly 2 per day (N6-A, N5-B, N6-C, N5-D)
    resp = await axios.post(`${base}/api/workshops/select`, { email: "std4@example.com", selections: ["N6-A", "N5-B", "N6-C", "N5-D"] });
    console.log("Std+4 select:", resp.data.message);

    // Try conflict (slot conflict)
    try {
      await axios.post(`${base}/api/workshops/select`, { email: "std3@example.com", selections: ["N1A-A", "N2A-A", "N5-C"] });
    } catch (e) {
      console.log("Expected slot conflict:", e.response?.data?.message);
    }

    // Try linked conflict
    try {
      await axios.post(`${base}/api/workshops/select`, { email: "std3@example.com", selections: ["N1A-A", "N1B-B", "N5-C"] });
    } catch (e) {
      console.log("Expected linked conflict:", e.response?.data?.message);
    }

  } catch (err) {
    console.error("Test error:", err.response?.data || err.message);
  } finally {
    await mongoose.connection.close();
  }
}

main();


