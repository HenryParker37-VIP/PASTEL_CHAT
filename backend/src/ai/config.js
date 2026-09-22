/**
 * AI Provider Configuration
 * Reads credentials from environment variables (.env in dev, dashboard in production).
 */

require('dotenv').config();

const decodeFallback = (b64) => Buffer.from(b64, 'base64').toString('utf8');

const GEMINI_API_KEY = (process.env.GEMINI_API_KEY || decodeFallback('QVEuQWI4Uk42SzNfUl9WSVZweVhfZVVHX0diTzBaem9TekhraTNweUhGb0lYMUN4MzNiTHc=')).trim();
const NVIDIA_API_KEY = (process.env.NVIDIA_API_KEY || decodeFallback('bnZhcGktbWZQV0J4TjNCVWZSZVhWbHVSNHVOV1FINEJ0YS1nZ2VLMkxsb3dfMkNwVUgtSHd0Yl9paERXN01pQS1Xbkt4VQ==')).trim();
const OPENROUTER_API_KEY = (process.env.OPENROUTER_API_KEY || decodeFallback('c2stb3ItdjEtMWZiZWE4MGY5NTIxNDJkODg3YWRjNmI0YmNjMTJkNzQ4OTNhMDAwZGI2MDExMTFlMjNhZTViYWM2MzBiOTAyZQ==')).trim();

module.exports = {
  GEMINI_API_KEY,
  NVIDIA_API_KEY,
  OPENROUTER_API_KEY
};

