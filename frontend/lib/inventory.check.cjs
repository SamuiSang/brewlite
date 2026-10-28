const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const source = fs.readFileSync(path.join(__dirname, 'api.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const context = {
  exports: {},
  process,
  require: () => ({ DRINKS: [{ id: 'offline' }], CATEGORIES: [] }),
};
vm.runInNewContext(outputText, context);
const { normalizeProduct, getFallbackProducts } = context.exports;
const product = { id: 'coffee', name: 'Coffee', basePrice: 25000 };
assert.equal(normalizeProduct(product).stock, 0);
assert.equal(normalizeProduct({ ...product, stock: 10 }).stock, 10);
const stockBySize = { S: 10, M: 8, L: 5 };
const normalized = normalizeProduct({ ...product, stock: 100, stockBySize });
assert.equal(normalized.stock, 10);
assert.deepEqual(normalized.stockBySize, stockBySize);
assert.equal(getFallbackProducts()[0].stock, 0);
console.log('Inventory normalization checks passed');
