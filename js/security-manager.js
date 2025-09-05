class SecurityManager {
    constructor() {
        this.twoFactorAuth = new TwoFactorAuth();
        this.biometricAuth = new BiometricAuth();
        this.fraudDetection = new FraudDetection();
        this.sessionManager = new SessionManager();
        this.encryptionService = new EncryptionService();
        this.auditLogger = new AuditLogger();
        this.init();
    }

    init() {
        this.setupSecurityPolicies();
        this.initializeDeviceFingerprinting();
        this.startSecurityMonitoring();
    }

    // Two-Factor Authentication
    async enableTwoFactor(userId, method = 'totp') {
        try {
            const secret = await this.twoFactorAuth.generateSecret(userId);
            const qrCode = await this.twoFactorAuth.generateQRCode(userId, secret);
            
            await this.auditLogger.log('2FA_SETUP_INITIATED', {
                userId,
                method,
                timestamp: new Date()
            });

            return {
                secret,
                qrCode,
                backupCodes: this.twoFactorAuth.generateBackupCodes()
            };
        } catch (error) {
            await this.auditLogger.log('2FA_SETUP_FAILED', { userId, error: error.message });
            throw error;
        }
    }

    async verifyTwoFactor(userId, token, method = 'totp') {
        try {
            const isValid = await this.twoFactorAuth.verifyToken(userId, token, method);
            
            await this.auditLogger.log('2FA_VERIFICATION', {
                userId,
                success: isValid,
                method,
                timestamp: new Date()
            });

            if (!isValid) {
                await this.fraudDetection.recordFailedAuth(userId, '2FA_FAILED');
            }

            return isValid;
        } catch (error) {
            await this.auditLogger.log('2FA_VERIFICATION_ERROR', { userId, error: error.message });
            throw error;
        }
    }

    // Biometric Authentication
    async setupBiometric(userId, biometricType = 'fingerprint') {
        try {
            if (!this.biometricAuth.isSupported(biometricType)) {
                throw new Error(`Biometric type ${biometricType} not supported`);
            }

            const enrollment = await this.biometricAuth.enroll(userId, biometricType);
            
            await this.auditLogger.log('BIOMETRIC_SETUP', {
                userId,
                biometricType,
                enrollmentId: enrollment.id,
                timestamp: new Date()
            });

            return enrollment;
        } catch (error) {
            await this.auditLogger.log('BIOMETRIC_SETUP_FAILED', { userId, error: error.message });
            throw error;
        }
    }

    async authenticateBiometric(userId, biometricData) {
        try {
            const result = await this.biometricAuth.authenticate(userId, biometricData);
            
            await this.auditLogger.log('BIOMETRIC_AUTH', {
                userId,
                success: result.success,
                confidence: result.confidence,
                timestamp: new Date()
            });

            if (!result.success) {
                await this.fraudDetection.recordFailedAuth(userId, 'BIOMETRIC_FAILED');
            }

            return result;
        } catch (error) {
            await this.auditLogger.log('BIOMETRIC_AUTH_ERROR', { userId, error: error.message });
            throw error;
        }
    }

    // Session Management
    async createSecureSession(userId, deviceInfo) {
        try {
            const sessionToken = this.sessionManager.generateSecureToken();
            const deviceFingerprint = await this.generateDeviceFingerprint(deviceInfo);
            
            const session = {
                sessionId: sessionToken,
                userId,
                deviceFingerprint,
                createdAt: new Date(),
                lastActivity: new Date(),
                ipAddress: deviceInfo.ipAddress,
                userAgent: deviceInfo.userAgent,
                isActive: true
            };

            await this.sessionManager.storeSession(session);
            await this.auditLogger.log('SESSION_CREATED', session);

            return sessionToken;
        } catch (error) {
            await this.auditLogger.log('SESSION_CREATION_FAILED', { userId, error: error.message });
            throw error;
        }
    }

    async validateSession(sessionToken, deviceInfo) {
        try {
            const session = await this.sessionManager.getSession(sessionToken);
            
            if (!session || !session.isActive) {
                throw new Error('Invalid or expired session');
            }

            // Verify device fingerprint
            const currentFingerprint = await this.generateDeviceFingerprint(deviceInfo);
            if (session.deviceFingerprint !== currentFingerprint) {
                await this.fraudDetection.recordSuspiciousActivity(session.userId, 'DEVICE_MISMATCH');
                throw new Error('Device fingerprint mismatch');
            }

            // Update last activity
            await this.sessionManager.updateLastActivity(sessionToken);
            
            return session;
        } catch (error) {
            await this.auditLogger.log('SESSION_VALIDATION_FAILED', { sessionToken, error: error.message });
            throw error;
        }
    }

    // Fraud Detection
    async analyzeLoginAttempt(userId, loginData) {
        const riskScore = await this.fraudDetection.calculateRiskScore(userId, loginData);
        
        const analysis = {
            userId,
            riskScore,
            riskLevel: this.getRiskLevel(riskScore),
            factors: await this.fraudDetection.getRiskFactors(userId, loginData),
            timestamp: new Date()
        };

        await this.auditLogger.log('FRAUD_ANALYSIS', analysis);

        if (riskScore > 80) {
            await this.triggerSecurityAlert(userId, 'HIGH_RISK_LOGIN', analysis);
        }

        return analysis;
    }

    async monitorTradingActivity(userId, tradeData) {
        const patterns = await this.fraudDetection.analyzeTradePatterns(userId, tradeData);
        
        if (patterns.suspicious) {
            await this.auditLogger.log('SUSPICIOUS_TRADING', {
                userId,
                tradeData,
                patterns,
                timestamp: new Date()
            });

            await this.triggerSecurityAlert(userId, 'SUSPICIOUS_TRADING', patterns);
        }

        return patterns;
    }

    // Encryption Services
    encryptSensitiveData(data, userId) {
        return this.encryptionService.encrypt(data, userId);
    }

    decryptSensitiveData(encryptedData, userId) {
        return this.encryptionService.decrypt(encryptedData, userId);
    }

    // Security Utilities
    async generateDeviceFingerprint(deviceInfo) {
        const fingerprint = {
            userAgent: deviceInfo.userAgent,
            screen: deviceInfo.screen,
            timezone: deviceInfo.timezone,
            language: deviceInfo.language,
            platform: deviceInfo.platform,
            plugins: deviceInfo.plugins
        };

        return this.encryptionService.hash(JSON.stringify(fingerprint));
    }

    getRiskLevel(score) {
        if (score >= 80) return 'HIGH';
        if (score >= 50) return 'MEDIUM';
        if (score >= 20) return 'LOW';
        return 'MINIMAL';
    }

    async triggerSecurityAlert(userId, alertType, data) {
        const alert = {
            userId,
            alertType,
            data,
            timestamp: new Date(),
            status: 'ACTIVE'
        };

        // Send to security team
        await this.notifySecurityTeam(alert);
        
        // Store alert
        await this.auditLogger.log('SECURITY_ALERT', alert);
        
        return alert;
    }

    async notifySecurityTeam(alert) {
        // Implementation for security team notification
        console.log('Security Alert:', alert);
    }

    setupSecurityPolicies() {
        // Configure security policies
        this.policies = {
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            maxFailedAttempts: 5,
            lockoutDuration: 15 * 60 * 1000, // 15 minutes
            passwordPolicy: {
                minLength: 12,
                requireUppercase: true,
                requireLowercase: true,
                requireNumbers: true,
                requireSpecialChars: true
            }
        };
    }

    initializeDeviceFingerprinting() {
        // Initialize device fingerprinting
        this.deviceFingerprinting = {
            collectBrowserInfo: true,
            collectScreenInfo: true,
            collectTimezoneInfo: true,
            collectPluginInfo: true
        };
    }

    startSecurityMonitoring() {
        // Start continuous security monitoring
        setInterval(() => {
            this.performSecurityChecks();
        }, 60000); // Every minute
    }

    async performSecurityChecks() {
        // Perform routine security checks
        await this.sessionManager.cleanupExpiredSessions();
        await this.fraudDetection.updateRiskModels();
        await this.auditLogger.archiveOldLogs();
    }
}

