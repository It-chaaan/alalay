import assert from 'node:assert/strict';
import { parseReceiptText } from './receipt-parser.service.js';

const parsed = parseReceiptText(
  'SM SUPERMARKET\n2026-08-14\nMILK 95.50\nBREAD 68.00\nSUBTOTAL 163.50\nTOTAL ₱163.50\nCASH 200.00',
);
assert.equal(parsed.merchant, 'SM SUPERMARKET');
assert.equal(parsed.total, 163.5);
assert.equal(parsed.currency, 'PHP');
assert.equal(parsed.date, '2026-08-14');
assert.equal(parsed.suggestedCategory, 'Groceries');
assert.deepEqual(
  parsed.lineItems.map(({ description, amount }) => ({ description, amount })),
  [
    { description: 'MILK', amount: 95.5 },
    { description: 'BREAD', amount: 68 },
  ],
);
assert.equal(parseReceiptText('AMOUNT DUE 1,250.75').total, 1250.75);
assert.equal(parseReceiptText('receipt copy\n08/12/2026').date, null);
assert.equal(parseReceiptText('no useful data').total, null);

const shopee = parseReceiptText(`Game One PH
Order Details
Customer: Sample Buyer
Mobile: 0917 123 9987
Deepcool CH160 Plus Tempered Glass  ₱3,595
Voucher  ₱666
Order Total  ₱2,929
Estimated delivery 04/09/2026 - 07/09/2026`);
assert.equal(shopee.merchant, 'Game One PH');
assert.equal(shopee.total, 2929);
assert.equal(shopee.date, null);
assert.equal(shopee.extraction.date.requiresConfirmation, true);
assert.equal(shopee.currency, 'PHP');
assert.deepEqual(
  shopee.lineItems.map((item) => item.description),
  ['Deepcool CH160 Plus Tempered Glass'],
);
assert.ok(!shopee.lineItems.some((item) => /customer|mobile|0917/i.test(item.description)));
assert.notEqual(shopee.total, 9987);
console.log('Receipt parser tests passed');
