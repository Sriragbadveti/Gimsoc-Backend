require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");
const app = express();
const path = require("path");

// Increase payload size limit for large exports
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://www.medcongimsoc.com", 
      "https://medcongimsoc.com", 
      "http://localhost:5173", 
      "http://localhost:3000",
      "http://localhost:4173",
      "http://localhost:8080"
    ];
    
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`🚫 CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  exposedHeaders: ["set-cookie"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Origin", "Accept"],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Specific OPTIONS handler for admin routes with enhanced headers
app.options('/api/admin/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://www.medcongimsoc.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Specific OPTIONS handler for dashboard routes
app.options('/api/dashboard/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://www.medcongimsoc.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Specific OPTIONS handler for admin-auth routes
app.options('/api/admin-auth/*', (req, res) => {
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://www.medcongimsoc.com');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.status(200).end();
});

// Performance monitoring middleware with enhanced CORS headers
app.use((req, res, next) => {
  const start = Date.now();
  const requestId = Date.now() + Math.random().toString(36).substr(2, 9);
  
  // Reduce logging for admin auto-refresh requests and frequent checks
  const isAdminRefresh = req.path.includes('/api/admin/getalltickets') || req.path.includes('/api/admin/ticket-summary');
  const isGalaCheck = req.path.includes('/api/form/gala-availability');
  const shouldLog = !isAdminRefresh && !isGalaCheck;
  
  if (shouldLog) {
    console.log(`🌐 [${requestId}] ${req.method} ${req.path} - Origin: ${req.headers.origin} - Started`);
  }
  
  // Enhanced CORS headers for all requests
  const origin = req.headers.origin || 'https://www.medcongimsoc.com';
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  
  // Log response time
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    // Only log admin refresh requests if they're slow or have errors
    if (shouldLog || duration > 5000 || res.statusCode >= 400) {
      console.log(`✅ [${requestId}] ${req.method} ${req.path} - ${res.statusCode} - ${duration}ms`);
    }
    
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
const qrRouter = require("./routes/qrRouter.js");
app.use("/api/qr", qrRouter);

// Add volunteer router
const volunteerRouter = require("./routes/volunteerRouter.js");
app.use("/api/volunteer", volunteerRouter);

// Add workshop router
const workshopRouter = require("./routes/workshopRouter.js");
app.use("/api/workshop", workshopRouter);

// Error handling middleware for payload size errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ JSON parsing error:', err.message);
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid JSON payload' 
    });
  }
  
  if (err.code === 'LIMIT_FILE_SIZE' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    console.error('❌ File size error:', err.message);
    return res.status(413).json({ 
      success: false, 
      message: 'File too large. Please reduce file size and try again.' 
    });
  }
  
  if (err.type === 'entity.too.large') {
    console.error('❌ Payload too large:', err.message);
    return res.status(413).json({ 
      success: false, 
      message: 'Request payload too large. Please try with fewer tickets or contact support.' 
    });
  }
  
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

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

// WebSocket setup removed - using simple QR system
console.log('🔌 QR system initialized without WebSocket');
