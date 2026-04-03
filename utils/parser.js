const cheerio = require('cheerio');
const { BASE_URL } = require('./fetcher');

/**
 * Нормализация URL
 */
function normalizeUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  return `${BASE_URL}${path.startsWith('/') ? path : '/' + path}`;
}

/**
 * Парсинг страницы поиска
 * @param {string} html
 * @returns {Array}
 */
function parseSearchResults(html) {
  const $ = cheerio.load(html);
  const results = [];

  // Селекторы подбираются под типовую структуру hdkinoteatr.com (можно менять)
  $('.short-item, .movie-item, .film-item, .post-list .item').each((i, el) => {
    const titleElem = $(el).find('.title a, h3 a, .name a, .post-title a');
    let title = titleElem.text().trim();
    let relativeUrl = titleElem.attr('href');
    
    // Если не нашли – пробуем другие варианты
    if (!relativeUrl) {
      relativeUrl = $(el).find('a').first().attr('href');
      title = $(el).find('a').first().attr('title') || $(el).find('.title').text().trim();
    }
    
    const poster = $(el).find('img').attr('src') || $(el).find('.poster img').attr('src') || '';
    const year = $(el).find('.year, .date, .post-date').text().trim();
    
    let type = 'movie';
    if (relativeUrl && (relativeUrl.includes('/serial/') || $(el).find('.serial-label').length)) {
      type = 'series';
    }
    
    if (title && relativeUrl) {
      results.push({
        title,
        type,
        url: relativeUrl,
        poster: normalizeUrl(poster),
        year: year || '',
      });
    }
  });
  
  return results;
}

/**
 * Парсинг страницы фильма/сериала
 * @param {string} html
 * @param {string} pageUrl
 * @returns {object}
 */
function parseContentPage(html, pageUrl) {
  const $ = cheerio.load(html);
  const title = $('h1, .title, .post-title').first().text().trim();
  const description = $('.full-story, .desc-text, .post-content, .story-content').first().text().trim();
  const poster = $('.poster img, .film-poster img, .movie-poster img').attr('src') || '';
  
  const isSeries = pageUrl.includes('/serial/') || $('.serial-seasons, .seasons-list, .season-list').length > 0;
  
  if (!isSeries) {
    // Попытаемся извлечь ссылку на плеер (часто в iframe)
    let videoPageUrl = null;
    const iframe = $('iframe[src*="hdkinoteatr"], iframe[src*="/embed/"]').attr('src');
    if (iframe) videoPageUrl = normalizeUrl(iframe);
    else {
      const watchLink = $('a:contains("Смотреть"), a:contains("Смотреть онлайн"), .play-btn').attr('href');
      if (watchLink && watchLink !== '#') videoPageUrl = normalizeUrl(watchLink);
    }
    return {
      type: 'movie',
      title,
      description,
      poster: normalizeUrl(poster),
      videoPageUrl, // страница, где находится плеер (дальше нужно извлечь реальное видео)
    };
  }
  
  // Парсинг сериала
  const seasons = [];
  const seasonsBlocks = $('.serial-seasons, .seasons-list, .season-list, .seasons');
  if (seasonsBlocks.length) {
    seasonsBlocks.each((i, seasonElem) => {
      let seasonNum = $(seasonElem).find('.season-title, .season-num').text().match(/\d+/)?.[0] || (i+1).toString();
      const episodes = [];
      
      $(seasonElem).find('.series-item, .episode-item, .episode, .season-episode').each((j, epElem) => {
        let epNum = $(epElem).find('.episode-num, .series-num').text().match(/\d+/)?.[0] || (j+1).toString();
        let epTitle = $(epElem).find('.episode-title, .series-title').text().trim() || `Эпизод ${epNum}`;
        let epLink = $(epElem).find('a').attr('href');
        
        if (epLink) {
          episodes.push({
            num: epNum,
            title: epTitle,
            url: epLink, // ссылка на страницу эпизода (относительная)
          });
        }
      });
      if (episodes.length) seasons.push({ num: seasonNum, episodes });
    });
  } else {
    // Если нет группировки по сезонам – все серии подряд
    $('.episode-item, .series-item, .episode').each((j, epElem) => {
      let epNum = $(epElem).find('.episode-num').text().match(/\d+/)?.[0] || (j+1).toString();
      let epTitle = $(epElem).find('.episode-title').text().trim() || `Эпизод ${epNum}`;
      let epLink = $(epElem).find('a').attr('href');
      if (epLink) {
        if (!seasons[0]) seasons[0] = { num: '1', episodes: [] };
        seasons[0].episodes.push({ num: epNum, title: epTitle, url: epLink });
      }
    });
  }
  
  return {
    type: 'series',
    title,
    description,
    poster: normalizeUrl(poster),
    seasons,
  };
}

/**
 * Из страницы плеера извлекает прямую ссылку на видеофайл (.m3u8 / .mp4)
 * @param {string} html
 * @returns {string|null}
 */
function extractVideoUrlFromPlayer(html) {
  const $ = cheerio.load(html);
  // 1) video / source
  let videoUrl = $('video source').attr('src') || $('video').attr('src');
  if (videoUrl) return normalizeUrl(videoUrl);
  
  // 2) iframe внутри плеера
  const iframeSrc = $('iframe').attr('src');
  if (iframeSrc && (iframeSrc.includes('.m3u8') || iframeSrc.includes('.mp4') || iframeSrc.includes('/play/'))) {
    return normalizeUrl(iframeSrc);
  }
  
  // 3) JavaScript переменные file: "http..."
  const scripts = $('script').map((i, el) => $(el).html()).get();
  for (let script of scripts) {
    if (!script) continue;
    let match = script.match(/file\s*:\s*["']([^"']+\.(?:m3u8|mp4))["']/i);
    if (match) return normalizeUrl(match[1]);
    match = script.match(/src\s*:\s*["']([^"']+\.(?:m3u8|mp4))["']/i);
    if (match) return normalizeUrl(match[1]);
    match = script.match(/source\s*:\s*["']([^"']+\.(?:m3u8|mp4))["']/i);
    if (match) return normalizeUrl(match[1]);
  }
  
  // 4) Прямая ссылка в тексте страницы (редко)
  const bodyText = $('body').text();
  const urlMatch = bodyText.match(/https?:\/\/[^\s"']+\.(?:m3u8|mp4)/i);
  if (urlMatch) return urlMatch[0];
  
  return null;
}

module.exports = {
  normalizeUrl,
  parseSearchResults,
  parseContentPage,
  extractVideoUrlFromPlayer,
};