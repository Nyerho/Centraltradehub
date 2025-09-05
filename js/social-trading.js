class SocialTradingPlatform {
    constructor() {
        this.copyTradingManager = new CopyTradingManager();
        this.signalProviderManager = new SignalProviderManager();
        this.communityManager = new CommunityManager();
        this.leaderboardManager = new LeaderboardManager();
        this.socialFeedManager = new SocialFeedManager();
        this.notificationManager = new NotificationManager();
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSocialData();
        this.startRealTimeUpdates();
    }

    // Copy Trading Management
    async startCopyTrading(followerId, providerId, settings) {
        return await this.copyTradingManager.createCopyRelationship(followerId, providerId, settings);
    }

    async stopCopyTrading(relationshipId) {
        return await this.copyTradingManager.stopCopyRelationship(relationshipId);
    }

    async getCopyTradingStats(userId) {
        return await this.copyTradingManager.getCopyTradingStatistics(userId);
    }

    // Signal Provider Management
    async becomeSignalProvider(userId, providerData) {
        return await this.signalProviderManager.registerProvider(userId, providerData);
    }

    async publishSignal(providerId, signalData) {
        return await this.signalProviderManager.publishSignal(providerId, signalData);
    }

    async getTopSignalProviders(filters = {}) {
        return await this.signalProviderManager.getTopProviders(filters);
    }

    // Community Features
    async createPost(userId, postData) {
        return await this.communityManager.createPost(userId, postData);
    }

    async followUser(followerId, followeeId) {
        return await this.communityManager.followUser(followerId, followeeId);
    }

    async getSocialFeed(userId, filters = {}) {
        return await this.socialFeedManager.getFeed(userId, filters);
    }

    // Leaderboard
    async getLeaderboard(category = 'overall', timeframe = 'monthly') {
        return await this.leaderboardManager.getLeaderboard(category, timeframe);
    }

    setupEventListeners() {
        // Real-time updates for social features
        this.copyTradingManager.on('tradeExecuted', (data) => {
            this.notificationManager.notifyFollowers(data);
        });

        this.signalProviderManager.on('signalPublished', (signal) => {
            this.notificationManager.notifySubscribers(signal);
        });

        this.communityManager.on('postCreated', (post) => {
            this.socialFeedManager.updateFeeds(post);
        });
    }

    loadSocialData() {
        // Load cached social data
        this.loadFromStorage();
    }

    startRealTimeUpdates() {
        // Start WebSocket connections for real-time updates
        setInterval(() => {
            this.updateRealTimeData();
        }, 5000);
    }

    async updateRealTimeData() {
        // Update real-time social trading data
        await this.copyTradingManager.updateRealTimeStats();
        await this.leaderboardManager.updateRankings();
    }

    loadFromStorage() {
        // Load data from localStorage
        const socialData = localStorage.getItem('socialTradingData');
        if (socialData) {
            const parsed = JSON.parse(socialData);
            // Initialize with stored data
        }
    }
}

class CopyTradingManager {
    constructor() {
        this.copyRelationships = new Map();
        this.tradeHistory = [];
        this.eventListeners = new Map();
        this.riskManager = new CopyTradingRiskManager();
    }

    async createCopyRelationship(followerId, providerId, settings) {
        try {
            // Validate provider
            const provider = await this.validateProvider(providerId);
            if (!provider.isActive) {
                throw new Error('Provider is not active');
            }

            // Create relationship
            const relationshipId = this.generateRelationshipId();
            const relationship = {
                id: relationshipId,
                followerId,
                providerId,
                settings: {
                    copyRatio: settings.copyRatio || 0.1, // 10% of provider's position size
                    maxRiskPerTrade: settings.maxRiskPerTrade || 2, // 2% max risk
                    stopLoss: settings.stopLoss || 5, // 5% stop loss
                    takeProfit: settings.takeProfit || 10, // 10% take profit
                    maxOpenTrades: settings.maxOpenTrades || 5,
                    allowedSymbols: settings.allowedSymbols || [],
                    excludedSymbols: settings.excludedSymbols || [],
                    tradingHours: settings.tradingHours || { start: '09:00', end: '17:00' }
                },
                status: 'active',
                createdAt: new Date(),
                statistics: {
                    totalTrades: 0,
                    winningTrades: 0,
                    losingTrades: 0,
                    totalPnL: 0,
                    winRate: 0,
                    avgWin: 0,
                    avgLoss: 0
                }
            };

            this.copyRelationships.set(relationshipId, relationship);
            await this.saveCopyRelationship(relationship);
            
            this.emit('copyRelationshipCreated', relationship);
            return relationship;
        } catch (error) {
            throw new Error(`Failed to create copy relationship: ${error.message}`);
        }
    }

