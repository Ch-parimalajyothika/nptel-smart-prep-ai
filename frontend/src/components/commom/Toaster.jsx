// src/components/common/Toaster.js
import React from 'react';
import { Toaster } from 'react-hot-toast';
import { X } from 'lucide-react';

const CustomToaster = () => {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: 'var(--bg-primary)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border-color)',
          borderRadius: '0.5rem',
          padding: '0.75rem 1rem',
          fontSize: '0.875rem',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
        },
        success: {
          iconTheme: {
            primary: 'var(--brand-500)',
            secondary: 'white',
          },
        },
        error: {
          iconTheme: {
            primary: 'var(--red-500)',
            secondary: 'white',
          },
        },
      }}
      components={{
        Toast: ({ toast, children }) => (
          <div
            className={`flex items-center gap-3 min-w-[300px] max-w-md ${
              toast.visible ? 'animate-enter' : 'animate-leave'
            }`}
          >
            {children}
            <button
              onClick={() => toast.dismiss()}
              className="ml-auto p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
        ),
      }}
    />
  );
};

export default CustomToaster;