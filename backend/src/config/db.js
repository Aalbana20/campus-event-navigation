const { Pool } = require("pg");

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

// Test the connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("Database connection failed:", err.message);
  } else {
    console.log("Connected to PostgreSQL database");
    release();
  }
});

module.exports = pool;
