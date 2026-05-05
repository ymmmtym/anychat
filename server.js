const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const { MemoryStorage, RedisStorage, MAX_MESSAGES } = require('./lib/storage');

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
const STORAGE_TYPE = process.env.STORAGE_TYPE || 'memory'; // 'memory' or 'redis'
const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const rateLimitMap = new Map();
let connectionCount = 0;

// Storage is initialized from lib/storage.js

const storage = STORAGE_TYPE === 'redis' ? new RedisStorage(REDIS_URL) : new MemoryStorage();

app.use((req, res, next) => {
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:");
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

app.use(express.static('public'));

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
  
  if (connectionCount > MAX_CONNECTIONS) {
    socket.disconnect(true);
    connectionCount--;
    return;
  }

  const messages = await storage.getMessages();
  socket.emit('history', messages);
  
  socket.on('disconnect', () => {
    connectionCount--;
  });
  
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

module.exports = { app, server, io, storage };
