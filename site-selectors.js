// Site-specific CSS selectors for product extraction
const SITE_SELECTORS = {
  'amazon.com': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'amazon.co.uk': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'amazon.de': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'amazon.fr': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'amazon.ca': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'amazon.co.jp': {
    name: '#productTitle',
    image: '#landingImage, #imgBlkFront',
    price: '.a-price .a-offscreen, #priceblock_ourprice, #priceblock_dealprice, .a-price-whole, span.a-price'
  },
  'ebay.com': {
    name: 'h1.x-item-title__mainTitle, h1.textual-display, h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: 'img[src*="ebayimg.com"], #icImg, img[itemprop="image"], .img.img500, #mainImgHldr img, img.brw-product-card__image',
    price: 'div.x-price-primary, div.x-bin-price__content, span.textual-display, .notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  'ebay.co.uk': {
    name: 'h1.x-item-title__mainTitle, h1.textual-display, h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: 'img[src*="ebayimg.com"], #icImg, img[itemprop="image"], .img.img500, #mainImgHldr img, img.brw-product-card__image',
    price: 'div.x-price-primary, div.x-bin-price__content, span.textual-display, .notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  'ebay.de': {
    name: 'h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: '#icImg, img[itemprop="image"], .img.img500, #mainImgHldr img',
    price: '.notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  'ebay.fr': {
    name: 'h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: '#icImg, img[itemprop="image"], .img.img500, #mainImgHldr img',
    price: '.notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  'ebay.ca': {
    name: 'h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: '#icImg, img[itemprop="image"], .img.img500, #mainImgHldr img',
    price: '.notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  'ebay.com.au': {
    name: 'h1[data-testid="x-item-title-label"], #x-item-title-label, h1.it-ttl, .x-item-title-label, h1.it-ttl',
    image: '#icImg, img[itemprop="image"], .img.img500, #mainImgHldr img',
    price: '.notranslate[itemprop="price"], #prcIsum, .u-flL.condText, .notranslate, .u-flL.condText .notranslate'
  },
  // Alibaba
  'alibaba.com': {
    name: '',
    image: '',
    price: ''
  },
  // JD.com
  'jd.com': {
    name: '',
    image: '',
    price: ''
  },
  // Shopee
  'shopee.com': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.sg': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.co.id': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.com.my': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.ph': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.co.th': {
    name: '',
    image: '',
    price: ''
  },
  'shopee.vn': {
    name: '',
    image: '',
    price: ''
  },
  // Walmart
  'walmart.com': {
    name: '#main-title',
    image: 'img.db',
    price: 'span'
  },
  // Target
  'target.com': {
    name: '#pdp-product-title-id',
    price: 'div.styles_priceFullLineHeight__BgU9C',
    image: 'img'
  },
  // Best Buy
  'bestbuy.com': {
    name: 'h1.h4',
    image: 'img[fetchpriority="high"], img[loading="eager"][alt*="iPad"], img.flex.grow',
    price: 'div.price-container, div.standard-layout__middle-block_price, span.font-sans'
  },
  // Etsy
  'etsy.com': {
    name: 'h1.wt-line-height-tight',
    price: '.wt-text-title-larger.wt-mr-xs-1.wt-text-black .wt-screen-reader-only, .wt-screen-reader-only, div.n-listing-card__price',
    image: 'img.wt-max-width-full'
  },
  // Wayfair
  'wayfair.com': {
    name: '',
    image: '',
    price: ''
  },
  // Chewy
  'chewy.com': {
    name: '',
    image: '',
    price: ''
  },
  // Newegg
  'newegg.com': {
    name: '',
    image: '',
    price: ''
  },
  // Temu
  'temu.com': {
    name: '',
    image: 'img._3eDhqCfZ',
    price: 'div._1vkz0rqG'
  },
  // Abercrombie
  'abercrombie.com': {
    name: 'h1.product-title-component',
    price: 'span.product-price-text, div.product-price-container',
    image: 'img'
  },
  // Pacsun
  'pacsun.com': {
    name: '',
    image: '',
    price: ''
  },
  // Aeropostale
  'aeropostale.com': {
    name: '',
    image: '',
    price: ''
  }
};

/**
 * Get the base domain from a URL
 * @param {string} url - The full URL
 * @returns {string} - The base domain (e.g., 'amazon.com')
 */
function getBaseDomain(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    
    // Remove 'www.' prefix if present
    const domain = hostname.replace(/^www\./, '');
    
    return domain;
  } catch (e) {
    console.error('Error parsing URL:', e);
    return '';
  }
}

/**
 * Get selectors for the current site
 * @param {string} url - The current page URL
 * @returns {Object|null} - Selectors object or null if not found
 */
function getSelectorsForSite(url) {
  const domain = getBaseDomain(url);
  
  // Try exact match first
  if (SITE_SELECTORS[domain]) {
    return SITE_SELECTORS[domain];
  }
  
  // Try to match parent domain (e.g., 'amazon.com' for 'smile.amazon.com')
  const domainParts = domain.split('.');
  if (domainParts.length > 2) {
    const parentDomain = domainParts.slice(-2).join('.');
    if (SITE_SELECTORS[parentDomain]) {
      return SITE_SELECTORS[parentDomain];
    }
  }
  
  return null;
}

/**
 * Get list of all supported site domains
 * @returns {Array<string>} - Array of supported domain names
 */
function getSupportedSitesList() {
  return Object.keys(SITE_SELECTORS);
}

/**
 * Check if a domain is in the supported sites list
 * @param {string} domain - The domain to check
 * @returns {boolean} - True if domain is supported
 */
function isSupportedSite(domain) {
  // Check exact match
  if (SITE_SELECTORS[domain]) {
    return true;
  }
  
  // Check parent domain match
  const domainParts = domain.split('.');
  if (domainParts.length > 2) {
    const parentDomain = domainParts.slice(-2).join('.');
    if (SITE_SELECTORS[parentDomain]) {
      return true;
    }
  }
  
  return false;
}

