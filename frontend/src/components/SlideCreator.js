import React, { useState, useEffect, useRef } from 'react';
import SlideForm from './SlideForm';
import LayoutSelector from './LayoutSelector';
import SlidePreview from './SlidePreview';
import FileUpload from './FileUpload';
import './SlideCreator.css';

const SlideCreator = () => {
    const [layout, setLayout] = useState('');
    const [currentFile, setCurrentFile] = useState(null);
    const [downloadFilename, setDownloadFilename] = useState('');
    const [slideCount, setSlideCount] = useState(0);
    const [totalSlides, setTotalSlides] = useState(0);
    const [showDownload, setShowDownload] = useState(false);
    const [backendStatus, setBackendStatus] = useState('checking'); // checking, online, offline
    const [previewData, setPreviewData] = useState({
        title: '',
        content: '',
        content2: '',
        imagePreview: null
    });
    
    // Track object URLs for cleanup
    const objectURLsRef = useRef([]);
    
    // Check backend health on mount
    useEffect(() => {
        const checkBackend = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/health', {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000), // 5 second timeout
                });
                
                if (response.ok) {
                    setBackendStatus('online');
                } else {
                    setBackendStatus('offline');
                }
            } catch (error) {
                console.error('Backend health check failed:', error);
                setBackendStatus('offline');
            }
        };
        
        checkBackend();
        
        // Re-check every 30 seconds
        const interval = setInterval(checkBackend, 30000);
        
        return () => clearInterval(interval);
    }, []);
    
    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            objectURLsRef.current.forEach(url => {
                try {
                    window.URL.revokeObjectURL(url);
                } catch (e) {
                    console.error('Error revoking URL:', e);
                }
            });
        };
    }, []);

    const handleSlideAdded = (updatedFile, filename) => {
        // Validate file
        if (!updatedFile || updatedFile.size === 0) {
            console.error('Invalid file received');
            return;
        }
        
        setCurrentFile(updatedFile);
        setDownloadFilename(filename);
        setSlideCount(prev => prev + 1);
        setShowDownload(true);
    };
    
    const handleFileUploaded = async (file) => {
        // When a new file is uploaded, fetch its slide count
        if (!file) return;
        
        // Set the current file immediately
        setCurrentFile(file);
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('http://localhost:5000/api/get-slide-count', {
                method: 'POST',
                body: formData,
            });
            
            if (response.ok) {
                const data = await response.json();
                setTotalSlides(data.total_slides || 0);
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Failed to load slide count' }));
                console.error('Failed to fetch slide count:', errorData.error);
                setTotalSlides(0);
            }
        } catch (error) {
            console.error('Error fetching slide count:', error);
            setTotalSlides(0);
        }
    };

    const handleContentChange = (data) => {
        setPreviewData(data);
    };

    const handleDownload = () => {
        if (!currentFile) {
            alert('No file available to download');
            return;
        }
        
        try {
            const url = window.URL.createObjectURL(currentFile);
            objectURLsRef.current.push(url);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadFilename || `presentation_with_${slideCount}_slides.pptx`;
            document.body.appendChild(a);
            a.click();
            
            // Cleanup
            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                objectURLsRef.current = objectURLsRef.current.filter(u => u !== url);
            }, 100);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file. Please try again.');
        }
    };

    const handleReset = () => {
        // Confirm reset if slides have been added
        if (slideCount > 0) {
            const confirm = window.confirm(
                `You have ${slideCount} slide${slideCount !== 1 ? 's' : ''} added. Are you sure you want to start over?`
            );
            if (!confirm) return;
        }
        
        // Clean up object URLs
        objectURLsRef.current.forEach(url => {
            try {
                window.URL.revokeObjectURL(url);
            } catch (e) {
                console.error('Error revoking URL:', e);
            }
        });
        objectURLsRef.current = [];
        
        setCurrentFile(null);
        setSlideCount(0);
        setTotalSlides(0);
        setShowDownload(false);
        setLayout('');
        setPreviewData({
            title: '',
            content: '',
            content2: '',
            imagePreview: null
        });
    };

    return (
        <div className="slide-creator-new">
            {backendStatus === 'offline' && (
                <div className="alert alert-error">
                    Backend server is not responding. Please ensure the Flask server is running on port 5000.
                </div>
            )}
            
            {backendStatus === 'checking' && (
                <div className="alert alert-warning">
                    Checking backend connection...
                </div>
            )}
            
            <div className="creator-layout">
                {/* Left Column - Forms */}
                <div className="creator-left">
                    <FileUpload 
                        onFileUploaded={handleFileUploaded}
                        currentFile={currentFile}
                        totalSlides={totalSlides}
                    />
                    
                    <LayoutSelector 
                        onLayoutChange={setLayout} 
                        currentLayout={layout}
                    />
                    
                    <SlideForm 
                        layout={layout} 
                        onSlideAdded={handleSlideAdded}
                        onContentChange={handleContentChange}
                        initialFile={currentFile}
                        slideCount={slideCount}
                        totalSlides={totalSlides}
                    />
                </div>
                
                {/* Right Column - Preview and Status */}
                <div className="creator-right">
                    {slideCount > 0 && (
                        <div className="session-status">
                            <h3 className="status-title">Session Status</h3>
                            <div className="status-info">
                                <div className="status-item">
                                    <span className="status-label">Slides Added:</span>
                                    <span className="status-value">{slideCount}</span>
                                </div>
                                {totalSlides > 0 && (
                                    <div className="status-item">
                                        <span className="status-label">Total Slides:</span>
                                        <span className="status-value">{totalSlides + slideCount}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    
                    <SlidePreview 
                        layout={layout}
                        title={previewData.title}
                        content={previewData.content}
                        content2={previewData.content2}
                        imagePreview={previewData.imagePreview}
                    />
                    
                    {showDownload && (
                        <div className="download-section">
                            <button 
                                className="btn-download" 
                                onClick={handleDownload}
                            >
                                 Download Presentation
                            </button>
                            <button 
                                className="btn-reset" 
                                onClick={handleReset}
                            >
                                Start New
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SlideCreator;
