// ============================================================================
// PastelChat — Backend CORS config for Render <-> Vercel
// Drop this block into backend/src/app.js in place of the current CORS setup.
// Also add CLIENT_URL to your Render environment variables (comma-separated
// list of every frontend origin you want to allow).
// ============================================================================

const cors = require('cors');
const { Server } = require('socket.io');

// ---- 1. Allowed origins --------------------------------------------------
// CLIENT_URL on Render should be e.g.:
//   https://pastel-chat.vercel.app,https://pastel-chat-git-main-you.vercel.app
const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  // Allow tools like curl / mobile apps / same-origin (no Origin header)
  if (!origin) return callback(null, true);

  const ok =
    allowedOrigins.includes(origin) ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    origin.endsWith('.vercel.app') ||      // any Vercel preview / prod deploy
    origin.endsWith('.netlify.app');       // keep if you still use Netlify

  callback(ok ? null : new Error(`CORS blocked for origin: ${origin}`), ok);
}

// ---- 2. Express CORS -----------------------------------------------------
app.use(
  cors({
    origin: corsOrigin,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);

// Pre-flight for every route (some hosts need this explicitly)
app.options('*', cors({ origin: corsOrigin, credentials: true }));

// ---- 3. Socket.io CORS ---------------------------------------------------
const io = new Server(server, {
  cors: {
    origin: corsOrigin,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Render's free tier is happier on websocket; fall back to polling if needed
  transports: ['websocket', 'polling']
});
