// backend/middleware/auth.js
// Middleware for authentication, API key validation, and role‑based access control.
// Implements optional JWT verification and ensures the Gemini API key is configured.
// Also enforces doctor‑nurse hierarchy using a JSON mapping file.

const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key';

/** Verify Gemini API key is present. */
function requireGeminiKey(req, res, next) {
  if (!process.env.GEMINI_API_KEY) {
    console.error('GEMINI_API_KEY missing');
    return res.status(500).json({ success: false, error: 'Server misconfiguration: Gemini API key missing.' });
  }
  next();
}

/** Optional JWT authentication – attaches decoded payload to req.user if present. */
function optionalJwt(req, res, next) {
  // Check for standard Authorization header first
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (!err) {
          req.user = decoded;
          return next();
        }
        console.warn('Invalid JWT:', err.message);
      });
    }
  }
  // Fallback: simple role header for local testing
  const roleHeader = req.headers['x-user-role'];
  if (roleHeader) {
    req.user = { role: roleHeader };
  }
  next();
}

/** Enforce doctor‑nurse hierarchy. Expects staffAssignments.json in project root. */
function enforceStaffHierarchy(req, res, next) {
  const doctorId = req.body.doctorId || (req.user && req.user.id);
  const nurseId = req.body.nurseId;
  if (!doctorId || !nurseId) {
    return res.status(400).json({ success: false, error: 'doctorId and nurseId are required.' });
  }
  const assignmentsPath = path.join(__dirname, '..', 'staffAssignments.json');
  let assignments = {};
  try {
    assignments = JSON.parse(fs.readFileSync(assignmentsPath, 'utf8'));
  } catch (_) {
    console.warn('staffAssignments.json not found – skipping hierarchy check');
    return next();
  }
  const allowed = assignments[doctorId] || [];
  if (!allowed.includes(nurseId)) {
    return res.status(403).json({ success: false, error: 'Nurse not assigned to this doctor.' });
  }
  next();
}

module.exports = { requireGeminiKey, optionalJwt, enforceStaffHierarchy };
