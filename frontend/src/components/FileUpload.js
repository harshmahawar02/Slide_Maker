import React, { useRef } from 'react';
import './FileUpload.css';

const FileUpload = ({ onFileUploaded, currentFile, totalSlides }) => {
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && onFileUploaded) {
            onFileUploaded(selectedFile);
        }
    };

    const handleClick = () => {
        if (currentFile === null && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    return (
        <div className="file-upload-section">
            <h3 className="upload-title">Upload PowerPoint Template</h3>
            <div className="upload-container">
                <input 
                    type="file" 
                    accept=".pptx"
                    onChange={handleFileChange}
                    disabled={currentFile !== null}
                    className="file-input"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                />
                <div 
                    className={`file-input-label ${currentFile ? 'disabled' : ''}`}
                    onClick={handleClick}
                    role="button"
                    tabIndex={currentFile ? -1 : 0}
                >
                    {currentFile ? (
                        <>
                            <span className="file-icon">✓</span>
                            <div className="file-details">
                                <span className="file-name">{currentFile.name}</span>
                                {totalSlides > 0 && (
                                    <span className="file-meta">{totalSlides} slides found</span>
                                )}
                            </div>
                        </>
                    ) : (
                        <>
                            <span className="file-icon">📄</span>
                            <span className="file-prompt">Click to select .pptx file</span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FileUpload;
