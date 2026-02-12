let dragId = null;
let authMode = 'login';
let currentLang = 'ru';

const textMap = {
  ru: {
    authSubtitle: 'Личные заметки в формате канбан',
    namePlaceholder: 'Имя',
    usernamePlaceholder: 'Логин',
    passwordPlaceholder: 'Пароль',
    loginBtn: 'Войти',
    registerBtn: 'Регистрация',
    greet: 'Привет,',
    logout: 'Выйти',
    newNote: 'Новая заметка',
    noteTitlePlaceholder: 'Название заметки',
    noteDescriptionPlaceholder: 'Описание заметки...',
    deadlineLabel: 'Дедлайн',
    addNote: 'Добавить',
    todo: 'К выполнению',
    doing: 'В работе',
    done: 'Готово',
    delete: 'Удалить',
    fillName: 'Введите имя для регистрации',
    authError: 'Ошибка авторизации',
    usernameTaken: 'Этот логин уже занят',
    usernameShort: 'Логин должен быть минимум 2 символа',
    saveError: 'Ошибка сохранения заметки'
  },
  en: {
    authSubtitle: 'Personal notes in kanban format',
    namePlaceholder: 'Name',
    usernamePlaceholder: 'Login',
    passwordPlaceholder: 'Password',
    loginBtn: 'Sign in',
    registerBtn: 'Sign up',
    greet: 'Hello,',
    logout: 'Log out',
    newNote: 'New note',
    noteTitlePlaceholder: 'Note title',
    noteDescriptionPlaceholder: 'Note description...',
    deadlineLabel: 'Deadline',
    addNote: 'Add',
    todo: 'To do',
    doing: 'Doing',
    done: 'Done',
    delete: 'Delete',
    fillName: 'Enter your name for sign up',
    authError: 'Authorization error',
    usernameTaken: 'This login is already taken',
    usernameShort: 'Login must be at least 2 characters',
    saveError: 'Failed to save note'
  }
};

function getText(key) {
  return textMap[currentLang][key] || key;
}

function mapServerError(errorText) {
  if (currentLang !== 'en') return errorText;

  if (errorText === 'Логин и пароль должны быть минимум 2 символа') return 'Login and password must be at least 2 characters';
  if (errorText === 'Такой логин уже занят') return 'This login is already taken';
  if (errorText === 'Неверный логин или пароль') return 'Invalid login or password';
  if (errorText === 'Имя должно быть минимум 2 символа') return 'Name must be at least 2 characters';
  return errorText;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function showAuth(errorText) {
  const authBlock = document.getElementById('authView');
  const boardBlock = document.getElementById('boardView');
  const errorBlock = document.getElementById('authError');

  authBlock.classList.remove('hidden');
  boardBlock.classList.add('hidden');

  if (errorText) {
    errorBlock.textContent = errorText;
    errorBlock.classList.remove('hidden');
  } else {
    errorBlock.textContent = '';
    errorBlock.classList.add('hidden');
  }
}

function showBoard(userName) {
  document.getElementById('usernameLabel').textContent = userName;
  document.getElementById('authView').classList.add('hidden');
  document.getElementById('boardView').classList.remove('hidden');
}

function setAuthMode(modeName) {
  const nameInput = document.getElementById('name');
  const submitBtn = document.getElementById('authSubmitBtn');
  const modeBtn = document.getElementById('authToggleBtn');

  authMode = modeName;

  if (modeName === 'register') {
    nameInput.classList.remove('hidden');
    submitBtn.textContent = getText('registerBtn');
    modeBtn.textContent = getText('loginBtn');
  } else {
    nameInput.classList.add('hidden');
    submitBtn.textContent = getText('loginBtn');
    modeBtn.textContent = getText('registerBtn');
  }
}

function applyLang() {
  document.documentElement.lang = currentLang;

  document.getElementById('authSubtitle').textContent = getText('authSubtitle');
  document.getElementById('name').placeholder = getText('namePlaceholder');
  document.getElementById('username').placeholder = getText('usernamePlaceholder');
  document.getElementById('password').placeholder = getText('passwordPlaceholder');

  document.getElementById('greetText').textContent = getText('greet');
  document.getElementById('logoutBtn').textContent = getText('logout');
  document.getElementById('newNoteTitle').textContent = getText('newNote');
  document.getElementById('newTitle').placeholder = getText('noteTitlePlaceholder');
  document.getElementById('newDescription').placeholder = getText('noteDescriptionPlaceholder');
  document.getElementById('newDeadline').setAttribute('aria-label', getText('deadlineLabel'));
  document.getElementById('addNoteBtn').textContent = getText('addNote');
  document.getElementById('todoTitle').textContent = getText('todo');
  document.getElementById('doingTitle').textContent = getText('doing');
  document.getElementById('doneTitle').textContent = getText('done');

  const langBtnText = currentLang === 'ru' ? 'EN' : 'RU';
  document.getElementById('langToggleAuthBtn').textContent = langBtnText;
  document.getElementById('langToggleBoardBtn').textContent = langBtnText;

  setAuthMode(authMode);
}

function toggleLang() {
  if (currentLang === 'ru') currentLang = 'en';
  else currentLang = 'ru';

  applyLang();
  loadNotes();
}

async function checkUsernameTaken(userLogin) {
  const response = await fetch('/api/check-username', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: userLogin })
  });

  if (!response.ok) return false;

  let data = {};
  try {
    data = await response.json();
  } catch (_e) {
    data = {};
  }

  return !!data.taken;
}

