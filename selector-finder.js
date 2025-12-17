/**
 * Selector Finder Tool
 * 
 * This tool helps you find CSS selectors for product name, price, and image
 * on any e-commerce website. Run this in the browser console on a product page.
 * 
 * Usage:
 * 1. Open a product page
 * 2. Open browser console (F12)
 * 3. Copy and paste this entire file, or call findProductSelectors()
 * 4. Review the suggested selectors
 */

/**
 * Generate a unique CSS selector for an element
 */
function generateSelector(element) {
  if (element.id) {
    return `#${element.id}`;
  }
  
  if (element.className) {
    const classes = element.className.split(' ').filter(c => c && !c.match(/^[a-z0-9]{8,}$/i)); // Filter out hashed classes
    if (classes.length > 0) {
      const classSelector = '.' + classes[0].replace(/\s+/g, '.');
      const tagName = element.tagName.toLowerCase();
      return `${tagName}${classSelector}`;
    }
  }
  
  // Use tag name and nth-child as fallback
  const tagName = element.tagName.toLowerCase();
  const parent = element.parentElement;
  if (parent) {
    const siblings = Array.from(parent.children).filter(el => el.tagName === element.tagName);
    const index = siblings.indexOf(element);
    if (index >= 0 && siblings.length > 1) {
      return `${tagName}:nth-child(${index + 1})`;
    }
  }
  
  return tagName;
}

/**
 * Find the best selectors for product information
 * @returns {Object} Object with suggested selectors for name, price, and image
 */