    async executeCopyTrade(providerId, originalTrade) {
        try {
            const followers = this.getActiveFollowers(providerId);
            
            for (const relationship of followers) {
                if (await this.shouldCopyTrade(relationship, originalTrade)) {
                    const copyTrade = await this.createCopyTrade(relationship, originalTrade);
                    await this.executeTrade(copyTrade);
                    
                    this.updateRelationshipStats(relationship.id, copyTrade);
                    this.emit('tradeExecuted', { relationship, copyTrade, originalTrade });
                }
            }
        } catch (error) {
            console.error('Copy trade execution failed:', error);
        }
    }

    async shouldCopyTrade(relationship, trade) {
        const settings = relationship.settings;
        
        // Check if symbol is allowed
        if (settings.allowedSymbols.length > 0 && !settings.allowedSymbols.includes(trade.symbol)) {
            return false;
        }
        
        // Check if symbol is excluded
        if (settings.excludedSymbols.includes(trade.symbol)) {
            return false;
        }
        
        // Check trading hours
        if (!this.isWithinTradingHours(settings.tradingHours)) {
            return false;
        }
        
        // Check max open trades
        const openTrades = await this.getOpenCopyTrades(relationship.id);
        if (openTrades.length >= settings.maxOpenTrades) {
            return false;
        }
        
        // Risk management check
        return await this.riskManager.validateTrade(relationship, trade);
    }

    async createCopyTrade(relationship, originalTrade) {
        const settings = relationship.settings;
        const copySize = originalTrade.size * settings.copyRatio;
        
        return {
            id: this.generateTradeId(),
            relationshipId: relationship.id,
            followerId: relationship.followerId,
            providerId: relationship.providerId,
            originalTradeId: originalTrade.id,
            symbol: originalTrade.symbol,
            type: originalTrade.type,
            size: copySize,
            entryPrice: originalTrade.entryPrice,
            stopLoss: this.calculateStopLoss(originalTrade, settings),
            takeProfit: this.calculateTakeProfit(originalTrade, settings),
            timestamp: new Date(),
            status: 'pending'
        };
    }

    calculateStopLoss(trade, settings) {
        const slDistance = trade.entryPrice * (settings.stopLoss / 100);
        return trade.type === 'buy' ? 
            trade.entryPrice - slDistance : 
            trade.entryPrice + slDistance;
    }

    calculateTakeProfit(trade, settings) {
        const tpDistance = trade.entryPrice * (settings.takeProfit / 100);
        return trade.type === 'buy' ? 
            trade.entryPrice + tpDistance : 
            trade.entryPrice - tpDistance;
    }

    async stopCopyRelationship(relationshipId) {
        const relationship = this.copyRelationships.get(relationshipId);
        if (!relationship) {
            throw new Error('Copy relationship not found');
        }

        relationship.status = 'stopped';
        relationship.stoppedAt = new Date();
        
        // Close all open copy trades
        await this.closeAllCopyTrades(relationshipId);
        
        await this.saveCopyRelationship(relationship);
        this.emit('copyRelationshipStopped', relationship);
        
        return relationship;
    }

    async getCopyTradingStatistics(userId) {
        const asFollower = Array.from(this.copyRelationships.values())
            .filter(r => r.followerId === userId);
        const asProvider = Array.from(this.copyRelationships.values())
            .filter(r => r.providerId === userId);

        return {
            asFollower: {
                activeRelationships: asFollower.filter(r => r.status === 'active').length,
                totalPnL: asFollower.reduce((sum, r) => sum + r.statistics.totalPnL, 0),
                winRate: this.calculateAverageWinRate(asFollower),
                totalTrades: asFollower.reduce((sum, r) => sum + r.statistics.totalTrades, 0)
            },
            asProvider: {
                followers: asProvider.length,
                totalCopiedTrades: asProvider.reduce((sum, r) => sum + r.statistics.totalTrades, 0),
                averageFollowerPnL: this.calculateAverageFollowerPnL(asProvider),
                rating: await this.calculateProviderRating(userId)
            }
        };
    }

