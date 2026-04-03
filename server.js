const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Папка для кэша (не обязательна)
const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

// CORS – разрешаем всё для теста
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Range', 'User-Agent', 'Origin', 'Accept']
}));
app.options('*', cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Логирование
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Подключаем API (поиск, информация, видео и т.д.)
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- ФОРМИРОВАНИЕ СТАРТОВОГО ПАРАМЕТРА (МАССИВ) ----------
const getStartParameter = (req) => [
  {
    name: "hdkinoteatr_main",        // обязательно!
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
  }
];

// ---------- МАРШРУТЫ ДЛЯ MSX ----------
// Функция для отправки ответа с правильными заголовками
const sendStartParameter = (req, res) => {
  const data = getStartParameter(req);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.json(data);
};

// Все возможные пути, по которым MSX может запрашивать start parameter
app.get('/', sendStartParameter);
app.get('/start', sendStartParameter);
app.get('/msx/start.json', sendStartParameter);
app.get('/msx/start', sendStartParameter);

// Дополнительно: обработка запросов с любыми query-параметрами (например, ?v=...)
app.get('/msx/start.json', (req, res) => {
  console.log('[MSX] Запрос start.json с параметрами:', req.query);
  sendStartParameter(req, res);
});

// Проверка статуса
app.get('/status', (req, res) => {
  res.json({ success: true, status: 'online', timestamp: Date.now() });
});

// Отладка: сырой JSON
app.get('/debug', (req, res) => {
  res.json(getStartParameter(req));
});

// 404 для всего остального
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});

// Запуск
app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 Стартовый параметр MSX: http://localhost:${PORT}/msx/start.json`);
});
