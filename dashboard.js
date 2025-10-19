// ... existing code ...
window.addEventListener('user-profile-changed', (e) => {
    const profile = e.detail;
    if (!profile) return;
    // Update any custom elements by ID/class here
    const nameEl = document.getElementById('header-user-name');
    if (nameEl) nameEl.textContent = profile.displayName || 'User';
});
// ... existing code ...