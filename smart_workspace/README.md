# Smart Workspace

## RU

Учебный проект: простая канбан-доска заметок.

Функции:
- регистрация и вход пользователя
- заметка содержит: название, описание, дедлайн
- изменение цвета заметок в зависимости от статуса
- 3 колонки: `todo`, `doing`, `done`
- перенос карточек между колонками (drag & drop)
- удаление карточек
- переключение языка RU/EN
- перевод интерфейса и ошибок RU/EN
- сохранение сессии после входа
- проверка формата дедлайна на сервере
- хеширование паролей через `scrypt`

Запуск:
```bash
npm install
npm start
```

Тесты:
```bash
npm test
```

Открыть:
- `http://127.0.0.1:8000`

---

## EN

Training project: simple kanban notes board.

Features:
- user registration and login
- note fields: title, description, deadline
- note color changes depending on status
- 3 columns: `todo`, `doing`, `done`
- drag & drop between columns
- delete cards
- RU/EN language switch
- RU/EN UI and error messages
- session persistence after login
- server-side deadline format validation
- password hashing with `scrypt`

Run:
```bash
npm install
npm start
```

Tests:
```bash
npm test
```

Open:
- `http://127.0.0.1:8000`
