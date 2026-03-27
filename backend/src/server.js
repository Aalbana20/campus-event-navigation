require("dotenv").config();
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");

const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(cors({ origin: "http://localhost:5173" })); // Vite default dev port
app.use(express.json());

// --- Routes ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/auth", authRoutes);

// --- 404 fallback ---
app.use((req, res) => {
  res.status(404).json({ error: `Cannot ${req.method} ${req.path}` });
});

// --- Start server ---
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
