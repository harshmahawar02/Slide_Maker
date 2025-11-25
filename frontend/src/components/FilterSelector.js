import React, { useState, useEffect } from 'react';
import './FilterSelector.css';

const FilterSelector = ({ onFolderSelected }) => {
    const [filters, setFilters] = useState({
        subSolution: '',
        serviceType: '',
        sessionDescription: ''
    });

    const [options, setOptions] = useState({
        subSolution: [],
        serviceType: [],
        sessionDescription: []
    });

    const [loading, setLoading] = useState({
        initial: true,
        serviceType: false,
        sessionDescription: false,
        applying: false
    });

    const [error, setError] = useState('');

    // Load initial Sub Solution options
    useEffect(() => {
        loadFilterOptions();
    }, []);

    // Load Service Type options when Sub Solution changes
    useEffect(() => {
        if (filters.subSolution) {
            loadFilterOptions('serviceType', { subSolution: filters.subSolution });
        } else {
            // Reset dependent filters
            setOptions(prev => ({
                ...prev,
                serviceType: [],
                sessionDescription: []
            }));
            setFilters(prev => ({
                ...prev,
                serviceType: '',
                sessionDescription: ''
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.subSolution]);

    // Load Session Description options when Service Type changes
    useEffect(() => {
        if (filters.serviceType && filters.subSolution) {
            loadFilterOptions('sessionDescription', {
                subSolution: filters.subSolution,
                serviceType: filters.serviceType
            });
        } else {
            // Reset dependent filter
            setOptions(prev => ({
                ...prev,
                sessionDescription: []
            }));
            setFilters(prev => ({
                ...prev,
                sessionDescription: ''
            }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters.serviceType]);

    const loadFilterOptions = async (level = 'initial', params = {}) => {
        const loadingKey = level === 'initial' ? 'initial' : level;
        setLoading(prev => ({ ...prev, [loadingKey]: true }));
        setError('');

        try {
            const queryParams = new URLSearchParams(params);
            const response = await fetch(
                `http://localhost:5000/api/sharepoint/filter-options?${queryParams}`
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to load filter options');
            }

            const data = await response.json();
            setOptions(prev => ({
                ...prev,
                ...data
            }));
        } catch (err) {
            console.error('Error loading filter options:', err);
            setError(err.message || 'Failed to load filter options. Please ensure query.iqy file is in Downloads folder.');
        } finally {
            setLoading(prev => ({ ...prev, [loadingKey]: false }));
        }
    };

    const handleFilterChange = (filterName, value) => {
        setFilters(prev => ({
            ...prev,
            [filterName]: value
        }));
        setError('');
    };

    const handleClearFilters = () => {
        setFilters({
            subSolution: '',
            serviceType: '',
            sessionDescription: ''
        });
        setError('');
        loadFilterOptions();
    };

    const handleApplyFilters = async () => {
        if (!filters.subSolution || !filters.serviceType || !filters.sessionDescription) {
            setError('Please select all filter options');
            return;
        }

        setLoading(prev => ({ ...prev, applying: true }));
        setError('');

        try {
            const response = await fetch('http://localhost:5000/api/sharepoint/get-folder', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filters),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get folder');
            }

            const data = await response.json();

            if (!data.exists) {
                setError(
                    'Folder not found on local system. Please ensure the SharePoint folder is synced to OneDrive.'
                );
                return;
            }

            // Notify parent component with folder path
            onFolderSelected(data.folderPath);
        } catch (err) {
            console.error('Error applying filters:', err);
            setError(err.message || 'Failed to apply filters. Please try different filter combinations.');
        } finally {
            setLoading(prev => ({ ...prev, applying: false }));
        }
    };

    const isServiceTypeDisabled = !filters.subSolution || loading.serviceType;
    const isSessionDescriptionDisabled =
        !filters.serviceType || !filters.subSolution || loading.sessionDescription;
    const isApplyDisabled =
        !filters.subSolution ||
        !filters.serviceType ||
        !filters.sessionDescription ||
        loading.applying;

    if (loading.initial) {
        return (
            <div className="filter-selector-container">
                <div className="filter-selector-loading">
                    <div className="loading-spinner"></div>
                    <p>Loading filter options...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="filter-selector-container">
            <div className="filter-selector-card">
                <div className="filter-selector-header">
                    <h2 className="filter-selector-title">Select Presentation Folder</h2>
                    <p className="filter-selector-description">
                        Use the filters below to locate your SharePoint presentation folder
                    </p>
                </div>

                <div className="filter-selector-content">
                    {/* Filter Step 1: Sub Solution */}
                    <div className="filter-group">
                        <label htmlFor="subSolution" className="filter-label">
                            <span className="filter-step">1</span>
                            Sub Solution
                            <span className="filter-required">*</span>
                        </label>
                        <select
                            id="subSolution"
                            className="filter-select"
                            value={filters.subSolution}
                            onChange={(e) => handleFilterChange('subSolution', e.target.value)}
                            disabled={loading.initial}
                        >
                            <option value="">Select Sub Solution</option>
                            {options.subSolution.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Step 2: Service Type */}
                    <div className="filter-group">
                        <label htmlFor="serviceType" className="filter-label">
                            <span className="filter-step">2</span>
                            Service Type
                            <span className="filter-required">*</span>
                        </label>
                        <select
                            id="serviceType"
                            className="filter-select"
                            value={filters.serviceType}
                            onChange={(e) => handleFilterChange('serviceType', e.target.value)}
                            disabled={isServiceTypeDisabled}
                        >
                            <option value="">
                                {isServiceTypeDisabled && !loading.serviceType
                                    ? 'Select Sub Solution first'
                                    : loading.serviceType
                                    ? 'Loading...'
                                    : 'Select Service Type'}
                            </option>
                            {options.serviceType.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Step 3: Session Description */}
                    <div className="filter-group">
                        <label htmlFor="sessionDescription" className="filter-label">
                            <span className="filter-step">3</span>
                            Session Description
                            <span className="filter-required">*</span>
                        </label>
                        <select
                            id="sessionDescription"
                            className="filter-select"
                            value={filters.sessionDescription}
                            onChange={(e) => handleFilterChange('sessionDescription', e.target.value)}
                            disabled={isSessionDescriptionDisabled}
                        >
                            <option value="">
                                {isSessionDescriptionDisabled && !loading.sessionDescription
                                    ? 'Select Service Type first'
                                    : loading.sessionDescription
                                    ? 'Loading...'
                                    : 'Select Session Description'}
                            </option>
                            {options.sessionDescription.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {error && (
                    <div className="filter-error" role="alert">
                        <svg className="filter-error-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path
                                fillRule="evenodd"
                                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                                clipRule="evenodd"
                            />
                        </svg>
                        <span>{error}</span>
                    </div>
                )}

                <div className="filter-actions">
                    <button
                        type="button"
                        className="filter-button filter-button-secondary"
                        onClick={handleClearFilters}
                        disabled={loading.applying}
                    >
                        Clear Filters
                    </button>
                    <button
                        type="button"
                        className="filter-button filter-button-primary"
                        onClick={handleApplyFilters}
                        disabled={isApplyDisabled}
                    >
                        {loading.applying ? (
                            <>
                                <span className="button-spinner"></span>
                                Locating Folder...
                            </>
                        ) : (
                            'Show Presentations'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FilterSelector;
