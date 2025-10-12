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
        // Show the verification modal instead of just loading
        this.showVerificationModal();
    }

    showVerificationModal() {
        const modal = document.getElementById('verificationModal');
        const stepContent = document.getElementById('stepContent');
        
        // Create the file upload interface
        stepContent.innerHTML = `
            <div class="verification-form">
                <h4>Upload Required Documents</h4>
                <p class="form-description">Please upload clear, high-quality images of your documents</p>
                
                <!-- ID Document Upload -->
                <div class="upload-section">
                    <div class="upload-header">
                        <i class="fas fa-id-card"></i>
                        <h5>Government-issued ID</h5>
                        <span class="required">*Required</span>
                    </div>
                    <div class="upload-area" id="idUploadArea">
                        <input type="file" id="idFileInput" accept="image/*,.pdf" style="display: none;">
                        <div class="upload-placeholder" onclick="document.getElementById('idFileInput').click()">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Click to upload or drag and drop</p>
                            <small>Supported: JPG, PNG, PDF (Max 5MB)</small>
                        </div>
                        <div class="upload-preview" id="idPreview" style="display: none;"></div>
                    </div>
                </div>

                <!-- Utility Bill Upload -->
                <div class="upload-section">
                    <div class="upload-header">
                        <i class="fas fa-file-invoice"></i>
                        <h5>Proof of Address</h5>
                        <span class="required">*Required</span>
                    </div>
                    <div class="upload-area" id="billUploadArea">
                        <input type="file" id="billFileInput" accept="image/*,.pdf" style="display: none;">
                        <div class="upload-placeholder" onclick="document.getElementById('billFileInput').click()">
                            <i class="fas fa-cloud-upload-alt"></i>
                            <p>Click to upload or drag and drop</p>
                            <small>Utility bill, bank statement (Max 5MB)</small>
                        </div>
                        <div class="upload-preview" id="billPreview" style="display: none;"></div>
                    </div>
                </div>

                <!-- Selfie Upload -->
                <div class="upload-section">
                    <div class="upload-header">
                        <i class="fas fa-camera"></i>
                        <h5>Selfie with ID</h5>
                        <span class="required">*Required</span>
                    </div>
                    <div class="upload-area" id="selfieUploadArea">
                        <input type="file" id="selfieFileInput" accept="image/*" style="display: none;">
                        <div class="upload-placeholder" onclick="document.getElementById('selfieFileInput').click()">
                            <i class="fas fa-camera"></i>
                            <p>Take a selfie or upload photo</p>
                            <small>Hold your ID next to your face (Max 5MB)</small>
                        </div>
                        <div class="upload-preview" id="selfiePreview" style="display: none;"></div>
                    </div>
                </div>

                <!-- Action Buttons -->
                <div class="modal-actions">
                    <button class="btn btn-secondary" onclick="closeVerificationModal()">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                    <button class="btn btn-primary" id="submitVerificationBtn" onclick="submitVerification()" disabled>
                        <i class="fas fa-check"></i> Submit for Review
                    </button>
                </div>
            </div>
        `;
        
        modal.style.display = 'block';
        
        // Initialize file upload handlers
        this.initializeFileUploads();
    }

    initializeFileUploads() {
        const fileInputs = ['idFileInput', 'billFileInput', 'selfieFileInput'];
        const previews = ['idPreview', 'billPreview', 'selfiePreview'];
        const areas = ['idUploadArea', 'billUploadArea', 'selfieUploadArea'];
        
        fileInputs.forEach((inputId, index) => {
            const input = document.getElementById(inputId);
            const preview = document.getElementById(previews[index]);
            const area = document.getElementById(areas[index]);
            
            if (input && preview && area) {
                input.addEventListener('change', (e) => {
                    this.handleFileUpload(e, preview, area);
                });
                
                // Add drag and drop functionality
                area.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    area.classList.add('drag-over');
                });
                
                area.addEventListener('dragleave', () => {
                    area.classList.remove('drag-over');
                });
                
                area.addEventListener('drop', (e) => {
                    e.preventDefault();
                    area.classList.remove('drag-over');
                    
                    const files = e.dataTransfer.files;
                    if (files.length > 0) {
                        input.files = files;
                        this.handleFileUpload({ target: input }, preview, area);
                    }
                });
            }
        });
    }

    handleFileUpload(event, preview, area) {
        const file = event.target.files[0];
        if (!file) return;
        
        // Validate file size (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            return;
        }
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a valid image (JPG, PNG) or PDF file');
            return;
        }
        
        // Show preview
        const placeholder = area.querySelector('.upload-placeholder');
        placeholder.style.display = 'none';
        preview.style.display = 'block';
        
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.innerHTML = `
                    <div class="file-preview">
                        <img src="${e.target.result}" alt="Preview" style="max-width: 200px; max-height: 150px; border-radius: 8px;">
                        <div class="file-info">
                            <p><strong>${file.name}</strong></p>
                            <p>${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            <button class="btn-remove" onclick="removeFile('${event.target.id}', '${preview.id}', '${area.id}')">
                                <i class="fas fa-trash"></i> Remove
                            </button>
                        </div>
                    </div>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            preview.innerHTML = `
                <div class="file-preview">
                    <div class="pdf-icon">
                        <i class="fas fa-file-pdf" style="font-size: 3rem; color: #dc3545;"></i>
                    </div>
                    <div class="file-info">
                        <p><strong>${file.name}</strong></p>
                        <p>${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button class="btn-remove" onclick="removeFile('${event.target.id}', '${preview.id}', '${area.id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        }
        
        // Check if all files are uploaded
        this.checkSubmitButton();
    }

    checkSubmitButton() {
        const idFile = document.getElementById('idFileInput').files[0];
        const billFile = document.getElementById('billFileInput').files[0];
        const selfieFile = document.getElementById('selfieFileInput').files[0];
        const submitBtn = document.getElementById('submitVerificationBtn');
        
        if (idFile && billFile && selfieFile && submitBtn) {
            submitBtn.disabled = false;
            submitBtn.classList.add('btn-ready');
        } else if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.classList.remove('btn-ready');
        }
    }

    async submitVerification() {
        const loadingOverlay = document.getElementById('loadingOverlay');
        loadingOverlay.style.display = 'block';
        
        try {
            // Get uploaded files
            const idFile = document.getElementById('idFileInput').files[0];
            const billFile = document.getElementById('billFileInput').files[0];
            const selfieFile = document.getElementById('selfieFileInput').files[0];

            // Upload documents to Firebase Storage and get URLs
            // Import at top of file:
            // import { storage } from './firebase-config.js';
            // import { ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js';

            const userId = this.currentUser.uid;
            const timestamp = Date.now();
            const basePath = `kyc/${userId}/`;

            const uploadAndGetUrl = async (file, path) => {
                const storageRef = ref(storage, path);
                await uploadBytes(storageRef, file);
                return await getDownloadURL(storageRef);
            };

            const idUrl = await uploadAndGetUrl(idFile, `${basePath}${timestamp}_id_${idFile.name}`);
            const addressUrl = await uploadAndGetUrl(billFile, `${basePath}${timestamp}_address_${billFile.name}`);
            const selfieUrl = await uploadAndGetUrl(selfieFile, `${basePath}${timestamp}_selfie_${selfieFile.name}`);

            // Update user status to pending and store document URLs
            await updateDoc(doc(db, 'users', this.currentUser.uid), {
                kycStatus: 'pending',
                kycSubmittedAt: new Date().toISOString(),
                documentsUploaded: {
                    id: idFile.name,
                    proofOfAddress: billFile.name,
                    selfie: selfieFile.name
                },
                kycDocuments: {
                    idUrl,
                    addressUrl,
                    selfieUrl
                }
            });

            // Send notification email
            const userDoc = await getDoc(doc(db, 'users', this.currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                await this.emailService.sendKYCNotification(
                    this.currentUser.email,
                    userData.displayName || 'User',
                    'submitted'
                );
            }
            
            // Close modal and update status
            this.closeVerificationModal();
            this.loadKYCStatus();
            
            alert('Documents submitted successfully! We will review your verification within 24-48 hours.');
            
        } catch (error) {
            console.error('Error submitting verification:', error);
            alert('Failed to submit documents. Please try again.');
        } finally {
            loadingOverlay.style.display = 'none';
        }
    }

    closeVerificationModal() {
        const modal = document.getElementById('verificationModal');
        if (modal) {
            modal.style.display = 'none';
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
    alert('Support chat would open here. Please contact support@centraltradekeplr.com for assistance.');
};

window.removeFile = (inputId, previewId, areaId) => {
    const input = document.getElementById(inputId);
    const preview = document.getElementById(previewId);
    const area = document.getElementById(areaId);
    const placeholder = area.querySelector('.upload-placeholder');
    
    if (input) input.value = '';
    if (preview) preview.style.display = 'none';
    if (placeholder) placeholder.style.display = 'block';
    
    if (window.kycPortal) {
        window.kycPortal.checkSubmitButton();
    }
};

window.submitVerification = () => {
    if (window.kycPortal) {
        window.kycPortal.submitVerification();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    window.kycPortal = new KYCPortal();
});

// Remove the duplicate global functions and DOMContentLoaded listener at the end
// Keep only the class definition and export

export default KYCPortal;