// Auth Page JavaScript
document.addEventListener('DOMContentLoaded', function() {
    initializeAuthPage();
});

function initializeAuthPage() {
    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    const formContainers = document.querySelectorAll('.auth-form-container');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update active form
            formContainers.forEach(container => {
                container.classList.remove('active');
                if (container.id === targetTab + '-form') {
                    container.classList.add('active');
                }
            });
        });
    });
    
    // Form validation
    setupFormValidation();
    
    // Password strength checker
    setupPasswordStrength();
    
    // Form submissions
    setupFormSubmissions();
}

function setupFormValidation() {
    const forms = document.querySelectorAll('.auth-form');
    
    forms.forEach(form => {
        const inputs = form.querySelectorAll('input, select');
        
        inputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => clearError(input));
        });
    });
}

function validateField(field) {
    const value = field.value.trim();
    const fieldName = field.name;
    const errorElement = document.getElementById(fieldName + 'Error') || 
                        document.getElementById(field.id + 'Error');
    
    let isValid = true;
    let errorMessage = '';
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
        errorMessage = 'This field is required';
    }
    
    // Email validation
    else if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
            errorMessage = 'Please enter a valid email address';
        }
    }
    
    // Phone validation
    else if (field.type === 'tel' && value) {
        const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
        if (!phoneRegex.test(value.replace(/[\s\-\(\)]/g, ''))) {
            isValid = false;
            errorMessage = 'Please enter a valid phone number';
        }
    }
    
    // Mirror Trade Code validation (optional field)
    else if (fieldName === 'mirrorTradeCode' && value) {
        const codeRegex = /^[A-Z0-9]{6,12}$/;
        if (!codeRegex.test(value.toUpperCase())) {
            isValid = false;
            errorMessage = 'Mirror Trade code must be 6-12 characters (letters and numbers only)';
        }
    }
    
    // Password validation
    else if (field.type === 'password' && fieldName === 'password' && value) {
        if (value.length < 8) {
            isValid = false;
            errorMessage = 'Password must be at least 8 characters long';
        } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(value)) {
            isValid = false;
            errorMessage = 'Password must contain uppercase, lowercase, and number';
        }
    }
    
    // Confirm password validation
    else if (fieldName === 'confirmPassword' && value) {
        const passwordField = document.getElementById('registerPassword');
        if (value !== passwordField.value) {
            isValid = false;
            errorMessage = 'Passwords do not match';
        }
    }
    
    // Terms validation
    else if (fieldName === 'terms' && field.type === 'checkbox') {
        if (!field.checked) {
            isValid = false;
            errorMessage = 'You must agree to the terms and conditions';
        }
    }
    
    // Update field appearance and error message
    if (errorElement) {
        errorElement.textContent = errorMessage;
    }
    
    field.style.borderColor = isValid ? '#e1e5e9' : '#e74c3c';
    
    return isValid;
}

function clearError(field) {
    const fieldName = field.name;
    const errorElement = document.getElementById(fieldName + 'Error') || 
                        document.getElementById(field.id + 'Error');
    
    if (errorElement) {
        errorElement.textContent = '';
    }
    
    field.style.borderColor = '#e1e5e9';
}

function setupPasswordStrength() {
    const passwordField = document.getElementById('registerPassword');
    const strengthBar = document.querySelector('.strength-fill');
    const strengthText = document.querySelector('.strength-text');
    
    if (passwordField && strengthBar && strengthText) {
        passwordField.addEventListener('input', function() {
            const password = this.value;
            const strength = calculatePasswordStrength(password);
            
            // Remove all strength classes
            strengthBar.className = 'strength-fill';
            
            if (password.length > 0) {
                strengthBar.classList.add(strength.class);
                strengthText.textContent = strength.text;
            } else {
                strengthText.textContent = 'Password strength';
            }
        });
    }
}

