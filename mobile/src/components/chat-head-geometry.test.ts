import { strict as assert } from 'node:assert';

import { initialChatHeadPosition, snappedChatHeadPosition } from './chat-head-geometry';

const initial = initialChatHeadPosition({
  width: 390,
  height: 844,
  insetTop: 47,
  insetBottom: 34,
  size: 54,
});
assert.deepEqual(initial, { x: 320, y: 614 });

assert.deepEqual(
  snappedChatHeadPosition({
    x: 20,
    y: 20,
    width: 390,
    height: 844,
    insetTop: 47,
    insetBottom: 34,
    size: 54,
  }),
  { x: 16, y: 103 },
);
assert.deepEqual(
  snappedChatHeadPosition({
    x: 330,
    y: 900,
    width: 390,
    height: 844,
    insetTop: 47,
    insetBottom: 34,
    size: 54,
  }),
  { x: 320, y: 606 },
);

console.log('chat head geometry tests passed');
