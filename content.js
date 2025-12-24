/**
 * Message Listener - Handles communication from popup
 * 
 * When the popup requests product extraction, this listener:
 * 1. Calls extractProductInfo() to get product data from the current page
 * 2. Returns success response with product data, or error response with details
 * 3. Handles both structured errors (NOT_PRODUCT_PAGE, SITE_NOT_SUPPORTED) and generic errors
 */
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extractProduct') {
    // Use async IIFE to handle async extractProductInfo() function
    (async () => {
      try {
        const result = await extractProductInfo();
        sendResponse({ success: true, data: result });
      } catch (error) {
        // Check if it's a structured error (has error.type property)
        if (error.type) {
          sendResponse({ 
            success: false, 
            error: error.message,
            errorType: error.type,
            errorData: error
          });
        } else {
          // Generic error - wrap in standard format
          sendResponse({ 
            success: false, 
            error: error.message || 'Failed to extract product information',
            errorType: 'UNKNOWN_ERROR'
          });
        }
      }
    })();
    return true; // Keep message channel open for async response (required for Chrome extensions)
  }
  return false; // Don't handle other message types
});

/**
 * Heuristic function to extract product name from h1 elements
 * 
 * Strategy:
 * - Finds all h1 elements on the page
 * - Scores each h1 based on position (higher on page = better) and length
 * - Returns the h1 with the lowest score (best candidate)
 * 
 * @returns {string|null} - Product name or null if no h1 found
 */
function extractProductName() {
  const headings = Array.from(document.querySelectorAll("h1"));
  if (headings.length === 0) return null;

  // Score each h1: lower score = better candidate
  // Score = vertical position + (text length * 0.5)
  // This prefers headings that are higher on the page and have reasonable length
  const candidates = headings
    .filter(el => el.innerText.trim().length > 0) // Only non-empty headings
    .map(el => {
      const rect = el.getBoundingClientRect();
      return {
        text: el.innerText.trim(),
        score: rect.top + el.innerText.length * 0.5 // Lower = better (higher on page)
      };
    });

  // Sort by score (ascending) and return the best candidate
  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.text || null;
}

/**
 * Helper function to extract price from element, handling superscript decimals
 * 
 * Some websites display prices like "$29" with cents in superscript: "$29<sup>99</sup>"
 * This function detects and combines them into "$29.99"
 * 
 * Strategy:
 * 1. Find currency symbol + main price digits
 * 2. Look for superscript elements (<sup> tags or styled elements) containing cents
 * 3. Combine: currency + mainPrice + "." + cents
 * 4. Fallback to regular price extraction if no superscript found
 * 
 * @param {HTMLElement} el - The element to extract price from
 * @returns {string|null} - Extracted price (e.g., "$29.99") or null
 */
function extractPriceFromElement(el) {
  const currencyRegex = /([$€£¥])\s?(\d+)/; // Match currency symbol + main price digits
  const text = el.innerText?.trim() || '';
  
  // Step 1: Find currency symbol and main price digits
  const match = text.match(currencyRegex);
  if (match) {
    const currency = match[1]; // $, €, £, or ¥
    const mainPrice = match[2]; // The main number part (e.g., "29")
    
    // Step 2: Check for superscript elements within this element
    // Superscript could be in <sup> tags or styled with vertical-align/font-size
    const superscripts = el.querySelectorAll('sup, [style*="vertical-align"], [style*="font-size"]');
    
    for (const sup of superscripts) {
      const supText = sup.textContent?.trim() || '';
      // Check if superscript contains 1-3 digits (likely cents: "99", "5", etc.)
      const supMatch = supText.match(/^(\d{1,3})$/);
      if (supMatch) {
        const cents = supMatch[1].padStart(2, '0'); // Ensure 2 digits ("5" -> "05")
        return `${currency}${mainPrice}.${cents}`; // Combine: "$29" + "." + "99" = "$29.99"
      }
    }
    
    // Step 3: Also check sibling elements that might be superscript
    // Sometimes the superscript is a separate element next to the price
    if (el.parentElement) {
      const siblings = Array.from(el.parentElement.children);
      const elIndex = siblings.indexOf(el);
      
      // Check the next sibling element
      if (elIndex >= 0 && elIndex < siblings.length - 1) {
        const nextSibling = siblings[elIndex + 1];
        const nextText = nextSibling.textContent?.trim() || '';
        const nextMatch = nextText.match(/^(\d{1,3})$/);
        
        // Check if it's styled as superscript (smaller font, vertical-align, or <sup> tag)
        const siblingStyles = window.getComputedStyle(nextSibling);
        const elStyles = window.getComputedStyle(el);
        const isSuperscript = nextSibling.tagName === 'SUP' || 
                             siblingStyles.verticalAlign === 'super' ||
                             parseFloat(siblingStyles.fontSize) < parseFloat(elStyles.fontSize); // Smaller font indicates superscript
        
        if (nextMatch && isSuperscript) {
          const cents = nextMatch[1].padStart(2, '0');
          return `${currency}${mainPrice}.${cents}`;
        }
      }
    }
    
    // Step 4: If no superscript found, return the regular price
    return match[0]; // e.g., "$29"
  }
  
  // Fallback: try to match full price pattern (with decimals already included)
  const fullMatch = text.match(/([$€£¥]\s?\d+(?:[\.,]\d+)?)/);
  return fullMatch ? fullMatch[1] : null;
}

/**
 * Extract price with discount preference (for sites with original/discount variants)
 * 
 * Some sites use data attributes to mark discount vs original prices:
 * - <span data-variant="discount">$29.99</span>
 * - <span data-variant="original">$39.99</span>
 * 
 * This function prioritizes discount prices over original prices.
 * 
 * @param {string} containerSelector - CSS selector for the price container
 * @param {string} variantAttribute - Attribute name for variant (default: 'data-variant')
 * @param {string} discountValue - Value for discount variant (default: 'discount')
 * @param {string} originalValue - Value for original variant (default: 'original')
 * @param {HTMLElement} rootElement - Root element to search within (default: document)
 * @returns {string|null} - Extracted price or null if not found
 */