function calculatePasswordStrength(password) {
    let score = 0;
    
    // Length check
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    
    // Character variety checks
    if (/[a-z]/.test(password)) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    
    // Return strength object
    if (score < 3) {
        return { class: 'weak', text: 'Weak password' };
    } else if (score < 4) {
        return { class: 'fair', text: 'Fair password' };
    } else if (score < 5) {
        return { class: 'good', text: 'Good password' };
    } else {
        return { class: 'strong', text: 'Strong password' };
    }
}

function setupFormSubmissions() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Forgot password form
    const forgotForm = document.getElementById('forgotPasswordForm');
    if (forgotForm) {
        forgotForm.addEventListener('submit', handleForgotPassword);
    }
}

function handleLogin(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    const email = formData.get('email');
    const password = formData.get('password');
    const remember = formData.get('remember');
    
    // Validate form
    const emailField = form.querySelector('[name="email"]');
    const passwordField = form.querySelector('[name="password"]');
    
    const emailValid = validateField(emailField);
    const passwordValid = validateField(passwordField);
    
    if (!emailValid || !passwordValid) {
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing In...';
    submitBtn.disabled = true;
    
    // Use Firebase authentication through AuthManager
    if (window.authManager) {
        window.authManager.login(email, password).then(success => {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            if (success) {
                // Login successful - AuthManager will handle UI updates
                console.log('Login successful');
            }
        }).catch(error => {
            // Reset button on error
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            console.error('Login error:', error);
        });
    } else {
        // Fallback if AuthManager not available
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showNotification('Authentication system not ready. Please refresh the page.', 'error');
    }
}

function handleRegister(e) {
    e.preventDefault();
    
    const form = e.target;
    const inputs = form.querySelectorAll('input, select');
    
    // Validate all fields
    let isFormValid = true;
    inputs.forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
        }
    });
    
    if (!isFormValid) {
        showNotification('Please fix the errors above', 'error');
        return;
    }
    
    // Get form data
    const formData = new FormData(form);
    const userData = {
        firstName: formData.get('firstName'),
        lastName: formData.get('lastName'),
        email: formData.get('email'),
        password: formData.get('password'),
        phone: formData.get('phone'),
        country: formData.get('country')
    };
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating Account...';
    submitBtn.disabled = true;
    
    // Use Firebase authentication through AuthManager
    if (window.authManager) {
        window.authManager.register(userData).then(success => {
            // Reset button
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            
            if (success) {
                // Registration successful
                console.log('Registration successful');
            }
        }).catch(error => {
            // Reset button on error
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
            console.error('Registration error:', error);
        });
    } else {
        // Fallback if AuthManager not available
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        showNotification('Authentication system not ready. Please refresh the page.', 'error');
    }
}

