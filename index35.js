const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const listingUrl = 'https://www.airbnb.com/rooms/798494434203919952?source_impression_id=p3_1770684972_P31nam_3jl-MbCVf&modal=PHOTO_TOUR_SCROLLABLE';
  const baseName = '4 BDRM Exceptional Beach House Baru - Private Island Rental - Cartagena Villas Colombia';
  const outputDir = '4BDRMExceptionalBeachHouseBaru';
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

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  let index = 1;
  for (const imgUrl of uniqueImages) {
    try {
      const ext = path.extname(imgUrl.split('?')[0]) || '.jpeg';
      const filename = `${String(index).padStart(3, '0')} - ${baseName}${ext}`;
      const response = await page.request.get(imgUrl);
      const buffer = await response.body();
      fs.writeFileSync(`${outputDir}/${filename}`, buffer);
      console.log(`✔ Saved: ${filename}`);
      index++;
    } catch (e) {
      console.warn(`⚠ Failed: ${imgUrl}`);
    }
  }

  console.log(`\n✅ Finished downloading ${index - 1} full-size images`);
  await browser.close();
})();
