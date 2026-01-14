// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDkYmCw8aXm4vdlFUSPtsbaj0dLr14vUiw",
    authDomain: "trading-ce7a5.firebaseapp.com",
    projectId: "trading-ce7a5",
    storageBucket: "trading-ce7a5.firebasestorage.app",
    messagingSenderId: "558394601592",
    appId: "1:558394601592:web:d9d3417ee8960033407d8d"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// User Management
const UserService = {
    async getCurrentUser() {
        return auth.currentUser;
    },

    async getUserData(uid) {
        try {
            const doc = await db.collection('users').doc(uid).get();
            return doc.exists ? doc.data() : null;
        } catch (error) {
            console.error('Error getting user data:', error);
            return null;
        }
    },

    async createUser(uid, userData) {
        try {
            await db.collection('users').doc(uid).set({
                ...userData,
                createdAt: new Date(),
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error creating user:', error);
            return false;
        }
    },

    async updateUser(uid, updates) {
        try {
            await db.collection('users').doc(uid).update({
                ...updates,
                updatedAt: new Date()
            });
            return true;
        } catch (error) {
            console.error('Error updating user:', error);
            return false;
        }
    },

    async logout() {
        try {
            await auth.signOut();
            return true;
        } catch (error) {
            console.error('Logout error:', error);
            return false;
        }
    }
};

// Trading Operations
const TradingService = {
    async executeTrade(userId, tradeData) {
        try {
            const tradeRef = await db.collection('trades').add({
                userId: userId,
                ...tradeData,
                status: 'executed',
                timestamp: new Date()
            });

            // Update user balance
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            const tradeCost = tradeData.amount * tradeData.price;
            const newBalance = userData.tradingBalance - tradeCost;
            
            await db.collection('users').doc(userId).update({
                tradingBalance: newBalance,
                updatedAt: new Date()
            });

            return { success: true, tradeId: tradeRef.id };
        } catch (error) {
            console.error('Error executing trade:', error);
            return { success: false, error: error.message };
        }
    },

    async getOpenPositions(userId) {
        try {
            const snapshot = await db.collection('trades')
                .where('userId', '==', userId)
                .where('status', '==', 'open')
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting positions:', error);
            return [];
        }
    },

    async closePosition(tradeId, closePrice) {
        try {
            const tradeDoc = await db.collection('trades').doc(tradeId).get();
            const tradeData = tradeDoc.data();
            
            const pnl = tradeData.side === 'buy' 
                ? (closePrice - tradeData.price) * tradeData.amount
                : (tradeData.price - closePrice) * tradeData.amount;
            
            await db.collection('trades').doc(tradeId).update({
                status: 'closed',
                closePrice: closePrice,
                pnl: pnl,
                closedAt: new Date()
            });

            // Update user balance with P&L
            const userDoc = await db.collection('users').doc(tradeData.userId).get();
            const userData = userDoc.data();
            
            await db.collection('users').doc(tradeData.userId).update({
                tradingBalance: userData.tradingBalance + pnl,
                updatedAt: new Date()
            });

            return { success: true, pnl: pnl };
        } catch (error) {
            console.error('Error closing position:', error);
            return { success: false, error: error.message };
        }
    }
};

// Withdrawal Service
const WithdrawalService = {
    async requestWithdrawal(userId, withdrawalData) {
        try {
            const userDoc = await db.collection('users').doc(userId).get();
            const userData = userDoc.data();
            
            if (withdrawalData.amount > userData.withdrawalBalance) {
                return { success: false, error: 'Insufficient withdrawal balance' };
            }

            const withdrawalRef = await db.collection('withdrawals').add({
                userId: userId,
                ...withdrawalData,
                status: 'pending',
                timestamp: new Date()
            });

            // Update user withdrawal balance
            const newWithdrawalBalance = userData.withdrawalBalance - withdrawalData.amount;
            const newPendingWithdrawal = (userData.pendingWithdrawal || 0) + withdrawalData.amount;
            
            await db.collection('users').doc(userId).update({
                withdrawalBalance: newWithdrawalBalance,
                pendingWithdrawal: newPendingWithdrawal,
                updatedAt: new Date()
            });

            return { 
                success: true, 
                withdrawalId: withdrawalRef.id,
                message: 'Withdrawal request submitted successfully'
            };
        } catch (error) {
            console.error('Error requesting withdrawal:', error);
            return { success: false, error: error.message };
        }
    },

    async getWithdrawalHistory(userId) {
        try {
            const snapshot = await db.collection('withdrawals')
                .where('userId', '==', userId)
                .orderBy('timestamp', 'desc')
                .get();
            
            return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (error) {
            console.error('Error getting withdrawal history:', error);
            return [];
        }
    }
};

// Market Data Service (using CoinGecko API)
const MarketService = {
    async getMarketData(coinId = 'bitcoin') {
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}`);
            const data = await response.json();
            return {
                id: data.id,
                symbol: data.symbol.toUpperCase(),
                name: data.name,
                current_price: data.market_data.current_price.usd,
                price_change_24h: data.market_data.price_change_24h,
                price_change_percentage_24h: data.market_data.price_change_percentage_24h,
                market_cap: data.market_data.market_cap.usd,
                image: data.image.small
            };
        } catch (error) {
            console.error('Error fetching market data:', error);
            return null;
        }
    },

    async searchCoins(query) {
        try {
            const response = await fetch(`https://api.coingecko.com/api/v3/search?query=${query}`);
            const data = await response.json();
            return data.coins.slice(0, 10); // Return top 10 results
        } catch (error) {
            console.error('Error searching coins:', error);
            return [];
        }
    },

    async getTopCoins() {
        try {
            const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=20&page=1&sparkline=false');
            const data = await response.json();
            return data.map(coin => ({
                id: coin.id,
                symbol: coin.symbol.toUpperCase(),
                name: coin.name,
                current_price: coin.current_price,
                price_change_percentage_24h: coin.price_change_percentage_24h,
                market_cap: coin.market_cap,
                image: coin.image
            }));
        } catch (error) {
            console.error('Error fetching top coins:', error);
            return [];
        }
    }
};

// Notification Service
const NotificationService = {
    show(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelector('.notification');
        if (existing) existing.remove();

        // Create notification
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const colors = {
            success: '#02c076',
            error: '#f6465d',
            warning: '#f0b90b',
            info: '#3786f4'
        };

        notification.innerHTML = `
            <div style="position: fixed; top: 20px; right: 20px; padding: 15px 20px; 
                        background: ${colors[type] || colors.info}; color: white; 
                        border-radius: 8px; font-weight: 600; z-index: 9999; 
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
                ${message}
            </div>
        `;

        document.body.appendChild(notification);

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
};

// Make services globally available
window.UserService = UserService;
window.TradingService = TradingService;
window.WithdrawalService = WithdrawalService;
window.MarketService = MarketService;
window.NotificationService = NotificationService;
window.auth = auth;
window.db = db;