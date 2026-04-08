// ---------- КАТЕГОРИИ (жанры) с главной страницы ----------
router.get('/categories', async (req, res) => {
  const cacheKey = 'all_categories';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную');
    const $ = require('cheerio').load(html);
    const categories = [];
    // Ищем блок с категориями/жанрами (типичные селекторы для hdkinoteatr)
    $('.categories a, .genres a, .menu-item a[href*="/films/"], .menu-item a[href*="/serials/"]').each((i, el) => {
      let name = $(el).text().trim();
      let link = $(el).attr('href');
      if (name && link && !link.includes('#')) {
        categories.push({ name, link: normalizeUrl(link) });
      }
    });
    // Если не нашли – добавим стандартные жанры
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
    // Преобразуем в формат списка MSX
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
    const movies = [];
    $('.short-item, .movie-item, .film-item, .post').each((i, el) => {
      const title = $(el).find('.title a, h3 a, .name a').first().text().trim();
      const link = $(el).find('.title a, h3 a, .name a').first().attr('href');
      const poster = $(el).find('img').attr('src') || '';
      const year = $(el).find('.year, .date').text().trim() || '';
      if (title && link) {
        movies.push({
          type: "control",
          label: title,
          subtitle: year,
          icon: poster || "movie",
          action: "load",
          url: `/api/info?url=${encodeURIComponent(link)}`
        });
      }
    });
    return { type: "list", title: "Фильмы", items: movies };
  });
  res.json(data);
});

// ---------- ВСЕ ФИЛЬМЫ (главная страница) ----------
router.get('/movies', async (req, res) => {
  const cacheKey = 'all_movies';
  const data = await getOrFetch(cacheKey, async () => {
    const html = await fetchHtml(BASE_URL);
    if (!html) throw new Error('Не удалось загрузить главную');
    const $ = require('cheerio').load(html);
    const movies = [];
    $('.short-item, .movie-item, .film-item').slice(0, 24).each((i, el) => {
      const title = $(el).find('.title a, h3 a').first().text().trim();
      const link = $(el).find('.title a, h3 a').first().attr('href');
      const poster = $(el).find('img').attr('src') || '';
      const year = $(el).find('.year, .date').text().trim() || '';
      if (title && link) {
        movies.push({
          type: "control",
          label: title,
          subtitle: year,
          icon: poster || "movie",
          action: "load",
          url: `/api/info?url=${encodeURIComponent(link)}`
        });
      }
    });
    return { type: "list", title: "Все фильмы", items: movies };
  });
  res.json(data);
});