class TwoFactorAuth {
    constructor() {
        this.totpWindow = 1; // 30-second window
        this.backupCodeLength = 8;
    }

    async generateSecret(userId) {
        const secret = this.generateRandomSecret();
        await this.storeSecret(userId, secret);
        return secret;
    }

    async generateQRCode(userId, secret) {
        const issuer = 'Central Trade Hub';
        const label = `${issuer}:${userId}`;
        const otpauth = `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}`;
        
        // Generate QR code (would use a QR code library)
        return this.createQRCode(otpauth);
    }

    async verifyToken(userId, token, method = 'totp') {
        if (method === 'totp') {
            return await this.verifyTOTP(userId, token);
        } else if (method === 'backup') {
            return await this.verifyBackupCode(userId, token);
        }
        return false;
    }

    async verifyTOTP(userId, token) {
        const secret = await this.getSecret(userId);
        if (!secret) return false;

        const currentTime = Math.floor(Date.now() / 1000 / 30);
        
        // Check current window and adjacent windows
        for (let i = -this.totpWindow; i <= this.totpWindow; i++) {
            const timeStep = currentTime + i;
            const expectedToken = this.generateTOTP(secret, timeStep);
            if (expectedToken === token) {
                return true;
            }
        }
        
        return false;
    }

    generateTOTP(secret, timeStep) {
        // TOTP algorithm implementation
        const hmac = this.hmacSha1(this.base32Decode(secret), this.intToBytes(timeStep));
        const offset = hmac[hmac.length - 1] & 0xf;
        const code = ((hmac[offset] & 0x7f) << 24) |
                    ((hmac[offset + 1] & 0xff) << 16) |
                    ((hmac[offset + 2] & 0xff) << 8) |
                    (hmac[offset + 3] & 0xff);
        return (code % 1000000).toString().padStart(6, '0');
    }

