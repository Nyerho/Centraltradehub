class FundingManager {
    constructor() {
        this.apiKeys = {
            stripe: 'pk_test_51S5PACRr9LhPVzG69gic1HAyOrqIx1uzMU0mooaAiSeUw9lXgdLv5meCTO31qnd7eP8M6J1a4mjpBD7w0kMYFbMT00Kj50M9kc', // Only publishable key in frontend
            // Secret keys should NEVER be in frontend code
            coinbase: 'your_coinbase_api_key',
            paypal: 'your_paypal_client_id',
            sendgrid: 'LBQUTKLA22UZF4LUBU3491RD'
        };
        
        this.supportedMethods = {
            stripe: {
                name: 'Credit/Debit Card',
                icon: 'fas fa-credit-card',
                fees: '2.9% + $0.30',
                processingTime: 'Instant',
                minAmount: 10,
                maxAmount: 50000,
                currencies: ['USD', 'EUR', 'GBP', 'CAD']
            },
            paypal: {
                name: 'PayPal',
                icon: 'fab fa-paypal',
                fees: '3.49% + $0.49',
                processingTime: 'Instant',
                minAmount: 5,
                maxAmount: 10000,
                currencies: ['USD', 'EUR', 'GBP', 'CAD', 'AUD']
            },
            crypto: {
                name: 'Cryptocurrency',
                icon: 'fab fa-bitcoin',
                fees: 'Network fees only',
                processingTime: '10-60 minutes',
                minAmount: 25,
                maxAmount: 100000,
                currencies: ['BTC', 'ETH', 'LTC', 'USDC', 'USDT']
            },
            wire: {
                name: 'Bank Wire Transfer',
                icon: 'fas fa-university',
                fees: '$25 flat fee',
                processingTime: '1-3 business days',
                minAmount: 1000,
                maxAmount: 1000000,
                currencies: ['USD', 'EUR', 'GBP']
            }
        };
        
        this.transactions = [];
        this.loadStripe();
        this.loadPayPal();
    }

    async loadStripe() {
        if (!window.Stripe) {
            const script = document.createElement('script');
            script.src = 'https://js.stripe.com/v3/';
            document.head.appendChild(script);
            
            await new Promise(resolve => {
                script.onload = resolve;
            });
        }
        this.stripe = Stripe(this.apiKeys.stripe);
    }

    async loadPayPal() {
        if (!window.paypal) {
            const script = document.createElement('script');
            script.src = `https://www.paypal.com/sdk/js?client-id=${this.apiKeys.paypal}&currency=USD`;
            document.head.appendChild(script);
        }
    }

    async initializePayment(method, amount, currency = 'USD') {
        const transaction = {
            id: this.generateTransactionId(),
            method,
            amount,
            currency,
            status: 'pending',
            timestamp: new Date().toISOString(),
            user: window.authManager?.getCurrentUser()?.email
        };
        
        this.transactions.push(transaction);
        
        try {
            let result;
            switch(method) {
                case 'stripe':
                    result = await this.processStripePayment(transaction);
                    break;
                case 'paypal':
                    result = await this.processPayPalPayment(transaction);
                    break;
                case 'crypto':
                    result = await this.processCryptoPayment(transaction);
                    break;
                case 'wire':
                    result = await this.processWireTransfer(transaction);
                    break;
                default:
                    throw new Error('Unsupported payment method');
            }
            
            transaction.status = 'completed';
            transaction.result = result;
            return transaction;
            
        } catch (error) {
            transaction.status = 'failed';
            transaction.error = error.message;
            throw error;
        }
    }

    async processStripePayment(transaction) {
        const { amount, currency } = transaction;
        
        // Create payment intent on your backend (where secret key is secure)
        const response = await fetch('/api/create-payment-intent', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Use user auth token
            },
            body: JSON.stringify({
                amount: amount * 100, // Stripe uses cents
                currency: currency.toLowerCase(),
                user_id: window.authManager.getCurrentUser().uid
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to create payment intent');
        }
        
        const { client_secret } = await response.json();
        
        // Confirm payment with Stripe (only uses publishable key)
        const result = await this.stripe.confirmCardPayment(client_secret, {
            payment_method: {
                card: this.stripeCardElement,
                billing_details: {
                    email: window.authManager.getCurrentUser().email
                }
            }
        });
        
        if (result.error) {
            throw new Error(result.error.message);
        }
        
        return {
            payment_intent_id: result.paymentIntent.id,
            status: result.paymentIntent.status
        };
    }

    async processPayPalPayment(transaction) {
        const { amount, currency } = transaction;
        
        return new Promise((resolve, reject) => {
            paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: amount.toString(),
                                currency_code: currency
                            }
                        }]
                    });
                },
                onApprove: async (data, actions) => {
                    const order = await actions.order.capture();
                    resolve({
                        order_id: order.id,
                        status: order.status,
                        payer: order.payer
                    });
                },
                onError: (err) => {
                    reject(new Error('PayPal payment failed: ' + err));
                }
            }).render('#paypal-button-container');
        });
    }

    async processCryptoPayment(transaction) {
        const { amount, currency } = transaction;
        
        // Generate crypto wallet address for payment
        const walletAddress = await this.generateCryptoAddress(currency);
        
        // Show payment instructions
        const instructions = {
            address: walletAddress,
            amount: amount,
            currency: currency,
            qr_code: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${walletAddress}`,
            network_fee: await this.estimateNetworkFee(currency),
            confirmation_time: '10-60 minutes'
        };
        
        return instructions;
    }

    async processWireTransfer(transaction) {
        const { amount, currency } = transaction;
        
        // Generate wire transfer instructions
        const wireInstructions = {
            bank_name: 'Central Trade Hub Bank',
            account_name: 'Central Trade Hub Ltd',
            account_number: '1234567890',
            routing_number: '021000021',
            swift_code: 'CTHBUSXX',
            reference: `CTH-${transaction.id}`,
            amount: amount,
            currency: currency,
            processing_fee: 25,
            estimated_arrival: '1-3 business days'
        };
        
        return wireInstructions;
    }

    async generateCryptoAddress(currency) {
        // In production, integrate with a crypto payment processor
        const addresses = {
            'BTC': '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
            'ETH': '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
            'LTC': 'LTC1qw508d6qejxtdg4y5r3zarvary0c5xw7k3w508d6qejxtdg4y5r3zarvary0c5xw7k',
            'USDC': '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87',
            'USDT': '0x742d35Cc6634C0532925a3b8D4C9db96590c6C87'
        };
        return addresses[currency] || addresses['BTC'];
    }

    async estimateNetworkFee(currency) {
        const fees = {
            'BTC': '$2-15',
            'ETH': '$5-25',
            'LTC': '$0.05-0.50',
            'USDC': '$5-25',
            'USDT': '$5-25'
        };
        return fees[currency] || '$5-25';
    }

    generateTransactionId() {
        return 'TXN-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }

    getTransactionHistory() {
        return this.transactions.filter(tx => 
            tx.user === window.authManager?.getCurrentUser()?.email
        );
    }

    validateAmount(method, amount, currency) {
        const methodConfig = this.supportedMethods[method];
        if (!methodConfig) {
            throw new Error('Invalid payment method');
        }
        
        if (amount < methodConfig.minAmount) {
            throw new Error(`Minimum amount for ${methodConfig.name} is ${methodConfig.minAmount} ${currency}`);
        }
        
        if (amount > methodConfig.maxAmount) {
            throw new Error(`Maximum amount for ${methodConfig.name} is ${methodConfig.maxAmount} ${currency}`);
        }
        
        if (!methodConfig.currencies.includes(currency)) {
            throw new Error(`${currency} is not supported for ${methodConfig.name}`);
        }
        
        return true;
    }
}

// Initialize funding manager
const fundingManager = new FundingManager();
window.fundingManager = fundingManager;
export default fundingManager;