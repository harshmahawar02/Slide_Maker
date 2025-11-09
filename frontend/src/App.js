import React from 'react';
import './App.css';
import SlideCreator from './components/SlideCreator';
import sapLogo from './SAP-Logo.png';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="sap-logo">
            <img src={sapLogo} alt="SAP" />
          </div>
          <div className="header-title">
            <h1>Slide Maker</h1>
            <span className="header-subtitle">Create PowerPoint Slides Effortlessly</span>
          </div>
        </div>
      </header>
      <main className="App-main">
        <SlideCreator />
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
