import React, { useState, useEffect, useRef } from 'react';
import './MassUpdate.css';

const MassUpdate = ({ selectedFiles = [], templatePath, onClose, isModal = false }) => {
    const [files, setFiles] = useState([]);
    const [replacements, setReplacements] = useState([{ id: Date.now(), find: '', replace: '' }]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({});
    const fileInputRef = useRef(null);
    const hasPreselectedFiles = selectedFiles.length > 0;

    // Initialize with preselected files if available
    useEffect(() => {
        if (selectedFiles.length > 0) {
            // Convert file objects to the format expected
            const formattedFiles = selectedFiles.map(file => ({
                name: file.name,
                fullPath: file.fullPath,
                size: file.sizeBytes || file.size || 0
            }));
            setFiles(formattedFiles);
        } else if (templatePath) {
            // Single file from customize dropdown
            const fileName = templatePath.split('\\').pop() || templatePath.split('/').pop();
            setFiles([{ name: fileName, fullPath: templatePath }]);
        }
    }, [selectedFiles, templatePath]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cleanup any object URLs if needed
        };
    }, []);

    const handleClose = () => {
        if (onClose) {
            onClose(null);
        }
    };

    // Handle file selection (for manual upload mode)
    const handleFileChange = (e) => {
        const selectedFiles = Array.from(e.target.files).filter(file => {
            const ext = file.name.toLowerCase();
            return ext.endsWith('.ppt') || ext.endsWith('.pptx');
        });

        if (selectedFiles.length === 0) {
            setError('Please select at least one PowerPoint file (.ppt or .pptx)');
            return;
        }

        setFiles(selectedFiles);
        setError('');
    };

    // Add new replacement row
    const handleAddRow = () => {
        setReplacements([...replacements, { id: Date.now(), find: '', replace: '' }]);
    };

    // Remove replacement row
    const handleRemoveRow = (id) => {
        if (replacements.length > 1) {
            setReplacements(replacements.filter(r => r.id !== id));
            // Clear validation errors for removed row
            const newErrors = { ...validationErrors };
            delete newErrors[id];
            setValidationErrors(newErrors);
        }
    };

    // Update replacement value
    const handleReplacementChange = (id, field, value) => {
        setReplacements(replacements.map(r => 
            r.id === id ? { ...r, [field]: value } : r
        ));
        
        // Clear validation error for this field
        if (validationErrors[id]) {
            const newErrors = { ...validationErrors };
            delete newErrors[id];
            setValidationErrors(newErrors);
        }
    };

    // Validate replacements
    const validateReplacements = () => {
        const errors = {};
        const findTexts = new Set();
        const replaceTexts = new Set();
        let hasError = false;

        replacements.forEach(r => {
            // Check for empty find text
            if (!r.find.trim()) {
                errors[r.id] = 'Find text cannot be empty';
                hasError = true;
                return;
            }

            // Check for duplicates
            if (findTexts.has(r.find.trim())) {
                errors[r.id] = 'Duplicate find text';
                hasError = true;
            }
            findTexts.add(r.find.trim());

            if (r.replace.trim()) {
                replaceTexts.add(r.replace.trim());
            }
        });

        // Check for inverse mappings (A->B and B->A)
        replacements.forEach(r => {
            if (r.find.trim() && r.replace.trim()) {
                if (replaceTexts.has(r.find.trim()) && findTexts.has(r.replace.trim())) {
                    errors[r.id] = 'Inverse mapping detected (circular replacement)';
                    hasError = true;
                }
            }
        });

        setValidationErrors(errors);
        return !hasError;
    };

    // Format file size
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();

        // Prevent double submission
        if (loading) return;

        // Validate files
        if (files.length === 0) {
            setError('Please select at least one PowerPoint file');
            return;
        }

        // Validate replacements
        if (!validateReplacements()) {
            setError('Please fix the validation errors in replacement rules');
            return;
        }

        // Check if at least one replacement has values
        const validReplacements = replacements.filter(r => r.find.trim());
        if (validReplacements.length === 0) {
            setError('Please define at least one replacement rule');
            return;
        }

        setLoading(true);
        setError('');

        try {
            // Create FormData
            const formData = new FormData();
            
            // Add files - check if they're File objects or path objects
            if (hasPreselectedFiles || (files.length > 0 && files[0].fullPath)) {
                // Files are from the browser (have fullPath)
                const filePaths = files.map(f => f.fullPath);
                formData.append('filePaths', JSON.stringify(filePaths));
            } else {
                // Files are uploaded File objects
                files.forEach((file) => {
                    formData.append('files', file);
                });
            }

            // Add replacements as JSON
            const replacementsObj = {};
            validReplacements.forEach(r => {
                replacementsObj[r.find.trim()] = r.replace.trim();
            });
            formData.append('replacements', JSON.stringify(replacementsObj));

            // Send request
            const response = await fetch('http://localhost:5000/api/mass-update/process', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || `Server error: ${response.status}`);
            }

            // Get the ZIP file
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `processed_presentations_${Date.now()}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            // Reset form
            const processedCount = files.length;
            setFiles([]);
            setReplacements([{ id: Date.now(), find: '', replace: '' }]);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            if (isModal && onClose) {
                onClose(`Success! Processed ${processedCount} file(s). Check your downloads folder.`);
            } else {
                alert(`Success! Processed ${processedCount} file(s). Check your downloads folder.`);
            }

        } catch (err) {
            console.error('Error processing files:', err);
            setError(err.message || 'Failed to process files. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // Remove selected file
    const handleRemoveFile = (index) => {
        const newFiles = files.filter((_, i) => i !== index);
        setFiles(newFiles);
        
        if (newFiles.length === 0 && fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="mass-update-container">
            <div className="mass-update-card">
                <p className="mass-update-description">
                    {hasPreselectedFiles 
                        ? 'Define text replacements to apply across all selected presentations.'
                        : 'Upload multiple PowerPoint files and define text replacements to apply across all slides.'
                    }
                </p>

                <form onSubmit={handleSubmit}>
                    {/* Step 1: File Selection */}
                    <div className="mass-update-section">
                        <h3 className="section-title">
                            <span className="step-number">1</span>
                            Selected Presentations
                        </h3>
                        
                        {/* Show preselected files or upload interface */}
                        {!hasPreselectedFiles && (
                            <div className="file-upload-area">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    id="file-input"
                                    multiple
                                    accept=".ppt,.pptx"
                                    onChange={handleFileChange}
                                    className="file-input-hidden"
                                />
                                <label htmlFor="file-input" className="file-upload-button">
                                    <span className="upload-icon">📁</span>
                                    Choose Files or Folder
                                </label>
                                <p className="file-upload-hint">
                                    Supports .ppt and .pptx files
                                </p>
                            </div>
                        )}

                        {files.length > 0 && (
                            <div className="files-list">
                                <h4 className="files-list-title">
                                    {hasPreselectedFiles ? `${files.length} presentation(s) selected` : `Selected Files (${files.length})`}
                                </h4>
                                <div className="files-table">
                                    {files.map((file, index) => (
                                        <div key={index} className="file-row">
                                            <div className="file-info">
                                                <span className="file-icon">📄</span>
                                                <div className="file-details">
                                                    <span className="file-name">{file.name}</span>
                                                    <span className="file-size">{formatFileSize(file.size)}</span>
                                                </div>
                                            </div>
                                            {!hasPreselectedFiles && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveFile(index)}
                                                    className="file-remove-btn"
                                                    aria-label={`Remove ${file.name}`}
                                                >
                                                    ✕
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Step 2: Replacement Rules */}
                    {files.length > 0 && (
                        <div className="mass-update-section">
                            <h3 className="section-title">
                                <span className="step-number">2</span>
                                Define Replacement Rules
                            </h3>

                            <div className="replacements-table">
                                <div className="table-header">
                                    <div className="table-cell header-cell">Find Text</div>
                                    <div className="table-cell header-cell">Replace With</div>
                                </div>

                                {replacements.map((replacement, index) => (
                                    <div key={replacement.id} className="table-row">
                                        <div className="table-cell">
                                            <input
                                                type="text"
                                                value={replacement.find}
                                                onChange={(e) => handleReplacementChange(replacement.id, 'find', e.target.value)}
                                                placeholder="Text to find..."
                                                className={`replacement-input ${validationErrors[replacement.id] ? 'input-error' : ''}`}
                                                aria-label={`Find text ${index + 1}`}
                                            />
                                        </div>
                                        <div className="table-cell">
                                            <input
                                                type="text"
                                                value={replacement.replace}
                                                onChange={(e) => handleReplacementChange(replacement.id, 'replace', e.target.value)}
                                                placeholder="Replace with..."
                                                className="replacement-input"
                                                aria-label={`Replace text ${index + 1}`}
                                            />
                                        </div>
                                        {replacements.length > 1 && (
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveRow(replacement.id)}
                                                className="remove-row-btn-hover"
                                                aria-label={`Remove replacement rule ${index + 1}`}
                                            >
                                                ✕
                                            </button>
                                        )}
                                        {validationErrors[replacement.id] && (
                                            <div className="validation-error">
                                                {validationErrors[replacement.id]}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={handleAddRow}
                                className="add-row-btn"
                            >
                                <span className="add-icon">+</span>
                                Add Replacement Rule
                            </button>
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="error-message" role="alert">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Submit Button */}
                    {files.length > 0 && (
                        <div className="submit-section">
                            <button
                                type="submit"
                                className="process-btn"
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Processing {files.length} file(s)...
                                    </>
                                ) : (
                                    'Process Files'
                                )}
                            </button>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

export default MassUpdate;
