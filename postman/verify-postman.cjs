const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const collection = JSON.parse(fs.readFileSync(path.join(__dirname, 'BrewLite_API_Collection.json'), 'utf8'));
const environment = JSON.parse(fs.readFileSync(path.join(__dirname, 'BrewLite_Local_Environment.json'), 'utf8'));
const collectionPath = path.join(__dirname, 'collections', collection.info.name);
const environmentPath = path.join(__dirname, 'environments', 'BrewLite Local.environment.yaml');
assert.ok(fs.existsSync(collectionPath), 'BrewLite collection must be discoverable under collections/');
assert.ok(fs.existsSync(environmentPath), 'Local View needs an environment YAML under environments/');
const countRequests = (items) => items.reduce((count, item) => count + (item.item ? countRequests(item.item) : Number(Boolean(item.request))), 0);
const countYaml = (directory) => fs.readdirSync(directory, { withFileTypes: true }).reduce((count, entry) => count + (entry.isDirectory() ? countYaml(path.join(directory, entry.name)) : Number(entry.name.endsWith('.request.yaml'))), 0);
assert.equal(collection.item.length, 9);
assert.equal(countYaml(collectionPath), countRequests(collection.item), 'Local and import collections must retain all requests');
assert.equal(environment._postman_variable_scope, 'environment');
for (const variable of environment.values) {
  assert.ok(fs.readFileSync(environmentPath, 'utf8').includes(`key: ${variable.key}\n`), `Missing environment variable: ${variable.key}`);
}
console.log(`Postman OK: ${collection.item.length} folders, ${countRequests(collection.item)} requests, ${environment.values.length} environment variables`);
