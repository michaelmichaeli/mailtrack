const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  
  // Capture the restapi requests to see format
  const apiCalls = [];
  page.on('request', (request) => {
    if (request.url().includes('track/restapi')) {
      apiCalls.push({
        url: request.url(),
        method: request.method(),
        headers: request.headers(),
        postData: request.postData(),
      });
    }
  });
  
  page.on('response', async (response) => {
    if (response.url().includes('track/restapi')) {
      try {
        const body = await response.json();
        console.log('RESPONSE:', JSON.stringify(body, null, 2));
      } catch (e) {
        // ignore
      }
    }
  });
  
  // Try a known Israel Post tracking number
  await page.goto('https://t.17track.net/en#nums=RS1300705226Y', { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(12000);
  
  console.log('\n=== API CALLS ===');
  for (const call of apiCalls) {
    console.log('URL:', call.url);
    console.log('Method:', call.method);
    console.log('PostData:', call.postData);
    console.log('Headers:', JSON.stringify({
      'content-type': call.headers['content-type'],
      'origin': call.headers['origin'],
      'referer': call.headers['referer'],
    }));
    console.log('---');
  }
  
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
