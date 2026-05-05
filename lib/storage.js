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

class RedisStorage extends MessageStorage {
  constructor(url) {
    super();
    this.redis = null;
    this.key = 'anychat:messages';
    this.init(url);
  }

  async init(url) {
    try {
      const redis = require('redis');
      this.redis = redis.createClient({ url });
      await this.redis.connect();
      console.log('Redis connected');
    } catch (err) {
      console.error('Redis connection failed:', err.message);
      console.log('Falling back to memory storage');
    }
  }

  async getMessages() {
    if (!this.redis) return [];
    const data = await this.redis.lRange(this.key, 0, -1);
    return data.map(item => JSON.parse(item));
  }

  async addMessage(msg) {
    if (!this.redis) return;
    await this.redis.rPush(this.key, JSON.stringify(msg));
    const count = await this.redis.lLen(this.key);
    if (count > MAX_MESSAGES) {
      await this.redis.lTrim(this.key, -MAX_MESSAGES, -1);
    }
  }

  async getCount() {
    if (!this.redis) return 0;
    return await this.redis.lLen(this.key);
  }
}

module.exports = { MessageStorage, MemoryStorage, RedisStorage, MAX_MESSAGES };
