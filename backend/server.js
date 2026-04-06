

// Import Express
const express = require("express");

// Import dotenv
const dotenv = require("dotenv");

// Import CORS (IMPORTANT)
const cors = require("cors");

// Import database connection
const connectDB = require("./config/db");

// Import routes
const authRoutes = require("./routes/authRoutes");

// Import middleware (protected route)
const protect = require("./config/authMiddleware");

// Load environment variables
dotenv.config({ path: "./.env" });

// Connect to database
connectDB();

// Create app
const app = express();

// =========================
// MIDDLEWARE
// =========================

// Allow frontend to connect (FIXES YOUR ERROR)
app.use(cors());

// Allow JSON requests
app.use(express.json());

// =========================
// ROUTES
// =========================

// Test route
app.get("/", (req, res) => {
  res.send("Server is running 🔥");
});

// Auth routes
app.use("/api/auth", authRoutes);

// Protected test route
app.get("/api/protected", protect, (req, res) => {
  res.json({
    message: "You accessed a protected route 🔐",
    userId: req.user,
  });
});

// =========================

// Port
const PORT = process.env.PORT || 5050;

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});