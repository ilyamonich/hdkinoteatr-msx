const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Создаём папку для кэша (если нужна, но мы используем memory-cache)
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование запросов
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Подключаем API роуты
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- СТАРТОВЫЙ ПАРАМЕТР ДЛЯ MEDIA STATION X ----------
// Этот маршрут будет вызван MSX при запуске (обычно GET / или /start)
const getStartParameter = (req) => ({
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
    serverUrl: `${req.protocol}://${req.get('host')}`,
    cacheTTL: 300
  }
});

// Корневой маршрут (для проверки и для MSX)
app.get('/', (req, res) => {
  res.json(getStartParameter(req));
});

// Отдельный маршрут /start (часто используется в MSX)
app.get('/start', (req, res) => {
  res.json(getStartParameter(req));
});

// Эндпоинт для проверки статуса сервера
app.get('/status', (req, res) => {
  res.json({ success: true, status: 'online', timestamp: Date.now() });
});

// Обработка 404
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Глобальный обработчик ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});

// Запуск
app.listen(PORT, () => {
  console.log(`✅ Media Station X сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 Стартовый параметр доступен: http://localhost:${PORT}/start`);
});
