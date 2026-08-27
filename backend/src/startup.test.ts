import assert from 'node:assert/strict';
import test from 'node:test';
import { apiRouter } from './routes/index.js';
import { createServer } from './services/server.js';

test('all active API routes import without schema initialization errors', () => {
  assert.ok(apiRouter);
});

test('the Express application can be created without binding a port', () => {
  assert.doesNotThrow(() => createServer());
});
