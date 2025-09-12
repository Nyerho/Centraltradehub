// Firebase Database Service
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { db } from './firebase-config.js';

class FirebaseDatabaseService {
  constructor() {
    this.listeners = new Map();
  }

  // User Profile Operations
  async getUserProfile(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        return {
          success: true,
          data: userDoc.data()
        };
      } else {
        return {
          success: false,
          message: 'User profile not found'
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateUserProfile(uid, profileData) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        ...profileData,
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        message: 'Profile updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Trading Operations
  async createTrade(uid, tradeData) {
    try {
      const tradesRef = collection(db, 'trades');
      const trade = {
        uid: uid,
        ...tradeData,
        createdAt: serverTimestamp(),
        status: 'open'
      };
      
      const docRef = await addDoc(tradesRef, trade);
      
      return {
        success: true,
        tradeId: docRef.id,
        message: 'Trade created successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getUserTrades(uid, limitCount = 50) {
    try {
      const tradesRef = collection(db, 'trades');
      const q = query(
        tradesRef,
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const querySnapshot = await getDocs(q);
      const trades = [];
      
      querySnapshot.forEach((doc) => {
        trades.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return {
        success: true,
        data: trades
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateTrade(tradeId, updateData) {
    try {
      const tradeRef = doc(db, 'trades', tradeId);
      await updateDoc(tradeRef, {
        ...updateData,
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        message: 'Trade updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Portfolio Operations
  async updatePortfolio(uid, portfolioData) {
    try {
      const portfolioRef = doc(db, 'portfolios', uid);
      await updateDoc(portfolioRef, {
        ...portfolioData,
        updatedAt: serverTimestamp()
      });
      
      return {
        success: true,
        message: 'Portfolio updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Market Data Operations
  async saveMarketData(symbol, data) {
    try {
      const marketRef = doc(db, 'marketData', symbol);
      await updateDoc(marketRef, {
        ...data,
        timestamp: serverTimestamp()
      });
      
      return {
        success: true,
        message: 'Market data saved'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Social Trading Operations
  async followTrader(followerId, traderId) {
    try {
      const followRef = doc(db, 'follows', `${followerId}_${traderId}`);
      await setDoc(followRef, {
        followerId: followerId,
        traderId: traderId,
        createdAt: serverTimestamp(),
        status: 'active'
      });
      
      // Update follower count
      const traderRef = doc(db, 'users', traderId);
      await updateDoc(traderRef, {
        'social.followers': increment(1)
      });
      
      return {
        success: true,
        message: 'Successfully followed trader'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Real-time Listeners
  subscribeToUserTrades(uid, callback) {
    const tradesRef = collection(db, 'trades');
    const q = query(
      tradesRef,
      where('uid', '==', uid),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const trades = [];
      snapshot.forEach((doc) => {
        trades.push({
          id: doc.id,
          ...doc.data()
        });
      });
      callback(trades);
    });
    
    this.listeners.set(`trades_${uid}`, unsubscribe);
    return unsubscribe;
  }

  subscribeToMarketData(symbol, callback) {
    const marketRef = doc(db, 'marketData', symbol);
    
    const unsubscribe = onSnapshot(marketRef, (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      }
    });
    
    this.listeners.set(`market_${symbol}`, unsubscribe);
    return unsubscribe;
  }

  // Account Balance Operations
  async getUserBalance(uid) {
    try {
      const userRef = doc(db, 'users', uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        return {
          success: true,
          balance: userData.accountBalance || 0
        };
      } else {
        // Initialize user with default balance if profile doesn't exist
        await this.initializeUserAccount(uid);
        return {
          success: true,
          balance: 1000 // Default starting balance
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateUserBalance(uid, newBalance) {
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        accountBalance: newBalance,
        balanceUpdatedAt: new Date().toISOString()
      });
      
      return {
        success: true,
        message: 'Balance updated successfully'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async initializeUserAccount(uid, initialBalance = 1000) {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        accountBalance: initialBalance,
        createdAt: new Date().toISOString(),
        balanceUpdatedAt: new Date().toISOString()
      }, { merge: true });
      
      return {
        success: true,
        message: 'User account initialized'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async addFunds(uid, amount) {
    try {
      const balanceResult = await this.getUserBalance(uid);
      if (!balanceResult.success) {
        return balanceResult;
      }
      
      const newBalance = balanceResult.balance + amount;
      return await this.updateUserBalance(uid, newBalance);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async withdrawFunds(uid, amount) {
    try {
      const balanceResult = await this.getUserBalance(uid);
      if (!balanceResult.success) {
        return balanceResult;
      }
      
      if (balanceResult.balance < amount) {
        return {
          success: false,
          error: 'Insufficient funds'
        };
      }
      
      const newBalance = balanceResult.balance - amount;
      return await this.updateUserBalance(uid, newBalance);
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Cleanup listeners
  unsubscribeAll() {
    this.listeners.forEach((unsubscribe) => {
      unsubscribe();
    });
    this.listeners.clear();
  }

  unsubscribe(key) {
    const unsubscribe = this.listeners.get(key);
    if (unsubscribe) {
      unsubscribe();
      this.listeners.delete(key);
    }
  }
}

// Export singleton instance
export default new FirebaseDatabaseService();