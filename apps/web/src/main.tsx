import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueuePage } from './pages/QueuePage';
import { AdminPage } from './pages/AdminPage';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Scan landing: /s/:storeId?sig=... (design.md §2.2) */}
        <Route path="/s/:storeId" element={<QueuePage />} />
        {/* Operations backend (design.md §2.7) */}
        <Route path="/admin/:storeId" element={<AdminPage />} />
        <Route
          path="*"
          element={
            <div className="screen">
              <p>Scan a store QR code to take a queue ticket.</p>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