function extractPriceWithDiscountPreference(containerSelector, variantAttribute = 'data-variant', discountValue = 'discount', originalValue = 'original', rootElement = document) {
  const container = rootElement.querySelector(containerSelector);
  if (!container) return null;
  
  const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
  
  // First, try to find discount price
  const discountElement = container.querySelector(`[${variantAttribute}="${discountValue}"]`);
  if (discountElement) {
    let priceText = extractPriceFromElement(discountElement);
    if (!priceText) {
      const text = discountElement.textContent || discountElement.innerText || '';
      const match = text.match(priceRegex);
      if (match) {
        priceText = match[1];
      }
    }
    if (priceText && priceRegex.test(priceText)) {
      return priceText.trim();
    }
  }
  
  // If no discount, try original price
  const originalElement = container.querySelector(`[${variantAttribute}="${originalValue}"]`);
  if (originalElement) {
    let priceText = extractPriceFromElement(originalElement);
    if (!priceText) {
      const text = originalElement.textContent || originalElement.innerText || '';
      const match = text.match(priceRegex);
      if (match) {
        priceText = match[1];
      }
    }
    if (priceText && priceRegex.test(priceText)) {
      return priceText.trim();
    }
  }
  
  // Fallback: extract from container itself
  let priceText = extractPriceFromElement(container);
  if (!priceText) {
    const text = container.textContent || container.innerText || '';
    const match = text.match(priceRegex);
    if (match) {
      priceText = match[1];
    }
  }
  
  return priceText && priceRegex.test(priceText) ? priceText.trim() : null;
}

/**
 * Heuristic function to extract price using currency pattern matching
 * 
 * This is a fallback function that searches the entire page for price-like text.
 * It uses a scoring system to find the most likely product price.
 * 
 * Strategy:
 * 1. Find all elements containing currency patterns ($, €, £, ¥)
 * 2. Filter out non-price elements (shipping, fees, etc.)
 * 3. Score each candidate based on:
 *    - Position on page (higher = better)
 *    - Proximity to product name
 *    - Price value (reasonable range = better)
 *    - Font size (larger = more prominent)
 * 4. Return the highest-scoring price
 * 
 * @returns {string|null} - Extracted price or null if not found
 */
function extractPrice() {
  const currencyRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/; // Match currency + number with optional decimals
  
  // Get product name position for proximity scoring
  // Prices near the product name are more likely to be the main product price
  const productName = extractProductName();
  let nameElement = null;
  if (productName) {
    const headings = Array.from(document.querySelectorAll("h1"));
    nameElement = headings.find(h => h.innerText.trim() === productName);
  }

  // Search all elements on the page
  const elements = Array.from(document.querySelectorAll("body *"));
  
  // Words that indicate this is NOT the main product price
  // These help filter out shipping costs, old prices, fees, etc.
  const excludeWords = ['shipping', 'delivery', 'was', 'save', 'from', 'starting at', 'each', 'per', 'tax', 'fee', 'original', 'list', 'msrp'];
  
  // Step 1: Filter elements to find price candidates
  const candidates = elements
    .filter(el => {
      // Skip hidden elements
      if (el.offsetParent === null) return false;
      
      // Try to extract price (handles superscript decimals)
      const priceText = extractPriceFromElement(el);
      const text = el.innerText?.trim() || '';
      
      // Must have either extracted price or currency pattern in text
      if (!priceText && !currencyRegex.test(text)) return false;
      
      // Skip elements with too much text (likely not a price element)
      if (text.length > 50) return false;
      
      // Filter out elements containing exclude words (shipping, fees, etc.)
      const textLower = text.toLowerCase();
      if (excludeWords.some(word => textLower.includes(word))) return false;
      
      // Extract the price value to validate it's reasonable
      const finalPrice = priceText || (text.match(currencyRegex)?.[1]);
      if (finalPrice) {
        const priceValue = parseFloat(finalPrice.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
        
        // Filter out very small prices (likely shipping costs, fees, etc.)
        if (priceValue < 0.50) return false;
        
        // Filter out extremely large prices (likely errors or total cart values)
        if (priceValue > 100000) return false;
      }
      
      return true; // This element is a valid price candidate
    })
    // Step 2: Score each candidate (lower score = better)
    .map(el => {
      const rect = el.getBoundingClientRect();
      
      // Extract price text, handling superscript decimals
      let priceText = extractPriceFromElement(el);
      if (!priceText) {
        // Fallback to regex match if superscript extraction didn't work
        const match = el.innerText.match(currencyRegex);
        if (!match) return null;
        priceText = match[1];
      }
      
      const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
      
      // Calculate score - LOWER score = BETTER candidate
      // We subtract points for good indicators, add points for bad indicators
      let score = rect.top; // Base score: vertical position (higher on page = lower score = better)
      
      // Boost: Prices near product name are more likely to be the main price
      if (nameElement) {
        const nameRect = nameElement.getBoundingClientRect();
        const verticalDistance = Math.abs(rect.top - nameRect.bottom);
        if (verticalDistance < 500) { // Within 500px of product name
          score -= 200; // Significant boost (lower score = better)
        }
      }
      
      // Boost: Reasonable price range ($5-$5000) is more likely to be product price
      if (priceValue >= 5 && priceValue <= 5000) {
        score -= 100; // Boost for reasonable prices
      }
      
      // Boost: Larger font sizes indicate more prominent/important prices
      const fontSize = window.getComputedStyle(el).fontSize;
      const fontSizeNum = parseFloat(fontSize);
      if (fontSizeNum > 20) {
        score -= 50; // Boost for larger fonts
      }
      
      // Penalty: Very small prices (< $5) are likely shipping or fees
      if (priceValue < 5) {
        score += 300; // Heavy penalty (higher score = worse)
      }
      
      // Penalty: Prices on the far right are often shipping info or secondary prices
      if (rect.left > window.innerWidth * 0.7) {
        score += 150; // Penalty for far-right position
      }
      
      return {
        price: priceText,
        score: score, // Lower = better
        priceValue: priceValue
      };
    });

  // Step 3: Return the best candidate (lowest score)
  if (candidates.length === 0) return null;

  // Filter out null candidates and sort by score (ascending = best first)
  const validCandidates = candidates.filter(c => c !== null);
  validCandidates.sort((a, b) => a.score - b.score);
  
  return validCandidates[0]?.price || null;
}

/**
 * Heuristic function to extract product image
 * 
 * Strategy:
 * 1. Find all images on the page
 * 2. Filter out small images (icons), hidden images, and non-product images (logos, etc.)
 * 3. Score each candidate based on size and position
 * 4. Return the highest-scoring image URL
 * 
 * @returns {string|null} - Image URL or null if no suitable image found
 */
function extractProductImage() {
  const images = Array.from(document.querySelectorAll("img"));
  if (images.length === 0) return null;

  // Step 1: Filter to find product image candidates
  const candidates = images
    .filter(img => {
      const rect = img.getBoundingClientRect();
      
      // Filter out very small images (likely icons, buttons, etc.)
      if (rect.width < 100 || rect.height < 100) return false;
      
      // Filter out hidden images (display: none, visibility: hidden, etc.)
      if (img.offsetParent === null) return false;
      
      // Must have a valid image source
      // Check multiple attributes for lazy-loaded images
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (!src || src.trim() === '') return false;
      
      // Filter out common non-product images by URL pattern
      const srcLower = src.toLowerCase();
      if (srcLower.includes('logo') || 
          srcLower.includes('icon') || 
          srcLower.includes('avatar') ||
          srcLower.includes('spinner') ||
          srcLower.includes('placeholder')) {
        return false;
      }
      
      return true; // This image is a valid candidate
    })
    // Step 2: Score each candidate (higher score = better)
    .map(img => {
      const rect = img.getBoundingClientRect();
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-old-src');
      
      // Score = image area - (vertical position * 10)
      // This prefers larger images that are higher on the page
      const area = rect.width * rect.height;
      const score = area - rect.top * 10;
      
      return {
        url: src,
        score: score // Higher = better
      };
    });

  // Step 3: Return the best candidate (highest score)
  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score); // Sort descending (highest score first)
  return candidates[0]?.url || null;
}