    generateBackupCodes() {
        const codes = [];
        for (let i = 0; i < 10; i++) {
            codes.push(this.generateRandomCode(this.backupCodeLength));
        }
        return codes;
    }

    generateRandomSecret() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        let secret = '';
        for (let i = 0; i < 32; i++) {
            secret += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return secret;
    }

    generateRandomCode(length) {
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        let code = '';
        for (let i = 0; i < length; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Utility methods (simplified implementations)
    hmacSha1(key, data) {
        // HMAC-SHA1 implementation would go here
        return new Array(20).fill(0); // Placeholder
    }

    base32Decode(encoded) {
        // Base32 decode implementation
        return new Uint8Array(20); // Placeholder
    }

    intToBytes(num) {
        const bytes = new Uint8Array(8);
        for (let i = 7; i >= 0; i--) {
            bytes[i] = num & 0xff;
            num >>= 8;
        }
        return bytes;
    }

    createQRCode(data) {
        // QR code generation (would use qrcode library)
        return `data:image/png;base64,${btoa(data)}`; // Placeholder
    }

    async storeSecret(userId, secret) {
        // Store encrypted secret in database
        localStorage.setItem(`2fa_secret_${userId}`, secret);
    }

    async getSecret(userId) {
        // Retrieve encrypted secret from database
        return localStorage.getItem(`2fa_secret_${userId}`);
    }

    async verifyBackupCode(userId, code) {
        // Verify backup code and mark as used
        const usedCodes = JSON.parse(localStorage.getItem(`used_backup_codes_${userId}`) || '[]');
        if (usedCodes.includes(code)) {
            return false;
        }
        
        const validCodes = JSON.parse(localStorage.getItem(`backup_codes_${userId}`) || '[]');
        if (validCodes.includes(code)) {
            usedCodes.push(code);
            localStorage.setItem(`used_backup_codes_${userId}`, JSON.stringify(usedCodes));
            return true;
        }
        
        return false;
    }
}

class BiometricAuth {
    constructor() {
        this.supportedTypes = ['fingerprint', 'face', 'voice'];
    }

    isSupported(biometricType) {
        return this.supportedTypes.includes(biometricType) && 
               'credentials' in navigator;
    }

    async enroll(userId, biometricType) {
        if (!this.isSupported(biometricType)) {
            throw new Error('Biometric type not supported');
        }

        try {
            const credential = await navigator.credentials.create({
                publicKey: {
                    challenge: new Uint8Array(32),
                    rp: { name: 'Central Trade Hub' },
                    user: {
                        id: new TextEncoder().encode(userId),
                        name: userId,
                        displayName: userId
                    },
                    pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required'
                    }
                }
            });

            const enrollment = {
                id: credential.id,
                userId,
                biometricType,
                publicKey: credential.response.publicKey,
                createdAt: new Date()
            };

            await this.storeBiometricData(enrollment);
            return enrollment;
        } catch (error) {
            throw new Error(`Biometric enrollment failed: ${error.message}`);
        }
    }

    async authenticate(userId, biometricData) {
        try {
            const storedCredentials = await this.getBiometricData(userId);
            if (!storedCredentials.length) {
                throw new Error('No biometric data found for user');
            }

            const assertion = await navigator.credentials.get({
                publicKey: {
                    challenge: new Uint8Array(32),
                    allowCredentials: storedCredentials.map(cred => ({
                        id: new TextEncoder().encode(cred.id),
                        type: 'public-key'
                    })),
                    userVerification: 'required'
                }
            });

            const result = {
                success: true,
                confidence: 0.95, // Would be calculated based on actual biometric matching
                credentialId: assertion.id
            };

            return result;
        } catch (error) {
            return {
                success: false,
                confidence: 0,
                error: error.message
            };
        }
    }

    async storeBiometricData(enrollment) {
        const existing = JSON.parse(localStorage.getItem('biometric_data') || '[]');
        existing.push(enrollment);
        localStorage.setItem('biometric_data', JSON.stringify(existing));
    }

    async getBiometricData(userId) {
        const allData = JSON.parse(localStorage.getItem('biometric_data') || '[]');
        return allData.filter(data => data.userId === userId);
    }
}

class FraudDetection {
    constructor() {
        this.riskFactors = {
            newDevice: 20,
            newLocation: 15,
            unusualTime: 10,
            multipleFailedAttempts: 25,
            suspiciousTradePattern: 30,
            highVelocityTrading: 20
        };
        this.userProfiles = new Map();
    }

