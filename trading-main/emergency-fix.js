// EMERGENCY FIX - Put this in ALL your HTML files before other scripts

// Direct Firebase initialization
const firebaseConfig = {
    apiKey: "AIzaSyDkYmCw8aXm4vdlFUSPtsbaj0dLr14vUiw",
    authDomain: "trading-ce7a5.firebaseapp.com",
    projectId: "trading-ce7a5",
    storageBucket: "trading-ce7a5.firebasestorage.app",
    messagingSenderId: "558394601592",
    appId: "1:558394601592:web:d9d3417ee8960033407d8d"
};

// Initialize Firebase directly
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

// Make global
window.auth = firebase.auth();
window.db = firebase.firestore();

// Alert function
window.showMessage = function(msg, type = 'info') {
    alert(msg); // Just use simple alert for now
    console.log(type.toUpperCase() + ':', msg);
};