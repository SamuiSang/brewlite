// Run against local Docker app: node test/ordering.smoke.cjs
process.loadEnvFile();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const base = 'http://localhost:3001';
let token;
let userId;
const orderIds = [];

async function request(path, method = 'GET', body, expected = 200, authenticated = true) {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(authenticated && token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}

async function main() {
  const email = `smoke-${randomUUID()}@example.test`;
  const password = `Smoke-${randomUUID()}`;
  const registered = await request('/auth/register', 'POST', { email, password, fullName: 'Ordering smoke test' }, 201);
  userId = registered.user.id;
  await request('/auth/login', 'POST', { email, password: 'incorrect' }, 401);
  const login = await request('/auth/login', 'POST', { email, password }, 200);
  token = login.accessToken;
  assert.ok(token);
  await prisma.user.update({ where: { id: userId }, data: { loyaltyPoints: 10 } });
  const products = await request('/products');
  assert.equal(products.length, 16);
  const product = products.find((p) => p.name === 'Cà phê đen đá');
  assert.ok(product.stockBySize.S >= 3);
  const before = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
  const balance = async () => (await prisma.user.findUnique({ where: { id: userId } })).loyaltyPoints;
  const input = {
    userId: 'forged-user-id', customerName: 'Ordering smoke test', phone: '0900000000',
    promotionCode: 'WELCOME10', useLoyaltyPoints: 2,
    items: [{ productId: product.id, size: 'S', qty: 3 }],
  };
  await request('/orders', 'POST', input, 401, false);
  await request('/orders/validate-voucher', 'POST', { code: 'WELCOME10', subtotal: 75000 }, 201);
  await request('/orders/validate-voucher', 'POST', { code: 'NOT-A-VOUCHER', subtotal: 75000 }, 404);
  await request('/orders', 'POST', { ...input, items: [{ productId: product.id, size: 'S', qty: product.stockBySize.S + 1 }] }, 400);
  await request('/orders', 'POST', { ...input, useLoyaltyPoints: 9999 }, 400);

  for (const paid of [false, true]) {
    const order = await request('/orders', 'POST', input, 201);
    orderIds.push(order.id);
    assert.equal(order.userId, userId, 'JWT identity overrides body userId');
    assert.equal(Number(order.subtotal), 75000);
    assert.equal(Number(order.discountAmount), 8500);
    assert.equal(Number(order.totalAmount), 66500);
    assert.equal(order.pointsRedeemed, 2);
    assert.equal(await balance(), 8);
    assert.ok((await prisma.orderIngredient.count({ where: { orderId: order.id } })) > 0);
    assert.equal((await request(`/products/${product.id}`)).stockBySize.S, product.stockBySize.S - 3);
    const history = await request('/orders/me');
    assert.ok(history.some((entry) => entry.id === order.id));
    if (paid) {
      await request('/payments', 'POST', { orderId: order.id, method: 'VNPAY', idempotencyKey: randomUUID(), mockSuccess: false }, 200);
      const key = randomUUID();
      const payment = { orderId: order.id, method: 'VNPAY', idempotencyKey: key, mockSuccess: true };
      const result = await request('/payments', 'POST', payment, 200);
      assert.equal(result.success, true);
      assert.equal(await balance(), 14);
      const repeated = await request('/payments', 'POST', payment, 200);
      assert.equal(repeated.isIdempotent, true);
      assert.equal(await balance(), 14);
    }
    await request(`/orders/${order.id}/status`, 'PATCH', { status: 'CANCELLED' });
    await request(`/orders/${order.id}/status`, 'PATCH', { status: 'CANCELLED' });
    assert.equal(await balance(), 10, 'Cancellation restores redeemed points and revokes earned points once');
    const after = await prisma.ingredient.findMany({ orderBy: { id: 'asc' } });
    assert.deepEqual(after.map((x) => [x.id, x.stock.toString()]), before.map((x) => [x.id, x.stock.toString()]));
  }
  console.log('PASS: register/login, identity, voucher, stock rejection, points, history, failed/retried/idempotent payment, cancellation/restock.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => {
  // Remove only fixtures created by this run. Restore any uncancelled reservation first.
  for (const id of orderIds) {
    const order = await prisma.order.findUnique({ where: { id } });
    if (order && order.status !== 'CANCELLED') {
      await request(`/orders/${id}/status`, 'PATCH', { status: 'CANCELLED' });
    }
    await prisma.order.delete({ where: { id } });
  }
  if (userId) await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});
