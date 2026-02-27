const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  });
  const page = await ctx.newPage();
  
  const apiResponses = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('track') || url.includes('logistics') || url.includes('detail')) {
      try {
        const body = await response.text();
        if (body.length < 5000 && !body.includes('<!DOCTYPE')) {
          apiResponses.push({ url, status: response.status(), body: body.substring(0, 500) });
        }
      } catch (e) {
        // ignore
      }
    }
  });
  
  await page.goto('https://t.17track.net/en#nums=RS1299833326Y', { timeout: 30000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(10000);
  
  console.log('API responses captured:', apiResponses.length);
  for (const r of apiResponses) {
    console.log('URL:', r.url);
    console.log('Body:', r.body);
    console.log('---');
  }
  
  const trackingText = await page.evaluate(() => {
    const els = document.querySelectorAll('.trck-list, .tracking-list, [class*=track], .yqcr-list');
    return Array.from(els).map(e => {
      const t = e.textContent || '';
      return t.trim().substring(0, 200);
    }).join('\n');
  });
  console.log('Tracking text from page:', trackingText);
  
  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
