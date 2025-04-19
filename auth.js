// auth.js - Authentication removed

// Empty middleware - just pass through
const sessionMiddleware = (req, res, next) => {
  next();
};

// Always return true - no authentication
function isAuthenticated() {
  return true;
}

// Empty function stubs - no authentication
function loginAdmin() {
  return true;
}

function logoutAdmin() {
  // No-op
}

module.exports = {
  sessionMiddleware,
  isAuthenticated,
  loginAdmin,
  logoutAdmin
};