// Error types
const ERROR_TYPES = {
  NOT_PRODUCT_PAGE: 'NOT_PRODUCT_PAGE',
  SITE_NOT_SUPPORTED: 'SITE_NOT_SUPPORTED'
};

/**
 * Detect if the current page is a product page based on DOM analysis
 * @returns {Object} - { isProductPage: boolean, confidence: number, indicators: Array }
 */
function detectProductPage() {
  let score = 0;
  const indicators = [];
  const maxScore = 20; // Maximum possible score
  
  // 1. Check for Schema.org product markup (very reliable)
  const schemaProduct = document.querySelector('[itemtype*="Product"], [itemtype*="product"]');
  if (schemaProduct) {
    score += 5;
    indicators.push('Schema.org Product markup found');
  }
  
  // 2. Check for JSON-LD product data
  const jsonLdScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
  const hasProductJsonLd = jsonLdScripts.some(script => {
    try {
      const data = JSON.parse(script.textContent);
      return data['@type'] === 'Product' || 
             (Array.isArray(data) && data.some(item => item['@type'] === 'Product')) ||
             (data['@graph'] && data['@graph'].some(item => item['@type'] === 'Product'));
    } catch (e) {
      return false;
    }
  });
  if (hasProductJsonLd) {
    score += 5;
    indicators.push('JSON-LD Product data found');
  }
  
  // 3. Check for product-specific attributes
  const productAttributes = [
    '[data-product-id]',
    '[data-product-name]',
    '[data-product-price]',
    '[data-product-sku]',
    '[itemprop="name"]',
    '[itemprop="price"]',
    '[itemprop="image"]'
  ];
  const foundAttributes = productAttributes.filter(attr => document.querySelector(attr));
  if (foundAttributes.length > 0) {
    score += 3;
    indicators.push(`Product attributes found: ${foundAttributes.length}`);
  }
  
  // 4. Check for price elements (strong indicator)
  const pricePattern = /([$€£¥])\s?(\d+(?:[\.,]\d+)?)/;
  const priceElements = Array.from(document.querySelectorAll('*')).filter(el => {
    const text = el.innerText?.trim() || '';
    return pricePattern.test(text) && text.length < 50 && el.offsetParent !== null;
  });
  if (priceElements.length > 0) {
    score += 3;
    indicators.push(`Price elements found: ${priceElements.length}`);
  }
  
  // 5. Check for "Add to Cart" or "Buy Now" buttons
  const buttons = Array.from(document.querySelectorAll('button, a[role="button"], input[type="submit"]'));
  const hasAddToCart = buttons.some(btn => {
    const text = (btn.textContent || btn.innerText || btn.getAttribute('aria-label') || '').toLowerCase();
    return text.includes('add to cart') || 
           text.includes('add to bag') || 
           text.includes('buy now') ||
           text.includes('purchase');
  });
  if (hasAddToCart) {
    score += 4;
    indicators.push('Add to Cart / Buy button found');
  }
  
  // 6. Check for product images (large, prominent images)
  const productImages = Array.from(document.querySelectorAll('img')).filter(img => {
    if (img.offsetParent === null) return false;
    const rect = img.getBoundingClientRect();
    return rect.width >= 200 && rect.height >= 200 && 
           img.src && !img.src.includes('data:') &&
           !img.src.toLowerCase().includes('logo') &&
           !img.src.toLowerCase().includes('icon');
  });
  if (productImages.length > 0) {
    score += 2;
    indicators.push(`Product images found: ${productImages.length}`);
  }
  
  // 7. Check for product title/name (h1 with reasonable length)
  const h1Elements = Array.from(document.querySelectorAll('h1'));
  const productTitle = h1Elements.find(h1 => {
    const text = h1.innerText?.trim() || '';
    return text.length > 10 && text.length < 200 && h1.offsetParent !== null;
  });
  if (productTitle) {
    score += 2;
    indicators.push('Product title (h1) found');
  }
  
  // 8. Check for quantity selectors (common on product pages)
  const quantitySelectors = document.querySelectorAll('input[type="number"][name*="quantity" i], select[name*="quantity" i], [aria-label*="quantity" i]');
  if (quantitySelectors.length > 0) {
    score += 1;
    indicators.push('Quantity selector found');
  }
  
  // 9. Check for product reviews/ratings
  const reviewSelectors = [
    '[itemprop="ratingValue"]',
    '[itemprop="reviewRating"]',
    '.rating',
    '.reviews',
    '[aria-label*="star" i]',
    '[aria-label*="rating" i]'
  ];
  const hasReviews = reviewSelectors.some(selector => document.querySelector(selector));
  if (hasReviews) {
    score += 1;
    indicators.push('Product reviews/ratings found');
  }
  
  // 10. Check for product variants (size, color, etc.)
  const variantSelectors = [
    '[name*="size" i]',
    '[name*="color" i]',
    '[name*="variant" i]',
    '[data-variant]',
    '.product-variant',
    '.size-selector',
    '.color-selector'
  ];
  const hasVariants = variantSelectors.some(selector => document.querySelector(selector));
  if (hasVariants) {
    score += 1;
    indicators.push('Product variants found');
  }
  
  // Calculate confidence (0-100%)
  const confidence = Math.min((score / maxScore) * 100, 100);
  
  // Threshold: if score >= 6, consider it a product page
  const isProductPage = score >= 6;
  
  return {
    isProductPage: isProductPage,
    confidence: Math.round(confidence),
    score: score,
    maxScore: maxScore,
    indicators: indicators
  };
}

