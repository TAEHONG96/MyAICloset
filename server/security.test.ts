import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryRateLimiter,
  isOriginAllowed,
  parseAllowedOrigins,
  sanitizeErrorMessage,
} from './security';

test('sanitizeErrorMessage redacts Google API keys and bearer tokens', () => {
  const leaky =
    'Request failed with key=AIzaSyDummySecretKey1234567890 and Bearer sk-secret-token-xyz';
  const sanitized = sanitizeErrorMessage(leaky);
  assert.equal(sanitized.includes('AIzaSyDummySecretKey1234567890'), false);
  assert.equal(sanitized.includes('sk-secret-token-xyz'), false);
  assert.ok(sanitized.includes('[REDACTED_API_KEY]'));
  assert.ok(sanitized.includes('[REDACTED_TOKEN]'));
});

test('parseAllowedOrigins and isOriginAllowed validate same-origin and CORS origins strictly in production', () => {
  const allowed = parseAllowedOrigins(
    'https://closet.onrender.com, https://custom.example.com',
    ['https://ais-preview.run.app/some/path']
  );

  assert.equal(isOriginAllowed(undefined, allowed, 'closet.onrender.com', true), true);
  assert.equal(
    isOriginAllowed('https://closet.onrender.com', allowed, 'closet.onrender.com', true),
    true
  );
  assert.equal(
    isOriginAllowed('https://ais-preview.run.app', allowed, 'other.host', true),
    true
  );
  assert.equal(
    isOriginAllowed('https://evil-site.example.com', allowed, 'closet.onrender.com', true),
    false
  );
  assert.equal(
    isOriginAllowed('http://localhost:3000', [], 'localhost:3000', false),
    true
  );
});

test('InMemoryRateLimiter blocks requests past max within window and resets after expiry', () => {
  const limiter = new InMemoryRateLimiter({ windowMs: 10000, max: 2 });

  const r1 = limiter.check('1.2.3.4', 1000);
  const r2 = limiter.check('1.2.3.4', 2000);
  const r3 = limiter.check('1.2.3.4', 3000);
  const otherIp = limiter.check('5.6.7.8', 3000);
  const afterWindow = limiter.check('1.2.3.4', 12000);

  assert.equal(r1.allowed, true);
  assert.equal(r1.remaining, 1);
  assert.equal(r2.allowed, true);
  assert.equal(r2.remaining, 0);
  assert.equal(r3.allowed, false);
  assert.equal(r3.remaining, 0);
  assert.equal(otherIp.allowed, true);
  assert.equal(afterWindow.allowed, true);
});
