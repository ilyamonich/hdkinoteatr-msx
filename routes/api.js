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

const CACHE_TTL = parseInt(process.env.CACHE_TTL) || 300000;

function getOrFetch(key, fetcher, ttl = CACHE_TTL) {
  let cached = cache.get(key);
  if (cached) return Promise.resolve(cached);
  return fetcher().then(data => {
    if (data) cache.put(key, data, ttl);
    return data;
  });
}

// Поиск – возвращает список
router.get('/search', async (req, res) => {
  const query = req.query.q?.trim();
  if (!query) {
    return res.status(400).json({ error: 'Укажите параметр q' });
  }
  const searchUrl = `${BASE_URL}/search/?do=search&subaction=search&search_start=0&full_search=0&result_from=1&story=${encodeURIComponent(query)}`;
  const data = await getOrFetch(`search_${query}`, async () => {
    const html = await fetchHtml(searchUrl);
    if (!html) throw new Error('Не удалось загрузить поиск');
    const results = parseSearchResults(html);
    const items = results.map(item => ({
      type: "control",
      label: item.title,
      icon: item.poster || "movie",
      action: "open",
      url: `/api/info?url=${encodeURIComponent(item.url)}`
    }));
    return { type: "list", items };
  });
  if (!data) {
    return res.status(500).json({ error: 'Ошибка парсинга поиска' });
  }
  res.json(data);
});

// Информация о фильме/сериале
router.get('/info', async (req, res) => {
  let url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'Параметр url обязателен' });
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
    return res.status(500).json({ error: 'Не удалось получить информацию' });
  }
  if (data.type === 'movie') {
    res.json({
      type: "movie",
      title: data.title,
      description: data.description,
      poster: data.poster,
      actions: [
        {
          label: "▶ Смотреть",
          action: "play",
          url: `/api/video-url?url=${encodeURIComponent(data.videoPageUrl)}`
        }
      ]
    });
  } else {
    let episodesList = [];
    for (const season of data.seasons) {
      episodesList.push({
        type: "control",
        label: `Сезон ${season.num}`,
        items: season.episodes.map(ep => ({
          type: "control",
          label: `${ep.num}. ${ep.title}`,
          action: "play",
          url: `/api/video-url?url=${encodeURIComponent(ep.url)}`
        }))
      });
    }
    res.json({
      type: "list",
      title: data.title,
      description: data.description,
      poster: data.poster,
      items: episodesList
    });
  }
});

// Получение прямой видео-ссылки
router.get('/video-url', async (req, res) => {
  let playerUrl = req.query.url;
  if (!playerUrl) {
    return res.status(400).json({ error: 'Параметр url обязателен' });
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
    return res.status(404).json({ error: 'Не удалось извлечь видео' });
  }
  res.json({ videoUrl });
});

// Прокси видео
router.get('/proxy/video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400).json({ error: 'Не указан параметр url' });
  if (!videoUrl.match(/\.(m3u8|mp4|webm|mkv|ts)$/i) && !videoUrl.includes('/manifest')) {
    return res.status(400). json({ error: 'Неподдерживаемый формат видео' });
  }
  const rangeHeader = req.headers.range;
  const result = await fetchBinary(videoUrl, rangeHeader);
  if (!result) return res.status(502).json({ error: 'Не удалось загрузить видео' });
  const { data, headers } = result;
  if (headers['content-type']) res.setHeader('Content-Type', headers['content-type']);
  if (headers['content-length']) res.setHeader('Content-Length', headers['content-length']);
  if (headers['content-range']) res.setHeader('Content-Range', headers['content-range']);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.status(rangeHeader ? 206 : 200).send(data);
});

// Популярное (список фильмов)
router.get('/popular', async (req, res) => {
  const cacheKey = 'popular_main';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную страницу');
    const $ = require('cheerio').load(html);
    const items = [];
    $('.short-item, .movie-item, .film-item').slice(0, 12).each((i, el) => {
      const title = $(el).find('.title a, h3 a').first().text().trim();
      const url = $(el).find('.title a, h3 a').first().attr('href');
      const poster = $(el).find('img').attr('src');
      if (title && url) {
        items.push({
          type: "control",
          label: title,
          icon: poster || "movie",
          action: "open",
          url: `/api/info?url=${encodeURIComponent(url)}`
        });
      }
    });
    return { type: "list", items };
  });
  if (!data) return res.status(500).json({ error: 'Ошибка загрузки популярного' });
  res.json(data);
});

// Категория "Фильмы"
router.get('/category/movies', async (req, res) => {
  res.json({
    type: "list",
    items: [
      {
        type: "control",
        label: "🔍 Поиск фильмов",
        action: "search",
        search: {
          prompt: "Название фильма",
          url: "/api/search?q={query}"
        }
      },
      {
        type: "control",
        label: "🔥 Популярные фильмы",
        action: "open",
        url: "/api/popular"
      }
    ]
  });
});

// Категория "Сериалы"
router.get('/category/series', async (req, res) => {
  res.json({
    type: "list",
    items: [
      {
        type: "control",
        label: "🔍 Поиск сериалов",
        action: "search",
        search: {
          prompt: "Название сериала",
          url: "/api/search?q={query}"
        }
      }
    ]
  });
});

module.exports = router;
