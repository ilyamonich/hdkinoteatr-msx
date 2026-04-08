const express = require('express');
const router = express.Router();          // ← ОБЯЗАТЕЛЬНО ПЕРВЫМ
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

// ---------- ПОИСК ----------
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
      action: "load",
      url: `/api/info?url=${encodeURIComponent(item.url)}`
    }));
    return { type: "list", items };
  });
  if (!data) return res.status(500).json({ error: 'Ошибка парсинга поиска' });
  res.json(data);
});

// ---------- ИНФОРМАЦИЯ О ФИЛЬМЕ/СЕРИАЛЕ ----------
router.get('/info', async (req, res) => {
  let url = req.query.url;
  if (!url) return res.status(400).json({ error: 'Параметр url обязателен' });
  url = normalizeUrl(url);
  const cacheKey = `info_${url}`;
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(url);
    if (!html) throw new Error('Страница не загружена');
    return parseContentPage(html, url);
  });
  if (!data) return res.status(500).json({ error: 'Не удалось получить информацию' });

  if (data.type === 'movie') {
    res.json({
      type: "movie",
      title: data.title,
      description: data.description,
      poster: data.poster,
      actions: [{
        label: "▶ Смотреть",
        action: "play",
        url: `/api/video-url?url=${encodeURIComponent(data.videoPageUrl)}`
      }]
    });
  } else {
    let items = [];
    for (const season of data.seasons) {
      for (const ep of season.episodes) {
        items.push({
          type: "control",
          label: `${season.num}x${ep.num}: ${ep.title}`,
          action: "play",
          url: `/api/video-url?url=${encodeURIComponent(ep.url)}`
        });
      }
    }
    res.json({
      type: "list",
      title: data.title,
      description: data.description,
      poster: data.poster,
      items
    });
  }
});

// ---------- ВИДЕО-ССЫЛКА ----------
router.get('/video-url', async (req, res) => {
  let playerUrl = req.query.url;
  if (!playerUrl) return res.status(400).json({ error: 'Параметр url обязателен' });
  playerUrl = normalizeUrl(playerUrl);
  const cacheKey = `video_${playerUrl}`;
  const videoUrl = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(playerUrl);
    if (!html) throw new Error('Страница плеера не загружена');
    const url = extractVideoUrlFromPlayer(html);
    if (!url) throw new Error('Не найдена видео-ссылка');
    return url;
  }, CACHE_TTL);
  if (!videoUrl) return res.status(404).json({ error: 'Не удалось извлечь видео' });
  res.json({ videoUrl });
});

// ---------- ПРОКСИ ВИДЕО ----------
router.get('/proxy/video', async (req, res) => {
  const videoUrl = req.query.url;
  if (!videoUrl) return res.status(400). json({ error: 'Не указан параметр url' });
  if (!videoUrl.match(/\.(m3u8|mp4|webm|mkv|ts)$/i) && !videoUrl.includes('/manifest')) {
    return res.status(400).json({ error: 'Неподдерживаемый формат видео' });
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

// ---------- ВСЕ ФИЛЬМЫ (главная страница) ----------
router.get('/movies', async (req, res) => {
  const cacheKey = 'all_movies';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную');
    const $ = require('cheerio').load(html);
    const items = [];
    $('.short-item, .movie-item, .film-item').slice(0, 24).each((i, el) => {
      const title = $(el).find('.title a, h3 a').first().text().trim();
      const link = $(el).find('.title a, h3 a').first().attr('href');
      const poster = $(el).find('img').attr('src') || '';
      const year = $(el).find('.year, .date').text().trim() || '';
      if (title && link) {
        items.push({
          type: "control",
          label: title,
          subtitle: year,
          icon: poster || "movie",
          action: "load",
          url: `/api/info?url=${encodeURIComponent(link)}`
        });
      }
    });
    return { type: "list", title: "Все фильмы", items };
  });
  res.json(data);
});

// ---------- КАТЕГОРИИ (список жанров) ----------
router.get('/categories', async (req, res) => {
  const cacheKey = 'all_categories';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную');
    const $ = require('cheerio').load(html);
    const categories = [];
    $('.categories a, .genres a, .menu-item a[href*="/films/"], .menu-item a[href*="/serials/"]').each((i, el) => {
      let name = $(el).text().trim();
      let link = $(el).attr('href');
      if (name && link && !link.includes('#')) {
        categories.push({ name, link: normalizeUrl(link) });
      }
    });
    if (categories.length === 0) {
      const defaultGenres = [
        { name: "Боевики", link: "/films/boeviki/" },
        { name: "Комедии", link: "/films/komedii/" },
        { name: "Драмы", link: "/films/drami/" },
        { name: "Ужасы", link: "/films/uzhasy/" },
        { name: "Фантастика", link: "/films/fantastika/" }
      ];
      defaultGenres.forEach(g => categories.push({ name: g.name, link: normalizeUrl(g.link) }));
    }
    const items = categories.map(cat => ({
      type: "control",
      label: cat.name,
      icon: "folder",
      action: "load",
      url: `/api/category?url=${encodeURIComponent(cat.link)}`
    }));
    return { type: "list", title: "Категории", items };
  });
  res.json(data);
});

