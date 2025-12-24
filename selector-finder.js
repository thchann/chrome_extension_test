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
 * Find active modal/overlay/drawer that might contain product information
 * @param {HTMLElement} rootElement - Root element to search within (default: document)
 * @returns {HTMLElement|null} - Active modal element or null
 */
function findActiveModal(rootElement = document) {
  // Common modal/overlay selectors
  const modalSelectors = [
    '[role="dialog"]',
    '[aria-modal="true"]',
    '.modal',
    '.overlay',
    '.drawer',
    '.popup',
    '.dialog',
    '[class*="modal"]',
    '[class*="overlay"]',
    '[class*="drawer"]',
    '[class*="popup"]'
  ];
  
  // Find all potential modals
  const candidates = [];
  modalSelectors.forEach(selector => {
    try {
      const elements = rootElement.querySelectorAll(selector);
      elements.forEach(el => {
        const styles = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        
        // Check if element is visible and likely a modal
        if (styles.display !== 'none' && 
            styles.visibility !== 'hidden' &&
            el.offsetParent !== null &&
            rect.width > 0 && 
            rect.height > 0) {
          
          // Check z-index (modals usually have high z-index)
          const zIndex = parseInt(styles.zIndex) || 0;
          
          candidates.push({
            element: el,
            zIndex: zIndex,
            area: rect.width * rect.height,
            // Prefer elements that are centered or take up significant space
            isCentered: Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) < window.innerWidth * 0.3
          });
        }
      });
    } catch (e) {
      // Ignore selector errors
    }
  });
  
  if (candidates.length === 0) return null;
  
  // Sort by z-index (highest first), then by area, then by centered
  candidates.sort((a, b) => {
    if (b.zIndex !== a.zIndex) return b.zIndex - a.zIndex;
    if (b.isCentered !== a.isCentered) return b.isCentered - a.isCentered;
    return b.area - a.area;
  });
  
  return candidates[0].element;
}

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
 * Debug function to find discount price elements
 * Specifically looks for data-variant="discount" and data-variant="original"
 */
function findDiscountPrices() {
  console.log('🔍 Searching for discount price elements...\n');
  
  const results = {
    discount: [],
    original: [],
    containers: []
  };
  
  // Find all elements with data-variant="discount"
  const discountElements = document.querySelectorAll('[data-variant="discount"]');
  console.log(`Found ${discountElements.length} element(s) with data-variant="discount"`);
  
  discountElements.forEach((el, i) => {
    const text = el.textContent?.trim() || el.innerText?.trim() || '';
    const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
    const match = text.match(priceRegex);
    
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    
    results.discount.push({
      element: el,
      selector: generateSelector(el),
      text: text,
      price: match ? match[1] : null,
      classes: el.className,
      parent: el.parentElement ? generateSelector(el.parentElement) : null,
      visible: el.offsetParent !== null,
      zIndex: styles.zIndex,
      position: `(${Math.round(rect.left)}, ${Math.round(rect.top)})`
    });
    
    console.log(`\n${i + 1}. DISCOUNT ELEMENT:`);
    console.log(`   Selector: ${generateSelector(el)}`);
    console.log(`   Classes: ${el.className || 'none'}`);
    console.log(`   Text: "${text}"`);
    console.log(`   Price: ${match ? match[1] : 'NOT FOUND'}`);
    console.log(`   Visible: ${el.offsetParent !== null}`);
    console.log(`   Parent: ${el.parentElement ? generateSelector(el.parentElement) : 'none'}`);
  });
  
  // Find all elements with data-variant="original"
  const originalElements = document.querySelectorAll('[data-variant="original"]');
  console.log(`\n\nFound ${originalElements.length} element(s) with data-variant="original"`);
  
  originalElements.forEach((el, i) => {
    const text = el.textContent?.trim() || el.innerText?.trim() || '';
    const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
    const match = text.match(priceRegex);
    
    results.original.push({
      element: el,
      selector: generateSelector(el),
      text: text,
      price: match ? match[1] : null,
      classes: el.className,
      parent: el.parentElement ? generateSelector(el.parentElement) : null,
      visible: el.offsetParent !== null
    });
    
    console.log(`\n${i + 1}. ORIGINAL ELEMENT:`);
    console.log(`   Selector: ${generateSelector(el)}`);
    console.log(`   Classes: ${el.className || 'none'}`);
    console.log(`   Text: "${text}"`);
    console.log(`   Price: ${match ? match[1] : 'NOT FOUND'}`);
    console.log(`   Visible: ${el.offsetParent !== null}`);
    console.log(`   Parent: ${el.parentElement ? generateSelector(el.parentElement) : 'none'}`);
  });
  
  // Find price containers
  const priceContainers = document.querySelectorAll('div.product-price-container, [class*="price"]');
  console.log(`\n\nFound ${priceContainers.length} potential price container(s)`);
  
  priceContainers.forEach((container, i) => {
    const discountInContainer = container.querySelector('[data-variant="discount"]');
    const originalInContainer = container.querySelector('[data-variant="original"]');
    
    console.log(`\n${i + 1}. PRICE CONTAINER:`);
    console.log(`   Selector: ${generateSelector(container)}`);
    console.log(`   Classes: ${container.className || 'none'}`);
    console.log(`   Has discount element: ${!!discountInContainer}`);
    console.log(`   Has original element: ${!!originalInContainer}`);
    
    if (discountInContainer) {
      const discountText = discountInContainer.textContent?.trim() || '';
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
      const match = discountText.match(priceRegex);
      console.log(`   Discount price: ${match ? match[1] : 'NOT FOUND'}`);
    }
    
    if (originalInContainer) {
      const originalText = originalInContainer.textContent?.trim() || '';
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
      const match = originalText.match(priceRegex);
      console.log(`   Original price: ${match ? match[1] : 'NOT FOUND'}`);
    }
  });
  
  return results;
}

