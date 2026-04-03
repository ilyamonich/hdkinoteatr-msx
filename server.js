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

// Логирование
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Раздача статических файлов из папки msx (чтобы content.json был доступен)
app.use('/msx', express.static(path.join(__dirname, 'msx')));

// API роуты (поиск, популярное и т.д.) – остаются без изменений
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- СТАРТОВЫЙ ПАРАМЕТР (указывает на статический content.json) ----------
const SERVER_URL = process.env.SERVER_URL || 'https://hdkinoteatr-msx.onrender.com';
const startParameter = {
  name: "HDKinoteatr Media",
  image: `${SERVER_URL}/msx/icon.png`, // если есть иконка, положите её в папку msx/icon.png
  version: "1.0",
  parameter: `content:${SERVER_URL}/msx/content.json`
};

// Маршруты для стартового параметра (отдаём JSON)
app.get(['/', '/start', '/msx/start', '/msx/start.json'], (req, res) => {
  console.log('[MSX] Запрос start parameter');
  res.setHeader('Content-Type', 'application/json');
  res.json(startParameter);
});

// Простой эндпоинт для проверки статуса
app.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 404 для всего остального
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`👉 Стартовый параметр: ${SERVER_URL}/msx/start.json`);
  console.log(`👉 Файл контента: ${SERVER_URL}/msx/content.json`);
});
