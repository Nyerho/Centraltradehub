// Forgot Password Functionality
import { auth } from './firebase-config.js';
import { sendPasswordResetEmail } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';

class ForgotPasswordManager {
    constructor() {
        this.init();
    }

    init() {
        this.bindEvents();
    }

    bindEvents() {
        const forgotForm = document.getElementById('forgotPasswordForm');
        const resendLink = document.getElementById('resendLink');

        if (forgotForm) {
            forgotForm.addEventListener('submit', (e) => this.handleForgotPassword(e));
        }

        if (resendLink) {
            resendLink.addEventListener('click', (e) => this.handleResend(e));
        }
    }

    async handleForgotPassword(e) {
        e.preventDefault();
        
        const email = document.getElementById('email').value.trim();
        const emailError = document.getElementById('emailError');
        const resetBtn = document.getElementById('resetPasswordBtn');
        
        // Clear previous errors
        emailError.textContent = '';
        
        // Validate email
        if (!email) {
            emailError.textContent = 'Please enter your email address';
            return;
        }
        
        if (!this.isValidEmail(email)) {
            emailError.textContent = 'Please enter a valid email address';
            return;
        }
        
        // Show loading state
        resetBtn.disabled = true;
        resetBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
        
        try {
            await sendPasswordResetEmail(auth, email, {
                url: `${window.location.origin}/reset-password.html`,
                handleCodeInApp: false
            });
            
            // Store email for resend functionality
            sessionStorage.setItem('resetEmail', email);
            
            // Show success message
            this.showSuccessMessage();
            
        } catch (error) {
            console.error('Password reset error:', error);
            
            let errorMessage = 'An error occurred. Please try again.';
            
            switch (error.code) {
                case 'auth/user-not-found':
                    errorMessage = 'No account found with this email address';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Invalid email address';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many requests. Please try again later';
                    break;
                case 'auth/network-request-failed':
                    errorMessage = 'Network error. Please check your connection';
                    break;
                case 'auth/unauthorized-continue-uri':
                    errorMessage = 'Password reset temporarily unavailable. Please contact support.';
                    break;
            }
            
            emailError.textContent = errorMessage;
            
        } finally {
            // Reset button state
            resetBtn.disabled = false;
            resetBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Reset Link';
        }
    }

    async handleResend(e) {
        e.preventDefault();
        
        const email = sessionStorage.getItem('resetEmail');
        if (!email) {
            alert('Please go back and enter your email again');
            return;
        }
        
        const resendLink = document.getElementById('resendLink');
        resendLink.textContent = 'Sending...';
        
        try {
            await sendPasswordResetEmail(auth, email, {
                url: window.location.origin + '/auth.html',
                handleCodeInApp: false
            });
            
            resendLink.textContent = 'Sent!';
            setTimeout(() => {
                resendLink.textContent = 'Resend';
            }, 3000);
            
        } catch (error) {
            console.error('Resend error:', error);
            resendLink.textContent = 'Error - Try Again';
            setTimeout(() => {
                resendLink.textContent = 'Resend';
            }, 3000);
        }
    }

    showSuccessMessage() {
        const resetForm = document.getElementById('reset-form');
        const successMessage = document.getElementById('success-message');
        
        resetForm.style.display = 'none';
        successMessage.style.display = 'block';
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ForgotPasswordManager();
});