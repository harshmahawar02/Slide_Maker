import React, { useMemo, useState, useEffect } from 'react';
import './FileBrowser.css';

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const FileBrowser = ({ onOpenSlideMaker, onOpenMassUpdate }) => {
  // Filter states for cascading dropdowns
  const [filters, setFilters] = useState({
    subSolution: '',
    serviceType: '',
    sessionDescription: ''
  });

  const [filterOptions, setFilterOptions] = useState({
    subSolution: [],
    serviceType: [],
    sessionDescription: []
  });

  const [filterLoading, setFilterLoading] = useState({
    initial: true,
    serviceType: false,
    sessionDescription: false,
    applying: false
  });

  // File browsing states
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [folderPath, setFolderPath] = useState('');

  // Table filtering states
  const [searchTerm, setSearchTerm] = useState('');
  const [tableFilters, setTableFilters] = useState({ name: 'ALL', ext: 'ALL', sizeBucket: 'ANY' });

  // Preview & customize states
  const [previewModal, setPreviewModal] = useState({ isOpen: false, file: null, slides: [], loading: false, index: 0 });
  const [showFiltersSection, setShowFiltersSection] = useState(true);
  const [filtersApplied, setFiltersApplied] = useState(false);
  
  // Selection states for bulk download
  const [selectedFiles, setSelectedFiles] = useState(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  // Load initial Sub Solution options
  useEffect(() => {
    loadFilterOptions();
  }, []);

  // Load Service Type options when Sub Solution changes
  useEffect(() => {
    if (filters.subSolution) {
      loadFilterOptions('serviceType', { subSolution: filters.subSolution });
    } else {
      setFilterOptions(prev => ({
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
      setFilterOptions(prev => ({
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
    setFilterLoading(prev => ({ ...prev, [loadingKey]: true }));
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
      setFilterOptions(prev => ({
        ...prev,
        ...data
      }));
    } catch (err) {
      console.error('Error loading filter options:', err);
      setError(err.message || 'Failed to load filter options. Please ensure query.iqy file is in Downloads folder.');
    } finally {
      setFilterLoading(prev => ({ ...prev, [loadingKey]: false }));
    }
  };

  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
    setError('');
  };

  const handleApplyFilters = async () => {
    if (!filters.subSolution || !filters.serviceType || !filters.sessionDescription) {
      setError('Please select all filter options');
      return;
    }

    setFilterLoading(prev => ({ ...prev, applying: true }));
    setError('');
    setFiles([]);
    setFiltersApplied(true);

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

      setFolderPath(data.folderPath);
      setShowFiltersSection(false);
      await scanFolder(data.folderPath);
    } catch (err) {
      console.error('Error applying filters:', err);
      setError(err.message || 'Failed to apply filters. Please try different filter combinations.');
    } finally {
      setFilterLoading(prev => ({ ...prev, applying: false }));
    }
  };

  const handleAdaptFilters = () => {
    setShowFiltersSection(true);
  };

  const scanFolder = async (pathToScan) => {
    setError('');
    setLoading(true);
    setFiles([]);
    setPreviewModal({ isOpen: false, file: null, slides: [], loading: false, index: 0 });

    try {
      const resp = await fetch('http://localhost:5000/api/list-ppts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: pathToScan, includeDetails: true })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to list files');
      setFiles(data.files || []);
      resetTableFilters();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetTableFilters = () => {
    setTableFilters({ name: 'ALL', ext: 'ALL', sizeBucket: 'ANY' });
    setSearchTerm('');
  };

  const uniqueExts = useMemo(() => {
    const set = new Set(files.map(f => f.extension.toLowerCase()));
    return Array.from(set).sort();
  }, [files]);

  const uniqueNames = useMemo(() => {
    return files.slice(0, 200).map(f => f.name);
  }, [files]);

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return files.filter(f => {
      if (search && !f.name.toLowerCase().includes(search)) return false;
      if (tableFilters.name !== 'ALL' && f.name !== tableFilters.name) return false;
      if (tableFilters.ext !== 'ALL' && f.extension.toLowerCase() !== tableFilters.ext.toLowerCase()) return false;
      if (tableFilters.sizeBucket && tableFilters.sizeBucket !== 'ANY') {
        const sz = f.sizeBytes || 0;
        switch (tableFilters.sizeBucket) {
          case '<1MB': if (!(sz < 1024*1024)) return false; break;
          case '1-5MB': if (!(sz >= 1024*1024 && sz < 5*1024*1024)) return false; break;
          case '5-20MB': if (!(sz >= 5*1024*1024 && sz < 20*1024*1024)) return false; break;
          case '>20MB': if (!(sz >= 20*1024*1024)) return false; break;
          default: break;
        }
      }
      return true;
    });
  }, [files, tableFilters, searchTerm]);

  const handleRowClick = async (file) => {
    setPreviewModal({ isOpen: true, file, slides: [], loading: true, index: 0 });

    try {
      const resp = await fetch('http://localhost:5000/api/preview-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templatePath: file.fullPath, maxSlides: 50 })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load preview');
      setPreviewModal(prev => ({
        ...prev,
        loading: false,
        slides: data.slides || [],
        totalSlides: data.totalSlides || 0
      }));
    } catch (e) {
      setPreviewModal(prev => ({ ...prev, loading: false }));
    }
  };

  const closePreviewModal = () => {
    setPreviewModal({ isOpen: false, file: null, slides: [], loading: false, index: 0 });
  };

  const nextSlide = () => {
    setPreviewModal(prev => ({
      ...prev,
      index: Math.min(prev.index + 1, Math.max(0, prev.slides.length - 1))
    }));
  };

  const prevSlide = () => {
    setPreviewModal(prev => ({ ...prev, index: Math.max(prev.index - 1, 0) }));
  };

  const handleDownload = async (file, e) => {
    e.stopPropagation();
    try {
      const response = await fetch('http://localhost:5000/api/download-ppt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: file.fullPath })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download file');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Download error:', err);
      alert(err.message || 'Failed to download file');
    }
  };

  const handleCustomizeOption = (file, e) => {
    e.stopPropagation();
    onOpenSlideMaker && onOpenSlideMaker(file.fullPath);
  };

  // Selection handlers
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const allFileIds = new Set(filtered.map(file => file.fullPath));
      setSelectedFiles(allFileIds);
    } else {
      setSelectedFiles(new Set());
    }
  };

  const handleSelectFile = (file, e) => {
    e.stopPropagation();
    const newSelected = new Set(selectedFiles);
    if (newSelected.has(file.fullPath)) {
      newSelected.delete(file.fullPath);
    } else {
      newSelected.add(file.fullPath);
    }
    setSelectedFiles(newSelected);
  };

  const handleBulkDownload = async () => {
    if (selectedFiles.size === 0) return;
    
    setIsDownloading(true);
    const filesToDownload = files.filter(file => selectedFiles.has(file.fullPath));
    
    for (const file of filesToDownload) {
      try {
        const response = await fetch('http://localhost:5000/api/download-ppt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: file.fullPath })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to download file');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Small delay between downloads to avoid browser blocking
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (err) {
        console.error(`Download error for ${file.name}:`, err);
        alert(`Failed to download ${file.name}: ${err.message}`);
      }
    }
    
    setIsDownloading(false);
    setSelectedFiles(new Set()); // Clear selection after download
  };

  const isServiceTypeDisabled = !filters.subSolution || filterLoading.serviceType;
  const isSessionDescriptionDisabled = !filters.serviceType || !filters.subSolution || filterLoading.sessionDescription;
  const isGoDisabled = !filters.subSolution || !filters.serviceType || !filters.sessionDescription || filterLoading.applying;



  if (filterLoading.initial) {
    return (
      <div className="file-browser">
        <div className="fb-loading">
          <div className="loading-spinner"></div>
          <p>Loading filter options...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-browser">
      {/* Filter Section */}
      <div className="fb-filters-section">
        <div className="fb-filter-row">
          <div className="filter-field">
            <label htmlFor="subSolution">Sub Solution</label>
            <select
              id="subSolution"
              value={filters.subSolution}
              onChange={(e) => handleFilterChange('subSolution', e.target.value)}
              disabled={filterLoading.initial}
            >
              <option value="">Select Sub Solution</option>
              {filterOptions.subSolution.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="serviceType">Service Type</label>
            <select
              id="serviceType"
              value={filters.serviceType}
              onChange={(e) => handleFilterChange('serviceType', e.target.value)}
              disabled={isServiceTypeDisabled}
            >
              <option value="">
                {isServiceTypeDisabled && !filterLoading.serviceType
                  ? 'Select Sub Solution first'
                  : filterLoading.serviceType
                  ? 'Loading...'
                  : 'Select Service Type'}
              </option>
              {filterOptions.serviceType.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-field">
            <label htmlFor="sessionDescription">Session Description</label>
            <select
              id="sessionDescription"
              value={filters.sessionDescription}
              onChange={(e) => handleFilterChange('sessionDescription', e.target.value)}
              disabled={isSessionDescriptionDisabled}
            >
              <option value="">
                {isSessionDescriptionDisabled && !filterLoading.sessionDescription
                  ? 'Select Service Type first'
                  : filterLoading.sessionDescription
                  ? 'Loading...'
                  : 'Select Session Description'}
              </option>
              {filterOptions.sessionDescription.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-actions">
            <button
              className="btn-reset-main"
              onClick={() => {
                setFilters({ subSolution: '', serviceType: '', sessionDescription: '' });
                setFiles([]);
                setFiltersApplied(false);
              }}
              disabled={!filters.subSolution && !filters.serviceType && !filters.sessionDescription}
            >
              Reset
            </button>
            <button
              className="btn-go"
              onClick={handleApplyFilters}
              disabled={isGoDisabled}
            >
              {filterLoading.applying ? 'Loading...' : 'Go'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="fb-error-banner" role="alert">
          {error}
        </div>
      )}

      {/* No Presentations Found */}
      {filtersApplied && !loading && !filterLoading.applying && files.length === 0 && !error && (
        <div className="fb-no-presentations">
          <div className="no-presentations-icon">🔍</div>
          <h3>No presentations found</h3>
          <p>Try adjusting your filter criteria</p>
        </div>
      )}

      {/* Presentations Section */}
      {files.length > 0 && (
        <div className="fb-presentations-section">
          <div className="fb-section-header">
            <h2 className="section-title">Presentations</h2>
            
            {/* Action Toolbar */}
            {selectedFiles.size > 0 && (
              <div className="action-toolbar">
                <button 
                  className="btn-action btn-download-bulk"
                  onClick={handleBulkDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? `Downloading ${selectedFiles.size} file${selectedFiles.size !== 1 ? 's' : ''}...` : `Download (${selectedFiles.size})`}
                </button>
                <button 
                  className="btn-action btn-mass-update"
                  onClick={() => {
                    const selectedFilesList = files.filter(file => selectedFiles.has(file.fullPath));
                    onOpenMassUpdate && onOpenMassUpdate(selectedFilesList);
                  }}
                >
                  Mass Update ({selectedFiles.size})
                </button>
              </div>
            )}
          </div>
          <div className="fb-results-info">
            Found {filtered.length} presentation{filtered.length !== 1 ? 's' : ''}
          </div>

          {/* Table */}
          {loading ? (
            <div className="fb-loading-state">Scanning...</div>
          ) : filtered.length === 0 ? (
            <div className="fb-no-results">
              <div className="no-results-icon">📢</div>
              <h3>No results found</h3>
              <p>Try changing your filter criteria.</p>
            </div>
          ) : (
            <div className="fb-table-container">
              <table className="fb-table">
                <thead>
                  <tr>
                    <th className="checkbox-column">
                      <input 
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={filtered.length > 0 && selectedFiles.size === filtered.length}
                        aria-label="Select all presentations"
                      />
                    </th>
                    <th>Name</th>
                    <th>Ext</th>
                    <th>Size</th>
                    <th>Last Modified</th>
                    <th>Slides</th>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((file, index) => (
                    <tr key={file.fullPath} onClick={() => handleRowClick(file)}>
                      <td className="checkbox-cell" onClick={(e) => e.stopPropagation()}>
                        <input 
                          type="checkbox"
                          checked={selectedFiles.has(file.fullPath)}
                          onChange={(e) => handleSelectFile(file, e)}
                          aria-label={`Select ${file.name}`}
                        />
                      </td>
                      <td className="name-cell" title={file.name}>{file.name}</td>
                      <td>{file.extension}</td>
                      <td>{formatBytes(file.sizeBytes)}</td>
                      <td>{new Date(file.modifiedTime).toLocaleDateString()}</td>
                      <td>{file.slides ?? '-'}</td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="btn-customize"
                            onClick={(e) => handleCustomizeOption(file, e)}
                            title="Edit with Slide Maker"
                          >
                            Edit Slide
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Preview Modal */}
      {previewModal.isOpen && (
        <div className="preview-modal-backdrop" onClick={closePreviewModal}>
          <div className="preview-modal" onClick={(e) => e.stopPropagation()}>
            <div className="preview-modal-header">
              <h3>Slide Preview</h3>
              <button className="btn-close" onClick={closePreviewModal} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="preview-modal-body">
              {previewModal.loading && <div className="preview-loading">Loading preview...</div>}
              {!previewModal.loading && previewModal.slides.length > 0 && (
                <>
                  <div className="preview-toolbar">
                    <button onClick={prevSlide} disabled={previewModal.index === 0}>←</button>
                    <span>Slide {previewModal.index + 1} / {previewModal.totalSlides || previewModal.slides.length}</span>
                    <button onClick={nextSlide} disabled={previewModal.index >= previewModal.slides.length - 1}>→</button>
                  </div>
                  <div className="preview-content">
                    <h4>{previewModal.slides[previewModal.index].title || '(no title)'}</h4>
                    <div className="preview-texts">
                      {previewModal.slides[previewModal.index].texts.map((t, i) => (
                        <p key={i}>{t}</p>
                      ))}
                    </div>
                  </div>
                </>
              )}
              {!previewModal.loading && previewModal.slides.length === 0 && (
                <div className="preview-empty">No slides to preview</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FileBrowser;
