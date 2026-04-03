const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Создаём папку для кэша (если нужно для дискового кэша, но у нас memory-cache)
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

// Корневой эндпоинт для проверки
app.get('/', (req, res) => {
  res.json({
    name: 'Media Station X Server',
    version: '1.0.0',
    endpoints: [
      '/api/search?q=...',
      '/api/info?url=...',
      '/api/video-url?url=...',
      '/api/proxy/video?url=...'
    ]
  });
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
  console.log(`📡 Проксирование видео включено: /api/proxy/video?url=...`);
});