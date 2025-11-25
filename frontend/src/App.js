import React, { useState, useEffect } from 'react';
import './App.css';
import SlideCreator from './components/SlideCreator';
import FileBrowser from './components/FileBrowser';
import MassUpdate from './components/MassUpdate';
import sapLogo from './SAP-Logo.png';

function App() {
  const [currentView, setCurrentView] = useState('browser'); // 'browser', 'slideMaker', 'massUpdate'
  const [selectedPath, setSelectedPath] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const handleOpenSlideMaker = (path) => {
    setSelectedPath(path);
    setSelectedFiles([]);
    setCurrentView('slideMaker');
  };

  const handleOpenMassUpdate = (filesOrPath) => {
    // Handle both single file (from customize dropdown) and multiple files (from toolbar)
    if (Array.isArray(filesOrPath)) {
      setSelectedFiles(filesOrPath);
      setSelectedPath(null);
    } else {
      setSelectedPath(filesOrPath);
      setSelectedFiles([]);
    }
    setCurrentView('massUpdate');
  };

  const handleBackToBrowser = (successMessage) => {
    setCurrentView('browser');
    setSelectedPath(null);
    setSelectedFiles([]);
    
    if (successMessage) {
      showToast(successMessage, 'success');
    }
  };

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 5000);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="sap-logo">
            <img src={sapLogo} alt="SAP" />
          </div>
          
          <div className="header-title">
            <h1>Presentation Manager</h1>
            <span className="header-subtitle">
              Browse, customize, and manage PowerPoint presentations
            </span>
          </div>
        </div>
      </header>

      <main className="App-main">
        <div style={{ display: currentView === 'browser' ? 'block' : 'none' }}>
          <FileBrowser 
            onOpenSlideMaker={handleOpenSlideMaker}
            onOpenMassUpdate={handleOpenMassUpdate}
          />
        </div>

        {currentView === 'slideMaker' && (
          <div className="page-view">
            <div className="page-header">
              <div className="page-header-content">
                <h2 className="page-title">Slide Maker</h2>
                <button className="btn-back" onClick={() => handleBackToBrowser()}>
                  <span className="back-icon">←</span> Back to Presentations
                </button>
              </div>
            </div>
            <div className="page-content">
              <SlideCreator 
                templatePath={selectedPath} 
                onClose={handleBackToBrowser}
                isModal={false}
              />
            </div>
          </div>
        )}

        {currentView === 'massUpdate' && (
          <div className="page-view">
            <div className="page-header">
              <div className="page-header-content">
                <h2 className="page-title">Mass Update</h2>
                <button className="btn-back" onClick={() => handleBackToBrowser()}>
                  <span className="back-icon">←</span> Back to Presentations
                </button>
              </div>
            </div>
            <div className="page-content">
              <MassUpdate 
                templatePath={selectedPath}
                selectedFiles={selectedFiles}
                onClose={handleBackToBrowser}
                isModal={false}
              />
            </div>
          </div>
        )}
      </main>

      {/* Toast Notification */}
      {toast.show && (
        <div className={`toast toast-${toast.type}`}>
          <span className="toast-icon">{toast.type === 'success' ? '✓' : '!'}</span>
          <span className="toast-message">{toast.message}</span>
          <button className="toast-close" onClick={() => setToast({ show: false, message: '', type: 'success' })}>
            ✕
          </button>
        </div>
      )}

      <footer className="App-footer">
        <div className="footer-content">
          <span className="footer-text">INTERNAL - SAP and Partners Only</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
