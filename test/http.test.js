const { describe, test, expect, afterAll, beforeAll } = require('bun:test');
const http = require('http');
const { app, server } = require('../server');

const BASE_URL = 'http://localhost:3333';

beforeAll((done) => {
  server.listen(3333, done);
});

afterAll((done) => {
  server.close(done);
});

describe('HTTP Endpoints', () => {
  describe('GET /stats', () => {
    test('should return 200 with correct structure', async () => {
      const res = await fetch(BASE_URL + '/stats');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('messages');
      expect(body).toHaveProperty('storage');
      expect(body).toHaveProperty('memory');
      expect(body.memory).toHaveProperty('rss');
      expect(body.memory).toHaveProperty('heapUsed');
      expect(body.memory).toHaveProperty('heapTotal');
    });
  });

  describe('Security Headers', () => {
    test('should set Content-Security-Policy', async () => {
      const res = await fetch(BASE_URL + '/stats');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
    });

    test('should set X-Content-Type-Options: nosniff', async () => {
      const res = await fetch(BASE_URL + '/stats');
      expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    });

    test('should set X-Frame-Options: DENY', async () => {
      const res = await fetch(BASE_URL + '/stats');
      expect(res.headers.get('x-frame-options')).toBe('DENY');
    });

    test('should set X-XSS-Protection', async () => {
      const res = await fetch(BASE_URL + '/stats');
      expect(res.headers.get('x-xss-protection')).toBe('1; mode=block');
    });
  });

  describe('Static Files', () => {
    test('should serve index.html', async () => {
      const res = await fetch(BASE_URL + '/');
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toContain('<!DOCTYPE html>');
    });
  });
});
