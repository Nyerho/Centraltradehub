// COT Management Functions
import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Wait for page to load before initializing
window.addEventListener('load', () => {
    // Wait for auth to be ready
    setTimeout(() => {
        if (typeof loadCurrentCotCode === 'function') {
            loadCurrentCotCode();
        }
    }, 2000);
});

async function loadCurrentCotCode() {
    try {
        if (!db) {
            console.error('Firestore not initialized');
            return;
        }
        
        const docRef = doc(db, 'admin', 'withdrawal-settings');
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            const currentCotInput = document.getElementById('current-cot-code');
            const lastUpdatedSpan = document.getElementById('cot-last-updated');
            const updatedBySpan = document.getElementById('cot-updated-by');
            
            if (currentCotInput) currentCotInput.value = data.cotCode || '';
            if (lastUpdatedSpan) lastUpdatedSpan.textContent = data.lastUpdated ? new Date(data.lastUpdated).toLocaleString() : 'Never';
            if (updatedBySpan) updatedBySpan.textContent = data.updatedBy || 'N/A';
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
            updatedBy: window.authManager?.getCurrentUser()?.email || 'admin',
            createdAt: new Date().toISOString()
        };
        
        const docRef = doc(db, 'admin', 'withdrawal-settings');
        await setDoc(docRef, cotData);
        
        const currentCotInput = document.getElementById('current-cot-code');
        const lastUpdatedSpan = document.getElementById('cot-last-updated');
        const updatedBySpan = document.getElementById('cot-updated-by');
        
        if (currentCotInput) currentCotInput.value = defaultCotCode;
        if (lastUpdatedSpan) lastUpdatedSpan.textContent = new Date().toLocaleString();
        if (updatedBySpan) updatedBySpan.textContent = cotData.updatedBy;
        
        showToast('COT settings initialized with random code', 'success');
    } catch (error) {
        console.error('Error initializing COT settings:', error);
    }
}

async function updateCotCode() {
    try {
        const newCodeInput = document.getElementById('new-cot-code');
        let newCode = newCodeInput ? newCodeInput.value.trim() : '';
        
        if (!newCode) {
            newCode = generateRandomCotCode();
        }
        
        if (newCode.length < 4) {
            showToast('COT code must be at least 4 characters long', 'error');
            return;
        }
        
        if (!db) {
            console.error('Firestore not initialized');
            showToast('Database not available', 'error');
            return;
        }
        
        const cotData = {
            cotCode: newCode,
            lastUpdated: new Date().toISOString(),
            updatedBy: window.authManager?.getCurrentUser()?.email || 'admin'
        };
        
        const docRef = doc(db, 'admin', 'withdrawal-settings');
        await setDoc(docRef, cotData, { merge: true });
        
        const currentCotInput = document.getElementById('current-cot-code');
        const lastUpdatedSpan = document.getElementById('cot-last-updated');
        const updatedBySpan = document.getElementById('cot-updated-by');
        
        if (currentCotInput) currentCotInput.value = newCode;
        if (newCodeInput) newCodeInput.value = '';
        if (lastUpdatedSpan) lastUpdatedSpan.textContent = new Date().toLocaleString();
        if (updatedBySpan) updatedBySpan.textContent = cotData.updatedBy;
        
        showCotStatus();
        showToast('COT code updated successfully!', 'success');
    } catch (error) {
        console.error('Error updating COT code:', error);
        showToast('Error updating COT code: ' + error.message, 'error');
    }
}

function generateRandomCot() {
    const randomCode = generateRandomCotCode();
    const newCodeInput = document.getElementById('new-cot-code');
    if (newCodeInput) newCodeInput.value = randomCode;
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
    const currentCotInput = document.getElementById('current-cot-code');
    const cotCode = currentCotInput ? currentCotInput.value : '';
    
    if (!cotCode) {
        showToast('No COT code to copy', 'error');
        return;
    }
    
    navigator.clipboard.writeText(cotCode).then(() => {
        const btn = document.getElementById('copy-cot-btn');
        if (btn) {
            const originalHtml = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-check"></i>';
            btn.style.background = '#28a745';
            
            setTimeout(() => {
                btn.innerHTML = originalHtml;
                btn.style.background = '#6c757d';
            }, 2000);
        }
        
        showToast('COT code copied to clipboard', 'success');
    }).catch(() => {
        showToast('Failed to copy COT code', 'error');
    });
}

function showCotStatus() {
    const status = document.getElementById('cot-status');
    if (status) {
        status.style.display = 'block';
        setTimeout(() => {
            status.style.display = 'none';
        }, 3000);
    }
}

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