# Lotería Nacional Dominican Scraper

This is an [Apify](https://apify.com) actor that scrapes lottery results from the Dominican Republic's Lotería Nacional website. It extracts data for both afternoon and evening draws from the 'bancas' section.

## Features

- Scrapes lottery results from [loterianacional.gob.do](https://loterianacional.gob.do)
- Extracts data for both afternoon and evening draws
- Configurable date range for historical results
- Customizable maximum number of results
- Proxy support for reliable scraping

## Input Configuration

The actor accepts the following input parameters:

- `startDate` - Start date for scraping lottery results (format: YYYY-MM-DD)
- `endDate` - End date for scraping lottery results (format: YYYY-MM-DD)
- `maxItems` - Maximum number of lottery results to scrape (default: 100)
- `proxyConfiguration` - Proxy settings for the scraper

## Output

The actor outputs lottery results in the following format:

```json
{
  "date": "2023-01-01",
  "drawTime": "Tarde", // or "Noche"
  "numbers": ["01", "02", "03"],
  "url": "https://loterianacional.gob.do/..."
}
```

## Usage

1. Install dependencies: `npm install`
2. Run locally: `npm start`
3. Deploy to Apify: Follow the instructions in the Apify documentation

## License

ISC