const scrapePagerDutyAlerts = async () => {

  const { launchChrome } = require('./browser');
  const DD_URL = 'https://bluecore.datadoghq.com/dashboard'
  const PD_URL = 'https://bluecore.pagerduty.com/incidents'

  const dotenv = require('dotenv');
  dotenv.config();

  if (!process.env.GOOGLE_USERNAME || !process.env.GOOGLE_PASSWORD) throw 'Set GOOGLE_USERNAME and GOOGLE_PASSWORD';
  if (!process.env.PD_USERNAME || !process.env.PD_PASSWORD) throw 'Set GOOGLE_USERNAME and GOOGLE_PASSWORD';

  // Flow 1 => Launching chrome and opening a new tab/page
  const [chrome, newPage, exitChrome] = await launchChrome();
  const [page] = await newPage();

  // exit the function if the tab is not properly opened
  if (!page) return;

  // Flow 2 => Datadog authentication using google auth login
  console.log(`opening ${DD_URL}`);
  try {
    await page.goto(DD_URL);
  } catch(e) {
    console.error(`unable to visit ${DD_URL}`, e);
    await exitChrome();
    return;
  }

  await page.waitForSelector('button.authentication_login_google-login-button');
  await Promise.all([
    page.waitForNavigation(),
    page.click('button.authentication_login_google-login-button'),
  ]);

  //type username and password
  await page.waitForSelector('input[type="email"]')
  await page.type('input[type="email"]', process.env.GOOGLE_USERNAME); //set google username in env file
  await Promise.all([
      page.waitForNavigation(),
      await page.keyboard.press('Enter')
  ]);
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', process.env.GOOGLE_PASSWORD); //set google pwd in env file

  //finally submits login form and wait for page reload into datadog dashboard
  await Promise.all([
    page.waitForFunction(() => location.href === 'https://bluecore.datadoghq.com/dashboard'),
    await page.keyboard.press('Enter')
  ]);


  // Flow 3 => Pagerduty authentication and incident dashboard opening
  console.log(`opening ${PD_URL}`);
  try {
    await page.goto(PD_URL);
  } catch(e) {
    console.error(`unable to visit ${PD_URL}`, e);
    await exitChrome();
    return;
  }

  //type username and password
  await page.waitForSelector('input[type="email"]');
  await page.type('input[type="email"]', process.env.PD_USERNAME); //set pagerduty username in env file
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', process.env.PD_PASSWORD); //set pagerduty pwd in env file

  await Promise.all([
    page.waitForNavigation(),
    page.click('input[value="Sign In"]'),
  ]);

  //click assigned to me button to only list own incidents
  await Promise.all([
    page.waitForSelector('a.assign-me'),
    page.click('a.assign-me'),
  ]);

  await new Promise(resolve => setTimeout(resolve, 2000));
  
  // Flow 4 => getting a list of all open/acknowledged indicent urls
  const incidentUrls = await page.evaluate(() => {
    const ret = []
    const items = document.querySelectorAll('.details-cell a.ember-view');

    for (let i = 0; i < items.length; i++) {
      ret.push(window.location.protocol + '//' + window.location.hostname + items[i].getAttribute('href'));
    }
    return ret;
  });

  console.log(`total incident urls fetched ${incidentUrls.length}`);
  
  // Flow 5 => looping over each urls and opening then in new tab along with opening respective datadog dashboard in adjacent new tab
  for (let i = 0; i < incidentUrls.length; i++) {
    const page = await chrome.newPage();
    const url = incidentUrls[i];
    console.log(`opening incident ${url}`);

    try {
      await page.goto(url, {waitUntil: 'networkidle2'});
    } catch (e) {
      console.error(`unable to visit ${url}`, e);
    }

    //fetch and open dashboard url
    const dashboardUrl = await page.evaluate(() => {
      let href = $('.nagios-key:contains("dashboard_link")').siblings().find('.incident-details-container a').attr('href');

      return href;
    });

    if(dashboardUrl) {
      const page = await chrome.newPage();
      console.log(`opening dashboard ${dashboardUrl}`);

      try {
        await page.goto(dashboardUrl, {waitUntil: 'networkidle2'});
      } catch (e) {
        console.error(`unable to visit ${dashboardUrl}`, e);
      }
    }
  }

  //await exitChrome(); // close chrome
  return;
};

module.exports = scrapePagerDutyAlerts;