    getActiveFollowers(providerId) {
        return Array.from(this.copyRelationships.values())
            .filter(r => r.providerId === providerId && r.status === 'active');
    }

    async getOpenCopyTrades(relationshipId) {
        // This would typically query a database
        return this.tradeHistory.filter(trade => 
            trade.relationshipId === relationshipId && trade.status === 'open'
        );
    }

    isWithinTradingHours(tradingHours) {
        const now = new Date();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const startTime = parseInt(tradingHours.start.replace(':', ''));
        const endTime = parseInt(tradingHours.end.replace(':', ''));
        
        return currentTime >= startTime && currentTime <= endTime;
    }

    updateRelationshipStats(relationshipId, trade) {
        const relationship = this.copyRelationships.get(relationshipId);
        if (relationship && trade.pnl !== undefined) {
            const stats = relationship.statistics;
            stats.totalTrades++;
            stats.totalPnL += trade.pnl;
            
            if (trade.pnl > 0) {
                stats.winningTrades++;
                stats.avgWin = (stats.avgWin * (stats.winningTrades - 1) + trade.pnl) / stats.winningTrades;
            } else {
                stats.losingTrades++;
                stats.avgLoss = (stats.avgLoss * (stats.losingTrades - 1) + Math.abs(trade.pnl)) / stats.losingTrades;
            }
            
            stats.winRate = (stats.winningTrades / stats.totalTrades) * 100;
        }
    }

    calculateAverageWinRate(relationships) {
        if (relationships.length === 0) return 0;
        const totalWinRate = relationships.reduce((sum, r) => sum + r.statistics.winRate, 0);
        return totalWinRate / relationships.length;
    }

    calculateAverageFollowerPnL(relationships) {
        if (relationships.length === 0) return 0;
        const totalPnL = relationships.reduce((sum, r) => sum + r.statistics.totalPnL, 0);
        return totalPnL / relationships.length;
    }

    async calculateProviderRating(providerId) {
        // Calculate provider rating based on performance, followers, etc.
        const followers = this.getActiveFollowers(providerId);
        const avgPnL = this.calculateAverageFollowerPnL(followers);
        const avgWinRate = this.calculateAverageWinRate(followers);
        
        // Simple rating calculation (0-5 stars)
        const pnlScore = Math.min(avgPnL / 1000, 2); // Max 2 points for PnL
        const winRateScore = (avgWinRate / 100) * 2; // Max 2 points for win rate
        const followerScore = Math.min(followers.length / 10, 1); // Max 1 point for followers
        
        return Math.min(pnlScore + winRateScore + followerScore, 5);
    }

    async validateProvider(providerId) {
        // Validate if user can be a signal provider
        return {
            isActive: true,
            verified: true,
            rating: 4.5
        };
    }

    async executeTrade(trade) {
        // Execute the copy trade
        trade.status = 'executed';
        trade.executedAt = new Date();
        this.tradeHistory.push(trade);
    }

    async closeAllCopyTrades(relationshipId) {
        const openTrades = await this.getOpenCopyTrades(relationshipId);
        for (const trade of openTrades) {
            trade.status = 'closed';
            trade.closedAt = new Date();
        }
    }

    generateRelationshipId() {
        return 'copy_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateTradeId() {
        return 'trade_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async saveCopyRelationship(relationship) {
        // Save to backend and localStorage
        const relationships = JSON.parse(localStorage.getItem('copyRelationships') || '[]');
        const index = relationships.findIndex(r => r.id === relationship.id);
        
        if (index >= 0) {
            relationships[index] = relationship;
        } else {
            relationships.push(relationship);
        }
        
        localStorage.setItem('copyRelationships', JSON.stringify(relationships));
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }

