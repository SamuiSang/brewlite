/* eslint-disable @typescript-eslint/no-require-imports -- Standalone regression check for store replaceItem. */
// Run: node frontend/lib/store-replace.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const source = ts.transpileModule(fs.readFileSync(`${__dirname}/store.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const storage = new Map();
let stateRef;
const fakeStore = {
  getState: () => stateRef,
  setState: (updater) => {
    const patch = typeof updater === 'function' ? updater(stateRef) : updater;
    stateRef = { ...stateRef, ...patch };
  },
};

const modExports = {};
vm.runInNewContext(source, {
  exports: modExports,
  console,
  window: {},
  localStorage: {
    getItem: (k) => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: (k) => storage.delete(k),
  },
  require: (name) => {
    if (name === 'zustand') {
      return {
        create: () => (initializer) => {
          stateRef = initializer(fakeStore.setState, fakeStore.getState);
          return fakeStore;
        },
      };
    }
    if (name === 'zustand/middleware') {
      return {
        persist: (fn) => fn,
        createJSONStorage: () => undefined,
      };
    }
    throw new Error(`Unexpected require: ${name}`);
  },
});

const store = modExports.useCartStore.getState();

// 1. Add item S without toppings, then add item M with top-1
store.addItem({
  drinkId: 'latte',
  name: 'Latte',
  subtitle: '',
  image: '/img.png',
  size: 'S',
  sizeLabel: 'Regular',
  milk: 'dairy',
  milkLabel: 'Dairy',
  toppings: [],
  toppingsLabels: [],
  note: '',
  unitPrice: 49000,
  quantity: 1,
  optionsLabel: 'S (Regular)',
});

store.addItem({
  drinkId: 'latte',
  name: 'Latte',
  subtitle: '',
  image: '/img.png',
  size: 'M',
  sizeLabel: 'Medium',
  milk: 'dairy',
  milkLabel: 'Dairy',
  toppings: ['top-1'],
  toppingsLabels: ['Trân châu đen'],
  note: '',
  unitPrice: 64000,
  quantity: 2,
  optionsLabel: 'M (Medium) · Trân châu đen',
});

let items = modExports.useCartStore.getState().items;
assert.equal(items.length, 2, 'Two distinct configurations should stay separate');

// 2. Customize the first item to match a new topping (top-2) -> stays 2 items, replaces in place
store.replaceItem(items[0].id, {
  drinkId: 'latte',
  name: 'Latte',
  subtitle: '',
  image: '/img.png',
  size: 'S',
  sizeLabel: 'Regular',
  milk: 'dairy',
  milkLabel: 'Dairy',
  toppings: ['top-2'],
  toppingsLabels: ['Trân châu trắng 3Q'],
  note: 'Ít đá',
  unitPrice: 59000,
  quantity: 1,
  optionsLabel: 'S (Regular) · Trân châu trắng 3Q',
});

items = modExports.useCartStore.getState().items;
assert.equal(items.length, 2);
assert.deepEqual([...items[0].toppings], ['top-2']);
assert.equal(items[0].note, 'Ít đá');

// 3. Customize first item to have exact same options as second item -> merges quantities
store.replaceItem(items[0].id, {
  drinkId: 'latte',
  name: 'Latte',
  subtitle: '',
  image: '/img.png',
  size: 'M',
  sizeLabel: 'Medium',
  milk: 'dairy',
  milkLabel: 'Dairy',
  toppings: ['top-1'],
  toppingsLabels: ['Trân châu đen'],
  note: '',
  unitPrice: 64000,
  quantity: 1,
  optionsLabel: 'M (Medium) · Trân châu đen',
});

items = modExports.useCartStore.getState().items;
assert.equal(items.length, 1, 'Matching customized item should merge with existing identical item');
assert.equal(items[0].quantity, 3);

console.log('Store replaceItem checks passed');
