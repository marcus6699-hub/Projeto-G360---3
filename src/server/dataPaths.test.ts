import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { dataDirectory, dataFile } from './dataPaths.mjs';
import { AtomicJsonStore, isApplicationDb } from './jsonPersistence.mjs';

test('default data location remains backward compatible; configured location never moves or initializes files', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'g360-data-directory-'));
  assert.equal(path.basename(dataFile('db.json', {})), 'db.json');
  assert.equal(dataDirectory({ G360_DATA_DIR: directory }), directory);
  const file = dataFile('db.json', { G360_DATA_DIR: directory });
  assert.equal(file, path.join(directory, 'db.json')); assert.deepEqual(fs.readdirSync(directory), []);
  assert.throws(() => new AtomicJsonStore(file, { validate: isApplicationDb }).begin());
  assert.deepEqual(fs.readdirSync(directory), []);
});
test('invalid locations and arbitrary filenames cannot redirect private document access', () => {
  for (const configured of ['', 'relative/path', './db', '/tmp/invalid\0path']) assert.throws(() => dataDirectory({ G360_DATA_DIR: configured }));
  for (const name of ['../db.json', 'credentials.json', '/etc/passwd', 'db.json.g360-previous.json']) assert.throws(() => dataFile(name, {}));
});
