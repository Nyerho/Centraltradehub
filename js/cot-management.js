// COT Management Functions
async function loadCurrentCotCode() {
  try {
    if (!window.db) {
      console.error('Firestore not initialized');
      return;
    }
    
    const docRef = window.db.collection('admin').doc('withdrawal-settings');
    const doc = await docRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      document.getElementById('current-cot-code').value = data.cotCode || '';
      document.getElementById('cot-last-updated').textContent = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never';
      document.getElementById('cot-updated-by').textContent = data.updatedBy || 'N/A';
    } else {
      // Initialize with default COT code
      await initializeCotSettings();
    }
  } catch (error) {
    console.error('Error loading COT code:', error);
    showToast('Error loading COT settings: ' + error.message, 'error');
  }
}

async function initializeCotSettings() {
  try {
    const defaultCotCode = generateRandomCotCode();
    const cotData = {
      cotCode: defaultCotCode,
      lastUpdated: new Date().toISOString(),
      updatedBy: window.currentUser?.email || 'admin',
      createdAt: new Date().toISOString()
    };
    
    await window.db.collection('admin').doc('withdrawal-settings').set(cotData);
    document.getElementById('current-cot-code').value = defaultCotCode;
    document.getElementById('cot-last-updated').textContent = new Date().toLocaleString();
    document.getElementById('cot-updated-by').textContent = cotData.updatedBy;
    
    showToast('COT settings initialized with random code', 'success');
  } catch (error) {
    console.error('Error initializing COT settings:', error);
  }
}

async function updateCotCode() {
  try {
    let newCode = document.getElementById('new-cot-code').value.trim();
    
    if (!newCode) {
      newCode = generateRandomCotCode();
    }
    
    if (newCode.length < 4) {
      showToast('COT code must be at least 4 characters long', 'error');
      return;
    }
    
    if (!window.db) {
      console.error('Firestore not initialized');
      showToast('Database not available', 'error');
      return;
    }
    
    const cotData = {
      cotCode: newCode,
      lastUpdated: new Date().toISOString(),
      updatedBy: window.currentUser?.email || 'admin'
    };
    
    await window.db.collection('admin').doc('withdrawal-settings').set(cotData, { merge: true });
    document.getElementById('current-cot-code').value = newCode;
    document.getElementById('new-cot-code').value = '';
    document.getElementById('cot-last-updated').textContent = new Date().toLocaleString();
    document.getElementById('cot-updated-by').textContent = cotData.updatedBy;
    
    showCotStatus();
    showToast('COT code updated successfully!', 'success');
  } catch (error) {
    console.error('Error updating COT code:', error);
    showToast('Error updating COT code: ' + error.message, 'error');
  }
}

function generateRandomCot() {
  const randomCode = generateRandomCotCode();
  document.getElementById('new-cot-code').value = randomCode;
}

function generateRandomCotCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function copyCotCode() {
  const cotCode = document.getElementById('current-cot-code').value;
  if (!cotCode) {
    showToast('No COT code to copy', 'error');
    return;
  }
  
  navigator.clipboard.writeText(cotCode).then(() => {
    const btn = document.getElementById('copy-cot-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-check"></i>';
    btn.style.background = '#28a745';
    
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.style.background = '#6c757d';
    }, 2000);
    
    showToast('COT code copied to clipboard', 'success');
  }).catch(() => {
    showToast('Failed to copy COT code', 'error');
  });
}

function showCotStatus() {
  const status = document.getElementById('cot-status');
  status.style.display = 'block';
  setTimeout(() => {
    status.style.display = 'none';
  }, 3000);
}

// Toast notification function
function showToast(message, type = 'info') {
  // Create toast element if it doesn't exist
  let toast = document.getElementById('toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast-notification';
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 600;
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(toast);
  }
  
  // Set toast style based on type
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    info: '#007bff',
    warning: '#ffc107'
  };
  
  toast.style.backgroundColor = colors[type] || colors.info;
  toast.textContent = message;
  toast.style.opacity = '1';
  
  // Hide toast after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}

// Export functions for global use
window.loadCurrentCotCode = loadCurrentCotCode;
window.updateCotCode = updateCotCode;
window.generateRandomCot = generateRandomCot;
window.copyCotCode = copyCotCode;
window.showToast = showToast;