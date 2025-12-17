# Product Extractor Chrome Extension

A Chrome extension that extracts product name, price, and image from e-commerce websites. Currently supports Amazon and eBay, and is designed for easy expansion to other sites.

## Features

- Extract product name from product pages
- Extract product price
- Extract product image URL
- Export data in JSON format
- Copy to clipboard functionality
- Support for multiple Amazon domains (amazon.com, amazon.co.uk, etc.)

## Installation

### Step 1: Download or Clone
Make sure you have all the extension files in a folder on your computer.

### Step 2: Create Icon Files
The extension requires icon files. Create a folder named `icons` in the extension directory and add the following icon files:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

**Quick Option:** Open `create-icons.html` in your browser and click the download buttons to generate placeholder icons automatically. Save the downloaded files in the `icons` folder.

**Manual Option:** You can create simple icons or use placeholder images. If you don't have icons, you can temporarily use any PNG images with the correct dimensions, or create simple colored squares.

### Step 3: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the folder containing the extension files
5. The extension should now appear in your extensions list

### Step 4: Pin the Extension (Optional)
1. Click the puzzle piece icon (Extensions) in the Chrome toolbar
2. Find "Product Extractor" and click the pin icon to keep it visible in your toolbar

## Usage

1. Navigate to a product page on a supported e-commerce site (e.g., Amazon)
2. Click the Product Extractor extension icon in your Chrome toolbar
3. Click the **"Extract Product Info"** button
4. The extension will extract the product name and image URL
5. View the JSON output in the popup
6. Click **"Copy JSON"** to copy the data to your clipboard

## Supported Sites

Currently supported:
- **Amazon** (amazon.com, amazon.co.uk, amazon.de, amazon.fr, amazon.ca, amazon.co.jp)
- **eBay** (ebay.com, ebay.co.uk, ebay.de, ebay.fr, ebay.ca, ebay.com.au)
- **Alibaba** (alibaba.com)
- **JD.com** (jd.com)
- **Shopee** (shopee.com, shopee.sg, shopee.co.id, shopee.com.my, shopee.ph, shopee.co.th, shopee.vn)
- **Walmart** (walmart.com)
- **Target** (target.com)
- **Best Buy** (bestbuy.com)
- **Etsy** (etsy.com)
- **Wayfair** (wayfair.com)
- **Chewy** (chewy.com)
- **Newegg** (newegg.com)
- **Temu** (temu.com)
- **Abercrombie** (abercrombie.com)
- **Pacsun** (pacsun.com)
- **Aeropostale** (aeropostale.com)
- **Shopify stores** (most stores using Shopify platform)

Note: Most sites use heuristic extraction (automatic detection), while Amazon uses specific selectors for better accuracy.

## Adding Support for New Sites

To add support for a new e-commerce site:

1. Open `site-selectors.js`
2. Add a new entry to the `SITE_SELECTORS` object:

```javascript
'example.com': {
  name: '#product-title',  // CSS selector for product name
  price: '.product-price',  // CSS selector for product price
  image: '.product-image img'  // CSS selector for product image
}
```

3. The selectors should target:
   - **name**: The element containing the product name/title
   - **price**: The element containing the product price
   - **image**: The `<img>` element or container with the product image

4. Save the file and reload the extension in `chrome://extensions/`

### Finding CSS Selectors

#### Method 1: Using the Selector Finder Tool (Recommended)

The extension includes an automated selector finder tool that analyzes product pages and suggests the best selectors.

1. Open a product page on the website you want to add
2. Open Chrome DevTools (F12 or Right-click → Inspect)
3. Go to the Console tab
4. Copy the contents of `selector-finder.js` and paste it into the console, then press Enter
5. Run: `findProductSelectors()`
6. The tool will display:
   - Top 5 suggested selectors for name, price, and image
   - Confidence scores for each selector
   - Ready-to-copy code for `site-selectors.js`
7. Copy the suggested selectors and add them to `site-selectors.js`

#### Method 2: Manual Inspection

1. Open the product page in Chrome
2. Right-click on the product name and select "Inspect"
3. In the DevTools, right-click on the highlighted element and select "Copy" > "Copy selector"
4. Use this selector (or a simpler version) in `site-selectors.js`

## Output Format

The extension returns JSON data in this format:

```json
{
  "name": "Product Name Here",
  "price": "$29.99",
  "image": "https://example.com/image.jpg",
  "site": "amazon.com",
  "url": "https://amazon.com/product-page",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

## Troubleshooting

### Extension doesn't appear
- Make sure Developer mode is enabled in `chrome://extensions/`
- Check that all files are in the same folder
- Verify that `manifest.json` is valid JSON

### "Site not supported" error
- The current website is not yet supported
- Add support by following the "Adding Support for New Sites" section above

### "Could not find product information" error
- Make sure you are on a product page (not a category or search page)
- The CSS selectors might need to be updated if the website changed its structure
- Check the browser console (F12) for more details

### No data extracted
- The page structure might have changed
- Update the selectors in `site-selectors.js` for that site
- Some sites load content dynamically - try waiting a moment before clicking extract

### Copy to clipboard doesn't work
- Make sure you're using a modern browser (Chrome 66+)
- Check browser permissions for clipboard access

## Development

### File Structure
```
chrome_extension_test/
├── manifest.json          # Extension configuration
├── popup.html             # Extension popup UI
├── popup.js               # Popup logic and communication
├── content.js             # DOM extraction logic
├── site-selectors.js      # Site-specific CSS selectors
├── styles.css             # Popup styling
├── icons/                 # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # This file
```

### Reloading the Extension
After making changes:
1. Go to `chrome://extensions/`
2. Click the reload icon on the Product Extractor card
3. Test your changes

## License

This project is provided as-is for educational and personal use.