/**
 * Find the best selectors for product information
 * @returns {Object} Object with suggested selectors for name, price, and image
 */
function findProductSelectors() {
  console.log('🔍 Searching for product selectors...\n');
  
  // Check for active modal/overlay first
  const activeModal = findActiveModal();
  if (activeModal) {
    const modalStyles = window.getComputedStyle(activeModal);
    const modalRect = activeModal.getBoundingClientRect();
    console.log('📦 MODAL/OVERLAY DETECTED:');
    console.log(`   Element: ${activeModal.tagName}${activeModal.className ? '.' + activeModal.className.split(' ').join('.') : ''}`);
    console.log(`   Z-index: ${modalStyles.zIndex}`);
    console.log(`   Size: ${Math.round(modalRect.width)}x${Math.round(modalRect.height)}px`);
    console.log(`   Position: (${Math.round(modalRect.left)}, ${Math.round(modalRect.top)})`);
    console.log('   Searching within modal first, then main page...\n');
  } else {
    console.log('ℹ️  No active modal/overlay detected. Searching main page only.\n');
  }
  
  // DEBUG: Check for discount prices
  console.log('\n' + '='.repeat(60));
  console.log('💰 DISCOUNT PRICE DEBUG');
  console.log('='.repeat(60));
  const discountResults = findDiscountPrices();
  console.log('\n' + '='.repeat(60) + '\n');
  
  const results = {
    name: [],
    price: [],
    image: [],
    modalResults: {
      name: [],
      price: [],
      image: []
    }
  };
  
  // Search roots: modal first, then document
  const searchRoots = [];
  if (activeModal) {
    searchRoots.push({ root: activeModal, label: 'MODAL' });
  }
  searchRoots.push({ root: document, label: 'MAIN PAGE' });
  
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
  
  // Special handling for Abercrombie: look for modal-specific selector first
  if (activeModal) {
    // Check for Abercrombie modal variant title (has both classes)
    const abercrombieModalTitle = activeModal.querySelector('h1.product-title-component.product-title-main-header');
    if (abercrombieModalTitle) {
      const text = abercrombieModalTitle.innerText?.trim() || '';
      if (text.length > 10 && text.length < 200) {
        const uniqueSelector = 'h1.product-title-component.product-title-main-header';
        const resultItem = {
          selector: uniqueSelector,
          text: text.substring(0, 80),
          confidence: calculateNameConfidence(abercrombieModalTitle, text) + 2, // Boost confidence for modal variant
          source: 'MODAL'
        };
        results.modalResults.name.push(resultItem);
        if (!results.name.find(r => r.selector === uniqueSelector)) {
          results.name.push(resultItem);
        }
      }
    }
  }
  
  searchRoots.forEach(({ root, label }) => {
    nameSelectors.forEach(selector => {
      try {
        const elements = root.querySelectorAll(selector);
        elements.forEach(el => {
          const text = el.innerText?.trim() || '';
          if (text.length > 10 && text.length < 200 && el.offsetParent !== null) {
            const uniqueSelector = generateSelector(el);
            const resultItem = {
              selector: uniqueSelector,
              text: text.substring(0, 80),
              confidence: calculateNameConfidence(el, text),
              source: label
            };
            
            // Add to appropriate results array
            if (label === 'MODAL') {
              if (!results.modalResults.name.find(r => r.selector === uniqueSelector)) {
                results.modalResults.name.push(resultItem);
              }
            }
            if (!results.name.find(r => r.selector === uniqueSelector)) {
              results.name.push(resultItem);
            }
          }
        });
      } catch (e) {
        // Ignore invalid selectors
      }
    });
  });
  
  // Find price candidates - prioritize discount prices
  const pricePattern = /([$€£¥])\s?(\d+(?:[\.,]\d+)?)/g; // Global flag to find all prices
  
  // First, specifically look for discount prices (data-variant="discount")
  searchRoots.forEach(({ root, label }) => {
    const discountElements = root.querySelectorAll('[data-variant="discount"]');
    discountElements.forEach(el => {
      if (el.offsetParent === null) return;
      const text = el.innerText?.trim() || el.textContent?.trim() || '';
      if (!text) return;
      
      // Extract all prices from the element
      const allPrices = text.match(pricePattern);
      if (allPrices && allPrices.length > 0) {
        // If multiple prices, prefer the lower one (discount)
        const prices = allPrices.map(p => {
          const value = parseFloat(p.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
          return { text: p.trim(), value: value };
        });
        prices.sort((a, b) => a.value - b.value); // Sort ascending
        
        const discountPrice = prices[0]; // Lower price is discount
        if (discountPrice.value >= 0.50 && discountPrice.value <= 100000) {
          const uniqueSelector = generateSelector(el);
          const resultItem = {
            selector: uniqueSelector,
            text: text.substring(0, 100),
            price: discountPrice.text,
            confidence: calculatePriceConfidence(el, discountPrice.value) + 3, // Boost for discount
            source: label,
            isDiscount: true
          };
          
          if (label === 'MODAL') {
            if (!results.modalResults.price.find(r => r.selector === uniqueSelector && r.isDiscount)) {
              results.modalResults.price.push(resultItem);
            }
          }
          if (!results.price.find(r => r.selector === uniqueSelector && r.isDiscount)) {
            results.price.push(resultItem);
          }
        }
      }
    });
  });
  
  // Also check for elements that contain multiple prices (like "Was $160, now $136")
  searchRoots.forEach(({ root, label }) => {
    // Look for price wrapper elements that might contain both prices
    const priceWrappers = root.querySelectorAll('.product-price-text-wrapper, [class*="price"]');
    priceWrappers.forEach(el => {
      if (el.offsetParent === null) return;
      const text = el.innerText?.trim() || el.textContent?.trim() || '';
      if (!text || text.length > 200) return;
      
      // Check if it contains multiple prices
      const allPrices = text.match(pricePattern);
      if (allPrices && allPrices.length >= 2) {
        const prices = allPrices.map(p => {
          const value = parseFloat(p.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
          return { text: p.trim(), value: value };
        });
        prices.sort((a, b) => a.value - b.value);
        
        // The lower price is likely the discount
        const discountPrice = prices[0];
        const originalPrice = prices[prices.length - 1];
        
        if (discountPrice.value >= 0.50 && discountPrice.value <= 100000) {
          const uniqueSelector = generateSelector(el);
          
          // Add discount price
          const discountItem = {
            selector: uniqueSelector,
            text: text.substring(0, 100),
            price: discountPrice.text,
            confidence: calculatePriceConfidence(el, discountPrice.value) + 2, // Boost for discount
            source: label,
            isDiscount: true,
            note: `Multiple prices found, showing discount: ${discountPrice.text} (original: ${originalPrice.text})`
          };
          
          if (label === 'MODAL') {
            if (!results.modalResults.price.find(r => r.selector === uniqueSelector && r.isDiscount)) {
              results.modalResults.price.push(discountItem);
            }
          }
          if (!results.price.find(r => r.selector === uniqueSelector && r.isDiscount)) {
            results.price.push(discountItem);
          }
        }
      }
    });
  });
  
  // General price search (fallback for non-discount prices)
  searchRoots.forEach(({ root, label }) => {
    const priceElements = Array.from(root.querySelectorAll('*')).filter(el => {
      if (el.offsetParent === null) return false;
      // Skip elements we already processed
      if (el.hasAttribute('data-variant')) return false;
      if (el.classList.contains('product-price-text-wrapper')) return false;
      
      const text = el.innerText?.trim() || '';
      if (!text || text.length > 50) return false;
      return pricePattern.test(text);
    });
    
    priceElements.forEach(el => {
      const text = el.innerText?.trim() || '';
      // Reset regex lastIndex for fresh match
      pricePattern.lastIndex = 0;
      const match = text.match(pricePattern);
      if (match) {
        const priceValue = parseFloat(match[0].replace(/[$€£¥\s,]/g, '').replace(',', '.'));
        if (priceValue >= 0.50 && priceValue <= 100000) {
          const uniqueSelector = generateSelector(el);
          const resultItem = {
            selector: uniqueSelector,
            text: text,
            price: match[0],
            confidence: calculatePriceConfidence(el, priceValue),
            source: label,
            isDiscount: false
          };
          
          // Add to appropriate results array
          if (label === 'MODAL') {
            if (!results.modalResults.price.find(r => r.selector === uniqueSelector && !r.isDiscount)) {
              results.modalResults.price.push(resultItem);
            }
          }
          if (!results.price.find(r => r.selector === uniqueSelector && !r.isDiscount)) {
            results.price.push(resultItem);
          }
        }
      }
    });
  });
  
  // Find image candidates
  searchRoots.forEach(({ root, label }) => {
    const images = Array.from(root.querySelectorAll('img')).filter(img => {
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
      const resultItem = {
        selector: uniqueSelector,
        src: img.src.substring(0, 100),
        width: img.width,
        height: img.height,
        confidence: calculateImageConfidence(img),
        source: label
      };
      
      // Add to appropriate results array
      if (label === 'MODAL') {
        if (!results.modalResults.image.find(r => r.selector === uniqueSelector)) {
          results.modalResults.image.push(resultItem);
        }
      }
      if (!results.image.find(r => r.selector === uniqueSelector)) {
        results.image.push(resultItem);
      }
    });
  });
  
  // Sort by confidence (prioritize modal results)
  results.name.sort((a, b) => {
    if (a.source === 'MODAL' && b.source !== 'MODAL') return -1;
    if (b.source === 'MODAL' && a.source !== 'MODAL') return 1;
    return b.confidence - a.confidence;
  });
  results.price.sort((a, b) => {
    if (a.source === 'MODAL' && b.source !== 'MODAL') return -1;
    if (b.source === 'MODAL' && a.source !== 'MODAL') return 1;
    return b.confidence - a.confidence;
  });
  results.image.sort((a, b) => {
    if (a.source === 'MODAL' && b.source !== 'MODAL') return -1;
    if (b.source === 'MODAL' && a.source !== 'MODAL') return 1;
    return b.confidence - a.confidence;
  });
  
  // Sort modal results separately
  results.modalResults.name.sort((a, b) => b.confidence - a.confidence);
  results.modalResults.price.sort((a, b) => b.confidence - a.confidence);
  results.modalResults.image.sort((a, b) => b.confidence - a.confidence);
  
  // Display results
  if (activeModal && (results.modalResults.name.length > 0 || results.modalResults.price.length > 0 || results.modalResults.image.length > 0)) {
    console.log('🎯 FOUND IN MODAL/OVERLAY:');
    console.log('─'.repeat(60));
    
    if (results.modalResults.name.length > 0) {
      console.log('\n📦 PRODUCT NAME (from modal):');
      results.modalResults.name.slice(0, 3).forEach((item, i) => {
        console.log(`${i + 1}. Selector: ${item.selector}`);
        console.log(`   Text: "${item.text}..."`);
        console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
      });
    }
    
    if (results.modalResults.price.length > 0) {
      console.log('\n💰 PRICE (from modal):');
      results.modalResults.price.slice(0, 3).forEach((item, i) => {
        console.log(`${i + 1}. Selector: ${item.selector}`);
        console.log(`   Price: ${item.price}`);
        console.log(`   Full text: "${item.text}"`);
        console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
      });
    }
    
    if (results.modalResults.image.length > 0) {
      console.log('\n🖼️  IMAGE (from modal):');
      results.modalResults.image.slice(0, 3).forEach((item, i) => {
        console.log(`${i + 1}. Selector: ${item.selector}`);
        console.log(`   Size: ${item.width}x${item.height}px`);
        console.log(`   URL: ${item.src}...`);
        console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
      });
    }
    
    console.log('\n' + '─'.repeat(60));
  }
  
  console.log('\n📦 PRODUCT NAME SELECTORS (best first, modal prioritized):');
  console.log('─'.repeat(60));
  results.name.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Text: "${item.text}..."`);
    console.log(`   Source: ${item.source}`);
    console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
  });
  
  console.log('\n💰 PRICE SELECTORS (best first, modal prioritized):');
  console.log('─'.repeat(60));
  results.price.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Price: ${item.price}${item.isDiscount ? ' 🏷️ DISCOUNT' : ''}`);
    console.log(`   Full text: "${item.text}"`);
    if (item.note) {
      console.log(`   Note: ${item.note}`);
    }
    console.log(`   Source: ${item.source}`);
    console.log(`   Confidence: ${item.confidence.toFixed(1)}/10\n`);
  });
  
  console.log('\n🖼️  IMAGE SELECTORS (best first, modal prioritized):');
  console.log('─'.repeat(60));
  results.image.slice(0, 5).forEach((item, i) => {
    console.log(`${i + 1}. Selector: ${item.selector}`);
    console.log(`   Size: ${item.width}x${item.height}px`);
    console.log(`   URL: ${item.src}...`);
    console.log(`   Source: ${item.source}`);
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

/**
 * Quick debug function - call this directly in console
 */
window.debugDiscountPrice = function() {
  console.log('🔍 DEBUGGING DISCOUNT PRICE...\n');
  
  // Check if price container exists
  const priceContainer = document.querySelector('div.product-price-container');
  console.log('Price container found:', !!priceContainer);
  if (priceContainer) {
    console.log('Container HTML:', priceContainer.outerHTML.substring(0, 500));
  }
  
  // Check for discount element
  const discountEl = document.querySelector('[data-variant="discount"]');
  console.log('\nDiscount element found:', !!discountEl);
  if (discountEl) {
    console.log('Discount element:', discountEl);
    console.log('Discount text:', discountEl.textContent);
    console.log('Discount classes:', discountEl.className);
    console.log('Discount parent:', discountEl.parentElement);
  }
  
  // Check within price container
  if (priceContainer) {
    const discountInContainer = priceContainer.querySelector('[data-variant="discount"]');
    console.log('\nDiscount in container:', !!discountInContainer);
    if (discountInContainer) {
      console.log('Discount text in container:', discountInContainer.textContent);
    }
    
    const originalInContainer = priceContainer.querySelector('[data-variant="original"]');
    console.log('Original in container:', !!originalInContainer);
    if (originalInContainer) {
      console.log('Original text in container:', originalInContainer.textContent);
    }
  }
  
  // Check all data-variant elements
  const allVariants = document.querySelectorAll('[data-variant]');
  console.log(`\nTotal elements with data-variant: ${allVariants.length}`);
  allVariants.forEach((el, i) => {
    console.log(`${i + 1}. ${el.getAttribute('data-variant')}: ${el.textContent?.trim()}`);
  });
};

// Auto-run if in browser console
if (typeof window !== 'undefined') {
  // Export for manual calling
  window.findProductSelectors = findProductSelectors;
  window.findDiscountPrices = findDiscountPrices;
  
  console.log('✅ Selector Finder Tool loaded!');
  console.log('📝 Run: findProductSelectors()');
  console.log('📝 Run: debugDiscountPrice() for quick discount debugging');
  console.log('   Or just call it directly in the console.\n');
}

