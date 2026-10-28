// Run: node lib/qr.check.cjs
const assert = require('node:assert/strict');
const QRCode = require('qrcode');
(async () => {
  const payload = JSON.stringify({ type: 'BREWLITE_MOCK_PAYMENT', orderId: 'test-order', amount: 66500, currency: 'VND' });
  const image = await QRCode.toDataURL(payload, { width: 256, margin: 4 });
  assert.ok(image.startsWith('data:image/png;base64,'));
  assert.equal(JSON.parse(payload).type, 'BREWLITE_MOCK_PAYMENT');
  console.log('PASS: local mock-payment QR encoding');
})().catch((error) => { console.error(error); process.exitCode = 1; });