    async calculateRiskScore(userId, loginData) {
        let riskScore = 0;
        const userProfile = await this.getUserProfile(userId);

        // Check for new device
        if (!userProfile.knownDevices.includes(loginData.deviceFingerprint)) {
            riskScore += this.riskFactors.newDevice;
        }

        // Check for new location
        if (!this.isKnownLocation(userProfile.knownLocations, loginData.location)) {
            riskScore += this.riskFactors.newLocation;
        }

        // Check for unusual time
        if (this.isUnusualTime(userProfile.loginTimes, loginData.timestamp)) {
            riskScore += this.riskFactors.unusualTime;
        }

        // Check for recent failed attempts
        const recentFailures = await this.getRecentFailedAttempts(userId);
        if (recentFailures > 3) {
            riskScore += this.riskFactors.multipleFailedAttempts;
        }

        return Math.min(riskScore, 100);
    }

    async analyzeTradePatterns(userId, tradeData) {
        const userProfile = await this.getUserProfile(userId);
        const recentTrades = await this.getRecentTrades(userId, 24); // Last 24 hours

        const analysis = {
            suspicious: false,
            reasons: [],
            riskScore: 0
        };

        // Check trade frequency
        if (recentTrades.length > userProfile.avgDailyTrades * 3) {
            analysis.suspicious = true;
            analysis.reasons.push('Unusually high trade frequency');
            analysis.riskScore += this.riskFactors.highVelocityTrading;
        }

        // Check trade amounts
        const avgTradeAmount = userProfile.avgTradeAmount;
        if (tradeData.amount > avgTradeAmount * 5) {
            analysis.suspicious = true;
            analysis.reasons.push('Unusually large trade amount');
            analysis.riskScore += this.riskFactors.suspiciousTradePattern;
        }

        // Check for rapid position changes
        const rapidChanges = this.detectRapidPositionChanges(recentTrades);
        if (rapidChanges) {
            analysis.suspicious = true;
            analysis.reasons.push('Rapid position changes detected');
            analysis.riskScore += this.riskFactors.suspiciousTradePattern;
        }

        return analysis;
    }

    async recordFailedAuth(userId, reason) {
        const failure = {
            userId,
            reason,
            timestamp: new Date(),
            ipAddress: this.getCurrentIP()
        };

        const failures = JSON.parse(localStorage.getItem(`failed_auth_${userId}`) || '[]');
        failures.push(failure);
        
        // Keep only last 50 failures
        if (failures.length > 50) {
            failures.splice(0, failures.length - 50);
        }
        
        localStorage.setItem(`failed_auth_${userId}`, JSON.stringify(failures));
    }

