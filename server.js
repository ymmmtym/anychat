const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS || 'http://localhost:3000',
    methods: ['GET', 'POST']
  }
});

const messages = [];
const MAX_MESSAGES = 1000;
const MAX_MESSAGE_LENGTH = 5000;
const RATE_LIMIT_WINDOW = 10000;
const RATE_LIMIT_MAX = 10;

const rateLimitMap = new Map();

app.use(express.static('public'));

app.get('/stats', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    messages: messages.length,
    memory: {
      rss: `${(mem.rss / 1024 / 1024).toFixed(2)} MB`,
      heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`,
      heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(2)} MB`
    }
  });
});

io.on('connection', (socket) => {
  socket.emit('history', messages);
  
  socket.on('message', (data) => {
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
    
    messages.push(msg);
    
    if (messages.length > MAX_MESSAGES) {
      messages.shift();
    }
    
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

server.listen(3000, () => console.log('http://localhost:3000'));
