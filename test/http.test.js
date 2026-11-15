const { describe, test, expect, afterAll, beforeAll } = require('bun:test');
const http = require('http');
const crypto = require('crypto');
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

    test('should not use unsafe-inline in CSP', async () => {
      const res = await fetch(BASE_URL + '/stats');
      const csp = res.headers.get('content-security-policy');
      expect(csp).not.toContain("'unsafe-inline'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    test('should allow inline scripts/styles via sha256 hashes', async () => {
      const [cspRes, htmlRes] = await Promise.all([
        fetch(BASE_URL + '/stats'),
        fetch(BASE_URL + '/')
      ]);
      const csp = cspRes.headers.get('content-security-policy');
      const html = await htmlRes.text();

      const scriptHashes = [...html.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
        .map(m => m[1]);
      const styleHashes = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)]
        .map(m => m[1]);

      expect(scriptHashes.length).toBeGreaterThan(0);
      expect(styleHashes.length).toBeGreaterThan(0);

      const scriptDirective = csp.split(';').map(s => s.trim()).find(s => s.startsWith('script-src'));
      const styleDirective = csp.split(';').map(s => s.trim()).find(s => s.startsWith('style-src'));

      for (const content of scriptHashes) {
        const hash = "'sha256-" + crypto.createHash('sha256').update(content, 'utf8').digest('base64') + "'";
        expect(scriptDirective).toContain(hash);
      }
      for (const content of styleHashes) {
        const hash = "'sha256-" + crypto.createHash('sha256').update(content, 'utf8').digest('base64') + "'";
        expect(styleDirective).toContain(hash);
      }
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
