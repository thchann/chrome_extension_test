// Listen for messages from popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if (request.action === 'extractProduct') {
    try {
      const result = extractProductInfo();
      sendResponse({ success: true, data: result });
    } catch (error) {
      sendResponse({ 
        success: false, 
        error: error.message || 'Failed to extract product information' 
      });
    }
  }
  return true; // Keep the message channel open for async response
});

/**
 * Heuristic function to extract product name from h1 elements
 * @returns {string|null} - Product name or null
 */
function extractProductName() {
  const headings = Array.from(document.querySelectorAll("h1"));
  if (headings.length === 0) return null;

  const candidates = headings
    .filter(el => el.innerText.trim().length > 0)
    .map(el => {
      const rect = el.getBoundingClientRect();
      return {
        text: el.innerText.trim(),
        score: rect.top + el.innerText.length * 0.5
      };
    });

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.text || null;
}

/**
 * Helper function to extract price from element, handling superscript decimals
 * @param {HTMLElement} el - The element to extract price from
 * @returns {string|null} - Extracted price or null
 */
function extractPriceFromElement(el) {
  const currencyRegex = /([$€£¥])\s?(\d+)/;
  const text = el.innerText?.trim() || '';
  
  // First, try to find price with superscript
  // Look for currency symbol followed by digits, then check for superscript nearby
  const match = text.match(currencyRegex);
  if (match) {
    const currency = match[1];
    const mainPrice = match[2];
    
    // Check for superscript elements within this element or nearby
    // Superscript could be in <sup> tags or styled with vertical-align
    const superscripts = el.querySelectorAll('sup, [style*="vertical-align"], [style*="font-size"]');
    
    for (const sup of superscripts) {
      const supText = sup.textContent?.trim() || '';
      // Check if superscript contains 1-3 digits (likely cents)
      const supMatch = supText.match(/^(\d{1,3})$/);
      if (supMatch) {
        const cents = supMatch[1].padStart(2, '0'); // Ensure 2 digits
        return `${currency}${mainPrice}.${cents}`;
      }
    }
    
    // Also check sibling elements that might be superscript
    if (el.parentElement) {
      const siblings = Array.from(el.parentElement.children);
      const elIndex = siblings.indexOf(el);
      
      // Check next sibling
      if (elIndex >= 0 && elIndex < siblings.length - 1) {
        const nextSibling = siblings[elIndex + 1];
        const nextText = nextSibling.textContent?.trim() || '';
        const nextMatch = nextText.match(/^(\d{1,3})$/);
        
        // Check if it's styled as superscript
        const styles = window.getComputedStyle(nextSibling);
        const isSuperscript = nextSibling.tagName === 'SUP' || 
                             styles.verticalAlign === 'super' ||
                             styles.fontSize < styles.fontSize; // Smaller font might indicate superscript
        
        if (nextMatch && isSuperscript) {
          const cents = nextMatch[1].padStart(2, '0');
          return `${currency}${mainPrice}.${cents}`;
        }
      }
    }
    
    // If no superscript found, return the regular price
    return match[0];
  }
  
  // Fallback: try to match full price pattern
  const fullMatch = text.match(/([$€£¥]\s?\d+(?:[\.,]\d+)?)/);
  return fullMatch ? fullMatch[1] : null;
}

/**
 * Heuristic function to extract price using currency pattern matching
 * @returns {string|null} - Price or null
 */
