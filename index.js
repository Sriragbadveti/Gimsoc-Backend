require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();
const path = require("path");
app.use(express.json());
// index.js ya server.js me
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, path) => {
    res.setHeader("Access-Control-Allow-Origin", "https://www.medcongimsoc.com");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: ["https://www.medcongimsoc.com", "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    exposedHeaders: ["set-cookie"],
  })
);

// ROUTES
const authRouter = require("./routes/authRouter.js");
app.use("/api/auth", authRouter);

const ticketRouter = require("./routes/getTicketType.js");
app.use("/api/ticket" , ticketRouter)

const paypalRouter = require("./routes/paypalRouter.js");
app.use("/api/paypal" , paypalRouter);

const dashboardRouter = require("./routes/dashboardRouter.js");
app.use("/api/info" , dashboardRouter);

const adminRouter = require("./routes/adminRouter.js");
app.use("/api/admin" , adminRouter);

const abstractRouter = require("./routes/abstractRouter.js");
app.use("/api/abstract" , abstractRouter)

const submissionRouter = require("./routes/ticketRouter.js");
app.use("/api/form" , submissionRouter);

const { router: qrRouter, setupWebSocket } = require("./routes/qrRouter.js");
app.use("/api/qr", qrRouter);

// MONGODB CONNECTION
mongoose
  .connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("✅ MongoDB connected");
  })
  .catch((err) => {
    console.log("❌ MongoDB connection error:", err);
  });

// PORT
const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`🚀 App is successfully running on port ${PORT}`);
});

// Setup WebSocket server
setupWebSocket(server);
