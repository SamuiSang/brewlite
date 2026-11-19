/* eslint-disable @typescript-eslint/no-require-imports -- Standalone Node regression test. */
// Run: node frontend/lib/voucher-eligibility.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const exportsForTest = {};
const calls = [];
const source = ts.transpileModule(fs.readFileSync(`${__dirname}/voucher-eligibility.ts`, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(source, {
  exports: exportsForTest,
  fetch: async (url, options) => {
    const payload = JSON.parse(options.body);
    calls.push({ url, headers: options.headers, ...payload });
    if (payload.code === 'OFFLINE') throw Error('offline');
    return { ok: payload.code === 'WELCOME10' && payload.subtotal >= 40000 };
  },
});
(async () => {
  const codes = ['WELCOME10', 'BREW5', 'OFFLINE'];
  assert.deepEqual(Array.from(await exportsForTest.getEligibleVoucherCodes('http://localhost:3001', codes, 50000)), ['WELCOME10']);
  assert.deepEqual(Array.from(await exportsForTest.getEligibleVoucherCodes('http://localhost:3001', codes, 10000)), []);
  await exportsForTest.getEligibleVoucherCodes('http://localhost:3001', ['WELCOME10'], 50000, 'user-token');
  assert.equal(calls[6].headers.Authorization, 'Bearer user-token');
  assert.equal(calls[0].headers.Authorization, undefined);
  assert.equal(calls.length, 7);
  assert.ok(calls.every((call) => call.url === 'http://localhost:3001/orders/validate-voucher'));
  console.log('Voucher eligibility checks passed');
})();