    async updateRealTimeStats() {
        // Update real-time copy trading statistics
        for (const relationship of this.copyRelationships.values()) {
            if (relationship.status === 'active') {
                // Update real-time P&L and statistics
                await this.updateRelationshipRealTimePnL(relationship);
            }
        }
    }

    async updateRelationshipRealTimePnL(relationship) {
        const openTrades = await this.getOpenCopyTrades(relationship.id);
        let unrealizedPnL = 0;
        
        for (const trade of openTrades) {
            const currentPrice = await this.getCurrentPrice(trade.symbol);
            const pnl = this.calculateUnrealizedPnL(trade, currentPrice);
            unrealizedPnL += pnl;
        }
        
        relationship.statistics.unrealizedPnL = unrealizedPnL;
    }

    calculateUnrealizedPnL(trade, currentPrice) {
        const priceDiff = currentPrice - trade.entryPrice;
        const multiplier = trade.type === 'buy' ? 1 : -1;
        return priceDiff * trade.size * multiplier;
    }

    async getCurrentPrice(symbol) {
        // Get current market price
        try {
            const response = await fetch(`/api/market-data/${symbol}`);
            const data = await response.json();
            return data.price;
        } catch (error) {
            console.error('Failed to get current price:', error);
            return 0;
        }
    }
}

class CopyTradingRiskManager {
    async validateTrade(relationship, trade) {
        const settings = relationship.settings;
        
        // Check risk per trade
        const riskAmount = trade.size * trade.entryPrice * (settings.maxRiskPerTrade / 100);
        const accountBalance = await this.getAccountBalance(relationship.followerId);
        
        if (riskAmount > accountBalance * (settings.maxRiskPerTrade / 100)) {
            return false;
        }
        
        // Check correlation with existing positions
        const correlation = await this.checkCorrelation(relationship.followerId, trade.symbol);
        if (correlation > 0.8) {
            return false;
        }
        
        return true;
    }

    async getAccountBalance(userId) {
        // Get user's account balance
        return 10000; // Placeholder
    }

    async checkCorrelation(userId, symbol) {
        // Check correlation with existing positions
        return 0.3; // Placeholder
    }
}

class SignalProviderManager {
    constructor() {
        this.providers = new Map();
        this.signals = [];
        this.subscriptions = new Map();
        this.eventListeners = new Map();
    }

    async registerProvider(userId, providerData) {
        try {
            const provider = {
                id: this.generateProviderId(),
                userId,
                name: providerData.name,
                description: providerData.description,
                strategy: providerData.strategy,
                riskLevel: providerData.riskLevel || 'medium',
                subscriptionFee: providerData.subscriptionFee || 0,
                performance: {
                    totalSignals: 0,
                    successfulSignals: 0,
                    successRate: 0,
                    avgReturn: 0,
                    maxDrawdown: 0,
                    sharpeRatio: 0
                },
                statistics: {
                    subscribers: 0,
                    totalRevenue: 0,
                    rating: 0,
                    reviews: []
                },
                status: 'active',
                createdAt: new Date(),
                verificationStatus: 'pending'
            };

            this.providers.set(provider.id, provider);
            await this.saveProvider(provider);
            
            return provider;
        } catch (error) {
            throw new Error(`Failed to register provider: ${error.message}`);
        }
    }

