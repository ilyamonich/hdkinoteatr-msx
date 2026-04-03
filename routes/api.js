const express = require('express');
const router = express.Router();
const cache = require('memory-cache');
const dotenv = require('dotenv');
dotenv.config();

const { fetchHtml, fetchBinary, BASE_URL } = require('../utils/fetcher');
const {
  parseSearchResults,
  parseContentPage,
  extractVideoUrlFromPlayer,
  normalizeUrl,
} = require('../utils/parser');

const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300000; // 5 минут

// Вспомогательная функция для кэширования
function getOrFetch(key, fetcher, ttl = CACHE_TTL) {
  let cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  return fetcher().then(data => {
    if (data) cache.put(key, data, ttl);
    return data;
  });
}

// ---------------------- Поиск ----------------------
router.get('/search', async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) {
    return res.status(400).json({ success: false, error: 'Укажите параметр q' });
  }
  
  const searchUrl = `${BASE_URL}/search/?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`;
  
  const data = await getOrFetch(`search_${query}`, async () => {
    const html = await fetchHtml(searchUrl);
    if (!html) throw new Error('Не удалось загрузить поиск');
    const results = parseSearchResults(html);
    return { results };
  });
  
  if (!data) {
    return res.status(500).json({ success: false, error: 'Ошибка парсинга поиска' });
  }
  res.json({ success: true, results: data.results });
});

// ---------------------- Информация ----------------------
router.get('/info', async (req, res) => {
  let url = req.query.url;
  if (!url) {
    return res.status(400).json({ success: false, error: 'Параметр url обязателен' });
  }
  url = normalizeUrl(url);
  
  const cacheKey = `info_${url}`;
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(url);
    if (!html) throw new Error('Страница не загружена');
    const content = parseContentPage(html, url);
    return content;
  });
  
  if (!data) {
    return res.status(500).json({ success: false, error: 'Не удалось получить информацию' });
  }
  res.json({ success: true, ...data });
});

// ---------------------- Получение прямой видео-ссылки ----------------------
router.get('/video-url', async (req, res) => {
  let playerUrl = req.query.url;
  if (!playerUrl) {
    return res.status(400).json({ success: false, error: 'Параметр url обязателен' });
  }
  playerUrl = normalizeUrl(playerUrl);
  
  const cacheKey = `video_${playerUrl}`;
  const videoUrl = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(playerUrl);
    if (!html) throw new Error('Страница плеера не загружена');
    const url = extractVideoUrlFromPlayer(html);
    if (!url) throw new Error('Не найдена видео-ссылка');
    return url;
  }, CACHE_TTL);
  
  if (!videoUrl) {
    return res.status(404).json({ success: false, error: 'Не удалось извлечь видео' });
  }
  res.json({ success: true, videoUrl });
});

// ---------------------- Прокси для видео (обход CORS/Referer) ----------------------
router.get('/proxy/video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) {
    return res.status(400).json({ success: false, error: 'Не указан параметр url' });
  }
  
  // Проверяем, что ссылка ведёт на медиафайл (базовая защита)
  if (!videoUrl.match(/\.(m3u8|mp4|webm|mkv|ts)$/i) && !videoUrl.includes('/manifest')) {
    return res.status(400).json({ success: false, error: 'Неподдерживаемый формат видео' });
  }
  
  // Обработка Range заголовков (для перемотки)
  const rangeHeader = req.headers.range;
  const result = await fetchBinary(videoUrl, rangeHeader);
  if (!result) {
    return res.status(502).json({ success: false, error: 'Не удалось загрузить видео' });
  }
  
  const { data, headers } = result;
  if (headers['content-type']) res.setHeader('Content-Type', headers['content-type']);
  if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
  if (headers['content-range']) res.setHeader('Content-Range', headers['content-range']);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  
  res.status(rangeHeader ? 206 : 200).send(data);
});

module.exports = router;