/**
 * Format supported sites list for display
 * @param {Array<string>} sites - Array of supported site domains
 * @returns {string} - Formatted string of supported sites
 */
function formatSupportedSitesList(sites) {
  // Group sites by main domain
  const grouped = {};
  sites.forEach(site => {
    const mainDomain = site.split('.')[0];
    if (!grouped[mainDomain]) {
      grouped[mainDomain] = [];
    }
    grouped[mainDomain].push(site);
  });
  
  // Format as readable list
  const formatted = [];
  Object.keys(grouped).sort().forEach(mainDomain => {
    const domains = grouped[mainDomain];
    if (domains.length === 1) {
      formatted.push(`• ${mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)} (${domains[0]})`);
    } else {
      const mainSite = domains.find(d => !d.includes('.co.') && !d.includes('.com.')) || domains[0];
      const others = domains.filter(d => d !== mainSite);
      if (others.length > 0) {
        formatted.push(`• ${mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)} (${mainSite}${others.length > 2 ? `, ${others.length} more` : ', ' + others.join(', ')})`);
      } else {
        formatted.push(`• ${mainDomain.charAt(0).toUpperCase() + mainDomain.slice(1)} (${mainSite})`);
      }
    }
  });
  
  return formatted.join('\n');
}

/**
 * Main function: Extract product information from the current page
 * 
 * Flow:
 * 1. Validate site is supported
 * 2. Detect if page is a product page
 * 3. Get site-specific selectors
 * 4. Extract product data (name, price, image) using site-specific logic or heuristics
 * 5. Return product data object
 * 
 * @returns {Promise<Object>} - Product data object with name, price, image, site, url, timestamp
 * @throws {Object} - Structured error if site not supported or not a product page
 */
