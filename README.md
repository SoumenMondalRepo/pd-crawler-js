# pd-crawler-js
Crawl Pagerduty incident pages and opens all open/acknowledged incidents of owner FDEs in new tabs along with respective datadog dashboards

- Run `npm install` after checkout to install all dependencies
- Create a new `.env` file in project root directory
- Copy all content from `.env.example` file into newly created `.env` file and update your own google account and pagerduty credentials
- Run `npm start` to run the pd-crawler

❗ If you have 2FA enabled in your google account authentication, you need to either put TOTP code/authorize a google prompt in your other linked device to complete the google authentication process at the first step after script runs