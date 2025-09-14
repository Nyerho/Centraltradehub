import { auth, db } from './firebase-config.js';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

class KYCPortal {
    constructor() {
        this.currentUser = null;
        this.kycStatus = 'unverified';
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
        const statusCard = document.getElementById('kycStatusCard');
        const statusIndicator = document.getElementById('statusIndicator');
        const startBtn = document.getElementById('startVerificationBtn');

        statusCard.className = 'kyc-status-card';
        
        switch (this.kycStatus) {
            case 'verified':
                statusCard.classList.add('verified');
                statusIndicator.innerHTML = '<i class="fas fa-check-circle"></i><span>Verification Complete</span>';
                startBtn.style.display = 'none';
                break;
            case 'pending':
                statusCard.classList.add('pending');
                statusIndicator.innerHTML = '<i class="fas fa-clock"></i><span>Verification Under Review</span>';
                startBtn.textContent = 'Check Status';
                startBtn.onclick = () => this.checkVerificationStatus();
                break;
            default:
                statusCard.classList.add('unverified');
                statusIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i><span>Verification Required</span>';
                break;
        }
    }

    async startVerification() {
        const progressDiv = document.getElementById('kycProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        
        progressDiv.style.display = 'block';
        
        // Simulate verification process
        const steps = [
            'Initializing verification...',
            'Preparing document upload...',
            'Starting Sumsub verification...',
            'Redirecting to verification portal...'
        ];
        
        for (let i = 0; i < steps.length; i++) {
            progressText.textContent = steps[i];
            progressFill.style.width = `${(i + 1) * 25}%`;
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        // In a real implementation, integrate with Sumsub or similar KYC provider
        this.launchSumsubVerification();
    }

    async launchSumsubVerification() {
        try {
            // Update status to pending
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                kycStatus: 'pending',
                kycStartedAt: new Date().toISOString()
            });
            
            // In production, integrate with actual Sumsub SDK
            alert('KYC verification portal would launch here. For demo purposes, status set to pending.');
            
            // Reload status
            this.kycStatus = 'pending';
            this.updateStatusDisplay();
            
        } catch (error) {
            console.error('Error starting KYC verification:', error);
            alert('Unable to start verification. Please try again later.');
        }
    }

    async checkVerificationStatus() {
        await this.loadKYCStatus();
        
        if (this.kycStatus === 'verified') {
            alert('Congratulations! Your KYC verification has been approved.');
        } else if (this.kycStatus === 'pending') {
            alert('Your verification is still under review. We will notify you once it is complete.');
        } else {
            alert('Verification status updated. Please refresh the page.');
        }
    }
}

// Global functions
window.startKYCVerification = () => {
    if (window.kycPortal) {
        window.kycPortal.startVerification();
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.kycPortal = new KYCPortal();
});

export default KYCPortal;