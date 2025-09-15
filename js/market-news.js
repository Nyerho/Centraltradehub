class MarketNewsService {
    constructor() {
        this.apiKey = 'YOUR_ALPHA_VANTAGE_API_KEY'; // Replace with your actual API key
        this.baseUrl = 'https://www.alphavantage.co/query';
        this.newsCache = new Map();
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutes
    }

    async fetchMarketNews(topic = 'general', limit = 10) {
        const cacheKey = `${topic}_${limit}`;
        const cached = this.newsCache.get(cacheKey);
        
        if (cached && Date.now() - cached.timestamp < this.cacheExpiry) {
            return cached.data;
        }

        try {
            const params = new URLSearchParams({
                function: 'NEWS_SENTIMENT',
                topics: topic,
                limit: limit.toString(),
                apikey: this.apiKey
            });

            const response = await fetch(`${this.baseUrl}?${params}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data['Error Message']) {
                throw new Error(data['Error Message']);
            }

            if (data['Note']) {
                throw new Error('API call frequency limit reached. Please try again later.');
            }

            const newsData = {
                feed: data.feed || [],
                sentiment: data.sentiment_score_definition || 'Not available'
            };

            // Cache the result
            this.newsCache.set(cacheKey, {
                data: newsData,
                timestamp: Date.now()
            });

            return newsData;
        } catch (error) {
            console.error('Error fetching market news:', error);
            throw error;
        }
    }

    formatTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) {
            return 'Just now';
        } else if (diffInSeconds < 3600) {
            const minutes = Math.floor(diffInSeconds / 60);
            return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        } else if (diffInSeconds < 86400) {
            const hours = Math.floor(diffInSeconds / 3600);
            return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        } else {
            const days = Math.floor(diffInSeconds / 86400);
            return `${days} day${days > 1 ? 's' : ''} ago`;
        }
    }

    getSentimentIcon(score) {
        if (score > 0.1) return 'fas fa-arrow-up';
        if (score < -0.1) return 'fas fa-arrow-down';
        return 'fas fa-minus';
    }

    getSentimentClass(score) {
        if (score > 0.1) return 'positive';
        if (score < -0.1) return 'negative';
        return 'neutral';
    }

    getSentimentText(score) {
        if (score > 0.1) return 'Bullish';
        if (score < -0.1) return 'Bearish';
        return 'Neutral';
    }
}

class MarketNewsUI {
    constructor() {
        this.newsService = new MarketNewsService();
        this.currentTopic = 'general';
        this.isLoading = false;
        this.initializeEventListeners();
        this.loadInitialNews();
    }

    initializeEventListeners() {
        const refreshBtn = document.getElementById('refreshNewsBtn');
        const topicFilter = document.getElementById('newsTopicFilter');

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshNews());
        }

        if (topicFilter) {
            topicFilter.addEventListener('change', (e) => {
                this.currentTopic = e.target.value;
                this.loadNews();
            });
        }
    }

    async loadInitialNews() {
        await this.loadNews();
        // Auto-refresh every 10 minutes
        setInterval(() => this.loadNews(), 10 * 60 * 1000);
    }

    async loadNews() {
        if (this.isLoading) return;

        this.showLoading();
        
        try {
            const newsData = await this.newsService.fetchMarketNews(this.currentTopic, 8);
            this.displayNews(newsData.feed);
            this.hideError();
        } catch (error) {
            console.error('Error loading news:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }

    async refreshNews() {
        // Clear cache for current topic
        this.newsService.newsCache.clear();
        await this.loadNews();
    }

    showLoading() {
        this.isLoading = true;
        const loadingEl = document.getElementById('newsLoading');
        const refreshBtn = document.getElementById('refreshNewsBtn');
        
        if (loadingEl) loadingEl.style.display = 'flex';
        if (refreshBtn) {
            refreshBtn.classList.add('loading');
            refreshBtn.disabled = true;
        }
    }

    hideLoading() {
        this.isLoading = false;
        const loadingEl = document.getElementById('newsLoading');
        const refreshBtn = document.getElementById('refreshNewsBtn');
        
        if (loadingEl) loadingEl.style.display = 'none';
        if (refreshBtn) {
            refreshBtn.classList.remove('loading');
            refreshBtn.disabled = false;
        }
    }

    showError(message) {
        const errorEl = document.getElementById('newsError');
        const newsListEl = document.getElementById('marketNewsList');
        
        if (errorEl) {
            errorEl.style.display = 'flex';
            errorEl.querySelector('span').textContent = message;
        }
        if (newsListEl) newsListEl.innerHTML = '';
    }

    hideError() {
        const errorEl = document.getElementById('newsError');
        if (errorEl) errorEl.style.display = 'none';
    }

    displayNews(newsItems) {
        const newsListEl = document.getElementById('marketNewsList');
        if (!newsListEl) return;

        if (!newsItems || newsItems.length === 0) {
            newsListEl.innerHTML = `
                <div class="no-news">
                    <i class="fas fa-newspaper"></i>
                    <span>No news available for this topic.</span>
                </div>
            `;
            return;
        }

        newsListEl.innerHTML = newsItems.map(item => {
            const sentimentScore = parseFloat(item.overall_sentiment_score || 0);
            const sentimentClass = this.newsService.getSentimentClass(sentimentScore);
            const sentimentIcon = this.newsService.getSentimentIcon(sentimentScore);
            const sentimentText = this.newsService.getSentimentText(sentimentScore);
            const timeAgo = this.newsService.formatTimeAgo(item.time_published);

            return `
                <div class="news-item" onclick="window.open('${item.url}', '_blank')">
                    <div class="news-item-header">
                        <h4 class="news-title">${item.title}</h4>
                        <span class="news-source">${item.source}</span>
                    </div>
                    <p class="news-summary">${item.summary}</p>
                    <div class="news-meta">
                        <div class="news-time">
                            <i class="fas fa-clock"></i>
                            <span>${timeAgo}</span>
                        </div>
                        <div class="news-sentiment ${sentimentClass}">
                            <i class="${sentimentIcon}"></i>
                            <span>${sentimentText}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Initialize market news when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.marketNewsUI = new MarketNewsUI();
    });
} else {
    window.marketNewsUI = new MarketNewsUI();
}

export { MarketNewsService, MarketNewsUI };