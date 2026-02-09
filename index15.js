const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const listingUrl = 'https://cartagenaservices.com/products/isla-coco-solo';
  const outputDir = '7BRExclusive5Bungalows';
  const baseName = '7 BR Exclusive 5 Bungalows - Cartagena Villas Colombia';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(listingUrl, { waitUntil: 'domcontentloaded' });

  // 🍿 Extract Shopify product JSON image list
  const imageUrls = await page.evaluate(() => {
    const jsonData = window.__INITIAL_STATE__ || null;
    if (jsonData && jsonData.product && Array.isArray(jsonData.product.images)) {
      return jsonData.product.images;
    }

    const matches = document.body.innerHTML.match(/"images"\s*:\s*(\[[^\]]+\])/);
    if (matches && matches[1]) {
      try {
        return JSON.parse(matches[1]);
      } catch {}
    }
    return [];
  });

  // Build full URLs
  const absoluteUrls = imageUrls
    .map(url => url.replace(/^\/\//, 'https://'))
    .filter(Boolean);

  console.log(`📸 Found ${absoluteUrls.length} images`);

  let index = 13;
  for (const imgUrl of absoluteUrls) {
    try {
      const cleanUrl = imgUrl.split('?')[0];
      const ext = path.extname(cleanUrl) || '.jpg';
      const filename = `${String(index).padStart(3, '0')} - ${baseName}${ext}`;
      const filepath = path.join(outputDir, filename);

      const response = await page.request.get(imgUrl);
      if (!response.ok()) throw new Error('Request failed');

      const buffer = await response.body();
      fs.writeFileSync(filepath, buffer);

      console.log(`✔ Saved: ${filename}`);
      index++;
    } catch (err) {
      console.warn(`⚠ Failed to download: ${imgUrl}`);
    }
  }

  console.log(`\n✅ Finished downloading ${index - 1} images`);
  await browser.close();
})();
