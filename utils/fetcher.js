const axios = require('axios');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = process.env.BASE_URL || 'https://www.hdkinoteatr.com';
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT) || 15000;

// Имитация реального браузера
const defaultHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
  'Referer': BASE_URL,
  'DNT': '1',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1',
};

/**
 * Загружает HTML страницы
 * @param {string} url - полный URL или относительный путь
 * @returns {Promise<string|null>} HTML или null при ошибке
 */
async function fetchHtml(url) {
  const fullUrl = url.startsWith('http') ? url : `${BASE_URL}${url.startsWith('/') ? url : '/' + url}`;
  try {
    const response = await axios.get(fullUrl, {
      headers: defaultHeaders,
      timeout: TIMEOUT,
      maxRedirects: 5,
    });
    return response.data;
  } catch (error) {
    console.error(`[fetcher] Ошибка загрузки ${fullUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Загружает бинарные данные (видео) для прокси
 * @param {string} url - прямая ссылка на видео
 * @returns {Promise<{data: Buffer, headers: object} | null>}
 */
async function fetchBinary(url, rangeHeader = null) {
  try {
    const headers = { ...defaultHeaders };
    if (rangeHeader) {
      headers['Range'] = rangeHeader;
    }
    const response = await axios.get(url, {
      headers,
      responseType: 'arraybuffer',
      timeout: TIMEOUT * 2,
    });
    return {
      data: response.data,
      headers: {
        'content-type': response.headers['content-type'],
        'content-length': response.headers['content-length'],
        'content-range': response.headers['content-range'],
      },
    };
  } catch (error) {
    console.error(`[fetcher] Ошибка загрузки видео ${url}: ${error.message}`);
    return null;
  }
}

module.exports = { fetchHtml, fetchBinary, BASE_URL };