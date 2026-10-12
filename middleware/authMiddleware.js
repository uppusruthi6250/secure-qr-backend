const jwt = require('jsonwebtoken');

// Middleware to authenticate JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. Authentication token missing.',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { userId, email, role, id }
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: 'Invalid or expired authentication token.',
    });
  }
};

// Middleware for Role-Based Access Control (RBAC)
const authorizeRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden. Your role (${req.user?.role || 'NONE'}) does not have permission. Required role(s): ${allowedRoles.join(', ')}`,
      });
    }
    next();
  };
};

// Role Specific Middlewares
const requireAdmin = [authenticateToken, authorizeRole('ADMIN')];
const requireOrganization = [authenticateToken, authorizeRole('ORGANIZATION', 'ADMIN')];
const requireCustomer = [authenticateToken, authorizeRole('CUSTOMER', 'ADMIN')];

module.exports = {
  authenticateToken,
  authorizeRole,
  requireAdmin,
  requireOrganization,
  requireCustomer,
};
