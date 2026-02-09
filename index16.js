const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const listingUrl = 'https://www.islacocosolo.com';
  const outputDir = '7BRExclusive5Bungalows1';
  const baseName = '7 BR Exclusive 5 Bungalows - Cartagena Villas Colombia';

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  // Add user agent to avoid blocking
  await page.setExtraHTTPHeaders({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  });

  await page.goto(listingUrl, { waitUntil: 'networkidle', timeout: 30000 });

  // ✅ CORRECT APPROACH: Find images in the actual page structure
  const imageUrls = await page.evaluate(() => {
    const urls = new Set();
    
    // Method 1: Check for images in gallery/slider components
    const galleryElements = document.querySelectorAll('[class*="gallery"], [class*="slider"], [class*="carousel"]');
    galleryElements.forEach(el => {
      const images = el.querySelectorAll('img, [data-src], [data-img], source[srcset]');
      images.forEach(img => {
        const src = img.src || img.currentSrc || img.dataset?.src || img.dataset?.img;
        if (src && src.trim()) {
          urls.add(src.trim());
        }
        
        // Check srcset for responsive images
        if (img.srcset) {
          img.srcset.split(',').forEach(src => {
            const url = src.trim().split(' ')[0];
            if (url) urls.add(url);
          });
        }
      });
    });
    
    // Method 2: Look for background images (common in modern sites)
    const elementsWithBg = document.querySelectorAll('div, section, li, figure');
    elementsWithBg.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const match = bgImage.match(/url\(["']?([^"')]+)["']?\)/);
        if (match && match[1]) {
          urls.add(match[1]);
        }
      }
    });
    
    // Method 3: Look for JSON data in script tags (alternative approach)
    const scriptTags = document.querySelectorAll('script[type="application/json"], script[type="application/ld+json"]');
    for (const script of scriptTags) {
      try {
        const data = JSON.parse(script.textContent);
        // Check for image data in common structures
        if (data.image) {
          if (Array.isArray(data.image)) {
            data.image.forEach(img => urls.add(img.url || img));
          } else if (typeof data.image === 'string') {
            urls.add(data.image);
          } else if (data.image.url) {
            urls.add(data.image.url);
          }
        }
        
        // Check for gallery or product images
        if (data.media && Array.isArray(data.media)) {
          data.media.forEach(item => {
            if (item.url) urls.add(item.url);
          });
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
    
    return Array.from(urls);
  });

  // Build full URLs and clean them
  const absoluteUrls = imageUrls
    .map(url => {
      // Handle protocol-relative URLs
      if (url.startsWith('//')) {
        return 'https:' + url;
      }
      // Handle relative URLs
      if (url.startsWith('/')) {
        return 'https://www.islacocosolo.com' + url;
      }
      return url;
    })
    .filter(url => {
      // Filter to only image URLs
      return url && 
             url.startsWith('http') && 
             /\.(jpg|jpeg|png|gif|webp|bmp|avif)(\?.*)?$/i.test(url);
    })
    .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates

  console.log(`📸 Found ${absoluteUrls.length} images`);

  // Download images
  let index = 1;
  for (const imgUrl of absoluteUrls) {
    try {
      const cleanUrl = imgUrl.split('?')[0];
      const ext = path.extname(cleanUrl) || '.jpg';
      const filename = `${String(index).padStart(3, '0')} - ${baseName}${ext}`;
      const filepath = path.join(outputDir, filename);

      const response = await page.request.get(imgUrl, { timeout: 10000 });
      if (!response.ok()) throw new Error(`HTTP ${response.status()}`);

      const buffer = await response.body();
      fs.writeFileSync(filepath, buffer);

      console.log(`✔ Saved: ${filename}`);
      index++;
    } catch (err) {
      console.warn(`⚠ Failed to download: ${imgUrl} (${err.message})`);
    }
  }

  console.log(`\n✅ Finished downloading ${index - 1} images`);
  
  // Save debug information
  const debugInfo = {
    totalFound: absoluteUrls.length,
    downloaded: index - 1,
    urls: absoluteUrls
  };
  fs.writeFileSync(path.join(outputDir, 'debug.json'), JSON.stringify(debugInfo, null, 2));
  
  await browser.close();
})();