    async recordSuspiciousActivity(userId, activityType) {
        const activity = {
            userId,
            activityType,
            timestamp: new Date(),
            ipAddress: this.getCurrentIP()
        };

        const activities = JSON.parse(localStorage.getItem(`suspicious_activity_${userId}`) || '[]');
        activities.push(activity);
        localStorage.setItem(`suspicious_activity_${userId}`, JSON.stringify(activities));
    }

    async getUserProfile(userId) {
        if (this.userProfiles.has(userId)) {
            return this.userProfiles.get(userId);
        }

        const profile = {
            knownDevices: [],
            knownLocations: [],
            loginTimes: [],
            avgDailyTrades: 10,
            avgTradeAmount: 1000,
            lastUpdated: new Date()
        };

        this.userProfiles.set(userId, profile);
        return profile;
    }

    isKnownLocation(knownLocations, currentLocation) {
        return knownLocations.some(loc => 
            Math.abs(loc.lat - currentLocation.lat) < 0.1 &&
            Math.abs(loc.lng - currentLocation.lng) < 0.1
        );
    }

    isUnusualTime(loginTimes, currentTime) {
        const hour = new Date(currentTime).getHours();
        const usualHours = loginTimes.map(time => new Date(time).getHours());
        
        if (usualHours.length === 0) return false;
        
        const avgHour = usualHours.reduce((a, b) => a + b) / usualHours.length;
        return Math.abs(hour - avgHour) > 6; // More than 6 hours difference
    }

    detectRapidPositionChanges(trades) {
        if (trades.length < 3) return false;
        
        const timeWindow = 5 * 60 * 1000; // 5 minutes
        let rapidChanges = 0;
        
        for (let i = 1; i < trades.length; i++) {
            const timeDiff = new Date(trades[i].timestamp) - new Date(trades[i-1].timestamp);
            if (timeDiff < timeWindow && trades[i].type !== trades[i-1].type) {
                rapidChanges++;
            }
        }
        
        return rapidChanges > 3;
    }

    async getRecentFailedAttempts(userId) {
        const failures = JSON.parse(localStorage.getItem(`failed_auth_${userId}`) || '[]');
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        return failures.filter(failure => 
            new Date(failure.timestamp) > oneHourAgo
        ).length;
    }

    async getRecentTrades(userId, hours) {
        // This would typically fetch from a database
        const trades = JSON.parse(localStorage.getItem(`trades_${userId}`) || '[]');
        const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
        
        return trades.filter(trade => new Date(trade.timestamp) > cutoff);
    }

    getCurrentIP() {
        // In a real implementation, this would get the actual IP
        return '127.0.0.1';
    }

    async updateRiskModels() {
        // Update machine learning models for fraud detection
        console.log('Updating fraud detection models...');
    }

    async getRiskFactors(userId, loginData) {
        const factors = [];
        const userProfile = await this.getUserProfile(userId);

        if (!userProfile.knownDevices.includes(loginData.deviceFingerprint)) {
            factors.push('New device detected');
        }

        if (!this.isKnownLocation(userProfile.knownLocations, loginData.location)) {
            factors.push('New location detected');
        }

        if (this.isUnusualTime(userProfile.loginTimes, loginData.timestamp)) {
            factors.push('Unusual login time');
        }

        return factors;
    }
}

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionTimeout = 30 * 60 * 1000; // 30 minutes
    }

    generateSecureToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }

    async storeSession(session) {
        this.sessions.set(session.sessionId, session);
        
        // Also store in localStorage for persistence
        const sessions = JSON.parse(localStorage.getItem('active_sessions') || '{}');
        sessions[session.sessionId] = session;
        localStorage.setItem('active_sessions', JSON.stringify(sessions));
    }

    async getSession(sessionId) {
        let session = this.sessions.get(sessionId);
        
        if (!session) {
            const sessions = JSON.parse(localStorage.getItem('active_sessions') || '{}');
            session = sessions[sessionId];
            if (session) {
                this.sessions.set(sessionId, session);
            }
        }
        
        return session;
    }

    async updateLastActivity(sessionId) {
        const session = await this.getSession(sessionId);
        if (session) {
            session.lastActivity = new Date();
            await this.storeSession(session);
        }
    }

    async cleanupExpiredSessions() {
        const now = new Date();
        const sessions = JSON.parse(localStorage.getItem('active_sessions') || '{}');
        
        for (const [sessionId, session] of Object.entries(sessions)) {
            const lastActivity = new Date(session.lastActivity);
            if (now - lastActivity > this.sessionTimeout) {
                delete sessions[sessionId];
                this.sessions.delete(sessionId);
            }
        }
        
        localStorage.setItem('active_sessions', JSON.stringify(sessions));
    }
}