function findProductSelectors() {
  console.log('🔍 Searching for product selectors...\n');
  
  const results = {
    name: [],
    price: [],
    image: []
  };
  
  // Find product name candidates (h1, h2, or elements with product-related classes/ids)
  const nameSelectors = [
    'h1',
    'h2.product-title',
    '[data-product-name]',
    '[itemprop="name"]',
    '.product-title',
    '.product-name',
    '#product-title',
    '#product-name'
  ];
  
  nameSelectors.forEach(selector => {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach(el => {
        const text = el.innerText?.trim() || '';
        if (text.length > 10 && text.length < 200 && el.offsetParent !== null) {
          const uniqueSelector = generateSelector(el);
          if (!results.name.find(r => r.selector === uniqueSelector)) {
            results.name.push({
              selector: uniqueSelector,
              text: text.substring(0, 80),
              confidence: calculateNameConfidence(el, text)
            });
          }
        }
      });
    } catch (e) {
      // Ignore invalid selectors
    }
  });
  
  // Find price candidates
  const pricePattern = /([$€£¥])\s?(\d+(?:[\.,]\d+)?)/;
  const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
    if (el.offsetParent === null) return false;
    const text = el.innerText?.trim() || '';
    if (!text || text.length > 50) return false;
    return pricePattern.test(text);
  });
  
  priceElements.forEach(el => {
    const text = el.innerText?.trim() || '';
    const match = text.match(pricePattern);
    if (match) {
      const priceValue = parseFloat(match[0].replace(/[$€£¥\s,]/g, '').replace(',', '.'));
      if (priceValue >= 0.50 && priceValue <= 100000) {
        const uniqueSelector = generateSelector(el);
        if (!results.price.find(r => r.selector === uniqueSelector)) {
          results.price.push({
            selector: uniqueSelector,
            text: text,
            price: match[0],
            confidence: calculatePriceConfidence(el, priceValue)
          });
        }
      }
    }
  });
  
  // Find image candidates
  const images = Array.from(document.querySelectorAll('img')).filter(img => {
    if (img.offsetParent === null) return false;
    
    // Check for fetchpriority="high" or loading="eager" (strong indicators of main product image)
    const isHighPriority = img.getAttribute('fetchpriority') === 'high' || 
                          (img.getAttribute('loading') === 'eager' && img.alt && img.alt.length > 10);
    
    const rect = img.getBoundingClientRect();
    const isLargeEnough = rect.width >= 200 && rect.height >= 200;
    const hasValidSrc = img.src && !img.src.includes('data:');
    
    // Include if high priority OR large enough
    return (isHighPriority || isLargeEnough) && hasValidSrc;
  });
  
  images.forEach(img => {
    const uniqueSelector = generateSelector(img);
    if (!results.image.find(r => r.selector === uniqueSelector)) {
      results.image.push({
        selector: uniqueSelector,
        src: img.src.substring(0, 100),
        width: img.width,
        height: img.height,
        confidence: calculateImageConfidence(img)
      });
    }
  });
  
  // Sort by confidence
  results.name.sort((a, b) => b.confidence - a.confidence);
  results.price.sort((a, b) => b.confidence - a.confidence);
  results.image.sort((a, b) => b.confidence - a.confidence);
  
  // Display results
  console.log('📦 PRODUCT NAME SELECTORS (best first):');
  console.log('─'.repeat(60));
  results.name.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Text: "${item.text}..."`);
    console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
  });
  
  console.log('\n💰 PRICE SELECTORS (best first):');
  console.log('─'.repeat(60));
  results.price.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Price: ${item.price}`);
    console.log(`   Full text: "${item.text}"`);
    console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
  });
  
  console.log('\n🖼️  IMAGE SELECTORS (best first):');
  console.log('─'.repeat(60));
  results.image.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Size: ${item.width}x${item.height}px`);
    console.log(`   URL: ${item.src}...`);
    console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
  });
  
  console.log('\n✅ COPY THIS TO YOUR site-selectors.js:');
  console.log('─'.repeat(60));
  const domain = window.location.hostname.replace('www.', '');
  const bestName = results.name[0]?.selector || '';
  const bestPrice = results.price[0]?.selector || '';
  const bestImage = results.image[0]?.selector || '';
  
  console.log(`'${domain}': {`);
  console.log(`  name: '${bestName}',`);
  console.log(`  price: '${bestPrice}',`);
  console.log(`  image: '${bestImage}'`);
  console.log(`},`);
  
  return results;
}

/**
 * Calculate confidence score for name selector
 */
function calculateNameConfidence(element, text) {
  let score = 5; // Base score
  
  // Boost for h1
  if (element.tagName === 'H1') score += 3;
  if (element.tagName === 'H2') score += 2;
  
  // Boost for semantic attributes
  if (element.id && (element.id.includes('title') || element.id.includes('name'))) score += 2;
  if (element.className && (element.className.includes('title') || element.className.includes('name'))) score += 1.5;
  if (element.hasAttribute('data-product-name') || element.hasAttribute('itemprop')) score += 2;
  
  // Boost for reasonable length
  if (text.length >= 20 && text.length <= 100) score += 1;
  
  // Boost if near top of page
  const rect = element.getBoundingClientRect();
  if (rect.top < 500) score += 1;
  
  return Math.min(score, 10);
}

/**
 * Calculate confidence score for price selector
 */
function calculatePriceConfidence(element, priceValue) {
  let score = 5; // Base score
  
  // Boost for reasonable price range
  if (priceValue >= 5 && priceValue <= 5000) score += 2;
  
  // Boost for semantic attributes
  if (element.id && element.id.includes('price')) score += 2;
  if (element.className && element.className.includes('price')) score += 1.5;
  if (element.hasAttribute('itemprop') && element.getAttribute('itemprop') === 'price') score += 3;
  
  // Boost for larger font (more prominent)
  const fontSize = parseFloat(window.getComputedStyle(element).fontSize);
  if (fontSize > 20) score += 1;
  
  // Boost if near top of page
  const rect = element.getBoundingClientRect();
  if (rect.top < 800) score += 1;
  
  // Penalize if contains exclude words
  const text = element.innerText?.toLowerCase() || '';
  if (text.includes('shipping') || text.includes('was') || text.includes('save')) score -= 2;
  
  return Math.min(Math.max(score, 0), 10);
}

/**
 * Calculate confidence score for image selector
 */
function calculateImageConfidence(img) {
  let score = 5; // Base score
  
  // Strong boost for fetchpriority="high" (main product image indicator)
  if (img.getAttribute('fetchpriority') === 'high') score += 4;
  
  // Boost for loading="eager" with descriptive alt text
  if (img.getAttribute('loading') === 'eager' && img.alt && img.alt.length > 10) score += 2;
  
  // Boost for larger images
  if (img.width >= 400 && img.height >= 400) score += 2;
  
  // Boost for semantic attributes
  if (img.id && (img.id.includes('image') || img.id.includes('product'))) score += 2;
  if (img.className && (img.className.includes('image') || img.className.includes('product'))) score += 1.5;
  if (img.hasAttribute('itemprop') && img.getAttribute('itemprop') === 'image') score += 2;
  
  // Boost for descriptive alt text (indicates main product image)
  if (img.alt && img.alt.length > 20 && !img.alt.toLowerCase().includes('icon')) score += 1.5;
  
  // Boost if near top of page
  const rect = img.getBoundingClientRect();
  if (rect.top < 600) score += 1;
  
  // Penalize if likely not product image
  const src = img.src.toLowerCase();
  if (src.includes('logo') || src.includes('icon') || src.includes('avatar')) score -= 3;
  
  return Math.min(Math.max(score, 0), 10);
}

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  // Export for manual calling
  window.findProductSelectors = findProductSelectors;
  
  console.log('✅ Selector Finder Tool loaded!');
  console.log('📝 Run: findProductSelectors()');
  console.log('   Or just call it directly in the console.\n');
}

