document.addEventListener('DOMContentLoaded', function() {
  const extractBtn = document.getElementById('extractBtn');
  const copyBtn = document.getElementById('copyBtn');
  const statusDiv = document.getElementById('status');
  const resultsDiv = document.getElementById('results');
  const jsonOutput = document.getElementById('jsonOutput');
  const errorDiv = document.getElementById('error');

  // Extract button click handler
  extractBtn.addEventListener('click', async function() {
    // Reset UI
    statusDiv.textContent = 'Extracting product information...';
    statusDiv.className = 'status-message loading';
    resultsDiv.style.display = 'none';
    errorDiv.style.display = 'none';
    extractBtn.disabled = true;

    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) {
        throw new Error('No active tab found');
      }

      // Inject content script and send message
      const response = await chrome.tabs.sendMessage(tab.id, { action: 'extractProduct' });

      if (!response || !response.success) {
        throw new Error(response?.error || 'Failed to extract product information');
      }

      // Display results
      const jsonData = JSON.stringify(response.data, null, 2);
      jsonOutput.textContent = jsonData;
      resultsDiv.style.display = 'block';
      statusDiv.textContent = 'Product information extracted successfully!';
      statusDiv.className = 'status-message success';
      
    } catch (error) {
      console.error('Error:', error);
      errorDiv.textContent = error.message || 'Failed to extract product information. Make sure you are on a supported e-commerce site.';
      errorDiv.style.display = 'block';
      statusDiv.textContent = 'Extraction failed';
      statusDiv.className = 'status-message error';
    } finally {
      extractBtn.disabled = false;
    }
  });

  // Copy button click handler
  copyBtn.addEventListener('click', function() {
    const jsonText = jsonOutput.textContent;
    
    navigator.clipboard.writeText(jsonText).then(function() {
      // Show feedback
      const originalText = copyBtn.textContent;
      copyBtn.textContent = 'Copied!';
      copyBtn.classList.add('copied');
      
      setTimeout(function() {
        copyBtn.textContent = originalText;
        copyBtn.classList.remove('copied');
      }, 2000);
    }).catch(function(err) {
      console.error('Failed to copy:', err);
      errorDiv.textContent = 'Failed to copy to clipboard';
      errorDiv.style.display = 'block';
    });
  });
});

