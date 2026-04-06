const jwt = require("jsonwebtoken");

// Middleware to protect private routes
const protect = (req, res, next) => {
  let token;

  // Check if request has Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    try {
      // Get token from header
      token = req.headers.authorization.split(" ")[1];

      // Verify token using secret from .env
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Save user id from token into request
      req.user = decoded.id;

      // Move to next step
      next();
    } catch (error) {
      return res.status(401).json({
        message: "Not authorized, token failed",
      });
    }
  }

  // If no token was found
  if (!token) {
    return res.status(401).json({
      message: "No token, authorization denied",
    });
  }
};

module.exports = protect;