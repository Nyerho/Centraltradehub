const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
try {
  let serviceAccount;
  
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // Method 1: Complete JSON
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
    // Method 2: Individual variables
    serviceAccount = {
      type: "service_account",
      project_id: process.env.FIREBASE_PROJECT_ID,
      private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      client_email: process.env.FIREBASE_CLIENT_EMAIL,
    };
  } else {
    // Fallback to local file for development
    serviceAccount = require('../serviceAcoountkey.json');
  }

  if (!admin.apps.length) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      databaseURL: `https://centraltradehub-30f00-default-rtdb.firebaseio.com`
    });
  }
  
  console.log('✅ Firebase Admin initialized successfully');
} catch (error) {
  console.error('❌ Firebase Admin initialization failed:', error);
}

const auth = admin.auth();
const db = admin.firestore();

// Middleware to verify admin token
async function verifyAdminToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decodedToken = await auth.verifyIdToken(token);
    
    // Check if user is admin (you can customize this logic)
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    
    if (!userData || userData.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// API Routes

// Get all users
app.get('/api/users', verifyAdminToken, async (req, res) => {
  try {
    const listUsersResult = await auth.listUsers(1000);
    const users = listUsersResult.users.map(userRecord => ({
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      emailVerified: userRecord.emailVerified,
      disabled: userRecord.disabled,
      creationTime: userRecord.metadata.creationTime,
      lastSignInTime: userRecord.metadata.lastSignInTime
    }));
    
    res.json({ users });
  } catch (error) {
    console.error('Error listing users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user password
app.put('/api/users/:userId/password', verifyAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Update password in Firebase Auth
    await auth.updateUser(userId, {
      password: newPassword
    });

    // Log the password change
    await db.collection('admin_logs').add({
      action: 'password_changed',
      targetUserId: userId,
      adminId: req.user.uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Error updating password:', error);
    res.status(500).json({ error: 'Failed to update password' });
  }
});

// Disable/Enable user
app.put('/api/users/:userId/status', verifyAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { disabled } = req.body;

    await auth.updateUser(userId, { disabled });

    res.json({ success: true, message: `User ${disabled ? 'disabled' : 'enabled'} successfully` });
  } catch (error) {
    console.error('Error updating user status:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Delete user
app.delete('/api/users/:userId', verifyAdminToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // 1. Revoke refresh tokens (force logout on all devices)
    await auth.revokeRefreshTokens(userId);
    
    // 2. Delete from Firebase Auth
    await auth.deleteUser(userId);
    
    // 3. Delete from Firestore
    await db.collection('users').doc(userId).delete();

    res.json({ success: true, message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

app.listen(PORT, () => {
  console.log(`Admin server running on port ${PORT}`);
});