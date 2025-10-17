require("dotenv").config();
const mongoose = require("mongoose");
const WorkshopSession = require("../models/workshopSessionModel.js");

async function seed() {
  await mongoose.connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc");
  try {
    console.log("Seeding workshop sessions...");
    const defs = [];

    // TSU (Std+2)
    // Times: A/B (Day1), C/D (Day2)
    const TSU_A = { day: 1, slot: "A", time: "2:00 PM – 3:30 PM", venue: "TSU" };
    const TSU_B = { day: 1, slot: "B", time: "4:00 PM – 5:30 PM", venue: "TSU" };
    const TSU_C = { day: 2, slot: "C", time: "2:00 PM – 3:30 PM", venue: "TSU" };
    const TSU_D = { day: 2, slot: "D", time: "4:00 PM – 5:30 PM", venue: "TSU" };

    // T1 Foreign Object Removal + Suturing & Flap Closure (3 sessions: A,B,C)
    defs.push({ code: "T1-A", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, ...TSU_A });
    defs.push({ code: "T1-B", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, ...TSU_B });
    defs.push({ code: "T1-C", title: "Foreign Object Removal + Suturing & Flap Closure", capacity: 40, ...TSU_C });

    // T2 AMBOSS (1 session: D)
    defs.push({ code: "T2-D", title: "AMBOSS: Bridging Textbooks & Clinics", capacity: 40, ...TSU_D });

    // T3 Central Line Placement (3 sessions: A,B,D)
    defs.push({ code: "T3-A", title: "Central Line Placement", capacity: 40, ...TSU_A });
    defs.push({ code: "T3-B", title: "Central Line Placement", capacity: 40, ...TSU_B });
    defs.push({ code: "T3-D", title: "Central Line Placement", capacity: 40, ...TSU_D });

    // T4 Incision & Drainage (3 sessions: A,C,D)
    defs.push({ code: "T4-A", title: "Incision & Drainage", capacity: 40, ...TSU_A });
    defs.push({ code: "T4-C", title: "Incision & Drainage", capacity: 40, ...TSU_C });
    defs.push({ code: "T4-D", title: "Incision & Drainage", capacity: 40, ...TSU_D });

    // NVU (Std+3, Std+4)
    const NVU_A = { day: 1, slot: "A", time: "3:00 PM – 4:30 PM", venue: "NVU" };
    const NVU_B = { day: 1, slot: "B", time: "5:00 PM – 6:30 PM", venue: "NVU" };
    const NVU_C = { day: 2, slot: "C", time: "3:00 PM – 4:30 PM", venue: "NVU" };
    const NVU_D = { day: 2, slot: "D", time: "5:00 PM – 6:30 PM", venue: "NVU" };

    // N1A / N1B (Room 1, linkedGroup N1)
    defs.push({ code: "N1A-A", title: "From Swab to Solution: STI Cultures", capacity: 40, room: "Room 1", linkedGroup: "N1", ...NVU_A });
    defs.push({ code: "N1A-C", title: "From Swab to Solution: STI Cultures", capacity: 40, room: "Room 1", linkedGroup: "N1", ...NVU_C });
    defs.push({ code: "N1B-B", title: "Nasal Swabbing & Respiratory Pathogen ID", capacity: 40, room: "Room 1", linkedGroup: "N1", ...NVU_B });
    defs.push({ code: "N1B-D", title: "Nasal Swabbing & Respiratory Pathogen ID", capacity: 40, room: "Room 1", linkedGroup: "N1", ...NVU_D });

    // N2A / N2B (Room 2, linkedGroup N2)
    defs.push({ code: "N2A-A", title: "Wound Care & Drainage Management", capacity: 40, room: "Room 2", linkedGroup: "N2", ...NVU_A });
    defs.push({ code: "N2A-C", title: "Wound Care & Drainage Management", capacity: 40, room: "Room 2", linkedGroup: "N2", ...NVU_C });
    defs.push({ code: "N2B-B", title: "Wound Debridement & Suturing", capacity: 40, room: "Room 2", linkedGroup: "N2", ...NVU_B });
    defs.push({ code: "N2B-D", title: "Wound Debridement & Suturing", capacity: 40, room: "Room 2", linkedGroup: "N2", ...NVU_D });

    // N3 / N4 (Room 3, Room 4, linkedGroup N3 and N4 pair)
    defs.push({ code: "N3-A", title: "Outbreak Management Simulation", capacity: 40, room: "Room 3", linkedGroup: "N3", ...NVU_A });
    defs.push({ code: "N3-C", title: "Outbreak Management Simulation", capacity: 40, room: "Room 3", linkedGroup: "N3", ...NVU_C });
    defs.push({ code: "N4-B", title: "PPE Safety Practices & Critical Decision", capacity: 40, room: "Room 4", linkedGroup: "N4", ...NVU_B });
    defs.push({ code: "N4-D", title: "PPE Safety Practices & Critical Decision", capacity: 40, room: "Room 4", linkedGroup: "N4", ...NVU_D });

    // N5 / N6 (Room 5/6, all slots)
    for (const slot of [NVU_A, NVU_B, NVU_C, NVU_D]) {
      const slotLabel = slot.slot;
      defs.push({ code: `N5-${slotLabel}`, title: "Endotracheal Intubation", capacity: 40, room: "Room 5", ...slot });
      defs.push({ code: `N6-${slotLabel}`, title: "Venepuncture & Blood Culture Collection", capacity: 40, room: "Room 6", ...slot });
    }

    // Upsert sessions by code
    for (const def of defs) {
      await WorkshopSession.findOneAndUpdate(
        { code: def.code },
        { $set: def },
        { upsert: true }
      );
    }
    console.log(`Seeded ${defs.length} sessions.`);
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await mongoose.connection.close();
  }
}

seed();





