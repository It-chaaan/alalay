import assert from 'node:assert/strict';
import test from 'node:test';
import { receiptUploadMetadata } from './receipt-upload';

test('receipt uploads preserve image MIME and safe filenames', () => {
  assert.deepEqual(receiptUploadMetadata({ uri: 'file:///receipt.png', mimeType: 'image/png' }), {
    type: 'image/png',
    filename: 'receipt.png',
  });
  assert.deepEqual(receiptUploadMetadata({ uri: 'file:///receipt.jpg', mimeType: 'image/jpeg' }), {
    type: 'image/jpeg',
    filename: 'receipt.jpg',
  });
  assert.deepEqual(receiptUploadMetadata({ uri: 'file:///receipt', mimeType: null }), {
    type: 'image/jpeg',
    filename: 'receipt.jpg',
  });
});
