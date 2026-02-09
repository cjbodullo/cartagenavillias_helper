const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const listingUrl = 'https://www.airbnb.com/rooms/1346514370833083800?source_impression_id=p3_1770606659_P3F2Ft4Kr-DRmdso&modal=PHOTO_TOUR_SCROLLABLE';
  const baseName = '4 BR in Private Resort Baru - Cartagena Villas Colombia';

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'
  });

  await page.goto(listingUrl, { waitUntil: 'load', timeout: 120000 });
  await page.waitForTimeout(5000);

  // Scroll slowly to force lazy-loading of all gallery images
  for (let i = 0; i < 100; i++) {
    await page.mouse.wheel(0, 1000);
    await page.waitForTimeout(300);
  }

  // Extract all images loaded in the DOM after scrolling
  const images = await page.evaluate(() =>
    Array.from(document.querySelectorAll('img'))
      .filter(img => img.naturalWidth >= 500 && img.src.includes('a0.muscache.com'))
      .map(img => img.src.split('?')[0] + '?aki_policy=xx_large')
  );

  const uniqueImages = [...new Set(images)];

  console.log(`Found ${uniqueImages.length} full-size images`);

  if (!fs.existsSync('4BRinPrivateResortBaru')) fs.mkdirSync('4BRinPrivateResortBaru');

  let index = 1;
  for (const imgUrl of uniqueImages) {
    try {
      const ext = path.extname(imgUrl.split('?')[0]) || '.jpeg';
      const filename = `${String(index).padStart(3, '0')} - ${baseName}${ext}`;
      const response = await page.request.get(imgUrl);
      const buffer = await response.body();
      fs.writeFileSync(`4BRinPrivateResortBaru/${filename}`, buffer);
      console.log(`✔ Saved: ${filename}`);
      index++;
    } catch (e) {
      console.warn(`⚠ Failed: ${imgUrl}`);
    }
  }

  console.log(`\n✅ Finished downloading ${index - 1} full-size images`);
  await browser.close();
})();
