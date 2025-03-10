const { Dataset } = require('crawlee');
const moment = require('moment');

// Define the router for handling different URLs
exports.router = async (request, page, enqueueLinks, log, options) => {
  const { url } = request;
  const { startDate, endDate, maxItems } = options;
  
  // Check if we're on the main lottery page
  if (url.includes('/loterias/bancas')) {
    log.info('Processing main lottery page');
    
    try {
      // Wait for navigation to complete
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }).catch(() => {});
      
      // Wait for any content to load - more generic selector
      await page.waitForSelector('table, .lottery-results, .results-table', { timeout: 60000 })
        .catch(error => {
          log.warning(`Could not find expected table selector: ${error.message}`);
        });
      
      log.info('Page loaded, attempting to extract lottery results');
      
      // Take a screenshot for debugging
      await page.screenshot({ path: 'debug-screenshot.png' });
      
      // Get page HTML for analysis
      const pageContent = await page.content();
      log.info(`Page content length: ${pageContent.length} characters`);
      
      // Extract data for both afternoon and evening draws
      const results = await extractLotteryResults(page, startDate, endDate, maxItems, log);
      
      // Save the results to the dataset
      if (results.length > 0) {
        await Dataset.pushData(results);
        log.info(`Successfully saved ${results.length} results to dataset`);
      } else {
        log.warning('No lottery results were extracted');
      }
    } catch (error) {
      log.error(`Error processing lottery page: ${error.message}`);
    }
  }
};

/**
 * Extract lottery results from the page
 * @param {Page} page - Puppeteer page object
 * @param {string} startDate - Start date in YYYY-MM-DD format
 * @param {string} endDate - End date in YYYY-MM-DD format
 * @param {number} maxItems - Maximum number of items to extract
 * @param {Object} log - Logger object
 * @returns {Array} Array of lottery results
 */
async function extractLotteryResults(page, startDate, endDate, maxItems, log) {
  log.info('Extracting lottery results');
  
  // Convert dates to moment objects for comparison
  const startMoment = moment(startDate);
  const endMoment = moment(endDate);
  
  // Array to store results
  const results = [];
  
  try {
    // Try different selectors to find the results table
    const selectors = [
      '.table-responsive table tbody tr',
      'table tbody tr',
      '.lottery-results tr',
      '.results-container tr'
    ];
    
    let rows = [];
    
    // Try each selector until we find rows
    for (const selector of selectors) {
      log.info(`Trying selector: ${selector}`);
      rows = await page.$$(selector).catch(() => []);
      
      if (rows.length > 0) {
        log.info(`Found ${rows.length} rows with selector: ${selector}`);
        break;
      }
    }
    
    if (rows.length === 0) {
      log.warning('Could not find any rows with the attempted selectors');
      return [];
    }
    
    // Process each row
    for (const row of rows) {
      // Stop if we've reached the maximum number of items
      if (results.length >= maxItems) {
        break;
      }
      
      try {
        // Extract date from the row - try different child selectors
        let dateText = '';
        try {
          dateText = await row.$eval('td:nth-child(1)', el => el.textContent.trim());
        } catch (e) {
          try {
            dateText = await row.$eval('td:first-child', el => el.textContent.trim());
          } catch (e2) {
            log.warning(`Could not extract date from row: ${e2.message}`);
            continue;
          }
        }
        
        // Parse the date - try different formats
        let dateObj;
        const dateFormats = ['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY', 'DD-MM-YYYY'];
        
        for (const format of dateFormats) {
          dateObj = moment(dateText, format);
          if (dateObj.isValid()) break;
        }
        
        if (!dateObj || !dateObj.isValid()) {
          log.warning(`Invalid date format: ${dateText}`);
          continue;
        }
        
        // Skip if the date is outside our range
        if (dateObj.isBefore(startMoment) || dateObj.isAfter(endMoment)) {
          continue;
        }
        
        // Extract afternoon draw (Tarde)
        let afternoonNumbers = [];
        try {
          afternoonNumbers = await row.$eval('td:nth-child(2)', el => {
            const text = el.textContent.trim();
            return text.split(/[-,\s]+/).filter(num => num.trim() !== '');
          });
        } catch (e) {
          log.warning(`Could not extract afternoon numbers: ${e.message}`);
        }
        
        // Extract evening draw (Noche)
        let eveningNumbers = [];
        try {
          eveningNumbers = await row.$eval('td:nth-child(3)', el => {
            const text = el.textContent.trim();
            return text.split(/[-,\s]+/).filter(num => num.trim() !== '');
          });
        } catch (e) {
          log.warning(`Could not extract evening numbers: ${e.message}`);
        }
        
        // Only add results if we have numbers
        if (afternoonNumbers.length > 0) {
          results.push({
            date: dateObj.format('YYYY-MM-DD'),
            drawTime: 'Tarde',
            numbers: afternoonNumbers,
            url: request.url
          });
        }
        
        if (eveningNumbers.length > 0) {
          results.push({
            date: dateObj.format('YYYY-MM-DD'),
            drawTime: 'Noche',
            numbers: eveningNumbers,
            url: request.url
          });
        }
      } catch (rowError) {
        log.warning(`Error processing row: ${rowError.message}`);
        continue;
      }
    }
    
    log.info(`Extracted ${results.length} lottery results`);
    return results;
  } catch (error) {
    log.error(`Error extracting lottery results: ${error.message}`);
    return [];
  }
}