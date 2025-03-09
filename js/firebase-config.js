// Firebase configuration - replace with your actual Firebase config
// from the Firebase console

const firebaseConfig = {
    apiKey: "AIzaSyBC7eWfspVNPZXEaxP0ewWP-GlX-UjrUtg",
    authDomain: "assam-pratidin.firebaseapp.com",
    projectId: "assam-pratidin",
    storageBucket: "assam-pratidin.firebasestorage.app",
    messagingSenderId: "200834383405",
    appId: "1:200834383405:web:15835fbe89dbcd967f02a4"
  };
  
  // Initialize Firebase
  firebase.initializeApp(firebaseConfig);
  window.auth = firebase.auth();
  window.db = firebase.firestore();
  
  // Dispatch event to let other scripts know Firebase is ready
  const event = new CustomEvent('firebaseInitialized');
  window.dispatchEvent(event);
  
  console.log('Firebase initialized successfully');