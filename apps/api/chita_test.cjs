const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await ctx.newPage();

  // Capture API calls
  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('api') || url.includes('graphql') || url.includes('package') || url.includes('track')) {
      try {
        const ct = response.headers()['content-type'] || '';
        if (ct.includes('json')) {
          const body = await response.text();
          apiCalls.push({ url, status: response.status(), body: body.substring(0, 2000) });
        }
      } catch (e) { /* ignore */ }
    }
  });

  // Go to ChitaDelivery my-packages page (needs login, but let's see what API it calls)
  await page.goto('https://chitadelivery-cx.com/', { timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  console.log('Title:', await page.title());

  // Look for a tracking search input
  const content = await page.content();
  const hasSearch = content.includes('search') || content.includes('track') || content.includes('מעקב');
  console.log('Has search/track:', hasSearch);

  // Look for API endpoints in the page source
  const scriptUrls = await page.evaluate(() => {
    const scripts = document.querySelectorAll('script[src]');
    return Array.from(scripts).map(s => s.src);
  });
  console.log('Script URLs:', scriptUrls);

  console.log('\nAPI calls captured:', apiCalls.length);
  for (const c of apiCalls) {
    console.log('  URL:', c.url);
    console.log('  Body:', c.body.substring(0, 300));
    console.log('  ---');
  }

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
