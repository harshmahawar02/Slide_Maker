import React, { useState } from 'react';
import './App.css';
import SlideCreator from './components/SlideCreator';
import FileBrowser from './components/FileBrowser';
import sapLogo from './SAP-Logo.png';

function App() {
  const [selectedPath, setSelectedPath] = useState(null);
  const isBrowserView = !selectedPath;

  const handleOpenSlideMaker = (path) => {
    setSelectedPath(path);
  };

  const handleBackToBrowser = () => {
    setSelectedPath(null);
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="sap-logo">
            <img src={sapLogo} alt="SAP" />
          </div>
          <div className="header-title">
            <h1>{isBrowserView ? 'Share Point' : 'Slide Maker'}</h1>
            <span className="header-subtitle">
              {isBrowserView ? 'Browse and filter synced SharePoint decks' : 'Create PowerPoint slides effortlessly'}
            </span>
          </div>
        </div>
      </header>
      <main className="App-main">
        {selectedPath ? (
          <SlideCreator templatePath={selectedPath} onBack={handleBackToBrowser} />
        ) : (
          <FileBrowser onOpen={handleOpenSlideMaker} />
        )}
      </main>
      <footer className="App-footer">
        <div className="footer-content">
          <span className="footer-text">INTERNAL - SAP and Partners Only</span>
          {/* <span className="footer-icon">#</span> */}
        </div>
      </footer>
    </div>
  );
}

export default App;
