import React from 'react';
import './SlidePreview.css';

const SlidePreview = ({ layout, title, content, content2, imagePreview }) => {
    const renderPreview = () => {
        switch (layout) {
            case 'title_content':
                return (
                    <div className="preview-slide">
                        <div className="preview-title">
                            {title || 'Your title here...'}
                        </div>
                        <div className="preview-content">
                            {content || 'Your content here...'}
                        </div>
                    </div>
                );
            
            case 'title_two_content':
                return (
                    <div className="preview-slide">
                        <div className="preview-title">
                            {title || 'Your title here...'}
                        </div>
                        <div className="preview-two-content">
                            <div className="preview-content-box">
                                {content || 'First content here...'}
                            </div>
                            <div className="preview-content-box">
                                {content2 || 'Second content here...'}
                            </div>
                        </div>
                    </div>
                );
            
            case 'title_image_content':
                return (
                    <div className="preview-slide">
                        <div className="preview-title">
                            {title || 'Your title here...'}
                        </div>
                        <div className="preview-image-content">
                            <div className="preview-image-box">
                                {imagePreview ? (
                                    <img src={imagePreview} alt="Preview" />
                                ) : (
                                    <div className="preview-image-placeholder">
                                        <span>📷</span>
                                        <span>Image</span>
                                    </div>
                                )}
                            </div>
                            <div className="preview-content">
                                {content || 'Your content here...'}
                            </div>
                        </div>
                    </div>
                );
            
            case 'title_image':
                return (
                    <div className="preview-slide">
                        <div className="preview-title">
                            {title || 'Your title here...'}
                        </div>
                        <div className="preview-image-only">
                            {imagePreview ? (
                                <img src={imagePreview} alt="Preview" />
                            ) : (
                                <div className="preview-image-placeholder">
                                    <span>📷</span>
                                    <span>Image</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            
            default:
                return (
                    <div className="preview-slide">
                        <div className="preview-placeholder">
                            Select a layout to see preview
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="slide-preview-container">
            <h3 className="preview-header">Slide Preview</h3>
            <div className="preview-wrapper">
                {renderPreview()}
            </div>
            <p className="preview-hint">Preview updates as you type</p>
        </div>
    );
};

export default SlidePreview;
