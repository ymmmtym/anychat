const express = require('express');
const http = require('http');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const socketIO = require('socket.io');
const { createStorage, MAX_MESSAGES } = require('./lib/storage');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 1e6,
  pingTimeout: 60000
});

const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 10;
const MAX_CONNECTIONS = 100;
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory';
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const rateLimitMap = new Map();
let connectionCount = 0;

let storage;
createStorage(STORAGE_TYPE, REDIS_URL).then(s => { storage = s; });

const INDEX_HTML_PATH = path.join(__dirname, 'public', 'index.html');

function sha256(content) {
  const normalized = content.replace(/\r\n?/g, '\n');
  return "'sha256-" + crypto.createHash('sha256').update(normalized, 'utf8').digest('base64') + "'";
}

// Hashes of the inline <script>/<style> blocks so the CSP can allow them
// without 'unsafe-inline'.
function computeInlineHashes(html) {
  const scriptHashes = [];
  const styleHashes = [];
  const scriptRe = /<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = scriptRe.exec(html)) !== null) scriptHashes.push(sha256(m[1]));
  while ((m = styleRe.exec(html)) !== null) styleHashes.push(sha256(m[1]));
  return { scriptHashes, styleHashes };
}

let cachedCspHeader = null;
let cachedHtmlMtimeMs = 0;

async function computeCspHeader() {
  const fallback = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' ws: wss:";
  try {
    const stats = await fs.promises.stat(INDEX_HTML_PATH);
    if (cachedCspHeader && stats.mtimeMs === cachedHtmlMtimeMs) {
      return cachedCspHeader;
    }
    const html = await fs.promises.readFile(INDEX_HTML_PATH, 'utf8');
    const { scriptHashes, styleHashes } = computeInlineHashes(html);
    const scriptSrc = ["'self'", ...scriptHashes].join(' ');
    const styleSrc = ["'self'", ...styleHashes].join(' ');
    const csp = `default-src 'self'; script-src ${scriptSrc}; style-src ${styleSrc}; connect-src 'self' ws: wss:`;
    cachedCspHeader = csp;
    cachedHtmlMtimeMs = stats.mtimeMs;
    return csp;
  } catch (err) {
    console.error('Failed to compute CSP hashes for index.html:', err.message);
    return fallback;
  }
}

app.use(async (req, res, next) => {
  try {
    res.setHeader('Content-Security-Policy', await computeCspHeader());
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  } catch (err) {
    next(err);
  }
});

app.use(express.static('public'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/stats', async (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    messages: await storage.getCount(),
    storage: STORAGE_TYPE,
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`
    }
  });
});

io.on('connection', async (socket) => {
  connectionCount++;

  socket.on('disconnect', () => {
    connectionCount--;
  });

  if (connectionCount > MAX_CONNECTIONS) {
    socket.disconnect(true);
    return;
  }

  const messages = await storage.getMessages();
  socket.emit('history', messages);
  
  socket.on('message', async (data) => {
    if (!data || typeof data.text !== 'string' || typeof data.userId !== 'string') {
      return;
    }

    if (data.text.length > MAX_MESSAGE_LENGTH) {
      return;
    }

    const now = Date.now();
    const userKey = data.userId;
    
    if (!rateLimitMap.has(userKey)) {
      rateLimitMap.set(userKey, []);
    }
    
    const timestamps = rateLimitMap.get(userKey).filter(t => now - t < RATE_LIMIT_WINDOW);
    
    if (timestamps.length >= RATE_LIMIT_MAX) {
      return;
    }
    
    timestamps.push(now);
    rateLimitMap.set(userKey, timestamps);

    const msg = { 
      text: data.text.trim(), 
      timestamp: Date.now(), 
      userId: data.userId 
    };
    
    await storage.addMessage(msg);
    io.emit('message', msg);
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateLimitMap.entries()) {
    const filtered = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (filtered.length === 0) {
      rateLimitMap.delete(key);
    } else {
      rateLimitMap.set(key, filtered);
    }
  }
}, 60000);

const PORT = process.env.PORT || 3000;

if (require.main === module) {
  server.listen(PORT, () => console.log('http://localhost:' + PORT));
}

module.exports = { app, server, io, storage, computeInlineHashes };