// ---------- ФИЛЬМЫ ПО КАТЕГОРИИ ----------
router.get('/category', async (req, res) => {
  let categoryUrl = req.query.url;
  if (!categoryUrl) return res.status(400).json({ error: 'Не указан параметр url' });
  categoryUrl = normalizeUrl(categoryUrl);
  const cacheKey = `category_${categoryUrl}`;
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(categoryUrl);
    if (!html) throw new Error('Не удалось загрузить категорию');
    const $ = require('cheerio').load(html);
    const items = [];
    $('.short-item, .movie-item, .film-item, .post').each((i, el) => {
      const title = $(el).find('.title a, h3 a, .name a').first().text().trim();
      const link = $(el).find('.title a, h3 a, .name a').first().attr('href');
      const poster = $(el).find('img').attr('src') || '';
      const year = $(el).find('.year, .date').text().trim() || '';
      if (title && link) {
        items.push({
          type: "control",
          label: title,
          subtitle: year,
          icon: poster || "movie",
          action: "load",
          url: `/api/info?url=${encodeURIComponent(link)}`
        });
      }
    });
    return { type: "list", title: "Фильмы", items };
  });
  res.json(data);
});

// ---------- ПОПУЛЯРНОЕ (для обратной совместимости) ----------
router.get('/popular', async (req, res) => {
  const cacheKey = 'popular_main';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную');
    const $ = require('cheerio').load(html);
    const items = [];
    $('.short-item, .movie-item, .film-item').slice(0, 12).each((i, el) => {
      const title = $(el).find('.title a, h3 a').first().text().trim();
      const link = $(el).find('.title a, h3 a').first().attr('href');
      const poster = $(el).find('img').attr('src');
      if (title && link) {
        items.push({
          type: "control",
          label: title,
          icon: poster || "movie",
          action: "load",
          url: `/api/info?url=${encodeURIComponent(link)}`
        });
      }
    });
    return { type: "list", items };
  });
  res.json(data);
});

// ---------- КАТЕГОРИЯ "ФИЛЬМЫ" (заглушка) ----------
router.get('/category/movies', async (req, res) => {
  res.json({
    type: "list",
    items: [
      {
        type: "control",
        label: "🔍 Поиск фильмов",
        action: "input",
        input: {
          prompt: "Название фильма",
          submit: "/api/search?q={query}"
        }
      },
      {
        type: "control",
        label: "🔥 Популярные фильмы",
        action: "load",
        url: "/api/popular"
      }
    ]
  });
});

// ---------- КАТЕГОРИЯ "СЕРИАЛЫ" (заглушка) ----------
router.get('/category/series', async (req, res) => {
  res.json({
    type: "list",
    items: [
      {
        type: "control",
        label: "🔍 Поиск сериалов",
        action: "input",
        input: {
          prompt: "Название сериала",
          submit: "/api/search?q={query}"
        }
      }
    ]
  });
});

module.exports = router;
