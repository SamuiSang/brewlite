/* eslint-disable @typescript-eslint/no-require-imports */
const assert = require('node:assert/strict');

function mergeCarts(guestItems, userCart) {
  const merged = [...userCart];
  for (const gItem of guestItems) {
    const matchIndex = merged.findIndex((uItem) => uItem.id === gItem.id);
    if (matchIndex > -1) {
      merged[matchIndex] = {
        ...merged[matchIndex],
        quantity: merged[matchIndex].quantity + gItem.quantity,
      };
    } else {
      merged.push(gItem);
    }
  }
  return merged;
}

// Test case 1: Guest has 3 items, user has 0 items -> final has 3 items
const guest1 = [{ id: 'item-1', quantity: 1 }, { id: 'item-2', quantity: 2 }, { id: 'item-3', quantity: 1 }];
const user1 = [];
assert.equal(mergeCarts(guest1, user1).length, 3);

// Test case 2: Guest has 3 items, user already had 2 different items -> final has 5 items
const user2 = [{ id: 'item-4', quantity: 1 }, { id: 'item-5', quantity: 1 }];
assert.equal(mergeCarts(guest1, user2).length, 5);

// Test case 3: Guest has 1 item that user also had -> quantity is summed up
const guest3 = [{ id: 'item-1', quantity: 2 }];
const user3 = [{ id: 'item-1', quantity: 1 }];
const res3 = mergeCarts(guest3, user3);
assert.equal(res3.length, 1);
assert.equal(res3[0].quantity, 3);

console.log('Cart merge unit tests passed 100%!');
