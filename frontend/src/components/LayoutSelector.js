import React from 'react';
import './LayoutSelector.css';

const LayoutSelector = ({ onLayoutChange, currentLayout }) => {
    const layouts = [
        {
            id: '',
            name: 'Select a layout...',
        },
        {
            id: 'title_content',
            name: 'Title and Content',
        },
        {
            id: 'title_two_content',
            name: 'Title and Two Content',
        },
        {
            id: 'title_image_content',
            name: 'Title Image and Content',
        },
        {
            id: 'title_image',
            name: 'Title and Image',
        }
    ];

    return (
        <div className="layout-selector-new">
            <label htmlFor="layout-dropdown" className="layout-selector-label">
                Select Slide Layout
            </label>
            <select
                id="layout-dropdown"
                className="layout-dropdown"
                value={currentLayout}
                onChange={(e) => onLayoutChange(e.target.value)}
            >
                {layouts.map((layout) => (
                    <option key={layout.id} value={layout.id}>
                        {layout.name}
                    </option>
                ))}
            </select>
        </div>
    );
};

export default LayoutSelector;
