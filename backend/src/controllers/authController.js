const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
// const pool = require("../config/db"); // Uncomment when database is ready

// POST /auth/signup
const signup = async (req, res) => {
  const { name, email, password, role } = req.body;

  // --- Basic input validation ---
  if (!name || !email || !password) {
    return res.status(400).json({ error: "name, email, and password are required" });
  }

  const validRoles = ["student", "organizer", "admin"];
  const userRole = validRoles.includes(role) ? role : "student";

  try {
    // TODO: Check if email already exists in DB
    // const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    // if (existing.rows.length > 0) {
    //   return res.status(409).json({ error: "Email already registered" });
    // }

    // TODO: Hash password and insert into DB
    // const password_hash = await bcrypt.hash(password, 10);
    // const result = await pool.query(
    //   "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role",
    //   [name, email, password_hash, userRole]
    // );
    // const user = result.rows[0];

    // Placeholder response until DB is wired up
    const user = { id: 1, name, email, role: userRole };

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(201).json({ token, user });
  } catch (err) {
    console.error("signup error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// POST /auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "email and password are required" });
  }

  try {
    // TODO: Fetch real user from DB
    // const result = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
    // if (result.rows.length === 0) {
    //   return res.status(401).json({ error: "Invalid email or password" });
    // }
    // const user = result.rows[0];
    //
    // const passwordMatch = await bcrypt.compare(password, user.password_hash);
    // if (!passwordMatch) {
    //   return res.status(401).json({ error: "Invalid email or password" });
    // }

    // Placeholder: accept any email/password for now
    const user = { id: 1, name: "Test User", email, role: "student" };

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    return res.status(200).json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("login error:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
};

module.exports = { signup, login };