function handleForgotPassword(e) {
    e.preventDefault();
    
    const form = e.target;
    const emailField = form.querySelector('[name="email"]');
    
    if (!validateField(emailField)) {
        return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
    submitBtn.disabled = true;
    
    // Simulate API call
    setTimeout(() => {
        // Reset button
        submitBtn.innerHTML = originalText;
        submitBtn.disabled = false;
        
        // Show success message
        showNotification('Password reset link sent to your email!', 'success');
        
        // Close modal
        closeForgotPassword();
    }, 2000);
}

// Utility functions
function togglePassword(fieldId) {
    const field = document.getElementById(fieldId);
    const toggle = field.nextElementSibling;
    const icon = toggle.querySelector('i');
    
    if (field.type === 'password') {
        field.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        field.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

function showForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.add('show');
}

function closeForgotPassword() {
    const modal = document.getElementById('forgotPasswordModal');
    modal.classList.remove('show');
}

function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle'}"></i>
            <span>${message}</span>
        </div>
        <button class="notification-close" onclick="this.parentElement.remove()">
            <i class="fas fa-times"></i>
        </button>
    `;
    
    // Add notification styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 2rem;
                right: 2rem;
                background: white;
                border-radius: 10px;
                padding: 1rem 1.5rem;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                z-index: 3000;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                max-width: 400px;
                animation: slideIn 0.3s ease;
                border-left: 4px solid #667eea;
            }
            .notification.success {
                border-left-color: #27ae60;
            }
            .notification.error {
                border-left-color: #e74c3c;
            }
            .notification-content {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            .notification-content i {
                color: #667eea;
            }
            .notification.success .notification-content i {
                color: #27ae60;
            }
            .notification.error .notification-content i {
                color: #e74c3c;
            }
            .notification-close {
                background: none;
                border: none;
                color: #666;
                cursor: pointer;
                padding: 0.25rem;
                border-radius: 4px;
            }
            .notification-close:hover {
                background: #f8f9fa;
            }
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// Close modal when clicking outside
document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// Google Sign-In Configuration
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // Replace with your actual Google Client ID

// Google Sign-In Handlers
function handleGoogleSignIn(response) {
    try {
        // Decode the JWT token
        const responsePayload = decodeJwtResponse(response.credential);
        
        // Extract user information
        const userData = {
            email: responsePayload.email,
            name: responsePayload.name,
            firstName: responsePayload.given_name,
            lastName: responsePayload.family_name,
            picture: responsePayload.picture,
            googleId: responsePayload.sub
        };
        
        // Process Google Sign-In
        processGoogleAuth(userData, 'signin');
        
    } catch (error) {
        console.error('Google Sign-In Error:', error);
        showNotification('Google Sign-In failed. Please try again.', 'error');
    }
}

function handleGoogleSignUp(response) {
    try {
        // Decode the JWT token
        const responsePayload = decodeJwtResponse(response.credential);
        
        // Extract user information
        const userData = {
            email: responsePayload.email,
            name: responsePayload.name,
            firstName: responsePayload.given_name,
            lastName: responsePayload.family_name,
            picture: responsePayload.picture,
            googleId: responsePayload.sub
        };
        
        // Process Google Sign-Up
        processGoogleAuth(userData, 'signup');
        
    } catch (error) {
        console.error('Google Sign-Up Error:', error);
        showNotification('Google Sign-Up failed. Please try again.', 'error');
    }
}

function decodeJwtResponse(token) {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    
    return JSON.parse(jsonPayload);
}

function processGoogleAuth(userData, type) {
    // Show loading state
    const loadingMessage = type === 'signin' ? 'Signing you in...' : 'Creating your account...';
    showNotification(loadingMessage, 'info');
    
    // Simulate API call to your backend
    setTimeout(() => {
        if (type === 'signin') {
            // Handle successful Google Sign-In
            localStorage.setItem('user', JSON.stringify({
                id: userData.googleId,
                email: userData.email,
                name: userData.name,
                picture: userData.picture,
                authMethod: 'google'
            }));
            
            showNotification(`Welcome back, ${userData.firstName}!`, 'success');
            
            // Redirect to platform or dashboard
            setTimeout(() => {
                window.location.href = 'platform.html';
            }, 1500);
            
        } else {
            // Handle successful Google Sign-Up
            // Pre-fill registration form with Google data
            document.getElementById('firstName').value = userData.firstName || '';
            document.getElementById('lastName').value = userData.lastName || '';
            document.getElementById('registerEmail').value = userData.email || '';
            
            // Show success message
            showNotification(`Account created successfully! Welcome, ${userData.firstName}!`, 'success');
            
            // Store user data
            localStorage.setItem('user', JSON.stringify({
                id: userData.googleId,
                email: userData.email,
                name: userData.name,
                picture: userData.picture,
                authMethod: 'google'
            }));
            
            // Redirect to platform
            setTimeout(() => {
                window.location.href = 'platform.html';
            }, 1500);
        }
    }, 1000);
}

// Initialize Google Sign-In when page loads
function initializeGoogleSignIn() {
    // This function will be called after Google API loads
    if (typeof google !== 'undefined' && google.accounts) {
        google.accounts.id.initialize({
            client_id: GOOGLE_CLIENT_ID,
            callback: handleGoogleSignIn
        });
        
        // Render sign-in buttons
        google.accounts.id.renderButton(
            document.querySelector('.g_id_signin'),
            {
                theme: 'outline',
                size: 'large',
                type: 'standard',
                shape: 'rectangular',
                text: 'signin_with',
                logo_alignment: 'left'
            }
        );
    }
}