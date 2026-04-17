require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

require('./db/store');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const friendRoutes = require('./routes/friends');
const messageRoutes = require('./routes/messages');
const feedbackRoutes = require('./routes/feedback');
const setupSocket = require('./socket');

const app = express();
const server = http.createServer(app);

const allowedOrigins = (process.env.CLIENT_URL || 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function corsOrigin(origin, callback) {
  if (!origin) return callback(null, true);
  const ok =
    allowedOrigins.includes(origin) ||
    /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
    origin.endsWith('.netlify.app');
  callback(ok ? null : new Error('CORS not allowed'), ok);
}

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ['GET', 'POST'], credentials: true }
});

app.use(cors({ origin: corsOrigin, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.set('io', io);

app.use('/auth', authRoutes);
app.use('/users', userRoutes);
app.use('/friends', friendRoutes);
app.use('/messages', messageRoutes);
app.use('/feedback', feedbackRoutes);

app.get('/health', (_, res) => res.json({ status: 'ok', timestamp: new Date() }));

setupSocket(io);

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`[PastelChat] Running on port ${PORT} — created by Nguyen Manh Tuan Hung (Henry Parker)`);
});

module.exports = { app, server };
