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
        if (fileInputRef.current) {
            // Reset value so selecting the same file twice still triggers change
            fileInputRef.current.value = '';
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
                    className="file-input"
                    ref={fileInputRef}
                    style={{ display: 'none' }}
                />
                <div 
                    className="file-input-label"
                    onClick={handleClick}
                    role="button"
                    tabIndex={0}
                >
                    {currentFile ? (
                        <>
                            <span className="file-icon">✓</span>
                            <div className="file-details">
                                <span className="file-name">{currentFile.name}</span>
                                {totalSlides > 0 && (
                                    <span className="file-meta">{totalSlides} slides in deck</span>
                                )}
                                <span className="file-meta">Click to replace file</span>
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
