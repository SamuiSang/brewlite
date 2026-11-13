/* eslint-disable @typescript-eslint/no-require-imports -- Standalone component regression check. */
// Run: node frontend/app/cart/page.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/page.tsx`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
function check(subtotal, voucher, mounted = true) {
  let removed = 0;
  let stateIndex = 0;
  const effects = [];
  const state = {
    items: [], appliedVoucher: voucher, profile: { points: 0 },
    getTotalItems: () => 0, getSubtotal: () => subtotal,
    getDiscount: () => 0, getTotal: () => subtotal,
    removeVoucher: () => removed++,
  };
  const react = {
    createElement: () => null,
    useState: (initial) => [++stateIndex === 3 ? mounted : initial, () => {}],
    useEffect: (effect) => effects.push(effect),
    useCallback: (callback) => callback,
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports, console, setInterval: () => 0, clearInterval: () => {},
    process: { env: {} },
    require: (name) => {
      if (name === 'react') return { ...react, default: react };
      if (name === 'next/navigation') return { useRouter: () => ({}) };
      if (name === '@/lib/store') return { useCartStore: () => state, AVAILABLE_VOUCHERS: [] };
      if (name === '@/lib/data') return { formatVND: String };
      if (name === '@/lib/voucher-eligibility') return { getEligibleVoucherCodes: async () => [] };
      return {};
    },
  });
  exports.default();
  effects.forEach((effect) => effect());
  return removed;
}
assert.equal(check(39000, { code: 'WELCOME10', minOrderAmount: 40000 }), 1, 'Remove voucher below minimum');
assert.equal(check(40000, { code: 'WELCOME10', minOrderAmount: 40000 }), 0);
assert.equal(check(50000, { code: 'WELCOME10', minOrderAmount: 40000 }), 0);
assert.equal(check(0, null), 0);
assert.equal(check(0, { code: 'WELCOME10', minOrderAmount: 40000 }, false), 0, 'Wait for hydration');
console.log('Cart voucher removal checks passed');
