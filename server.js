const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = Number(process.env.PORT || 8000);
const dataFilePath = process.env.DATA_FILE_PATH || path.join(__dirname, 'data.json');
const sessionSecret = process.env.SESSION_SECRET || 'very-simple-secret-key';

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

app.use('/static', express.static(path.join(__dirname, 'static')));

function ensureDataFile() {
  if (!fs.existsSync(dataFilePath)) {
    const startData = { users: [], notes: [], lastUserId: 0, lastNoteId: 0 };
    fs.writeFileSync(dataFilePath, JSON.stringify(startData, null, 2), 'utf-8');
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

function isHashedPassword(value) {
  return typeof value === 'string' && value.startsWith('scrypt$');
}

function checkPassword(inputPassword, savedPassword) {
  if (!isHashedPassword(savedPassword)) {
    return inputPassword === savedPassword;
  }

  const parts = savedPassword.split('$');
  if (parts.length !== 3) return false;

  const salt = parts[1];
  const savedHash = parts[2];
  const inputHash = crypto.scryptSync(inputPassword, salt, 64).toString('hex');

  const a = Buffer.from(savedHash, 'hex');
  const b = Buffer.from(inputHash, 'hex');
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function migratePlainPasswords(dataObj) {
  let changed = false;

  for (const userItem of dataObj.users) {
    const pass = String(userItem.password || '');
    if (!pass) continue;
    if (isHashedPassword(pass)) continue;

    userItem.password = hashPassword(pass);
    changed = true;
  }

  return changed;
}

function readData() {
  ensureDataFile();
  const dataObj = JSON.parse(fs.readFileSync(dataFilePath, 'utf-8'));

  const changed = migratePlainPasswords(dataObj);
  if (changed) {
    fs.writeFileSync(dataFilePath, JSON.stringify(dataObj, null, 2), 'utf-8');
  }

  return dataObj;
}

function writeData(dataObj) {
  fs.writeFileSync(dataFilePath, JSON.stringify(dataObj, null, 2), 'utf-8');
}

function findUserByUsername(dataObj, username) {
  for (const userItem of dataObj.users) {
    if (userItem.username === username) return userItem;
  }
  return null;
}

function getCurrentUser(req) {
  if (!req.session.userId) return null;

  const dataObj = readData();
  for (const userItem of dataObj.users) {
    if (userItem.id === req.session.userId) return userItem;
  }

  return null;
}

function isValidDateString(value) {
  if (!value) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'index.html'));
});

app.get('/api/me', (req, res) => {
  const userItem = getCurrentUser(req);
  if (!userItem) return res.json({ user: null });

  res.json({
    user: {
      id: userItem.id,
      username: userItem.username,
      name: String(userItem.name || userItem.username).trim()
    }
  });
});

app.post('/api/check-username', (req, res) => {
  const username = String(req.body.username || '').trim();
  if (username.length < 2) {
    return res.json({ taken: false });
  }

  const dataObj = readData();
  const foundUser = findUserByUsername(dataObj, username);
  res.json({ taken: !!foundUser });
});

app.post('/api/register', (req, res) => {
  const userName = String(req.body.name || '').trim();
  const userLogin = String(req.body.username || '').trim();
  const userPass = String(req.body.password || '').trim();

  if (userName.length < 2) {
    return res.status(400).json({ error: 'Имя должно быть минимум 2 символа' });
  }

  if (userLogin.length < 2 || userPass.length < 2) {
    return res.status(400).json({ error: 'Логин и пароль должны быть минимум 2 символа' });
  }

  const dataObj = readData();
  const existsUser = findUserByUsername(dataObj, userLogin);
  if (existsUser) {
    return res.status(400).json({ error: 'Такой логин уже занят' });
  }

  dataObj.lastUserId += 1;
  const newUser = {
    id: dataObj.lastUserId,
    name: userName,
    username: userLogin,
    password: hashPassword(userPass)
  };

  dataObj.users.push(newUser);
  writeData(dataObj);

  req.session.userId = newUser.id;
  req.session.username = newUser.username;
  req.session.name = newUser.name;

  res.json({ ok: true, user: { id: newUser.id, username: newUser.username, name: newUser.name } });
});

