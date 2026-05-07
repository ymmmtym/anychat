const { describe, test, expect } = require('bun:test');
const { MemoryStorage, createStorage, MAX_MESSAGES } = require('../lib/storage');

describe('MemoryStorage', () => {
  test('should add and retrieve messages', async () => {
    const storage = new MemoryStorage();
    const msg = { text: 'hello', timestamp: 123, userId: 'user1' };
    await storage.addMessage(msg);
    const messages = await storage.getMessages();
    expect(messages).toEqual([msg]);
  });

  test('should return message count', async () => {
    const storage = new MemoryStorage();
    expect(await storage.getCount()).toBe(0);
    await storage.addMessage({ text: 'msg1' });
    await storage.addMessage({ text: 'msg2' });
    expect(await storage.getCount()).toBe(2);
  });

  test('should enforce MAX_MESSAGES limit', async () => {
    const storage = new MemoryStorage();
    for (let i = 0; i < MAX_MESSAGES + 1; i++) {
      await storage.addMessage({ text: `msg${i}` });
    }
    expect(await storage.getCount()).toBe(MAX_MESSAGES);
    const messages = await storage.getMessages();
    expect(messages[0].text).toBe('msg1');
  });
});

describe('createStorage', () => {
  test('should return MemoryStorage when type is memory', async () => {
    const storage = await createStorage('memory');
    expect(storage).toBeInstanceOf(MemoryStorage);
    await storage.addMessage({ text: 'hi', userId: 'u1' });
    expect(await storage.getCount()).toBe(1);
    const msgs = await storage.getMessages();
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe('hi');
  });

  test('should fallback to MemoryStorage when Redis connection fails', async () => {
    const storage = await createStorage('redis', 'redis://localhost:9999');
    expect(storage).toBeInstanceOf(MemoryStorage);
    await storage.addMessage({ text: 'fallback', userId: 'u1' });
    expect(await storage.getCount()).toBe(1);
  });

  test('should return object with required methods when Redis succeeds', async () => {
    const storage = await createStorage('redis', process.env.REDIS_URL || 'redis://localhost:6379');
    if (storage instanceof MemoryStorage) return;
    expect(storage).toHaveProperty('getMessages');
    expect(storage).toHaveProperty('addMessage');
    expect(storage).toHaveProperty('getCount');
  });
});