async function loadNotes() {
  const response = await fetch('/api/notes');
  if (!response.ok) return;

  let notesData = [];
  try {
    notesData = await response.json();
  } catch (_e) {
    notesData = [];
  }

  const todoBox = document.getElementById('todo');
  const doingBox = document.getElementById('doing');
  const doneBox = document.getElementById('done');

  todoBox.innerHTML = '';
  doingBox.innerHTML = '';
  doneBox.innerHTML = '';

  const nowDate = new Date();
  const todayValue = nowDate.toISOString().slice(0, 10);

  for (const noteItem of notesData) {
    let deadlineText = '';
    let overdueClass = '';
    if (noteItem.deadline) {
      deadlineText = '<div class="deadlineText">' + getText('deadlineLabel') + ': ' + escapeHtml(noteItem.deadline) + '</div>';
      if (noteItem.deadline < todayValue) {
        overdueClass = ' overdue';
      }
    }

    const html = '<article class="card' + overdueClass + '" draggable="true" data-id="' + noteItem.id + '">' +
      '<h3>' + escapeHtml(noteItem.title || '') + '</h3>' +
      '<p>' + escapeHtml(noteItem.description || '') + '</p>' +
      deadlineText +
      '<button class="red" data-delete-id="' + noteItem.id + '">' + getText('delete') + '</button>' +
      '</article>';

    if (noteItem.column_name === 'todo') todoBox.insertAdjacentHTML('beforeend', html);
    if (noteItem.column_name === 'doing') doingBox.insertAdjacentHTML('beforeend', html);
    if (noteItem.column_name === 'done') doneBox.insertAdjacentHTML('beforeend', html);
  }

  const cardList = document.querySelectorAll('.card');
  for (const cardItem of cardList) {
    cardItem.addEventListener('dragstart', function () {
      dragId = Number(cardItem.dataset.id);
    });
  }

  const deleteBtns = document.querySelectorAll('[data-delete-id]');
  for (const btnItem of deleteBtns) {
    btnItem.addEventListener('click', async function () {
      const noteId = Number(btnItem.dataset.deleteId);
      await fetch('/api/notes/' + noteId, { method: 'DELETE' });
      await loadNotes();
    });
  }
}

async function createNote() {
  const titleInput = document.getElementById('newTitle');
  const descInput = document.getElementById('newDescription');
  const deadlineInput = document.getElementById('newDeadline');

  const noteTitle = titleInput.value.trim();
  const noteDesc = descInput.value.trim();
  const noteDeadline = deadlineInput.value.trim();

  if (!noteTitle || !noteDesc) return;

  const response = await fetch('/api/notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: noteTitle, description: noteDesc, deadline: noteDeadline })
  });

  if (!response.ok) {
    showAuth(getText('saveError'));
    return;
  }

  titleInput.value = '';
  descInput.value = '';
  deadlineInput.value = '';
  await loadNotes();
}

async function doAuth() {
  const nameInput = document.getElementById('name');
  const loginInput = document.getElementById('username');
  const passInput = document.getElementById('password');

  const userName = nameInput.value.trim();
  const userLogin = loginInput.value.trim();
  const userPass = passInput.value.trim();

  const apiUrl = authMode === 'register' ? '/api/register' : '/api/login';
  const bodyData = { username: userLogin, password: userPass };

  if (authMode === 'register') {
    if (!userName) {
      showAuth(getText('fillName'));
      return;
    }

    if (userLogin.length < 2) {
      showAuth(getText('usernameShort'));
      return;
    }

    const isTaken = await checkUsernameTaken(userLogin);
    if (isTaken) {
      showAuth(getText('usernameTaken'));
      return;
    }

    bodyData.name = userName;
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(bodyData)
  });

  let responseData = {};
  try {
    responseData = await response.json();
  } catch (_e) {
    responseData = {};
  }

  if (!response.ok) {
    showAuth(mapServerError(responseData.error || getText('authError')));
    return;
  }

  showBoard(responseData.user.name || responseData.user.username);
  await loadNotes();
}

function bindDropZones() {
  const zones = document.querySelectorAll('.dropzone');

  for (const zoneItem of zones) {
    zoneItem.addEventListener('dragover', function (event) {
      event.preventDefault();
    });

    zoneItem.addEventListener('drop', async function (event) {
      event.preventDefault();
      if (!dragId) return;

      await fetch('/api/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dragId, column_name: zoneItem.id })
      });

      dragId = null;
      await loadNotes();
    });
  }
}

async function startApp() {
  bindDropZones();
  setAuthMode('login');
  applyLang();

  document.getElementById('authSubmitBtn').addEventListener('click', async function () {
    await doAuth();
  });

  document.getElementById('authToggleBtn').addEventListener('click', function () {
    if (authMode === 'login') setAuthMode('register');
    else setAuthMode('login');
    showAuth('');
  });

  document.getElementById('langToggleAuthBtn').addEventListener('click', function () {
    toggleLang();
  });

  document.getElementById('langToggleBoardBtn').addEventListener('click', function () {
    toggleLang();
  });

  document.getElementById('addNoteBtn').addEventListener('click', async function () {
    await createNote();
  });

  document.getElementById('logoutBtn').addEventListener('click', async function () {
    await fetch('/api/logout', { method: 'POST' });
    showAuth('');
    document.getElementById('todo').innerHTML = '';
    document.getElementById('doing').innerHTML = '';
    document.getElementById('done').innerHTML = '';
  });

  const meResponse = await fetch('/api/me');
  if (!meResponse.ok) {
    showAuth('');
    return;
  }

  let meData = {};
  try {
    meData = await meResponse.json();
  } catch (_e) {
    meData = {};
  }

  if (meData.user) {
    showBoard(meData.user.name || meData.user.username);
    await loadNotes();
  } else {
    showAuth('');
  }
}

startApp();
