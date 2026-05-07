const MAX_MESSAGES = 1000;

class MessageStorage {
  async getMessages() {}
  async addMessage(msg) {}
  async getCount() {}
}

class MemoryStorage extends MessageStorage {
  constructor() {
    super();
    this.messages = [];
  }

  async getMessages() {
    return this.messages;
  }

  async addMessage(msg) {
    this.messages.push(msg);
    if (this.messages.length > MAX_MESSAGES) {
      this.messages.shift();
    }
  }

  async getCount() {
    return this.messages.length;
  }
}

async function createStorage(storageType, redisUrl) {
  if (storageType !== 'redis') return new MemoryStorage();
  try {
    const redis = require('redis');
    const client = redis.createClient({ url: redisUrl });
    await client.connect();
    console.log('Redis connected');
    return {
      redis: client,
      key: 'anychat:messages',
      async getMessages() {
        const data = await this.redis.lRange(this.key, 0, -1);
        return data.map(item => JSON.parse(item));
      },
      async addMessage(msg) {
        await this.redis.rPush(this.key, JSON.stringify(msg));
        const count = await this.redis.lLen(this.key);
        if (count > MAX_MESSAGES) {
          await this.redis.lTrim(this.key, -MAX_MESSAGES, -1);
        }
      },
      async getCount() {
        return await this.redis.lLen(this.key);
      }
    };
  } catch (err) {
    console.error('Redis connection failed:', err.message);
    console.log('Falling back to memory storage');
    return new MemoryStorage();
  }
}

module.exports = { MessageStorage, MemoryStorage, createStorage, MAX_MESSAGES };
