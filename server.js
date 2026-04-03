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

// API роуты (поиск, популярное и т.д.)
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- БАЗОВЫЙ URL ВАШЕГО СЕРВЕРА ----------
const SERVER_URL = "https://hdkinoteatr-msx.onrender.com";

// ---------- СТАРТОВЫЙ ПАРАМЕТР ----------
const startParameter = {
  name: "HDKinoteatr Media",
  image: `${SERVER_URL}/icon.png`, // можно заменить на реальную иконку или удалить
  version: "1.0",
  parameter: `content:${SERVER_URL}/api/main`
};

// ---------- ОСНОВНОЙ КОНТЕНТ (обёрнут в поле "content") ----------
app.get('/api/main', (req, res) => {
  const mainContent = {
    content: {   // <-- ЭТО ПОЛЕ ОБЯЗАТЕЛЬНО
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
        },
        {
          id: "popular",
          title: "🔥 Популярное",
          icon: "trending_up",
          action: "load",
          url: "/api/popular"
        },
        {
          id: "movies",
          title: "🎬 Фильмы",
          icon: "movie",
          action: "load",
          url: "/api/category/movies"
        },
        {
          id: "series",
          title: "📺 Сериалы",
          icon: "tv",
          action: "load",
          url: "/api/category/series"
        }
      ],
      settings: {
        serverUrl: SERVER_URL,
        cacheTTL: 300
      }
    }
  };
  res.json(mainContent);
});

// Маршруты для стартового параметра
app.get(['/', '/start', '/msx/start', '/msx/start.json'], (req, res) => {
  console.log('[MSX] Запрос start parameter');
  res.setHeader('Content-Type', 'application/json');
  res.json(startParameter);
});

// Отладка
app.get('/debug', (req, res) => {
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
