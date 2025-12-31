/**
 * Script to clear all data from Firebase Firestore
 * 
 * WARNING: This will delete ALL data in your Firestore database!
 * Only run this in development/testing environments.
 * 
 * Usage:
 *   node scripts/clear-firebase.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json'); // You'll need to download this from Firebase Console

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteCollection(collectionPath) {
  const collectionRef = db.collection(collectionPath);
  const snapshot = await collectionRef.get();
  
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ Deleted ${snapshot.size} documents from ${collectionPath}`);
}

async function clearAllData() {
  try {
    console.log('🗑️  Starting to clear Firebase database...\n');
    
    // List of collections to clear
    const collections = [
      'users',
      'usernames',
      'friendships',
      'groups',
      'messages',
      'notifications'
    ];
    
    // Delete each collection
    for (const collection of collections) {
      try {
        await deleteCollection(collection);
      } catch (error) {
        console.log(`⚠️  Could not delete ${collection}: ${error.message}`);
      }
    }
    
    console.log('\n✅ Firebase database cleared successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing database:', error);
    process.exit(1);
  }
}

clearAllData();

