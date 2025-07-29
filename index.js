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
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
}));
app.use(cookieParser());
app.use(express.urlencoded({ extended: true }));

// CORS configuration
app.use(
  cors({
    origin: ["https://www.medcongimsoc.com", "https://medcongimsoc.com", "http://localhost:5173", "http://localhost:3000"],
    credentials: true,
    exposedHeaders: ["set-cookie"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  })
);

// Handle preflight requests
app.options('*', cors());

// Specific OPTIONS handler for admin routes
app.options('/api/admin/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Specific OPTIONS handler for dashboard routes
app.options('/api/dashboard/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Specific OPTIONS handler for admin-auth routes
app.options('/api/admin-auth/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.status(200).end();
});

// Performance monitoring middleware
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  console.log(`🌐 [${requestId}] ${req.method} ${req.path} - Origin: ${req.headers.origin} - Started`);
  
  // Additional CORS headers for problematic requests
  res.header('Access-Control-Allow-Origin', req.headers.origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`✅ [${requestId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    
    // Log slow requests
    if (duration > 5000) {
      console.warn(`⚠️ [${requestId}] Slow request: ${req.method} ${req.path} took ${duration}ms`);
    }
  });
  
  next();
});

// Test endpoint for CORS
app.get('/api/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!', 
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});

// ROUTES
const authRouter = require("./routes/authRouter.js");
app.use("/api/auth", authRouter);

const ticketRouter = require("./routes/getTicketType.js");
app.use("/api/ticket", ticketRouter);

const paypalRouter = require("./routes/paypalRouter.js");
app.use("/api/paypal", paypalRouter);

const dashboardRouter = require("./routes/dashboardRouter.js");
app.use("/api/info", dashboardRouter);
app.use("/api/dashboard", dashboardRouter);

const adminRouter = require("./routes/adminRouter.js");
app.use("/api/admin", adminRouter);

const adminAuthRouter = require("./routes/adminAuthRouter.js");
app.use("/api/admin-auth", adminAuthRouter);



const abstractRouter = require("./routes/abstractRouter.js");
app.use("/api/abstract", abstractRouter);

const submissionRouter = require("./routes/ticketRouter.js");
app.use("/api/form", submissionRouter);

// QR router setup
const { router: qrRouter, setupWebSocket } = require("./routes/qrRouter.js");
app.use("/api/qr", qrRouter);

// MONGODB CONNECTION WITH CONNECTION POOLING
mongoose
  .connect(process.env.MONGO_DB || "mongodb://localhost:27017/gimsoc", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    maxPoolSize: 50, // Increased connection pool for high concurrency
    minPoolSize: 10, // Minimum connections to maintain
    serverSelectionTimeoutMS: 5000, // Timeout for server selection
    socketTimeoutMS: 45000, // Socket timeout
  })
  .then(() => {
    console.log("✅ MongoDB connected with optimized connection pool");
    console.log(`📊 Connection pool: min=${10}, max=${50}`);
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
const wss = setupWebSocket(server);
console.log('🔌 WebSocket server initialized');