    async publishSignal(providerId, signalData) {
        try {
            const provider = this.providers.get(providerId);
            if (!provider || provider.status !== 'active') {
                throw new Error('Provider not found or inactive');
            }

            const signal = {
                id: this.generateSignalId(),
                providerId,
                symbol: signalData.symbol,
                type: signalData.type, // 'buy' or 'sell'
                entryPrice: signalData.entryPrice,
                stopLoss: signalData.stopLoss,
                takeProfit: signalData.takeProfit,
                confidence: signalData.confidence || 'medium',
                timeframe: signalData.timeframe || '1h',
                analysis: signalData.analysis || '',
                tags: signalData.tags || [],
                expiresAt: signalData.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000),
                publishedAt: new Date(),
                status: 'active',
                performance: {
                    views: 0,
                    likes: 0,
                    follows: 0,
                    comments: [],
                    result: null // 'hit_tp', 'hit_sl', 'expired', 'cancelled'
                }
            };

            this.signals.push(signal);
            provider.performance.totalSignals++;
            
            await this.saveSignal(signal);
            await this.notifySubscribers(providerId, signal);
            
            this.emit('signalPublished', signal);
            return signal;
        } catch (error) {
            throw new Error(`Failed to publish signal: ${error.message}`);
        }
    }

    async subscribeToProvider(userId, providerId) {
        const provider = this.providers.get(providerId);
        if (!provider) {
            throw new Error('Provider not found');
        }

        const subscription = {
            id: this.generateSubscriptionId(),
            userId,
            providerId,
            subscribedAt: new Date(),
            status: 'active',
            settings: {
                notifications: true,
                autoTrade: false,
                riskLevel: 'medium'
            }
        };

        if (!this.subscriptions.has(userId)) {
            this.subscriptions.set(userId, []);
        }
        this.subscriptions.get(userId).push(subscription);
        
        provider.statistics.subscribers++;
        
        await this.saveSubscription(subscription);
        return subscription;
    }

    async getTopProviders(filters = {}) {
        let providers = Array.from(this.providers.values())
            .filter(p => p.status === 'active' && p.verificationStatus === 'verified');

        // Apply filters
        if (filters.riskLevel) {
            providers = providers.filter(p => p.riskLevel === filters.riskLevel);
        }
        
        if (filters.minSuccessRate) {
            providers = providers.filter(p => p.performance.successRate >= filters.minSuccessRate);
        }
        
        if (filters.strategy) {
            providers = providers.filter(p => p.strategy === filters.strategy);
        }

        // Sort by performance
        const sortBy = filters.sortBy || 'rating';
        providers.sort((a, b) => {
            switch (sortBy) {
                case 'rating':
                    return b.statistics.rating - a.statistics.rating;
                case 'successRate':
                    return b.performance.successRate - a.performance.successRate;
                case 'subscribers':
                    return b.statistics.subscribers - a.statistics.subscribers;
                case 'avgReturn':
                    return b.performance.avgReturn - a.performance.avgReturn;
                default:
                    return b.statistics.rating - a.statistics.rating;
            }
        });

        return providers.slice(0, filters.limit || 20);
    }

    async getSignalsByProvider(providerId, filters = {}) {
        let signals = this.signals.filter(s => s.providerId === providerId);
        
        if (filters.status) {
            signals = signals.filter(s => s.status === filters.status);
        }
        
        if (filters.symbol) {
            signals = signals.filter(s => s.symbol === filters.symbol);
        }
        
        return signals.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
    }

    async updateSignalPerformance(signalId, result, finalPrice) {
        const signal = this.signals.find(s => s.id === signalId);
        if (!signal) return;

        signal.performance.result = result;
        signal.finalPrice = finalPrice;
        signal.closedAt = new Date();
        
        const provider = this.providers.get(signal.providerId);
        if (provider) {
            if (result === 'hit_tp') {
                provider.performance.successfulSignals++;
            }
            
            provider.performance.successRate = 
                (provider.performance.successfulSignals / provider.performance.totalSignals) * 100;
            
            // Calculate return
            const returnPct = this.calculateSignalReturn(signal, finalPrice);
            provider.performance.avgReturn = 
                (provider.performance.avgReturn + returnPct) / 2;
        }
        
        await this.saveSignal(signal);
        await this.saveProvider(provider);
    }

    calculateSignalReturn(signal, finalPrice) {
        const entryPrice = signal.entryPrice;
        const priceDiff = finalPrice - entryPrice;
        const multiplier = signal.type === 'buy' ? 1 : -1;
        return (priceDiff / entryPrice) * multiplier * 100;
    }

    async notifySubscribers(providerId, signal) {
        const subscribers = this.getProviderSubscribers(providerId);
        
        for (const subscription of subscribers) {
            if (subscription.settings.notifications) {
                await this.sendSignalNotification(subscription.userId, signal);
            }
        }
    }

    getProviderSubscribers(providerId) {
        const allSubscriptions = [];
        for (const userSubs of this.subscriptions.values()) {
            allSubscriptions.push(...userSubs.filter(s => 
                s.providerId === providerId && s.status === 'active'
            ));
        }
        return allSubscriptions;
    }

    async sendSignalNotification(userId, signal) {
        // Send notification to user
        console.log(`Notification sent to ${userId} for signal ${signal.id}`);
    }

    generateProviderId() {
        return 'provider_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateSignalId() {
        return 'signal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateSubscriptionId() {
        return 'sub_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async saveProvider(provider) {
        const providers = JSON.parse(localStorage.getItem('signalProviders') || '[]');
        const index = providers.findIndex(p => p.id === provider.id);
        
        if (index >= 0) {
            providers[index] = provider;
        } else {
            providers.push(provider);
        }
        
        localStorage.setItem('signalProviders', JSON.stringify(providers));
    }

    async saveSignal(signal) {
        const signals = JSON.parse(localStorage.getItem('tradingSignals') || '[]');
        const index = signals.findIndex(s => s.id === signal.id);
        
        if (index >= 0) {
            signals[index] = signal;
        } else {
            signals.push(signal);
        }
        
        localStorage.setItem('tradingSignals', JSON.stringify(signals));
    }

    async saveSubscription(subscription) {
        const subscriptions = JSON.parse(localStorage.getItem('signalSubscriptions') || '[]');
        subscriptions.push(subscription);
        localStorage.setItem('signalSubscriptions', JSON.stringify(subscriptions));
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
}

