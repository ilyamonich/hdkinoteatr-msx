const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

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

// API роуты (поиск, популярное, информация, видео)
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

const SERVER_URL = process.env.SERVER_URL || 'https://hdkinoteatr-msx.onrender.com';

// Стартовый параметр – только поиск (без parameter)
const startParameter = {
  name: "hdkinoteatr_main",
  version: "1.0",
  title: "HDKinoteatr Media",
  menu: [
    {
      id: "search",
      title: "🔍 Поиск фильмов и сериалов",
      icon: "search",
      action: "input",
      input: {
        prompt: "Введите название",
        submit: "/api/search?q={query}"
      }
    }
  ]
};

// Маршруты для стартового параметра
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