app.post('/api/login', (req, res) => {
  const userLogin = String(req.body.username || '').trim();
  const userPass = String(req.body.password || '').trim();

  const dataObj = readData();
  const foundUser = findUserByUsername(dataObj, userLogin);

  if (!foundUser || !checkPassword(userPass, String(foundUser.password || ''))) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }

  req.session.userId = foundUser.id;
  req.session.username = foundUser.username;
  req.session.name = foundUser.name || foundUser.username;

  res.json({
    ok: true,
    user: {
      id: foundUser.id,
      username: foundUser.username,
      name: String(foundUser.name || foundUser.username).trim()
    }
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

app.get('/api/notes', (req, res) => {
  const userItem = getCurrentUser(req);
  if (!userItem) return res.status(401).json({ error: 'unauthorized' });

  const dataObj = readData();
  const userNotes = [];

  for (const noteItem of dataObj.notes) {
    if (noteItem.userId === userItem.id) userNotes.push(noteItem);
  }

  userNotes.sort((a, b) => b.id - a.id);

  const outNotes = [];
  for (const noteItem of userNotes) {
    let noteTitle = '';
    let noteDesc = '';

    if (noteItem.title) noteTitle = String(noteItem.title).trim();
    if (noteItem.description) noteDesc = String(noteItem.description).trim();

    if (!noteTitle || !noteDesc) {
      const oldText = String(noteItem.text || '').trim();

      if (!noteTitle) {
        if (oldText) noteTitle = oldText.slice(0, 60);
        else noteTitle = 'Без названия';
      }

      if (!noteDesc) noteDesc = oldText;
    }

    outNotes.push({
      id: noteItem.id,
      title: noteTitle,
      description: noteDesc,
      deadline: String(noteItem.deadline || '').trim(),
      column_name: noteItem.columnName
    });
  }

  res.json(outNotes);
});

app.post('/api/notes', (req, res) => {
  const userItem = getCurrentUser(req);
  if (!userItem) return res.status(401).json({ error: 'unauthorized' });

  const noteTitle = String(req.body.title || '').trim();
  const noteDesc = String(req.body.description || '').trim();
  const noteDeadline = String(req.body.deadline || '').trim();

  if (!noteTitle || !noteDesc) {
    return res.status(400).json({ error: 'empty fields' });
  }
  if (!isValidDateString(noteDeadline)) {
    return res.status(400).json({ error: 'bad deadline' });
  }

  const dataObj = readData();
  dataObj.lastNoteId += 1;

  dataObj.notes.push({
    id: dataObj.lastNoteId,
    userId: userItem.id,
    title: noteTitle,
    description: noteDesc,
    deadline: noteDeadline,
    columnName: 'todo'
  });

  writeData(dataObj);
  res.json({ ok: true });
});

app.post('/api/move', (req, res) => {
  const userItem = getCurrentUser(req);
  if (!userItem) return res.status(401).json({ error: 'unauthorized' });

  const noteId = Number(req.body.id);
  const newColumn = req.body.column_name;

  if (!['todo', 'doing', 'done'].includes(newColumn)) {
    return res.status(400).json({ error: 'bad column' });
  }

  const dataObj = readData();
  let foundNote = null;

  for (const noteItem of dataObj.notes) {
    if (noteItem.id === noteId && noteItem.userId === userItem.id) {
      foundNote = noteItem;
      break;
    }
  }

  if (!foundNote) return res.status(404).json({ error: 'not found' });

  foundNote.columnName = newColumn;
  writeData(dataObj);
  res.json({ ok: true });
});

app.delete('/api/notes/:id', (req, res) => {
  const userItem = getCurrentUser(req);
  if (!userItem) return res.status(401).json({ error: 'unauthorized' });

  const noteId = Number(req.params.id);
  const dataObj = readData();
  const beforeCount = dataObj.notes.length;

  dataObj.notes = dataObj.notes.filter((noteItem) => {
    return !(noteItem.id === noteId && noteItem.userId === userItem.id);
  });

  if (dataObj.notes.length === beforeCount) {
    return res.status(404).json({ error: 'not found' });
  }

  writeData(dataObj);
  res.json({ ok: true });
});

if (require.main === module) {
  app.listen(port, () => {
    ensureDataFile();
    console.log(`Smart Workspace started on http://127.0.0.1:${port}`);
  });
}

module.exports = {
  app,
  ensureDataFile,
  readData,
  writeData,
  hashPassword,
  checkPassword,
  migratePlainPasswords,
  isValidDateString
};
