// app/test/page.tsx
'use client';

import { useState } from 'react';

export default function DeviceCompatibilityTestPage() {
  const [clickCount, setClickCount] = useState(0);

  const handleButtonClick = () => {
    setClickCount((prev) => prev + 1);
  };

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px',
        lineHeight: 1.6,
        color: '#333',
        backgroundColor: '#f8f9fa',
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '40px',
          borderRadius: '10px',
          boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            color: '#2c3e50',
            fontSize: '2.5rem',
            marginBottom: '20px',
          }}
        >
          📱 Device Compatibility Test
        </h1>

        <p
          style={{
            fontSize: '1.2rem',
            marginBottom: '30px',
            color: '#666',
          }}
        >
          This page is optimized to work on all devices—including older phones.
        </p>

        <div
          style={{
            backgroundColor: '#e8f5e9',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '25px',
            border: '1px solid #c8e6c9',
          }}
        >
          <p style={{ fontWeight: 'bold', color: '#2e7d32' }}>
            ✅ If you can see this styled box with proper spacing and colors,
            your device can render modern CSS correctly.
          </p>
        </div>

        <button
          onClick={handleButtonClick}
          style={{
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            fontSize: '16px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'background-color 0.3s',
            marginTop: '10px',
          }}
          onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#0056b3')}
          onMouseOut={(e) => (e.currentTarget.style.backgroundColor = '#007bff')}
        >
          Test Button (Tapped {clickCount} time{clickCount !== 1 ? 's' : ''})
        </button>

        <div
          style={{
            marginTop: '40px',
            paddingTop: '20px',
            borderTop: '1px solid #eee',
            fontSize: '0.9rem',
            color: '#777',
          }}
        >
          <p>✓ Clean layout that works on all screen sizes</p>
          <p>✓ Simple CSS with proper fallbacks</p>
          <p>✓ No complex frameworks or heavy dependencies</p>
          <p>✓ Touch-friendly interface</p>
        </div>
      </div>

      <footer
        style={{
          textAlign: 'center',
          marginTop: '30px',
          color: '#666',
          fontSize: '0.9rem',
        }}
      >
        <p>Simple test page • Works on all devices • No external dependencies</p>
      </footer>
    </div>
  );
}