async function extractProductInfo() {
  // ============================================================================
  // STEP 1: VALIDATE SITE SUPPORT
  // ============================================================================
  const url = window.location.href;
  const domain = getBaseDomain(url);
  
  // Check if this site is in our supported sites list
  const isSupported = isSupportedSite(domain);
  
  if (!isSupported) {
    // Site is not supported - add to junk sites list and throw error
    const isJunk = await isJunkSite(domain);
    
    if (!isJunk) {
      // Add to junk sites list (so we don't check it again)
      await addToJunkSites(domain);
    }
    
    // Get supported sites list for error message
    const supportedSites = getSupportedSitesList();
    const supportedSitesFormatted = formatSupportedSitesList(supportedSites);
    
    const error = {
      type: ERROR_TYPES.SITE_NOT_SUPPORTED,
      message: `Site not supported: ${domain}`,
      supportedSites: supportedSites,
      supportedSitesFormatted: supportedSitesFormatted,
      domain: domain
    };
    
    throw error;
  }
  
  // ============================================================================
  // STEP 2: DETECT IF PAGE IS A PRODUCT PAGE
  // ============================================================================
  const pageCheck = detectProductPage();
  
  if (!pageCheck.isProductPage) {
    // Page doesn't appear to be a product detail page
    const error = {
      type: ERROR_TYPES.NOT_PRODUCT_PAGE,
      message: `This isn't a product page.`,
      domain: domain,
      confidence: pageCheck.confidence,
      indicators: pageCheck.indicators
    };
    
    throw error;
  }
  
  // ============================================================================
  // STEP 3: GET SITE-SPECIFIC SELECTORS
  // ============================================================================
  const selectors = getSelectorsForSite(url);
  
  if (!selectors) {
    // This shouldn't happen if isSupportedSite worked correctly, but just in case
    throw new Error(`Site not supported: ${domain}`);
  }

  // ============================================================================
  // STEP 4: INITIALIZE PRODUCT DATA OBJECT
  // ============================================================================
  const productData = {
    name: null,
    image: null,
    price: null,
    site: domain,
    url: url,
    timestamp: new Date().toISOString()
  };

  // ============================================================================
  // STEP 5: EXTRACT PRODUCT DATA (SITE-SPECIFIC LOGIC)
  // ============================================================================
  const isAmazon = domain.includes('amazon.');
  const isEbay = domain.includes('ebay.');
  const isAbercrombie = domain.includes('abercrombie.com');
  
  if (isAmazon) {
    // Guard: if core Amazon product selectors are missing, treat as NOT_PRODUCT_PAGE
    const hasTitleElement = !!document.querySelector(selectors.name || '#productTitle');
    let hasPriceElement = false;
    if (selectors.price) {
      const priceSelectorsForCheck = selectors.price.split(',').map(s => s.trim());
      hasPriceElement = priceSelectorsForCheck.some(sel => document.querySelector(sel));
    }

    if (!hasTitleElement || !hasPriceElement) {
      const error = {
        type: ERROR_TYPES.NOT_PRODUCT_PAGE,
        message: `This isn't a product page.`,
        domain: domain,
        confidence: 100,
        indicators: ['Missing Amazon product title or price selectors on this page']
      };
      throw error;
    }

    // For Amazon, try specific selectors first (more reliable)
    // Extract product name
    if (selectors.name) {
      const nameElement = document.querySelector(selectors.name);
      if (nameElement) {
        productData.name = nameElement.textContent.trim();
      }
    }
    
    // --- Extract Product Price ---
    if (selectors.price) {
      const priceSelectors = selectors.price.split(',').map(s => s.trim()); // Handle multiple selectors
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/; // Match currency + number with optional decimals
      
      // Try each price selector until we find a valid price
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
          // Step 1: Try to extract price with superscript handling (e.g., "$29<sup>99</sup>" -> "$29.99")
          let priceText = extractPriceFromElement(priceElement);
          
          // Step 2: If superscript extraction didn't work, try traditional text extraction
          if (!priceText) {
            // Get full text content (handles prices split across child elements)
            priceText = priceElement.textContent || priceElement.innerText;
            if (!priceText || priceText.trim() === '') {
              // Fallback to aria-label or title attribute
              priceText = priceElement.getAttribute('aria-label') || priceElement.title;
            }
            
            if (priceText) {
              priceText = priceText.trim();
              
              // Use regex to extract the full price pattern (ensures we get decimals)
              const priceMatch = priceText.match(priceRegex);
              if (priceMatch) {
                priceText = priceMatch[1];
              } else {
                // Fallback: clean up common prefixes/suffixes
                priceText = priceText.replace(/^\s*Price:\s*/i, '');
                priceText = priceText.replace(/\s*each\s*$/i, '');
              }
            }
          }
          
          // Step 3: Amazon-specific - Check for split price format
          // Amazon sometimes splits price: main digits in one element, cents in .a-price-fraction
          // Example: "$39" + "95" (in separate elements) = "$39.95"
          // Or: "$39." + "95" = "$39.95"
          if (priceText && priceText.trim()) {
            // Always check for .a-price-fraction element (Amazon's cents element)
            // This handles both "$39" and "$39." cases
            const parentPrice = priceElement.closest('.a-price');
            if (parentPrice) {
              const fractionElement = parentPrice.querySelector('.a-price-fraction');
              if (fractionElement) {
                const fraction = fractionElement.textContent?.trim() || '';
                if (fraction) {
                  // Check if price already has a decimal point
                  if (priceText.endsWith('.')) {
                    // Combine: "$39." + "95" = "$39.95"
                    priceText = priceText + fraction;
                  } else if (!priceText.includes('.')) {
                    // Combine: "$39" + "95" = "$39.95"
                    priceText = priceText + '.' + fraction;
                  }
                }
              }
            }
            
            // If we found a price, use it and stop searching
            if (priceText && priceText.trim()) {
              productData.price = priceText.trim();
              break;
            }
          }
        }
      }
    }
    
    // --- Extract Product Image ---
    if (selectors.image) {
      const imageSelectors = selectors.image.split(',').map(s => s.trim());
      
      for (const selector of imageSelectors) {
        const imageElement = document.querySelector(selector);
        if (imageElement) {
          // Try multiple attributes for lazy-loaded images
          let imageUrl = imageElement.src || 
                        imageElement.getAttribute('data-src') || 
                        imageElement.getAttribute('data-lazy-src') ||
                        imageElement.getAttribute('data-old-src');
          
          // Amazon-specific: Handle dynamic image data attribute
          // Amazon stores image URLs in a JSON object in data-a-dynamic-image
          if (!imageUrl && imageElement.hasAttribute('data-a-dynamic-image')) {
            try {
              const dynamicImage = JSON.parse(imageElement.getAttribute('data-a-dynamic-image'));
              const imageKeys = Object.keys(dynamicImage);
              if (imageKeys.length > 0) {
                imageUrl = imageKeys[0]; // Use the first (usually largest) image
              }
            } catch (e) {
              console.warn('Failed to parse Amazon dynamic image data:', e);
            }
          }
          
          if (imageUrl) {
            productData.image = imageUrl;
            break; // Found image, stop searching
          }
        }
      }
    }
    
    // --- Fallback to Heuristics ---
    // If site-specific selectors didn't work, use heuristic functions
    if (!productData.name) {
      productData.name = extractProductName();
    }
    if (!productData.price) {
      productData.price = extractPrice();
    }
    if (!productData.image) {
      productData.image = extractProductImage();
    }
  // ============================================================================
  // EBAY-SPECIFIC EXTRACTION
  // ============================================================================
  } else if (isEbay) {
    // Guard: Verify this is actually a product page
    // Since detectProductPage() already passed (we wouldn't be here if it didn't),
    // we trust that it's a product page. The selectors might be outdated, but
    // heuristics will handle extraction if selectors don't match.
    // Only do a light check: if selectors don't exist AND heuristics also fail,
    // we'll know during extraction. But don't block here.
    
    // Note: We removed the strict guard because:
    // 1. detectProductPage() already validated it's a product page
    // 2. Selectors might be outdated (eBay changes their HTML frequently)
    // 3. Heuristics can still extract data even if selectors don't match
    // 4. This prevents false negatives on legitimate product pages

    // eBay extraction: Use selectors first, then heuristics as fallback
    
    // --- Extract Product Name ---
    if (selectors.name) {
      const nameElement = document.querySelector(selectors.name);
      if (nameElement) {
        productData.name = nameElement.textContent.trim();
      }
    }

    // --- Extract Product Price ---
    if (selectors.price) {
      const priceSelectors = selectors.price.split(',').map(s => s.trim());
      // Regex to match prices with thousands separators and decimals
      // Handles: $2,250.00 (US format with comma thousands, dot decimals)
      // Pattern: currency + optional space + digits with optional comma thousands + optional dot decimals
      // Examples: "$2,250.00", "$249.99", "$1,234.56"
      // The (?:,\d{3})* part handles thousands separators (e.g., $2,250 or $1,234,567)
      // The (?:\.\d{1,2})? part handles US decimal format (e.g., .00 or .99)
      const priceRegex = /([$€£¥]\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?)/g;

      // For eBay, prioritize div.x-bin-price__content (main price container with discount info)
      // Collect all price candidates first, then pick the best one
      const priceCandidates = [];

      // Try each price selector (some may match multiple elements)
      for (const selector of priceSelectors) {
        const priceElements = document.querySelectorAll(selector);

        // Check each matching element
        for (const priceElement of priceElements) {
          // Get full text content to check for multiple prices
          const fullText = priceElement.textContent || priceElement.innerText || '';
          
          // Reset regex for fresh match
          priceRegex.lastIndex = 0;
          const allPrices = fullText.match(priceRegex);
          
          let priceText = null;
          let priceValue = null;
          
          if (allPrices && allPrices.length >= 2) {
            // Multiple prices found - extract all, sort, and pick the highest (original price)
            // Example: "US $269.99\n$249.99 with coupon code" -> extract both, pick $269.99
            const prices = allPrices.map(p => {
              // Clean the price text (remove extra spaces, preserve thousands separators in text)
              const cleanPrice = p.trim();
              // Parse value: remove currency symbol, spaces, and thousands separators (commas)
              // Keep decimal point/dot for parsing
              const valueStr = cleanPrice.replace(/[$€£¥\s]/g, '').replace(/,/g, '');
              const value = parseFloat(valueStr);
              return { text: cleanPrice, value: value };
            });
            prices.sort((a, b) => b.value - a.value); // Sort descending (highest first)
            
            // Use the highest price (original price, ignore discount)
            priceText = prices[0].text;
            priceValue = prices[0].value;
          } else if (allPrices && allPrices.length === 1) {
            // Single price found - preserve the full price string as-is
            priceText = allPrices[0].trim();
            // Parse value: remove currency symbol, spaces, and thousands separators for calculation
            const valueStr = priceText.replace(/[$€£¥\s]/g, '').replace(/,/g, '');
            priceValue = parseFloat(valueStr);
          } else {
            // No prices found in text, try superscript extraction
            priceText = extractPriceFromElement(priceElement);
            if (priceText) {
              // Reset regex for validation
              priceRegex.lastIndex = 0;
              if (priceRegex.test(priceText)) {
                priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
              } else {
                priceText = null;
              }
            }
          }

          // Validate price is reasonable and add to candidates
          if (priceText && priceValue !== null) {
            // Ensure we have the full price with decimals
            // Check if price ends with a decimal point (might be split format)
            if (priceText.endsWith('.')) {
              // Look for decimal part in nearby elements (eBay might split like Amazon)
              const parent = priceElement.parentElement;
              if (parent) {
                const siblingText = parent.textContent || parent.innerText || '';
                priceRegex.lastIndex = 0;
                const siblingPrices = siblingText.match(priceRegex);
                if (siblingPrices && siblingPrices.length > 0) {
                  // Find the price that starts with our price
                  const completePrice = siblingPrices.find(p => p.startsWith(priceText));
                  if (completePrice && completePrice.includes('.')) {
                    priceText = completePrice;
                    priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
                  }
                }
              }
            }
            
            // Validate price is in reasonable range (not shipping, not error)
            if (priceValue >= 0.5 && priceValue <= 100000) {
              // Score this candidate:
              // - Higher score = better candidate
              // - Prioritize div.x-bin-price__content (main price container)
              // - Prioritize higher prices (main product vs. shipping/related items)
              let score = 0;
              
              // Check if this element is the main eBay price container
              // Prioritize div.x-price-primary (most reliable) and div.x-bin-price__content
              const isMainPriceContainer = priceElement.classList.contains('x-price-primary') ||
                                          priceElement.closest('.x-price-primary') !== null ||
                                          (priceElement.tagName === 'DIV' && priceElement.className.includes('x-price-primary')) ||
                                          selector === 'div.x-price-primary' ||
                                          selector.includes('x-price-primary') ||
                                          priceElement.classList.contains('x-bin-price__content') ||
                                          priceElement.closest('.x-bin-price__content') !== null ||
                                          (priceElement.tagName === 'DIV' && priceElement.className.includes('x-bin-price__content')) ||
                                          selector === 'div.x-bin-price__content' ||
                                          selector.includes('x-bin-price__content');
              
              if (isMainPriceContainer) {
                // Extra boost for x-price-primary (the most reliable selector)
                if (priceElement.classList.contains('x-price-primary') || 
                    priceElement.closest('.x-price-primary') !== null ||
                    selector === 'div.x-price-primary' ||
                    selector.includes('x-price-primary')) {
                  score += 200000; // Highest priority for x-price-primary
                } else {
                  score += 100000; // High priority for x-bin-price__content
                }
              }
              // Prefer prices in reasonable product range ($50-$1000) over very low prices
              if (priceValue >= 50 && priceValue <= 1000) {
                score += 20000; // Strong boost for typical product prices
              }
              // Penalize very low prices (likely shipping or related items)
              if (priceValue < 30) {
                score -= 50000; // Heavy penalty for very low prices
              }
              score += priceValue * 100; // Prefer higher prices (main product vs. $20 shipping)
              
              priceCandidates.push({
                text: priceText.trim(),
                value: priceValue,
                score: score,
                selector: selector
              });
            }
          }
        }
      }

      // Sort candidates by score (highest = best) and use the best one
      if (priceCandidates.length > 0) {
        priceCandidates.sort((a, b) => b.score - a.score);
        const bestCandidate = priceCandidates[0];
        productData.price = bestCandidate.text;
      }
    }

    // --- Extract Product Image ---
    if (selectors.image) {
      const imageSelectors = selectors.image.split(',').map(s => s.trim());
      for (const selector of imageSelectors) {
        const imageElement = document.querySelector(selector);
        if (imageElement) {
          let imageUrl =
            imageElement.src ||
            imageElement.getAttribute('data-src') ||
            imageElement.getAttribute('data-lazy-src') ||
            imageElement.getAttribute('data-old-src');
          if (imageUrl) {
            productData.image = imageUrl;
            break;
          }
        }
      }
    }

    // --- Fallback to Heuristics ---
    if (!productData.name) {
      productData.name = extractProductName();
    }
    if (!productData.price) {
      // For sites without specific logic, try selectors first, then heuristics
      if (selectors.price) {
        const priceSelectors = selectors.price.split(',').map(s => s.trim());
        // Match full price with decimals - ensure we capture .99, .00, etc.
        // Pattern: currency + optional space + digits + optional decimal point + 1-2 digits
        const priceRegex = /([$€£¥]\s?\d+\.\d{1,2}|[$€£¥]\s?\d+)/g; // Prioritize prices with decimals first
        
        // Collect all price candidates from all matching elements
        const priceCandidates = [];
        
        for (const selector of priceSelectors) {
          const priceElements = document.querySelectorAll(selector);
          
          for (const priceElement of priceElements) {
            const fullText = priceElement.textContent || priceElement.innerText || '';
            
            // Skip if text is too short or doesn't look like a price
            if (!fullText || fullText.trim().length < 3) continue;
            
            // Reset regex
            priceRegex.lastIndex = 0;
            const matches = fullText.match(priceRegex);
            
            if (matches && matches.length > 0) {
              // For each match, score it and add to candidates
              matches.forEach(match => {
                const priceText = match.trim();
                const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
                
                // Validate price is reasonable
                if (priceValue >= 0.5 && priceValue <= 100000) {
                  // Score: prioritize prices with decimals, then by value (higher = better for product prices)
                  let score = 0;
                  const hasDecimal = /\.\d{1,2}$/.test(priceText);
                  
                  if (hasDecimal) {
                    score += 1000; // Big boost for prices with decimals
                  }
                  
                  // Prefer prices in reasonable product range
                  if (priceValue >= 5 && priceValue <= 1000) {
                    score += 500;
                  }
                  
                  // Prefer longer price strings (more complete)
                  score += priceText.length * 10;
                  
                  priceCandidates.push({
                    text: priceText,
                    value: priceValue,
                    score: score
                  });
                }
              });
            }
          }
        }
        
        // Sort candidates by score (highest = best) and use the best one
        if (priceCandidates.length > 0) {
          priceCandidates.sort((a, b) => b.score - a.score);
          productData.price = priceCandidates[0].text;
        }
      }
      
      // If still no price, use heuristic function
      if (!productData.price) {
        productData.price = extractPrice();
      }
    }
    if (!productData.image) {
      productData.image = extractProductImage();
    }
    
  // ============================================================================
  // ABERCROMBIE-SPECIFIC EXTRACTION (with discount price support)
  // ============================================================================
  } else if (isAbercrombie) {
    // Guard: Verify this is actually a product page
    const hasTitleElement = selectors.name
      ? !!document.querySelector(selectors.name)
      : false;
    const hasPriceElement = selectors.price
      ? !!document.querySelector(selectors.price)
      : false;

    if (!hasTitleElement || !hasPriceElement) {
      const error = {
        type: ERROR_TYPES.NOT_PRODUCT_PAGE,
        message: `This isn't a product page.`,
        domain: domain,
        confidence: 100,
        indicators: ['Abercrombie: missing product title or price selectors']
      };
      throw error;
    }

    // --- Extract Product Name ---
    if (selectors.name) {
      // Try main header on main page (sub-item/variant title)
      const mainHeaderElement = document.querySelector('h1.product-title-component.product-title-main-header');
      if (mainHeaderElement) {
        productData.name = mainHeaderElement.textContent.trim();
      } else {
        // Fallback to regular product title
        const regularTitle = document.querySelector(selectors.name);
        if (regularTitle) {
          productData.name = regularTitle.textContent.trim();
        }
      }
    }

    // --- Extract Product Price (with Discount Detection) ---
    // Abercrombie displays both original and discount prices
    // Strategy: Prioritize discount price over original price
    if (selectors.price) {
      let priceText = null;
      let isDiscounted = false;
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/g; // Global flag to find all prices
      
      // METHOD 1: Try direct discount element first (most reliable)
      // span.product-price-text directly contains the discount price
      const directPriceElement = document.querySelector('span.product-price-text');
      if (directPriceElement) {
        const text = directPriceElement.textContent || directPriceElement.innerText || '';
        priceRegex.lastIndex = 0; // Reset regex for fresh match
        const match = text.match(priceRegex);
        if (match && match[0]) {
          priceText = match[0].trim();
          // Check if there's also an original price nearby to confirm discount
          const priceContainer = directPriceElement.closest('div.product-price-container') || 
                                 document.querySelector('div.product-price-container');
          if (priceContainer) {
            const containerText = priceContainer.textContent || priceContainer.innerText || '';
            priceRegex.lastIndex = 0;
            const allPrices = containerText.match(priceRegex);
            if (allPrices && allPrices.length >= 2) {
              isDiscounted = true; // Multiple prices = discount exists
            }
          }
        }
      }
      
      // METHOD 2: If direct element didn't work, search within price container
      if (!priceText) {
        const priceContainer = document.querySelector(selectors.price);
        if (priceContainer) {
          // Step 2a: Look for element with data-variant="discount" attribute
          const discountElement = priceContainer.querySelector('[data-variant="discount"]');
          if (discountElement) {
            isDiscounted = true;
            let discountText = extractPriceFromElement(discountElement);
            if (!discountText) {
              const text = discountElement.textContent || discountElement.innerText || '';
              priceRegex.lastIndex = 0;
              const match = text.match(priceRegex);
              if (match) {
                discountText = match[0];
              }
            }
            if (discountText && priceRegex.test(discountText)) {
              priceText = discountText.trim();
            }
          }
          
          // Step 2b: If no discount element, check span.product-price-text within container
          if (!priceText) {
            const priceTextElement = priceContainer.querySelector('span.product-price-text');
            if (priceTextElement) {
              const text = priceTextElement.textContent || priceTextElement.innerText || '';
              priceRegex.lastIndex = 0;
              const match = text.match(priceRegex);
              if (match) {
                priceText = match[0].trim();
                // Check wrapper for multiple prices to confirm discount
                const wrapper = priceContainer.querySelector('.product-price-text-wrapper');
                if (wrapper) {
                  const wrapperText = wrapper.textContent || wrapper.innerText || '';
                  priceRegex.lastIndex = 0;
                  const allPrices = wrapperText.match(priceRegex);
                  if (allPrices && allPrices.length >= 2) {
                    isDiscounted = true;
                  }
                }
              }
            }
          }
          
          // Step 2c: Check if price wrapper contains both prices (e.g., "$160\n$136")
          if (!priceText) {
            const priceWrapper = priceContainer.querySelector('.product-price-text-wrapper');
            if (priceWrapper) {
              const wrapperText = priceWrapper.textContent || priceWrapper.innerText || '';
              priceRegex.lastIndex = 0;
              const allPrices = wrapperText.match(priceRegex);
              if (allPrices && allPrices.length >= 2) {
                // Multiple prices found - extract and compare values
                const prices = allPrices.map(p => {
                  const value = parseFloat(p.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
                  return { text: p.trim(), value: value };
                });
                
                // Sort by value (ascending) - discount is usually the lower price
                prices.sort((a, b) => a.value - b.value);
                
                // Use the lower price as discount
                if (prices.length >= 2 && prices[0].value < prices[1].value) {
                  isDiscounted = true;
                  priceText = prices[0].text; // Lower price = discount
                } else {
                  priceText = prices[0].text; // Fallback to first price
                }
              } else if (allPrices && allPrices.length === 1) {
                priceText = allPrices[0].trim();
              }
            }
          }
          
          // Step 2d: Fallback to original price element (if no discount found)
          if (!priceText) {
            const originalElement = priceContainer.querySelector('[data-variant="original"]');
            if (originalElement) {
              let originalText = extractPriceFromElement(originalElement);
              if (!originalText) {
                const text = originalElement.textContent || originalElement.innerText || '';
                priceRegex.lastIndex = 0;
                const match = text.match(priceRegex);
                if (match) {
                  originalText = match[0];
                }
              }
              if (originalText && priceRegex.test(originalText)) {
                priceText = originalText.trim();
              }
            }
          }
          
          // Step 2e: Try wrapper with data-variant="discount" attribute
          if (!priceText) {
            const discountWrapper = priceContainer.querySelector('.product-price-text-wrapper[data-variant="discount"]');
            if (discountWrapper) {
              isDiscounted = true;
              let discountText = extractPriceFromElement(discountWrapper);
              if (!discountText) {
                const text = discountWrapper.textContent || discountWrapper.innerText || '';
                priceRegex.lastIndex = 0;
                const match = text.match(priceRegex);
                if (match) {
                  discountText = match[0];
                }
              }
              if (discountText && priceRegex.test(discountText)) {
                priceText = discountText.trim();
              }
            }
          }
          
          // Step 2f: Final fallback - use generic discount preference function
          if (!priceText) {
            priceText = extractPriceWithDiscountPreference(
              selectors.price,
              'data-variant',
              'discount',
              'original'
            );
            if (priceText && priceContainer.querySelector('[data-variant="discount"]')) {
              isDiscounted = true;
            }
          }
        }
      }
      
      // VALIDATION: If we detected a discount but got a high price, correct it
      // This handles cases where the extraction picked up the original price instead of discount
      if (priceText && isDiscounted) {
        const priceContainer = document.querySelector('div.product-price-container');
        if (priceContainer) {
          const containerText = priceContainer.textContent || priceContainer.innerText || '';
          priceRegex.lastIndex = 0;
          const allPrices = containerText.match(priceRegex);
          if (allPrices && allPrices.length >= 2) {
            const prices = allPrices.map(p => {
              const value = parseFloat(p.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
              return { text: p.trim(), value: value };
            });
            prices.sort((a, b) => a.value - b.value);
            
            // Compare current price with lowest price
            const currentValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
            
            // If current price is higher than the lowest, use the lowest (discount)
            if (prices[0].value < currentValue) {
              priceText = prices[0].text; // Correct to discount price
            }
          }
        }
      }
      
      // Store the extracted price if valid
      if (priceText) {
        const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
        if (priceValue >= 0.50 && priceValue <= 100000) {
          productData.price = priceText;
          if (isDiscounted) {
            productData.isDiscounted = true;
          }
        }
      }
      
      // METHOD 3: If all discount methods failed, try standard extraction
      if (!productData.price) {
        const priceSelectors = selectors.price.split(',').map(s => s.trim());
        const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
        
        for (const selector of priceSelectors) {
          const priceElement = document.querySelector(selector);
          if (priceElement) {
            let priceText = extractPriceFromElement(priceElement);
            if (!priceText) {
              priceText = priceElement.textContent || priceElement.innerText;
              if (priceText) {
                priceText = priceText.trim();
                const match = priceText.match(priceRegex);
                if (match) {
                  priceText = match[1];
                }
              }
            }
            
            if (priceText && priceRegex.test(priceText)) {
              const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
              if (priceValue >= 0.50 && priceValue <= 100000) {
                productData.price = priceText.trim();
                break;
              }
            }
          }
        }
      }
    }

    // --- Extract Product Image ---
    // Filter for large images (product images are typically 200x200px or larger)
    if (selectors.image) {
      const images = Array.from(document.querySelectorAll('img'));
      const productImages = images.filter(img => {
        const rect = img.getBoundingClientRect();
        const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
        if (!src || img.offsetParent === null) return false;
        // Filter for large images (likely product images, not icons)
        return rect.width >= 200 && rect.height >= 200;
      });
      
      // Sort by size (largest first) - biggest image is usually the main product image
      productImages.sort((a, b) => {
        const aRect = a.getBoundingClientRect();
        const bRect = b.getBoundingClientRect();
        return (bRect.width * bRect.height) - (aRect.width * aRect.height);
      });
      
      if (productImages.length > 0) {
        const img = productImages[0];
        productData.image = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      }
    }

    // --- Fallback to Heuristics ---
    if (!productData.name) {
      productData.name = extractProductName();
    }
    if (!productData.price) {
      productData.price = extractPrice();
    }
    if (!productData.image) {
      productData.image = extractProductImage();
    }
  // ============================================================================
  // GENERIC EXTRACTION (for all other supported sites)
  // ============================================================================
  } else {
    // For other sites (Best Buy, Target, Temu, etc.), use generic extraction:
    // 1. Try site-specific selectors first
    // 2. Fall back to heuristic functions if selectors don't work
    
    // --- Extract Product Name ---
    if (selectors.name) {
      const nameElement = document.querySelector(selectors.name);
      if (nameElement) {
        productData.name = nameElement.textContent.trim();
      }
    }
    
    // --- Extract Product Price ---
    if (selectors.price) {
      const priceSelectors = selectors.price.split(',').map(s => s.trim());
      // Use global regex to find all price matches, prioritize ones with decimals
      const priceRegex = /([$€£¥]\s?\d+\.\d{1,2}|[$€£¥]\s?\d+)/g;
      
      // Collect all price candidates from all matching elements
      const priceCandidates = [];
      
      // Try each price selector (some sites have multiple fallback selectors)
      for (const selector of priceSelectors) {
        // Some selectors may match multiple elements (e.g., multiple prices on page)
        const priceElements = document.querySelectorAll(selector);
        
        // Check each matching element
        for (const priceElement of priceElements) {
          const fullText = priceElement.textContent || priceElement.innerText || '';
          
          // Skip if text is too short
          if (!fullText || fullText.trim().length < 3) continue;
          
          // Reset regex and find all price matches
          priceRegex.lastIndex = 0;
          const matches = fullText.match(priceRegex);
          
          if (matches && matches.length > 0) {
            // For each match, score it and add to candidates
            matches.forEach(match => {
              const priceText = match.trim();
              const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
              
              // Validate price is reasonable
              if (priceValue >= 0.5 && priceValue <= 100000) {
                // Score: prioritize prices with decimals, then by value
                let score = 0;
                const hasDecimal = /\.\d{1,2}$/.test(priceText);
                
                if (hasDecimal) {
                  score += 10000; // Very large boost for prices with decimals
                }
                
                // Prefer prices in reasonable product range
                if (priceValue >= 5 && priceValue <= 1000) {
                  score += 5000;
                }
                
                // Prefer longer price strings (more complete)
                score += priceText.length * 100;
                
                priceCandidates.push({
                  text: priceText,
                  value: priceValue,
                  score: score
                });
              }
            });
          }
        }
      }
      
      // Sort candidates by score (highest = best) and use the best one
      if (priceCandidates.length > 0) {
        priceCandidates.sort((a, b) => b.score - a.score);
        productData.price = priceCandidates[0].text;
      }
    }
    
    // --- Extract Product Image ---
    if (selectors.image) {
      const imageSelectors = selectors.image.split(',').map(s => s.trim());
      for (const selector of imageSelectors) {
        const imageElement = document.querySelector(selector);
        if (imageElement) {
          let imageUrl = imageElement.src || 
                        imageElement.getAttribute('data-src') || 
                        imageElement.getAttribute('data-lazy-src') ||
                        imageElement.getAttribute('data-old-src');
          if (imageUrl) {
            productData.image = imageUrl;
            break;
          }
        }
      }
    }
    
    // --- Fallback to Heuristics ---
    // If site-specific selectors didn't work, use heuristic functions
    if (!productData.name) {
      productData.name = extractProductName();
    }
    if (!productData.price) {
      productData.price = extractPrice();
    }
    if (!productData.image) {
      productData.image = extractProductImage();
    }
  }

  // ============================================================================
  // STEP 6: VALIDATE AND RETURN RESULTS
  // ============================================================================
  // Ensure we extracted at least some product information
  if (!productData.name && !productData.image && !productData.price) {
    throw new Error('Could not find product information on this page. Make sure you are on a product page.');
  }

  return productData;
}

