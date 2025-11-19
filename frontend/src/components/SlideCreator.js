import React, { useState, useEffect, useRef } from 'react';
import SlideForm from './SlideForm';
import LayoutSelector from './LayoutSelector';
import SlidePreview from './SlidePreview';
import FileUpload from './FileUpload';
import './SlideCreator.css';

const SlideCreator = ({ templatePath, onBack }) => {
    const [layout, setLayout] = useState('');
    const [currentFile, setCurrentFile] = useState(null);
    const [currentTemplatePath, setCurrentTemplatePath] = useState(templatePath || null);
    const [downloadFilename, setDownloadFilename] = useState('');
    const [slideCount, setSlideCount] = useState(0);
    const [totalSlides, setTotalSlides] = useState(0);
    const [showDownload, setShowDownload] = useState(false);
    const [backendStatus, setBackendStatus] = useState('checking');
    const [previewData, setPreviewData] = useState({
        title: '',
        content: '',
        content2: '',
        imagePreview: null,
    });
    const [successMessage, setSuccessMessage] = useState('');
    const [isSuccessModalVisible, setIsSuccessModalVisible] = useState(false);

    const effectiveSlideTotal = totalSlides + slideCount;

    const objectURLsRef = useRef([]);
    const successDelayRef = useRef(null);

    useEffect(() => {
        const checkBackend = async () => {
            try {
                const response = await fetch('http://localhost:5000/api/health', {
                    method: 'GET',
                    signal: AbortSignal.timeout(5000),
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
        const interval = setInterval(checkBackend, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (templatePath) {
            setCurrentTemplatePath(templatePath);
            (async () => {
                try {
                    const resp = await fetch('http://localhost:5000/api/get-slide-count', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ templatePath }),
                    });
                    const data = await resp.json();
                    if (resp.ok) {
                        setTotalSlides(data.total_slides || 0);
                        setDownloadFilename(`${data.filename || 'presentation'}_updated.pptx`);
                    } else {
                        console.error('Failed to fetch slide count:', data.error);
                    }
                } catch (error) {
                    console.error('Error fetching slide count:', error);
                }
            })();
        }
    }, [templatePath]);

    useEffect(() => {
        return () => {
            objectURLsRef.current.forEach((url) => {
                try {
                    window.URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Error revoking URL:', error);
                }
            });
            if (successDelayRef.current) {
                clearTimeout(successDelayRef.current);
            }
        };
    }, []);

    const handleSlideAdded = (updatedFile, filename) => {
        if (!updatedFile || updatedFile.size === 0) {
            console.error('Invalid file received');
            return;
        }

        setCurrentFile(updatedFile);
        setDownloadFilename(filename);
        setSlideCount((prev) => prev + 1);
        setShowDownload(true);
    };

    const handleSlideSuccess = (message) => {
        if (successDelayRef.current) {
            clearTimeout(successDelayRef.current);
            successDelayRef.current = null;
        }

        setIsSuccessModalVisible(false);
        setSuccessMessage(message);

        successDelayRef.current = setTimeout(() => {
            setIsSuccessModalVisible(true);
            successDelayRef.current = null;
        }, 350);
    };

    const dismissSuccess = () => {
        if (successDelayRef.current) {
            clearTimeout(successDelayRef.current);
            successDelayRef.current = null;
        }
        setIsSuccessModalVisible(false);
        setSuccessMessage('');
    };

    useEffect(() => {
        if (!isSuccessModalVisible) {
            return;
        }

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                dismissSuccess();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = originalOverflow;
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isSuccessModalVisible]);

    useEffect(() => {
        if (!layout) {
            return;
        }

        const cards = document.querySelectorAll('.creator-left .file-upload-section');
        cards.forEach((card) => {
            card.style.minHeight = card.offsetHeight + 'px';
        });
    }, [layout]);

    const handleFileUploaded = async (file) => {
        if (!file) return;

        setCurrentFile(file);
        setCurrentTemplatePath(null);

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
                const errorData = await response
                    .json()
                    .catch(() => ({ error: 'Failed to load slide count' }));
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

            setTimeout(() => {
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                objectURLsRef.current = objectURLsRef.current.filter((u) => u !== url);
            }, 100);
        } catch (error) {
            console.error('Download error:', error);
            alert('Failed to download file. Please try again.');
        }
    };

    const handleReset = () => {
        if (slideCount > 0) {
            const confirmReset = window.confirm(
                `You have ${slideCount} slide${slideCount !== 1 ? 's' : ''} added in this session. This will clear the form but keep them in the deck. Continue?`
            );
            if (!confirmReset) return;
        }

        objectURLsRef.current.forEach((url) => {
            try {
                window.URL.revokeObjectURL(url);
            } catch (error) {
                console.error('Error revoking URL:', error);
            }
        });
        objectURLsRef.current = [];

        if (slideCount > 0) {
            setTotalSlides((prev) => prev + slideCount);
        }
        setSlideCount(0);
        setLayout('');
        setPreviewData({
            title: '',
            content: '',
            content2: '',
            imagePreview: null,
        });
    };

    const templateDisplayName = currentTemplatePath ? currentTemplatePath.split(/[\\/]/).pop() : '';

    return (
        <div className="slide-creator-new">
            {isSuccessModalVisible && successMessage && (
                <div className="success-modal-backdrop">
                    <div
                        className="success-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="success-modal-title"
                        aria-describedby="success-modal-message"
                    >
                        <h3 id="success-modal-title">Slide added</h3>
                        <p id="success-modal-message">{successMessage}</p>
                        <button className="modal-ok-button" onClick={dismissSuccess} autoFocus>
                            OK
                        </button>
                    </div>
                </div>
            )}

            {backendStatus === 'offline' && (
                <div className="alert alert-error">
                    Backend server is not responding. Please ensure the Flask server is running on port 5000.
                </div>
            )}

            {backendStatus === 'checking' && (
                <div className="alert alert-warning">Checking backend connection...</div>
            )}

            <div className="creator-layout">
                <div className="creator-left">
                    {!currentTemplatePath && (
                        <FileUpload onFileUploaded={handleFileUploaded} currentFile={currentFile} totalSlides={effectiveSlideTotal} />
                    )}

                    {currentTemplatePath && (
                        <div className="file-upload-section template-summary">
                            <h3 className="upload-title">Template Selected</h3>
                            <div className="upload-container">
                                <div className="file-input-label disabled">
                                    <span className="file-icon">✓</span>
                                    <div className="file-details">
                                        <span className="file-name" title={currentTemplatePath}>
                                            {templateDisplayName || currentTemplatePath}
                                        </span>
                                        {effectiveSlideTotal > 0 && (
                                            <span className="file-meta">{effectiveSlideTotal} slides in deck</span>
                                        )}
                                    </div>
                                </div>
                                {onBack && (
                                    <div className="template-summary-actions">
                                        <button className="btn-reset" onClick={onBack}>
                                            Back to file browser
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <LayoutSelector onLayoutChange={setLayout} currentLayout={layout} />

                    <SlideForm
                        layout={layout}
                        onSlideAdded={handleSlideAdded}
                        onContentChange={handleContentChange}
                        initialFile={currentFile}
                        templatePath={currentTemplatePath}
                        slideCount={slideCount}
                        totalSlides={totalSlides}
                        onSuccess={handleSlideSuccess}
                    />
                </div>

                <div className="creator-right">
                    {(slideCount > 0 || showDownload) && (
                        <div className="session-status">
                            <h3 className="status-title">Session Status</h3>
                            <div className="status-info">
                                <div className="status-item">
                                    <span className="status-label">Slides Added This Session:</span>
                                    <span className="status-value">{slideCount}</span>
                                </div>
                                {effectiveSlideTotal > 0 && (
                                    <div className="status-item">
                                        <span className="status-label">Total Slides:</span>
                                        <span className="status-value">{effectiveSlideTotal}</span>
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
                            <button className="btn-download" onClick={handleDownload}>
                                Download Presentation
                            </button>
                            <button className="btn-reset" onClick={handleReset}>
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
