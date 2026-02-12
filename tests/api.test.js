const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'smart-workspace-test-'));
const testDataPath = path.join(tmpDir, 'test-data.json');

process.env.DATA_FILE_PATH = testDataPath;

const {
  hashPassword,
  checkPassword,
  migratePlainPasswords,
  isValidDateString
} = require('../server');

test('hashPassword makes hash and checkPassword validates it', () => {
  const hash = hashPassword('123456');
  assert.equal(hash.startsWith('scrypt$'), true);
  assert.equal(checkPassword('123456', hash), true);
  assert.equal(checkPassword('wrong', hash), false);
});

test('migratePlainPasswords converts plain passwords', () => {
  const dataObj = {
    users: [
      { id: 1, username: 'u1', password: 'plain' },
      { id: 2, username: 'u2', password: 'scrypt$abc$def' }
    ],
    notes: [],
    lastUserId: 2,
    lastNoteId: 0
  };

  const changed = migratePlainPasswords(dataObj);
  assert.equal(changed, true);
  assert.equal(dataObj.users[0].password.startsWith('scrypt$'), true);
  assert.equal(dataObj.users[1].password, 'scrypt$abc$def');
});

test('isValidDateString validates yyyy-mm-dd', () => {
  assert.equal(isValidDateString('2030-01-02'), true);
  assert.equal(isValidDateString(''), true);
  assert.equal(isValidDateString('01-02-2030'), false);
  assert.equal(isValidDateString('2030/01/02'), false);
});
