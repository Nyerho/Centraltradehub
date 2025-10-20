// Account page module - integrates with global window.sdk and user-state.js

// Simple toast helper (creates a toast container if not present)
function showToast(message, type = 'info', timeout = 3000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '8px';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.textContent = message;
  toast.style.padding = '10px 14px';
  toast.style.borderRadius = '6px';
  toast.style.color = '#fff';
  toast.style.fontSize = '14px';
  toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
  toast.style.transition = 'opacity 0.2s ease';
  toast.style.opacity = '1';

  const colors = {
    info: '#0ea5e9',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444'
  };
  toast.style.background = colors[type] || colors.info;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      container.removeChild(toast);
    }, 200);
  }, timeout);
}

// Helper: find field by id or name or data-user-field
function findField(field) {
  return (
    document.getElementById(field) ||
    document.querySelector(`[name="${field}"]`) ||
    document.querySelector(`[data-user-field="${field}"]`)
  );
}

// Prefill form using cache, Auth, and Firestore
async function prefillForm() {
  const sdk = window.sdk;
  if (!sdk) {
    console.warn('account.js: window.sdk not ready yet');
    return;
  }
  const auth = sdk.auth();
  const db = sdk.firestore();

  // Apply cached values first for perceived responsiveness
  try {
    const cached = JSON.parse(localStorage.getItem('userProfileCache') || 'null');
    if (cached) {
      const dn = findField('displayName') || findField('fullName');
      const em = findField('email');
      const ph = findField('phoneNumber');
      if (dn) dn.value = cached.displayName || cached.fullName || '';
      if (em) em.value = cached.email || '';
      if (ph) ph.value = cached.phoneNumber || '';
    }
  } catch (_) {}

  const user = auth.currentUser;
  if (!user) {
    showToast('You are not signed in. Please sign in to manage your account.', 'warning');
    return;
  }

  const uid = user.uid;
  try {
    // Prefer profiles/{uid}, fallback to users/{uid}
    const profilesDoc = await db.collection('profiles').doc(uid).get();
    let data = profilesDoc.exists ? profilesDoc.data() : null;
    if (!data) {
      const usersDoc = await db.collection('users').doc(uid).get();
      data = usersDoc.exists ? usersDoc.data() : {};
    }

    const profile = {
      uid,
      displayName: data.displayName || data.fullName || user.displayName || '',
      fullName: data.fullName || data.displayName || user.displayName || '',
      email: user.email || data.email || '',
      phoneNumber: data.phoneNumber || ''
    };

    const dn = findField('displayName') || findField('fullName');
    const em = findField('email');
    const ph = findField('phoneNumber');
    if (dn) dn.value = profile.displayName || profile.fullName || '';
    if (em) em.value = profile.email || '';
    if (ph) ph.value = profile.phoneNumber || '';

    try { localStorage.setItem('userProfileCache', JSON.stringify(profile)); } catch (_) {}
  } catch (err) {
    console.error('account.js: failed to prefill form:', err);
  }
}

// Save changes to Auth and Firestore, then notify other pages
async function saveChanges(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();

  const sdk = window.sdk;
  if (!sdk) {
    showToast('Firebase SDK not ready. Please wait and try again.', 'error');
    return;
  }
  const auth = sdk.auth();
  const db = sdk.firestore();

  const user = auth.currentUser;
  if (!user) {
    showToast('You are not signed in.', 'error');
    return;
  }

  const uid = user.uid;
  // Gather values from form
  const dnField = findField('displayName') || findField('fullName');
  const emField = findField('email');
  const phField = findField('phoneNumber');

  const updatedProfile = {
    displayName: dnField ? dnField.value.trim() : user.displayName || '',
    email: emField ? emField.value.trim() : user.email || '',
    phoneNumber: phField ? phField.value.trim() : ''
  };

  try {
    // Update Auth displayName
    if (updatedProfile.displayName && updatedProfile.displayName !== (user.displayName || '')) {
      await sdk.updateProfile({ displayName: updatedProfile.displayName });
    }

    // Write to Firestore profiles/{uid} with merge
    await db.collection('profiles').doc(uid).set(
      {
        displayName: updatedProfile.displayName,
        email: updatedProfile.email,
        phoneNumber: updatedProfile.phoneNumber,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    // Cache and broadcast for cross-page sync (e.g., dashboard)
    const merged = {
      uid,
      displayName: updatedProfile.displayName,
      fullName: updatedProfile.displayName,
      email: updatedProfile.email,
      phoneNumber: updatedProfile.phoneNumber
    };
    try { localStorage.setItem('userProfileCache', JSON.stringify(merged)); } catch (_) {}
    window.dispatchEvent(new CustomEvent('user-profile-changed', { detail: merged }));

    showToast('Profile saved successfully.', 'success');
  } catch (err) {
    console.error('account.js: failed to save changes:', err);
    showToast('Failed to save changes. Please try again.', 'error');
  }
}

// Wire up events
document.addEventListener('DOMContentLoaded', () => {
  prefillForm();

  // Bind to the form in account.html
  const form =
    document.getElementById('account-form') ||
    document.querySelector('form#account-form') ||
    document.querySelector('form');

  if (form) {
    form.addEventListener('submit', saveChanges);
  }

  // Also bind an explicit save button if present
  const saveBtn =
    document.getElementById('save-button') ||
    document.querySelector('[data-action="save-profile"]');

  if (saveBtn) {
    saveBtn.addEventListener('click', saveChanges);
  }
});