class CommunityManager {
    constructor() {
        this.posts = [];
        this.users = new Map();
        this.follows = new Map();
        this.eventListeners = new Map();
    }

    async createPost(userId, postData) {
        try {
            const post = {
                id: this.generatePostId(),
                userId,
                type: postData.type || 'text', // 'text', 'image', 'trade', 'analysis'
                content: postData.content,
                images: postData.images || [],
                tags: postData.tags || [],
                tradeData: postData.tradeData || null,
                createdAt: new Date(),
                engagement: {
                    likes: 0,
                    comments: [],
                    shares: 0,
                    views: 0
                },
                visibility: postData.visibility || 'public' // 'public', 'followers', 'private'
            };

            this.posts.push(post);
            await this.savePost(post);
            
            this.emit('postCreated', post);
            return post;
        } catch (error) {
            throw new Error(`Failed to create post: ${error.message}`);
        }
    }

    async likePost(userId, postId) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            throw new Error('Post not found');
        }

        post.engagement.likes++;
        await this.savePost(post);
        
        return post;
    }

    async commentOnPost(userId, postId, comment) {
        const post = this.posts.find(p => p.id === postId);
        if (!post) {
            throw new Error('Post not found');
        }

        const commentObj = {
            id: this.generateCommentId(),
            userId,
            content: comment,
            createdAt: new Date(),
            likes: 0
        };

        post.engagement.comments.push(commentObj);
        await this.savePost(post);
        
        return commentObj;
    }

    async followUser(followerId, followeeId) {
        if (followerId === followeeId) {
            throw new Error('Cannot follow yourself');
        }

        if (!this.follows.has(followerId)) {
            this.follows.set(followerId, new Set());
        }
        
        this.follows.get(followerId).add(followeeId);
        
        const followRelation = {
            followerId,
            followeeId,
            followedAt: new Date()
        };
        
        await this.saveFollowRelation(followRelation);
        return followRelation;
    }

    async unfollowUser(followerId, followeeId) {
        if (this.follows.has(followerId)) {
            this.follows.get(followerId).delete(followeeId);
        }
        
        await this.removeFollowRelation(followerId, followeeId);
    }

    getFollowers(userId) {
        const followers = [];
        for (const [followerId, followees] of this.follows.entries()) {
            if (followees.has(userId)) {
                followers.push(followerId);
            }
        }
        return followers;
    }

    getFollowing(userId) {
        return Array.from(this.follows.get(userId) || []);
    }

    async getUserProfile(userId) {
        const userPosts = this.posts.filter(p => p.userId === userId);
        const followers = this.getFollowers(userId);
        const following = this.getFollowing(userId);
        
        return {
            userId,
            posts: userPosts.length,
            followers: followers.length,
            following: following.length,
            totalLikes: userPosts.reduce((sum, p) => sum + p.engagement.likes, 0),
            totalViews: userPosts.reduce((sum, p) => sum + p.engagement.views, 0)
        };
    }

    async getPostsByUser(userId, limit = 20) {
        return this.posts
            .filter(p => p.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, limit);
    }

    async searchPosts(query, filters = {}) {
        let results = this.posts.filter(post => {
            const contentMatch = post.content.toLowerCase().includes(query.toLowerCase());
            const tagMatch = post.tags.some(tag => tag.toLowerCase().includes(query.toLowerCase()));
            return contentMatch || tagMatch;
        });

        if (filters.type) {
            results = results.filter(p => p.type === filters.type);
        }
        
        if (filters.userId) {
            results = results.filter(p => p.userId === filters.userId);
        }
        
        return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }

    generatePostId() {
        return 'post_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    generateCommentId() {
        return 'comment_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    async savePost(post) {
        const posts = JSON.parse(localStorage.getItem('communityPosts') || '[]');
        const index = posts.findIndex(p => p.id === post.id);
        
        if (index >= 0) {
            posts[index] = post;
        } else {
            posts.push(post);
        }
        
        localStorage.setItem('communityPosts', JSON.stringify(posts));
    }

    async saveFollowRelation(relation) {
        const relations = JSON.parse(localStorage.getItem('followRelations') || '[]');
        relations.push(relation);
        localStorage.setItem('followRelations', JSON.stringify(relations));
    }

    async removeFollowRelation(followerId, followeeId) {
        const relations = JSON.parse(localStorage.getItem('followRelations') || '[]');
        const filtered = relations.filter(r => 
            !(r.followerId === followerId && r.followeeId === followeeId)
        );
        localStorage.setItem('followRelations', JSON.stringify(filtered));
    }

    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    emit(event, data) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
}

