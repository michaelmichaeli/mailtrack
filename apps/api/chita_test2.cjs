const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  });
  const page = await ctx.newPage();

  const apiCalls = [];
  page.on('response', async (response) => {
    const url = response.url();
    const ct = response.headers()['content-type'] || '';
    if (ct.includes('json') && !url.includes('google') && !url.includes('analytics')) {
      try {
        const body = await response.text();
        if (body.length < 10000) {
          apiCalls.push({ url, body });
        }
      } catch (e) { /* ignore */ }
    }
  });

  // ChitaDelivery my-packages requires phone auth - let's try their public tracking page
  // Navigate to the my-packages page to see what API calls it makes
  await page.goto('https://chitadelivery-cx.com/my-packages', { timeout: 20000, waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  
  console.log('Title:', await page.title());
  console.log('URL:', page.url());
  
  // Check for login/phone input
  const hasPhoneInput = await page.$('input[type="tel"], input[placeholder*="phone"], input[placeholder*="טלפון"]');
  console.log('Has phone input:', !!hasPhoneInput);
  
  console.log('\nAPI calls:');
  for (const c of apiCalls) {
    console.log('  URL:', c.url);
    console.log('  Body:', c.body.substring(0, 300));
    console.log('---');
  }

  await browser.close();
})().catch(e => { console.error(e.message); process.exit(1); });
