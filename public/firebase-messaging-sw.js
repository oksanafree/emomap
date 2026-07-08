importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDQSlevglh5UU_7lYU5s08TAHhHv-NsFnE',
  authDomain: 'emomap-v1.firebaseapp.com',
  projectId: 'emomap-v1',
  messagingSenderId: '276011838129',
  appId: '1:276011838129:web:e429c71cb147f5bd361090',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png',
    data: { url: payload.data?.url || '/' },
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