class LeaderboardManager {
    constructor() {
        this.leaderboards = new Map();
        this.userStats = new Map();
    }

    async getLeaderboard(category = 'overall', timeframe = 'monthly') {
        const key = `${category}_${timeframe}`;
        
        if (this.leaderboards.has(key)) {
            return this.leaderboards.get(key);
        }
        
        const leaderboard = await this.calculateLeaderboard(category, timeframe);
        this.leaderboards.set(key, leaderboard);
        
        return leaderboard;
    }

    async calculateLeaderboard(category, timeframe) {
        const users = await this.getUsersForTimeframe(timeframe);
        
        let sortedUsers = [];
        
        switch (category) {
            case 'profit':
                sortedUsers = users.sort((a, b) => b.totalProfit - a.totalProfit);
                break;
            case 'winRate':
                sortedUsers = users.sort((a, b) => b.winRate - a.winRate);
                break;
            case 'followers':
                sortedUsers = users.sort((a, b) => b.followers - a.followers);
                break;
            case 'signals':
                sortedUsers = users.sort((a, b) => b.successfulSignals - a.successfulSignals);
                break;
            default: // overall
                sortedUsers = users.sort((a, b) => b.overallScore - a.overallScore);
        }
        
        return sortedUsers.slice(0, 100).map((user, index) => ({
            rank: index + 1,
            ...user
        }));
    }

    async getUsersForTimeframe(timeframe) {
        // This would typically fetch from database
        // For now, return mock data
        return [
            {
                userId: 'user1',
                username: 'TradingPro',
                totalProfit: 15000,
                winRate: 75,
                followers: 150,
                successfulSignals: 45,
                overallScore: 850
            },
            {
                userId: 'user2',
                username: 'ForexMaster',
                totalProfit: 12000,
                winRate: 80,
                followers: 200,
                successfulSignals: 38,
                overallScore: 820
            }
        ];
    }

    async updateUserStats(userId, stats) {
        this.userStats.set(userId, {
            ...this.userStats.get(userId),
            ...stats,
            lastUpdated: new Date()
        });
        
        // Invalidate affected leaderboards
        this.leaderboards.clear();
    }

    async updateRankings() {
        // Recalculate all leaderboards
        this.leaderboards.clear();
        
        const categories = ['overall', 'profit', 'winRate', 'followers', 'signals'];
        const timeframes = ['daily', 'weekly', 'monthly', 'yearly'];
        
        for (const category of categories) {
            for (const timeframe of timeframes) {
                await this.getLeaderboard(category, timeframe);
            }
        }
    }
}

