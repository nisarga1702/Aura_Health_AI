// ==============================================================
// AURA-Health AI — Central API Configuration
// In production: set VITE_API_URL in your Railway environment
// In dev: proxy via vite.config.js routes /api → localhost:5000
// ==============================================================

const API_BASE = import.meta.env.VITE_API_URL || '';

export default API_BASE;
