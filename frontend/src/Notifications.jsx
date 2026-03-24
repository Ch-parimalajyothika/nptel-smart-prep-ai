import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info, AlertTriangle, Bell } from 'lucide-react';

// ==================== CONTEXT ====================
const NotificationContext = createContext();

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within NotificationProvider');
  }
  return context;
};

// ==================== PROVIDER ====================
export const NotificationProvider = ({ children }) => {
  // State for temporary toast notifications
  const [toasts, setToasts] = useState([]);
  // NEW: State for persistent notification history
  const [notifications, setNotifications] = useState([]);

  // Function to add a toast (temporary)
  const addToast = useCallback((type, message, duration = 5000) => {
    const id = Date.now();
    const toast = { id, type, message };
    setToasts(prev => [...prev, toast]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // NEW: Function to add a persistent notification
  const addNotification = useCallback((type, message) => {
    const id = Date.now();
    const notification = { id, type, message, timestamp: new Date(), read: false };
    setNotifications(prev => [notification, ...prev]);
    // Also show a toast for immediate feedback
    addToast(type, message);
  }, [addToast]);

  // NEW: Function to mark a notification as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  // NEW: Function to mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const success = useCallback((message) => addNotification('success', message), [addNotification]);
  const error = useCallback((message) => addNotification('error', message), [addNotification]);
  const warning = useCallback((message) => addNotification('warning', message), [addNotification]);
  const info = useCallback((message) => addNotification('info', message), [addNotification]);

  return (
    <NotificationContext.Provider value={{ 
      success, error, warning, info,
      // NEW: Expose the persistent list and actions
      notifications, 
      markAsRead, 
      markAllAsRead 
    }}>
      {children}
      {/* Container for temporary toasts */}
      <NotificationContainer notifications={toasts} onRemove={removeToast} />
    </NotificationContext.Provider>
  );
};

// ==================== NOTIFICATION BELL COMPONENT ====================
export const NotificationBell = () => {
  const { notifications, markAsRead, markAllAsRead } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isOpen && !event.target.closest('.notification-bell-container')) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleNotificationClick = (id) => {
    markAsRead(id);
    setIsOpen(false);
  };

  return (
    <div className="notification-bell-container relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs text-brand-600 hover:underline">
                Mark all as read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-slate-500 dark:text-slate-400 text-center">
                All caught up!
              </p>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n.id)}
                  className={`p-4 border-b border-slate-100 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${
                    !n.read ? 'bg-blue-50 dark:bg-slate-700/30' : ''
                  }`}
                >
                  <div className="flex gap-3">
                    <NotificationIcon type={n.type} />
                    <div className="flex-1">
                      <p className={`text-sm ${!n.read ? 'font-semibold' : ''} text-slate-800 dark:text-slate-200`}>
                        {n.message}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {n.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ==================== NOTIFICATION CONTAINER (for toasts) ====================
const NotificationContainer = ({ notifications, onRemove }) => {
  if (notifications.length === 0) return null;
  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm w-full">
      {notifications.map(notification => (
        <NotificationItem key={notification.id} notification={notification} onRemove={onRemove} />
      ))}
    </div>
  );
};

// ==================== NOTIFICATION ITEM (for toasts) ====================
const NotificationItem = ({ notification, onRemove }) => {
  const bgColors = {
    success: 'bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800',
    error: 'bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800',
    warning: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800',
    info: 'bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800'
  };
  const textColors = {
    success: 'text-green-800 dark:text-green-200',
    error: 'text-red-800 dark:text-red-200',
    warning: 'text-yellow-800 dark:text-yellow-200',
    info: 'text-blue-800 dark:text-blue-200'
  };
  return (
    <div className={`flex items-start gap-3 p-4 rounded-lg border ${bgColors[notification.type]} transform transition-all duration-300 shadow-lg animate-slide-in`}>
      <NotificationIcon type={notification.type} />
      <p className={`flex-1 text-sm font-medium ${textColors[notification.type]}`}>{notification.message}</p>
      <button onClick={() => onRemove(notification.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// Helper component for icons
const NotificationIcon = ({ type }) => {
  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };
  return icons[type];
};

// ==================== STYLES ====================
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn { from { opacity: 0; transform: translateX(100%); } to { opacity: 1; transform: translateX(0); } }
    .animate-slide-in { animation: slideIn 0.3s ease-out; }
  `;
  if (!document.head.querySelector('style[data-notification-styles]')) {
    style.setAttribute('data-notification-styles', 'true');
    document.head.appendChild(style);
  }
}