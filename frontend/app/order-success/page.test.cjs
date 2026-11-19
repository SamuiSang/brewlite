/* eslint-disable @typescript-eslint/no-require-imports -- Node regression check runs without a test framework. */
// Run: node frontend/app/order-success/page.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/page.tsx`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;

async function check({ status = 'SUCCESS', owner = 'user-1', seen = false, ok = true } = {}) {
  const effects = [];
  let cleared = 0;
  const saved = new Map(seen ? [['brewlite-paid-cart:order-1', '1']] : []);
  const store = { authToken: 'token', authUser: { id: 'user-1' }, clearCart: () => cleared++ };
  const react = {
    createElement: (component, props) => typeof component === 'function' ? component(props) : null,
    Suspense: ({ children }) => children,
    useEffect: (effect) => effects.push(effect),
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (name === 'react') return { ...react, default: react };
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams('orderId=order-1') };
      if (name === '@/lib/store') return { useCartStore: (selector) => selector(store) };
      if (name.includes('OrderDetailsContent')) return { default: () => null };
      throw Error(name);
    },
    process: { env: {} },
    sessionStorage: { getItem: (key) => saved.get(key), setItem: (key, value) => saved.set(key, value) },
    fetch: async () => ({ ok, json: async () => ({ id: 'order-1', userId: owner, payments: [{ status }] }) }),
    console,
  });
  exports.default();
  effects.forEach((effect) => effect());
  await new Promise(setImmediate);
  return cleared;
}
(async () => {
  assert.equal(await check(), 1, 'Paid return must clear cart');
  assert.equal(await check({ status: 'PENDING' }), 0);
  assert.equal(await check({ status: 'FAILED' }), 0);
  assert.equal(await check({ owner: 'someone-else' }), 0);
  assert.equal(await check({ seen: true }), 0, 'Revisiting must preserve new cart');
  assert.equal(await check({ ok: false }), 0);
  console.log('Paid return cart checks passed');
})();
