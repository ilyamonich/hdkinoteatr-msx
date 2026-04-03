const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Создаём папку для кэша (если нужна)
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

// ---------- Middleware ----------
// Настройка CORS для любых источников (для теста)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'User-Agent', 'Origin', 'Accept'],
  credentials: true,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование всех запросов (полезно для отладки)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Подключаем API роуты
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- Функция формирования стартового параметра для MSX ----------
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

// ---------- Маршруты для Media Station X ----------
// Корень (может использоваться для проверки)
app.get('/', (req, res) => {
  res.json(getStartParameter(req));
});

// /start (некоторые версии MSX)
app.get('/start', (req, res) => {
  res.json(getStartParameter(req));
});

// ОСНОВНОЙ МАРШРУТ: именно его запрашивает MSX
app.get('/msx/start.json', (req, res) => {
  console.log('[MSX] Запрос start.json получен');
  res.json(getStartParameter(req));
});

// Дополнительно, на случай если запросят без .json
app.get('/msx/start', (req, res) => {
  res.json(getStartParameter(req));
});

// Статус сервера
app.get('/status', (req, res) => {
  res.json({ success: true, status: 'online', timestamp: Date.now() });
});

// ---------- Обработка 404 (должна быть ПОСЛЕ всех конкретных маршрутов) ----------
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
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
  console.log(`📡 Стартовый параметр MSX: http://localhost:${PORT}/msx/start.json`);
});
