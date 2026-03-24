import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// ✅ ADD THESE
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// IF using toast
import { Toaster } from 'react-hot-toast';

// IF using custom notification
// import { NotificationProvider } from './Notifications';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>

        {/* If using toast */}
        <Toaster position="top-right" />

        {/* If using custom notification, use this instead */}
        {/* <NotificationProvider> */}

        <App />

        {/* </NotificationProvider> */}

      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);