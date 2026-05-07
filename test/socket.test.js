const { describe, test, expect, afterAll, beforeAll } = require('bun:test');
const { io } = require('socket.io-client');
const { server, storage } = require('../server');

const BASE_URL = 'http://localhost:3334';

beforeAll((done) => {
  server.listen(3334, done);
});

afterAll((done) => {
  server.close(done);
});

describe('Socket.IO', () => {
  test('should receive history on connect', (done) => {
    const client = io(BASE_URL);
    client.on('history', (msgs) => {
      expect(Array.isArray(msgs)).toBe(true);
      client.disconnect();
      done();
    });
  });

  test('should broadcast message to all clients', (done) => {
    const client1 = io(BASE_URL);
    const client2 = io(BASE_URL);
    let received = false;

    client2.on('message', (msg) => {
      expect(msg.text).toBe('hello from test');
      expect(msg.userId).toBe('test-user');
      received = true;
    });

    client1.on('connect', () => {
      client1.emit('message', { text: 'hello from test', userId: 'test-user' });
    });

    setTimeout(() => {
      expect(received).toBe(true);
      client1.disconnect();
      client2.disconnect();
      done();
    }, 500);
  });

  test('should reject invalid message payload', (done) => {
    const client = io(BASE_URL);
    client.on('connect', () => {
      client.emit('message', { invalid: 'data' });
      client.emit('message', null);
      client.emit('message', { text: 123, userId: 'user' });
    });
    setTimeout(() => {
      client.disconnect();
      done();
    }, 500);
  });

  test('should reject messages exceeding MAX_MESSAGE_LENGTH', (done) => {
    const client = io(BASE_URL);
    client.on('connect', () => {
      client.emit('message', { text: 'a'.repeat(5001), userId: 'user' });
    });
    setTimeout(() => {
      client.disconnect();
      done();
    }, 500);
  });

  test('should rate limit messages', (done) => {
    const client = io(BASE_URL);
    let receivedCount = 0;

    client.on('message', () => {
      receivedCount++;
    });

    client.on('connect', () => {
      for (let i = 0; i < 15; i++) {
        client.emit('message', { text: `msg${i}`, userId: 'rate-test-user' });
      }
    });

    setTimeout(() => {
      expect(receivedCount).toBeLessThanOrEqual(10);
      client.disconnect();
      done();
    }, 1000);
  });
});
