const launchChrome = async () => {
  const puppeteer = require('puppeteer-extra');
  const StealthPlugin = require('puppeteer-extra-plugin-stealth');

  puppeteer.use(StealthPlugin())

  const args = [
    '--window-size=1920,1080',
    '--disable-web-security',
    '--disable-features=IsolateOrigins',
    '--disable-site-isolation-trials',
  ];
 

  let chrome;
  try {
    chrome = await puppeteer.launch({
      headless: false, // run in not headless mode
      defaultViewport: null,
      //devtools: false, // disable dev tools
      //ignoreHTTPSErrors: true, // ignore https error
      args,
      //ignoreDefaultArgs: ["--disable-extensions"],
      executablePath: `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, //using chrome instead of chromium
    });
  } catch(e) {
    console.error("Unable to launch chrome", e);
    return [() => {}, () => {}];
  }

  const exitChrome = async () => {
    if (!chrome) return;
    try {
      await chrome.close();
    } catch(e) {}
  }

  const newPage = async () => {
    try {
      const [page] = await chrome.pages();
      const closePage = async () => {
        if (!page) return;
        try {
          await page.close();
        } catch(e) {}
      }
      return [page, closePage];
    } catch(e) {
      console.error('Unable to create a new page');
      return [];
    }
  };

  return [chrome, newPage, exitChrome];
};

module.exports = { launchChrome };