class SocialFeedManager {
    constructor() {
        this.feeds = new Map();
    }

    async getFeed(userId, filters = {}) {
        const feedKey = `${userId}_${JSON.stringify(filters)}`;
        
        if (this.feeds.has(feedKey)) {
            return this.feeds.get(feedKey);
        }
        
        const feed = await this.generateFeed(userId, filters);
        this.feeds.set(feedKey, feed);
        
        return feed;
    }

    async generateFeed(userId, filters) {
        // Get posts from followed users
        const following = await this.getFollowing(userId);
        const posts = await this.getPostsFromUsers([userId, ...following]);
        
        // Apply filters
        let filteredPosts = posts;
        
        if (filters.type) {
            filteredPosts = filteredPosts.filter(p => p.type === filters.type);
        }
        
        if (filters.timeframe) {
            const cutoff = this.getTimeframeCutoff(filters.timeframe);
            filteredPosts = filteredPosts.filter(p => new Date(p.createdAt) > cutoff);
        }
        
        // Sort by engagement and recency
        return filteredPosts.sort((a, b) => {
            const aScore = this.calculatePostScore(a);
            const bScore = this.calculatePostScore(b);
            return bScore - aScore;
        }).slice(0, filters.limit || 50);
    }

    calculatePostScore(post) {
        const ageHours = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
        const engagementScore = post.engagement.likes + post.engagement.comments.length * 2 + post.engagement.shares * 3;
        const recencyScore = Math.max(0, 100 - ageHours);
        
        return engagementScore + recencyScore;
    }

    getTimeframeCutoff(timeframe) {
        const now = new Date();
        switch (timeframe) {
            case 'hour':
                return new Date(now - 60 * 60 * 1000);
            case 'day':
                return new Date(now - 24 * 60 * 60 * 1000);
            case 'week':
                return new Date(now - 7 * 24 * 60 * 60 * 1000);
            case 'month':
                return new Date(now - 30 * 24 * 60 * 60 * 1000);
            default:
                return new Date(0);
        }
    }

    async updateFeeds(post) {
        // Invalidate feeds that should include this post
        this.feeds.clear();
    }

    async getFollowing(userId) {
        // Get list of users that this user follows
        const relations = JSON.parse(localStorage.getItem('followRelations') || '[]');
        return relations
            .filter(r => r.followerId === userId)
            .map(r => r.followeeId);
    }

    async getPostsFromUsers(userIds) {
        // Get posts from specified users
        const allPosts = JSON.parse(localStorage.getItem('communityPosts') || '[]');
        return allPosts.filter(p => userIds.includes(p.userId));
    }
}

class NotificationManager {
    constructor() {
        this.notifications = [];
    }

    async notifyFollowers(data) {
        const { relationship, copyTrade, originalTrade } = data;
        
        const notification = {
            id: this.generateNotificationId(),
            userId: relationship.followerId,
            type: 'copy_trade_executed',
            title: 'Copy Trade Executed',
            message: `A copy trade for ${originalTrade.symbol} has been executed`,
            data: { copyTrade, originalTrade },
            createdAt: new Date(),
            read: false
        };
        
        await this.sendNotification(notification);
    }

    async notifySubscribers(signal) {
        // This would be called by the SignalProviderManager
        const notification = {
            id: this.generateNotificationId(),
            type: 'new_signal',
            title: 'New Trading Signal',
            message: `New ${signal.type} signal for ${signal.symbol}`,
            data: { signal },
            createdAt: new Date(),
            read: false
        };
        
        // Send to all subscribers of this provider
        // Implementation would depend on subscription system
    }

    async sendNotification(notification) {
        this.notifications.push(notification);
        
        // Save to localStorage
        const notifications = JSON.parse(localStorage.getItem('notifications') || '[]');
        notifications.push(notification);
        localStorage.setItem('notifications', JSON.stringify(notifications));
        
        // Send push notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(notification.title, {
                body: notification.message,
                icon: '/assets/icons/notification.png'
            });
        }
    }

    generateNotificationId() {
        return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        SocialTradingPlatform,
        CopyTradingManager,
        SignalProviderManager,
        CommunityManager,
        LeaderboardManager,
        SocialFeedManager,
        NotificationManager
    };
}