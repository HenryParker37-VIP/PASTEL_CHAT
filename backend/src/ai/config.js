/**
 * AI Provider Configuration
 * Reads credentials from environment variables (.env in dev, dashboard in production).
 */

require('dotenv').config();

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || '').trim();
const NVIDIA_API_KEY = (process.env.NVIDIA_API_KEY || '').trim();
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || '').trim();

module.exports = {
  GEMINI_API_KEY,
  NVIDIA_API_KEY,
  OPENROUTER_API_KEY
};

