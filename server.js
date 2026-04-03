const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.options('*', cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Раздача статических файлов из папки msx
app.use('/msx', express.static(path.join(__dirname, 'msx')));

// API роуты
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

const SERVER_URL = process.env.SERVER_URL || 'https://hdkinoteatr-msx.onrender.com';

const startParameter = {
  name: "HDKinoteatr Media",
  image: `${SERVER_URL}/msx/icon.png`, // если нет иконки – удалите эту строку
  version: "1.0",
  parameter: `content:${SERVER_URL}/msx/content.json`
};

// Стартовый параметр
app.get(['/', '/start', '/msx/start', '/msx/start.json'], (req, res) => {
  console.log('[MSX] Запрос start parameter');
  res.setHeader('Content-Type', 'application/json');
  res.json(startParameter);
});

app.get('/status', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на порту ${PORT}`);
  console.log(`👉 Стартовый параметр: ${SERVER_URL}/msx/start.json`);
});
