const { Actor } = require('apify');
const { PuppeteerCrawler, Dataset } = require('crawlee');
const { router } = require('./routes');
const moment = require('moment');

// Initialize the Apify actor
Actor.main(async () => {
  console.log('Starting Lotería Nacional Dominican Scraper');
  
  // Get input parameters
  const input = await Actor.getInput() || {};
  const {
    startDate = moment().subtract(30, 'days').format('YYYY-MM-DD'),
    endDate = moment().format('YYYY-MM-DD'),
    maxItems = 100,
    proxyConfiguration = { useApifyProxy: true },
  } = input;
  
  console.log(`Scraping lottery results from ${startDate} to ${endDate}, max items: ${maxItems}`);
  
  // Initialize the crawler with more robust configuration
  const crawler = new PuppeteerCrawler({
    // Use Apify Proxy if configured
    proxyConfiguration: await Actor.createProxyConfiguration(proxyConfiguration),
    
    // Maximum number of concurrent requests
    maxConcurrency: 1, // Reduced to avoid overloading the site
    
    // Increase timeouts for better reliability
    navigationTimeoutSecs: 120,
    requestHandlerTimeoutSecs: 120,
    
    // Configure browser launch options
    launchContext: {
      launchOptions: {
        headless: true,
        args: [
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-sandbox',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=IsolateOrigins,site-per-process',
        ],
      },
    },
    
    // Function called for each URL
    async requestHandler({ request, page, enqueueLinks, log }) {
      log.info(`Processing ${request.url}`);
      
      // Set a longer navigation timeout
      page.setDefaultNavigationTimeout(120000);
      page.setDefaultTimeout(120000);
      
      // Add a route based on the URL
      await router(request, page, enqueueLinks, log, {
        startDate,
        endDate,
        maxItems,
      });
    },
    
    // This function is called if the page processing failed
    async failedRequestHandler({ request, error, log }) {
      log.error(`Request ${request.url} failed with error: ${error.message}`);
      
      // Save information about the failure
      await Dataset.pushData({
        url: request.url,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    },
  });
  
  // Start with the main lottery page
  await crawler.run(['https://loterianacional.gob.do/loterias/bancas']);
  
  console.log('Scraping finished successfully!');
});