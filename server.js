const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const cacheDir = path.join(__dirname, 'cache');
if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir);

// Middleware
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

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// API роуты
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

// ---------- ВОЗВРАЩАЕМ МАССИВ (как ожидает MSX) ----------
const getStartParameter = (req) => [
  {
    name: "hdkinoteatr_main",
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

// Маршруты для MSX
app.get('/', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(getStartParameter(req));
});

app.get('/start', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(getStartParameter(req));
});

app.get('/msx/start.json', (req, res) => {
  console.log('[MSX] Запрос start.json получен');
  const response = getStartParameter(req);
  console.log('[MSX] Ответ:', JSON.stringify(response, null, 2));
  res.setHeader('Content-Type', 'application/json');
  res.json(response);
});

app.get('/status', (req, res) => {
  res.json({ success: true, status: 'online', timestamp: Date.now() });
});

// 404
app.use((req, res) => {
  console.log(`[404] ${req.method} ${req.url}`);
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Ошибки
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Внутренняя ошибка сервера' });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
  console.log(`📡 Стартовый параметр: http://localhost:${PORT}/msx/start.json`);
});
