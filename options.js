// Saves options to chrome.storage
function saveOptions() {
  const apiKey = document.getElementById('api-key').value;
  const apiEndpoint = document.getElementById('api-endpoint').value;
  const model = document.getElementById('model').value;
  
  chrome.storage.local.set(
    {
      apiKey: apiKey,
      apiEndpoint: apiEndpoint,
      model: model
    },
    () => {
      // Update status to let user know options were saved
      const saveButton = document.getElementById('save');
      const originalText = saveButton.textContent;
      
      saveButton.textContent = 'Saved!';
      saveButton.disabled = true;
      
      setTimeout(() => {
        saveButton.textContent = originalText;
        saveButton.disabled = false;
      }, 1500);
    }
  );
}

// Restores input values using the preferences stored in chrome.storage
function restoreOptions() {
  chrome.storage.local.get(
    {
      apiKey: '', // Default to empty string if not set
      apiEndpoint: 'https://api.openai.com/v1/chat/completions', // Default endpoint
      model: 'gpt-4o' // Default model
    },
    (items) => {
      document.getElementById('api-key').value = items.apiKey;
      document.getElementById('api-endpoint').value = items.apiEndpoint;
      document.getElementById('model').value = items.model;
    }
  );
}

// Event listeners
document.addEventListener('DOMContentLoaded', restoreOptions);
document.getElementById('save').addEventListener('click', saveOptions);

// Save when Enter key is pressed in any input field
const inputFields = ['api-key', 'api-endpoint', 'model'];
inputFields.forEach(fieldId => {
  document.getElementById(fieldId).addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      saveOptions();
    }
  });
});