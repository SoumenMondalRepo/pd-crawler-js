const scrapePagerDutyAlerts = async () => {

  const { launchChrome } = require('./browser');
  const DD_URL = 'https://bluecore.datadoghq.com/dashboard'
  const PD_URL = 'https://bluecore.pagerduty.com/incidents'
  const BC_ADMIN_URL = 'https://bluecore.com/admin/login'

  const dotenv = require('dotenv');
  dotenv.config();

  if (!process.env.GOOGLE_USERNAME || !process.env.GOOGLE_PASSWORD) throw 'Set GOOGLE_USERNAME and GOOGLE_PASSWORD';
  if (!process.env.PD_USERNAME || !process.env.PD_PASSWORD) throw 'Set GOOGLE_USERNAME and GOOGLE_PASSWORD';
  if (!process.env.BC_ADMIN_USERNAME || !process.env.BC_ADMIN_PASSWORD) throw 'Set BC_ADMIN_USERNAME and BC_ADMIN_PASSWORD';

  // Flow 1 => Launching chrome and opening a new tab/page
  const [chrome, newPage, exitChrome] = await launchChrome();
  const [page] = await newPage();

  // exit the function if the tab is not properly opened
  if (!page) return;

  // Flow 2 => Bluecore admin authentication
  console.log(`opening ${BC_ADMIN_URL}`);
  try {
    await page.goto(BC_ADMIN_URL);
  } catch(e) {
    console.error(`unable to visit ${BC_ADMIN_URL}`, e);
    await exitChrome();
    return;
  }

  //type username and password
  await page.waitForSelector('input[name="username"]');
  await page.type('input[name="username"]', process.env.BC_ADMIN_USERNAME); //set admin username in env file
  await page.waitForSelector('input[type="password"]', { visible: true });
  await page.type('input[type="password"]', process.env.BC_ADMIN_PASSWORD); //set admin pwd in env file

  await Promise.all([
    page.waitForNavigation(),
    page.click('input[value="Log in"]'),
  ]);

  // Flow 3 => Datadog authentication using google auth login
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


  // Flow 4 => Pagerduty authentication and incident dashboard opening
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

  await new Promise(resolve => setTimeout(resolve, 5000));
  
  // Flow 5 => getting a list of all open/acknowledged indicent urls
  const incidentUrls = await page.evaluate(() => {
    const ret = []
    const items = document.querySelectorAll('.details-cell a.ember-view');

    for (let i = 0; i < items.length; i++) {
      ret.push(window.location.protocol + '//' + window.location.hostname + items[i].getAttribute('href'));
    }
    return ret;
  });

  console.log(`total incident urls fetched ${incidentUrls.length}`);
  
  // Flow 6 => looping over each urls and opening then in new tab along with opening respective datadog dashboard in adjacent new tab
  for (let i = 0; i < incidentUrls.length; i++) {
    const page = await chrome.newPage();
    const url = incidentUrls[i];
    console.log(`opening incident ${url}`);

    await Promise.all([
      await page.goto(url, {waitUntil: 'domcontentloaded'}),
      page.waitForSelector('.incident-details-container'),
    ])

    //fetch and open dashboard url
    const dashboardUrl = await page.evaluate(() => {
      let href
      let alert_type = $('.nagios-key:contains("alert_type")').siblings().find('.incident-details-container').text().trim();

      if (alert_type === 'CHRONOMETER_JOB_FAILURE') {
        href = $('.nagios-key:contains("chrono_page_link")').siblings().find('.incident-details-container a').attr('href');
      } else if (alert_type === 'INTEGRATION_EVENT_24_HOUR' || 
          alert_type === 'INTEGRATION_EVENT_7_DAY' || 
          alert_type === 'ALL_INTEGRATION_EVENTS_4_HOUR' || 
          alert_type === 'IDENTIFY_EVENT_7_DAY' ||
          alert_type === 'CHRONOMETER_EVENT_7_DAY') {
        href = $('.nagios-key:contains("dashboard_link")').siblings().find('.incident-details-container a').attr('href');
      }

      return href;
    });

    if(dashboardUrl) {
      const page = await chrome.newPage();
      console.log(`opening dashboard ${dashboardUrl}`);

      try {
        await page.goto(dashboardUrl, {waitUntil: 'domcontentloaded'});
      } catch (e) {
        console.error(`unable to visit ${dashboardUrl}`, e);
      }
    }
  }

  //await exitChrome(); // close chrome
  return;
};

const identifyAlertType = () => {
  return {
    CHRONOMETER_JOB_FAILURE: 'chrono failure',
    INTEGRATION_EVENT_24_HOUR: '',
    INTEGRATION_EVENT_7_DAY: '',
    ALL_INTEGRATION_EVENTS_4_HOUR: '',
    IDENTIFY_EVENT_7_DAY: '',
    JUSTUNO_EVENT_24_HOUR: '',
    UNSUBSCRIBE_BY_SOURCE_7_DAYS: '',
    RECURRING_EMAIL_VOLUME_7_DAY: '',
    CHRONOMETER_EVENT_7_DAY: '',
    TRANSACTIONAL_EMAIL_VOLUME_4_HOUR: '',
  }
};

module.exports = scrapePagerDutyAlerts;