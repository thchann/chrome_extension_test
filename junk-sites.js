/**
 * Junk Sites Storage Management
 * Manages a list of unsupported sites that have been checked and confirmed as not supported
 */

const JUNK_SITES_KEY = 'junkSites';

/**
 * Check if a domain is in the junk sites list
 * @param {string} domain - The domain to check
 * @returns {Promise<boolean>} - True if domain is in junk list
 */
async function isJunkSite(domain) {
  try {
    const result = await chrome.storage.local.get(JUNK_SITES_KEY);
    const junkSites = result[JUNK_SITES_KEY] || [];
    return junkSites.includes(domain);
  } catch (error) {
    console.error('Error checking junk sites:', error);
    return false;
  }
}

/**
 * Add a domain to the junk sites list
 * @param {string} domain - The domain to add
 * @returns {Promise<void>}
 */
async function addToJunkSites(domain) {
  try {
    const result = await chrome.storage.local.get(JUNK_SITES_KEY);
    const junkSites = result[JUNK_SITES_KEY] || [];
    
    if (!junkSites.includes(domain)) {
      junkSites.push(domain);
      await chrome.storage.local.set({ [JUNK_SITES_KEY]: junkSites });
    }
  } catch (error) {
    console.error('Error adding to junk sites:', error);
  }
}

/**
 * Get all junk sites
 * @returns {Promise<Array<string>>} - Array of junk site domains
 */
async function getJunkSites() {
  try {
    const result = await chrome.storage.local.get(JUNK_SITES_KEY);
    return result[JUNK_SITES_KEY] || [];
  } catch (error) {
    console.error('Error getting junk sites:', error);
    return [];
  }
}

/**
 * Clear all junk sites (for testing/debugging)
 * @returns {Promise<void>}
 */
async function clearJunkSites() {
  try {
    await chrome.storage.local.remove(JUNK_SITES_KEY);
  } catch (error) {
    console.error('Error clearing junk sites:', error);
  }
}

