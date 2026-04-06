// Import mongoose so we can connect to MongoDB
const mongoose = require("mongoose");

// Function to connect database
const connectDB = async () => {
  try {
    // Try connecting with the connection string from .env
    await mongoose.connect(process.env.MONGO_URI);

    // Success message
    console.log("MongoDB connected successfully");
  } catch (error) {
    // Show error if connection fails
    console.error("MongoDB connection failed:", error.message);

    // Stop the app if database does not connect
    process.exit(1);
  }
};

// Export function so we can use it in server.js
module.exports = connectDB;