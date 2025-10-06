require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  try {
    const mongoUri = process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc";
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const UserTicket = require("./models/userModel.js");

    // Only target Basic tickets
    const filter = { ticketType: "Basic" };
    const update = { $set: { dashboardPassword: "123456" } };

    const beforeCount = await UserTicket.countDocuments(filter);
    console.log(`Found ${beforeCount} Basic tickets. Updating dashboardPassword to 123456...`);

    const result = await UserTicket.updateMany(filter, update);
    console.log(`Matched: ${result.matchedCount || result.nMatched || 0}`);
    console.log(`Modified: ${result.modifiedCount || result.nModified || 0}`);

    // Optional verification sample
    const sample = await UserTicket.find(filter).select("email dashboardPassword").limit(5);
    console.log("Sample after update:");
    for (const doc of sample) {
      console.log(`- ${doc.email}: ${doc.dashboardPassword}`);
    }

  } catch (err) {
    console.error("Failed to update dashboard passwords:", err);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
}

main();


