import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import EmailService from './email-service.js';

class KYCPortal {
    constructor() {
        this.currentUser = null;
        this.kycStatus = 'unverified';
        this.emailService = new EmailService();
        this.init();
    }

    async init() {
        // Check authentication state
        onAuthStateChanged(auth, (user) => {
            if (user) {
                this.currentUser = user;
                this.loadKYCStatus();
            } else {
                // Redirect to login if not authenticated
                window.location.href = 'auth.html';
            }
        });
    }

    async loadKYCStatus() {
        try {
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                this.kycStatus = userData.kycStatus || 'unverified';
                this.updateStatusDisplay();
            }
        } catch (error) {
            console.error('Error loading KYC status:', error);
        }
    }

    updateStatusDisplay() {
        const statusIcon = document.getElementById('statusIcon');
        const statusTitle = document.getElementById('statusTitle');
        const statusDescription = document.getElementById('statusDescription');
        const statusBadge = document.getElementById('statusBadge');
        const progressFill = document.getElementById('progressFill');
        const startBtn = document.getElementById('startVerificationBtn');
        const continueBtn = document.getElementById('continueVerificationBtn');
        
        switch (this.kycStatus) {
            case 'verified':
                statusIcon.innerHTML = '<i class="fas fa-check-circle"></i>';
                statusIcon.style.background = 'var(--kyc-success)';
                statusTitle.textContent = 'Verification Complete';
                statusDescription.textContent = 'Your identity has been successfully verified';
                statusBadge.innerHTML = '<span class="badge verified">Verified</span>';
                progressFill.style.width = '100%';
                startBtn.style.display = 'none';
                continueBtn.style.display = 'none';
                this.updateProgressSteps(3);
                break;
            case 'pending':
                statusIcon.innerHTML = '<i class="fas fa-clock"></i>';
                statusIcon.style.background = 'var(--kyc-warning)';
                statusTitle.textContent = 'Verification Under Review';
                statusDescription.textContent = 'Your documents are being reviewed by our team';
                statusBadge.innerHTML = '<span class="badge pending">Pending</span>';
                progressFill.style.width = '66%';
                startBtn.style.display = 'none';
                continueBtn.style.display = 'inline-flex';
                continueBtn.textContent = 'Check Status';
                continueBtn.onclick = () => this.checkVerificationStatus();
                this.updateProgressSteps(2);
                break;
            default:
                statusIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
                statusIcon.style.background = 'var(--kyc-danger)';
                statusTitle.textContent = 'Verification Required';
                statusDescription.textContent = 'Complete your KYC verification to unlock all features';
                statusBadge.innerHTML = '<span class="badge unverified">Unverified</span>';
                progressFill.style.width = '0%';
                startBtn.style.display = 'inline-flex';
                continueBtn.style.display = 'none';
                this.updateProgressSteps(0);
                break;
        }
    }

    updateProgressSteps(currentStep) {
        const steps = ['step1', 'step2', 'step3'];
        steps.forEach((stepId, index) => {
            const stepElement = document.getElementById(stepId);
            if (stepElement) {
                stepElement.classList.remove('active', 'completed');
                if (index < currentStep) {
                    stepElement.classList.add('completed');
                } else if (index === currentStep) {
                    stepElement.classList.add('active');
                }
            }
        });
    }

    async startVerification() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'block';
        
        try {
            // Update status to pending
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                kycStatus: 'pending',
                kycStartedAt: new Date().toISOString()
            });
            
            // Send KYC notification email
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                await this.emailService.sendKYCNotification(
                    this.currentUser.email,
                    userData.displayName || 'User',
                    'pending'
                );
            }
            
            // Simulate verification process
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // In production, integrate with actual KYC provider (Sumsub, etc.)
            this.launchSumsubVerification();
            
        } catch (error) {
            console.error('Error starting verification:', error);
            alert('Failed to start verification. Please try again.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    async launchSumsubVerification() {
        // In production, integrate with actual Sumsub SDK
        alert('KYC verification portal would launch here. For demo purposes, status set to pending.');
        
        // Reload status
        this.loadKYCStatus();
    }

    async checkVerificationStatus() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'block';
        
        try {
            // Simulate status check
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            // Reload current status
            await this.loadKYCStatus();
            
            alert('Status updated. Please check your email for any updates.');
            
        } catch (error) {
            console.error('Error checking status:', error);
            alert('Failed to check status. Please try again.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }
}

// Global functions for HTML onclick handlers
window.startKYCVerification = () => {
    if (window.kycPortal) {
        window.kycPortal.startVerification();
    }
};

window.continueKYCVerification = () => {
    if (window.kycPortal) {
        window.kycPortal.checkVerificationStatus();
    }
};

window.closeVerificationModal = () => {
    const modal = document.getElementById('verificationModal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.openSupportChat = () => {
    // Implement support chat functionality
    alert('Support chat would open here. Please contact support@centraltradehub.com for assistance.');
};

document.addEventListener('DOMContentLoaded', () => {
    window.kycPortal = new KYCPortal();
});

export default KYCPortal;