function extractPrice() {
  const currencyRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
  
  // Get product name position for proximity scoring
  const productName = extractProductName();
  let nameElement = null;
  if (productName) {
    const headings = Array.from(document.querySelectorAll("h1"));
    nameElement = headings.find(h => h.innerText.trim() === productName);
  }

  const elements = Array.from(document.querySelectorAll("body *"));
  
  // Words that indicate this is NOT the main product price
  const excludeWords = ['shipping', 'delivery', 'was', 'save', 'from', 'starting at', 'each', 'per', 'tax', 'fee', 'original', 'list', 'msrp'];
  
  const candidates = elements
    .filter(el => {
      if (el.offsetParent === null) return false;
      
      // Try to extract price (handles superscript) - check if element has a price
      const priceText = extractPriceFromElement(el);
      const text = el.innerText?.trim() || '';
      
      // Must have either extracted price or currency pattern in text
      if (!priceText && !currencyRegex.test(text)) return false;
      if (text.length > 50) return false;
      
      // Filter out elements with exclude words
      const textLower = text.toLowerCase();
      if (excludeWords.some(word => textLower.includes(word))) return false;
      
      // Extract the price value to check if it's reasonable
      const finalPrice = priceText || (text.match(currencyRegex)?.[1]);
      if (finalPrice) {
        const priceValue = parseFloat(finalPrice.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
        
        // Filter out very small prices (likely shipping, fees, etc.)
        if (priceValue < 0.50) return false;
        
        // Filter out extremely large prices (likely errors or total cart values)
        if (priceValue > 100000) return false;
      }
      
      return true;
    })
    .map(el => {
      const rect = el.getBoundingClientRect();
      
      // Try to extract price, handling superscript decimals
      let priceText = extractPriceFromElement(el);
      if (!priceText) {
        // Fallback to regex match
        const match = el.innerText.match(currencyRegex);
        if (!match) return null;
        priceText = match[1];
      }
      
      const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
      
      // Calculate score - prefer prices that are:
      // 1. Higher on the page (lower top value)
      // 2. Closer to the product name
      // 3. In a reasonable price range (not too small, not too large)
      // 4. More prominent (larger font size)
      
      let score = rect.top; // Prefer higher on page
      
      // Boost score if near product name
      if (nameElement) {
        const nameRect = nameElement.getBoundingClientRect();
        const verticalDistance = Math.abs(rect.top - nameRect.bottom);
        if (verticalDistance < 500) { // Within 500px of product name
          score -= 200; // Boost this price
        }
      }
      
      // Boost score for reasonable prices (between $5 and $5000)
      if (priceValue >= 5 && priceValue <= 5000) {
        score -= 100;
      }
      
      // Boost score for larger font sizes (more prominent)
      const fontSize = window.getComputedStyle(el).fontSize;
      const fontSizeNum = parseFloat(fontSize);
      if (fontSizeNum > 20) {
        score -= 50; // Boost larger fonts
      }
      
      // Penalize very small prices
      if (priceValue < 5) {
        score += 300;
      }
      
      // Penalize prices on the far right (often shipping info)
      if (rect.left > window.innerWidth * 0.7) {
        score += 150;
      }
      
      return {
        price: priceText,
        score: score,
        priceValue: priceValue
      };
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => a.score - b.score);
  return candidates[0]?.price || null;
}

/**
 * Heuristic function to extract product image
 * @returns {string|null} - Image URL or null
 */
function extractProductImage() {
  const images = Array.from(document.querySelectorAll("img"));
  if (images.length === 0) return null;

  const candidates = images
    .filter(img => {
      // Filter out very small images (likely icons)
      const rect = img.getBoundingClientRect();
      if (rect.width < 100 || rect.height < 100) return false;
      
      // Filter out hidden images
      if (img.offsetParent === null) return false;
      
      // Must have a valid src
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src');
      if (!src || src.trim() === '') return false;
      
      // Filter out common non-product images
      const srcLower = src.toLowerCase();
      if (srcLower.includes('logo') || 
          srcLower.includes('icon') || 
          srcLower.includes('avatar') ||
          srcLower.includes('spinner') ||
          srcLower.includes('placeholder')) {
        return false;
      }
      
      return true;
    })
    .map(img => {
      const rect = img.getBoundingClientRect();
      const src = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy-src') || img.getAttribute('data-old-src');
      
      // Score based on size and position (larger, higher up images score better)
      const area = rect.width * rect.height;
      const score = area - rect.top * 10; // Prefer larger images that are higher on the page
      
      return {
        url: src,
        score: score
      };
    });

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => b.score - a.score); // Sort descending (highest score first)
  return candidates[0]?.url || null;
}

/**
 * Extract product information from the current page
 * @returns {Object} - Product data object
 */
function extractProductInfo() {
  const url = window.location.href;
  const domain = getBaseDomain(url);
  const selectors = getSelectorsForSite(url);
  
  if (!selectors) {
    throw new Error(`Site not supported: ${domain}. Currently supported: Amazon, eBay, Alibaba, JD.com, Shopee, Walmart, Target, Best Buy, Etsy, Wayfair, Chewy, Newegg, Temu, Abercrombie, Pacsun, Aeropostale, and Shopify stores.`);
  }

  const productData = {
    name: null,
    image: null,
    price: null,
    site: domain,
    url: url,
    timestamp: new Date().toISOString()
  };

  const isAmazon = domain.includes('amazon.');
  
  if (isAmazon) {
    // For Amazon, try specific selectors first (more reliable)
    // Extract product name
    if (selectors.name) {
      const nameElement = document.querySelector(selectors.name);
      if (nameElement) {
        productData.name = nameElement.textContent.trim();
      }
    }
    
    // Extract product price
    if (selectors.price) {
      const priceSelectors = selectors.price.split(',').map(s => s.trim());
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
      
      for (const selector of priceSelectors) {
        const priceElement = document.querySelector(selector);
        if (priceElement) {
          // Try to extract price with superscript handling first
          let priceText = extractPriceFromElement(priceElement);
          
          // If that didn't work, try traditional method
          if (!priceText) {
            // Get full text content (handles prices split across child elements)
            priceText = priceElement.textContent || priceElement.innerText;
            if (!priceText || priceText.trim() === '') {
              priceText = priceElement.getAttribute('aria-label') || priceElement.title;
            }
            
            if (priceText) {
              priceText = priceText.trim();
              
              // Use regex to extract the full price pattern (ensures we get decimals)
              const priceMatch = priceText.match(priceRegex);
              if (priceMatch) {
                priceText = priceMatch[1];
              } else {
                // Fallback: clean up and use the text if no regex match
                priceText = priceText.replace(/^\s*Price:\s*/i, '');
                priceText = priceText.replace(/\s*each\s*$/i, '');
              }
            }
          }
          
          if (priceText && priceText.trim()) {
            productData.price = priceText.trim();
            break;
          }
        }
      }
    }
    
    // Extract product image
    if (selectors.image) {
      const imageSelectors = selectors.image.split(',').map(s => s.trim());
      for (const selector of imageSelectors) {
        const imageElement = document.querySelector(selector);
        if (imageElement) {
          let imageUrl = imageElement.src || 
                        imageElement.getAttribute('data-src') || 
                        imageElement.getAttribute('data-lazy-src') ||
                        imageElement.getAttribute('data-old-src');
          
          if (!imageUrl && imageElement.hasAttribute('data-a-dynamic-image')) {
            try {
              const dynamicImage = JSON.parse(imageElement.getAttribute('data-a-dynamic-image'));
              const imageKeys = Object.keys(dynamicImage);
              if (imageKeys.length > 0) {
                imageUrl = imageKeys[0];
              }
            } catch (e) {
              console.warn('Failed to parse Amazon dynamic image data:', e);
            }
          }
          
          if (imageUrl) {
            productData.image = imageUrl;
            break;
          }
        }
      }
    }
    
    // Fallback to heuristics if selectors didn't work
    if (!productData.name) {
      productData.name = extractProductName();
    }
    if (!productData.price) {
      productData.price = extractPrice();
    }
    if (!productData.image) {
      productData.image = extractProductImage();
    }
  } else {
    // For other sites, try selectors first if available, then fall back to heuristics
    // Extract product name
    if (selectors.name) {
      const nameElement = document.querySelector(selectors.name);
      if (nameElement) {
        productData.name = nameElement.textContent.trim();
      }
    }
    
    // Extract product price
    if (selectors.price) {
      const priceSelectors = selectors.price.split(',').map(s => s.trim());
      const priceRegex = /([$€£¥]\s?\d+(?:[\.,]\d+)?)/;
      
      for (const selector of priceSelectors) {
        // For selectors that might match multiple elements, try all of them
        const priceElements = document.querySelectorAll(selector);
        
        for (const priceElement of priceElements) {
          let priceText = extractPriceFromElement(priceElement);
          if (!priceText) {
            priceText = priceElement.textContent || priceElement.innerText;
            if (priceText) {
              priceText = priceText.trim();
              const priceMatch = priceText.match(priceRegex);
              if (priceMatch) {
                priceText = priceMatch[1];
              }
            }
          }
          
          // Validate that we got an actual price (not just text like "Assistive Survey")
          if (priceText && priceRegex.test(priceText)) {
            // Additional validation: make sure it's not just a few characters
            const priceValue = parseFloat(priceText.replace(/[$€£¥\s,]/g, '').replace(',', '.'));
            if (priceValue >= 0.50 && priceValue <= 100000) {
              productData.price = priceText.trim();
              break; // Found a valid price, stop searching
            }
          }
        }
        
        // If we found a price, stop trying other selectors
        if (productData.price) break;
      }
    }
    
    // Extract product image
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
    
    // Fallback to heuristics if selectors didn't work
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


  // Validate that we got at least some data
  if (!productData.name && !productData.image && !productData.price) {
    throw new Error('Could not find product information on this page. Make sure you are on a product page.');
  }

  return productData;
}

