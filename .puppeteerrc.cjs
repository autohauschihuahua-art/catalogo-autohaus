const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Changes the cache location for Puppeteer on Render and local environments
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