class EncryptionService {
    constructor() {
        this.algorithm = 'AES-GCM';
        this.keyLength = 256;
    }

    async generateKey() {
        return await crypto.subtle.generateKey(
            {
                name: this.algorithm,
                length: this.keyLength
            },
            true,
            ['encrypt', 'decrypt']
        );
    }

    async encrypt(data, userId) {
        const key = await this.getUserKey(userId);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encodedData = new TextEncoder().encode(JSON.stringify(data));
        
        const encrypted = await crypto.subtle.encrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            encodedData
        );
        
        return {
            data: Array.from(new Uint8Array(encrypted)),
            iv: Array.from(iv)
        };
    }

    async decrypt(encryptedData, userId) {
        const key = await this.getUserKey(userId);
        const iv = new Uint8Array(encryptedData.iv);
        const data = new Uint8Array(encryptedData.data);
        
        const decrypted = await crypto.subtle.decrypt(
            {
                name: this.algorithm,
                iv: iv
            },
            key,
            data
        );
        
        const decodedData = new TextDecoder().decode(decrypted);
        return JSON.parse(decodedData);
    }

    async getUserKey(userId) {
        // In a real implementation, this would securely derive or retrieve user-specific keys
        const keyData = new TextEncoder().encode(userId.padEnd(32, '0'));
        return await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: this.algorithm },
            false,
            ['encrypt', 'decrypt']
        );
    }

    hash(data) {
        // Simple hash function (in production, use crypto.subtle.digest)
        let hash = 0;
        for (let i = 0; i < data.length; i++) {
            const char = data.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
}

class AuditLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 10000;
    }

    async log(eventType, data) {
        const logEntry = {
            id: this.generateLogId(),
            eventType,
            data,
            timestamp: new Date(),
            severity: this.getSeverity(eventType)
        };

        this.logs.push(logEntry);
        
        // Store in localStorage
        const storedLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
        storedLogs.push(logEntry);
        
        // Keep only recent logs
        if (storedLogs.length > this.maxLogs) {
            storedLogs.splice(0, storedLogs.length - this.maxLogs);
        }
        
        localStorage.setItem('audit_logs', JSON.stringify(storedLogs));
        
        // Send to server in production
        await this.sendToServer(logEntry);
    }

    generateLogId() {
        return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getSeverity(eventType) {
        const highSeverity = ['SECURITY_ALERT', 'FRAUD_DETECTED', 'BIOMETRIC_AUTH_ERROR'];
        const mediumSeverity = ['2FA_VERIFICATION', 'SESSION_VALIDATION_FAILED', 'SUSPICIOUS_TRADING'];
        
        if (highSeverity.includes(eventType)) return 'HIGH';
        if (mediumSeverity.includes(eventType)) return 'MEDIUM';
        return 'LOW';
    }

    async sendToServer(logEntry) {
        try {
            await fetch('/api/audit-logs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logEntry)
            });
        } catch (error) {
            console.error('Failed to send audit log to server:', error);
        }
    }

    async archiveOldLogs() {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const storedLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
        
        const recentLogs = storedLogs.filter(log => 
            new Date(log.timestamp) > thirtyDaysAgo
        );
        
        localStorage.setItem('audit_logs', JSON.stringify(recentLogs));
    }

    async getLogs(filters = {}) {
        const storedLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]');
        
        let filteredLogs = storedLogs;
        
        if (filters.eventType) {
            filteredLogs = filteredLogs.filter(log => log.eventType === filters.eventType);
        }
        
        if (filters.userId) {
            filteredLogs = filteredLogs.filter(log => 
                log.data && log.data.userId === filters.userId
            );
        }
        
        if (filters.severity) {
            filteredLogs = filteredLogs.filter(log => log.severity === filters.severity);
        }
        
        return filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SecurityManager,
        TwoFactorAuth,
        BiometricAuth,
        FraudDetection,
        SessionManager,
        EncryptionService,
        AuditLogger
    };
}