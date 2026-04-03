const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Статические файлы из папки msx (start.json, content.json, иконки и т.д.)
app.use('/msx', express.static(path.join(__dirname, 'msx')));

// API роуты (поиск, популярное, информация, видео)
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// Корневой маршрут – перенаправляем на start.json для удобства
app.get('/', (req, res) => {
  res.redirect('/msx/start.json');
});

// Проверка статуса сервера
app.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Обработка 404 для всех остальных маршрутов
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Запуск сервера
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`👉 Стартовый параметр: https://hdkinoteatr-msx.onrender.com/msx/start.json`);
});
