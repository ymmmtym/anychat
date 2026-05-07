const { describe, test, expect } = require('bun:test');
const { MemoryStorage, MAX_MESSAGES } = require('../lib/storage');

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
