import React, { useState, useEffect, useRef } from 'react';
import './SlideForm.css';

const SlideForm = ({ layout, onSlideAdded, onContentChange, initialFile, templatePath, slideCount, totalSlides, onSuccess }) => {
    const [title, setTitle] = useState('');
    const [text, setText] = useState('');
    const [text2, setText2] = useState('');
    const [image, setImage] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [file, setFile] = useState(initialFile);
    const [position, setPosition] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const hasFileSource = Boolean(file);
    const hasTemplateSource = Boolean(templatePath);
    const hasSource = hasFileSource || hasTemplateSource;
    
    // Abort controller for canceling requests
    const abortControllerRef = useRef(null);
    
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Cancel any pending requests
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            // Cleanup image preview
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
        };
    }, [imagePreview]);

    // Update file when initialFile changes
    useEffect(() => {
        if (initialFile) {
            setFile(initialFile);
        }
    }, [initialFile]);
    
    // Notify parent of content changes for preview
    useEffect(() => {
        if (onContentChange) {
            onContentChange({
                title,
                content: text,
                content2: text2,
                imagePreview
            });
        }
    }, [title, text, text2, imagePreview, onContentChange]);

    // Handle image selection
    const handleImageChange = (e) => {
        const selectedImage = e.target.files[0];
        if (selectedImage) {
            setImage(selectedImage);
            
            // Create preview URL
            if (imagePreview) {
                URL.revokeObjectURL(imagePreview);
            }
            const previewUrl = URL.createObjectURL(selectedImage);
            setImagePreview(previewUrl);
        }
    };

    // Get layout requirements
    const getLayoutRequirements = () => {
        switch (layout) {
            case 'title_content':
                return { needsContent: true, needsContent2: false, needsImage: false };
            case 'title_two_content':
                return { needsContent: true, needsContent2: true, needsImage: false };
            case 'title_image_content':
                return { needsContent: true, needsContent2: false, needsImage: true };
            case 'title_image':
                return { needsContent: false, needsContent2: false, needsImage: true };
            default:
                return { needsContent: false, needsContent2: false, needsImage: false };
        }
    };

    const requirements = getLayoutRequirements();
    const defaultPosition = (Number.isFinite(totalSlides) ? totalSlides : 0) + (Number.isFinite(slideCount) ? slideCount : 0);

    const getSourceFilename = () => {
        if (file && file.name) {
            return file.name;
        }
        if (templatePath) {
            const segments = templatePath.split(/[\\/]/);
            const name = segments[segments.length - 1];
            return name || 'presentation.pptx';
        }
        return 'presentation.pptx';
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Prevent double submission
        if (loading) {
            return;
        }
        
        setLoading(true);
    setError('');

        // Create new abort controller for this request
        abortControllerRef.current = new AbortController();

        try {
            // Validate source exists (either file upload or template path)
            if (!hasSource) {
                setError('Please select a template or upload a file');
                setLoading(false);
                return;
            }
            
            // Validate layout is selected
            if (!layout) {
                setError('Please select a slide layout');
                setLoading(false);
                return;
            }
            
            // Validate required fields based on layout
            if (requirements.needsContent && !text.trim()) {
                setError('Content is required for this layout');
                setLoading(false);
                return;
            }
            
            if (requirements.needsContent2 && !text2.trim()) {
                setError('Second content is required for this layout');
                setLoading(false);
                return;
            }
            
            if (requirements.needsImage && !image) {
                setError('Image is required for this layout');
                setLoading(false);
                return;
            }
            
            // Validate position
            const positionNum = position === '' ? defaultPosition : parseInt(position, 10);
            if (isNaN(positionNum) || positionNum < 0) {
                setError('Position must be a non-negative number');
                setLoading(false);
                return;
            }
            
            const formData = new FormData();
            if (file) {
                formData.append('file', file);
            } else if (templatePath) {
                formData.append('templatePath', templatePath);
            }
            formData.append('layout', layout);
            formData.append('title', title.trim());
            if (requirements.needsContent) {
                formData.append('text', text.trim());
            }
            if (requirements.needsContent2) {
                formData.append('text2', text2.trim());
            }
            if (image) {
                formData.append('image', image);
            }
            formData.append('position', positionNum);

            const response = await fetch('http://localhost:5000/api/add-slide', {
                method: 'POST',
                body: formData,
                signal: abortControllerRef.current.signal,
            });

            if (response.ok) {
                const blob = await response.blob();
                
                // Validate blob size
                if (blob.size === 0) {
                    setError('Received empty file from server. Please try again.');
                    setLoading(false);
                    return;
                }
                
                // Extract filename from Content-Disposition header
                const contentDisposition = response.headers.get('Content-Disposition');
                let filename = getSourceFilename();
                if (contentDisposition) {
                    const match = contentDisposition.match(/filename="?([^"]+)"?/);
                    if (match && match[1]) {
                        filename = match[1];
                    }
                }

                // Notify parent component with the updated file and filename
                if (onSlideAdded) {
                    const updatedFile = new File([blob], filename, { type: blob.type });
                    onSlideAdded(updatedFile, filename);
                }
                
                if (onSuccess) {
                    onSuccess('Slide added successfully! You can add more slides or download the presentation.');
                }
                
                // Reset form fields but keep the file
                setTitle('');
                setText('');
                setText2('');
                setImage(null);
                setPosition('');
                
                // Clear image preview
                if (imagePreview) {
                    URL.revokeObjectURL(imagePreview);
                    setImagePreview(null);
                }
                
                // Clear file inputs
                const imageInput = document.querySelector('input[type="file"][accept="image/*"]');
                if (imageInput) {
                    imageInput.value = '';
                }
            } else {
                const errorData = await response.json().catch(() => ({ error: 'Unknown error occurred' }));
                setError(errorData.error || 'Failed to add slide. Please try again.');
            }
        } catch (err) {
            // Check if error is due to abort
            if (err.name === 'AbortError') {
                setError('Request was cancelled');
            } else if (err.message.includes('fetch')) {
                setError('Cannot connect to the server. Please ensure the backend is running on port 5000.');
            } else {
                setError(`Error: ${err.message}`);
            }
            console.error('Error:', err);
        } finally {
            setLoading(false);
            abortControllerRef.current = null;
        }
    };

    return (
        <form onSubmit={handleSubmit} className="slide-form-new">
            {error && <div className="alert alert-error">{error}</div>}
            
            {/* Position Section */}
            {hasSource && layout && (
                <div className="form-section">
                    <h3 className="form-section-title">Choose Slide Position</h3>
                    <div className="form-group">
                        <label className="form-label">Position:</label>
                        <input 
                            type="number" 
                            value={position} 
                            onChange={(e) => setPosition(e.target.value)} 
                            min="0"
                            placeholder={`Leave blank to add at end (${defaultPosition})`}
                            disabled={loading}
                            className="text-input"
                        />
                        <small className="form-hint">
                             Enter 0 for beginning, 1 for after first slide, or leave blank to add at end
                        </small>
                    </div>
                </div>
            )}

            {/* Content Section */}
            {hasSource && layout && (
                <div className="form-section">
                    <h3 className="form-section-title">Enter Slide Content</h3>
                    
                    <div className="form-group">
                        <label className="form-label">Title:</label>
                        <input 
                            type="text" 
                            value={title} 
                            onChange={(e) => setTitle(e.target.value)} 
                            placeholder="Enter slide title"
                            disabled={loading}
                            className="text-input"
                        />
                    </div>
                    
                    {requirements.needsContent && (
                        <div className="form-group">
                            <label className="form-label">Content {requirements.needsContent2 ? '1' : ''}:</label>
                            <textarea 
                                value={text} 
                                onChange={(e) => setText(e.target.value)} 
                                placeholder="Enter slide content"
                                required
                                disabled={loading}
                                className="textarea-input"
                                rows="5"
                            />
                        </div>
                    )}
                    
                    {requirements.needsContent2 && (
                        <div className="form-group">
                            <label className="form-label">Content 2:</label>
                            <textarea 
                                value={text2} 
                                onChange={(e) => setText2(e.target.value)} 
                                placeholder="Enter second content"
                                required
                                disabled={loading}
                                className="textarea-input"
                                rows="5"
                            />
                        </div>
                    )}
                    
                    {requirements.needsImage && (
                        <div className="form-group">
                            <label className="form-label">Image:</label>
                            <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleImageChange} 
                                required
                                disabled={loading}
                                className="file-input"
                            />
                            {imagePreview && (
                                <div className="image-preview">
                                    <img src={imagePreview} alt="Preview" />
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
            
            <button type="submit" disabled={loading || !layout || !hasSource} className="submit-button">
                {loading ? 'Processing...' : 'Add Slide'}
            </button>
        </form>
    );
};

export default SlideForm;
