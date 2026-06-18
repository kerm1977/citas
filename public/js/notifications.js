/* ── Notification/Toast System ───────────────────────────────────────── */
'use strict';

const Notifications = (() => {
  function show(message, type = 'success', duration = 3000) {
    const container = document.getElementById('notifications-container');
    if (!container) {
      const div = document.createElement('div');
      div.id = 'notifications-container';
      div.className = 'notifications-container';
      document.body.appendChild(div);
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
    
    notification.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${message}</span>
      <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;

    const notificationsContainer = document.getElementById('notifications-container');
    notificationsContainer.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('notification-show');
    }, 10);

    if (duration > 0) {
      setTimeout(() => {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
      }, duration);
    }
  }

  function success(message, duration) {
    show(message, 'success', duration);
  }

  function error(message, duration) {
    show(message, 'error', duration);
  }

  function info(message, duration) {
    show(message, 'info', duration);
  }

  return { show, success, error, info };
})();

window.Notifications = Notifications;
