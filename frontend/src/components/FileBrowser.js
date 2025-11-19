import React, { useMemo, useState } from 'react';
import './FileBrowser.css';

// Helper to format bytes
function formatBytes(bytes) {
  if (bytes === 0 || bytes == null) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

const EMPTY_PREVIEW = { loading: false, slides: [], total: 0, index: 0 };
const FLOW_STEPS = [
  {
    label: 'Choose folder',
    description: 'Point to the SharePoint sync location that contains your decks.'
  },
  {
    label: 'Filter decks',
    description: 'Narrow down by name, extension, size, or quick search.'
  },
  {
    label: 'Customize',
    description: 'Open a deck in Slide Maker to add slides.'
  }
];

const FileBrowser = ({ onOpen }) => {
  const [folder, setFolder] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [files, setFiles] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ name: 'ALL', ext: 'ALL', sizeBucket: 'ANY' });
  const [preview, setPreview] = useState(EMPTY_PREVIEW);
  const [searchTerm, setSearchTerm] = useState('');

  const uniqueExts = useMemo(() => {
    const set = new Set(files.map(f => f.extension.toLowerCase()));
    return Array.from(set).sort();
  }, [files]);

  const uniqueNames = useMemo(() => {
    // Limit to first 200 for practicality
    return files.slice(0, 200).map(f => f.name);
  }, [files]);

  const filtered = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return files.filter(f => {
      if (search && !f.name.toLowerCase().includes(search)) return false;
      if (filters.name !== 'ALL' && f.name !== filters.name) return false;
      if (filters.ext !== 'ALL' && f.extension.toLowerCase() !== filters.ext.toLowerCase()) return false;
      if (filters.sizeBucket && filters.sizeBucket !== 'ANY') {
        const sz = f.sizeBytes || 0;
        switch (filters.sizeBucket) {
          case '<1MB': if (!(sz < 1024*1024)) return false; break;
          case '1-5MB': if (!(sz >= 1024*1024 && sz < 5*1024*1024)) return false; break;
          case '5-20MB': if (!(sz >= 5*1024*1024 && sz < 20*1024*1024)) return false; break;
          case '>20MB': if (!(sz >= 20*1024*1024)) return false; break;
          default: break;
        }
      }
      return true;
    });
  }, [files, filters, searchTerm]);

  const activeStepIndex = selected ? 2 : files.length > 0 ? 1 : 0;

  const resetFilters = () => {
    setFilters({ name: 'ALL', ext: 'ALL', sizeBucket: 'ANY' });
    setSearchTerm('');
  };

  const clearSelection = () => {
    setSelected(null);
    setPreview(EMPTY_PREVIEW);
  };

  const scanFolder = async () => {
    setError('');
    setLoading(true);
    setFiles([]);
    setSelected(null);
    setPreview(EMPTY_PREVIEW);
    try {
      const resp = await fetch('http://localhost:5000/api/list-ppts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: folder, includeDetails: true })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to list files');
  setFiles(data.files || []);
  resetFilters();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadPreview = async (file) => {
    setPreview({ loading: true, slides: [], total: 0, index: 0 });
    try {
      const resp = await fetch('http://localhost:5000/api/preview-texts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templatePath: file.fullPath, maxSlides: 50 })
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Failed to load preview');
      setPreview({ loading: false, slides: data.slides || [], total: data.totalSlides || 0, index: 0 });
    } catch (e) {
      setPreview({ loading: false, slides: [], total: 0, index: 0 });
    }
  };

  const onSelect = (file) => {
    setSelected(file);
    loadPreview(file);
  };

  const nextSlide = () => setPreview(p => ({ ...p, index: Math.min(p.index + 1, Math.max(0, p.slides.length - 1)) }));
  const prevSlide = () => setPreview(p => ({ ...p, index: Math.max(p.index - 1, 0) }));

  const handleFolderKeyDown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (folder.trim() && !loading) {
        scanFolder();
      }
    }
  };

  return (
    <div className="file-browser">
      <section className="fb-guide">
        <div className="guide-intro">
          <h2>SharePoint decks at your fingertips</h2>
          <p>Follow the guided steps below to locate a deck from SharePoint and open it in Slide Maker for customization.</p>
        </div>
        <div className="fb-stepper">
          {FLOW_STEPS.map((step, idx) => {
            const status = idx < activeStepIndex ? 'done' : idx === activeStepIndex ? 'active' : 'upcoming';
            return (
              <div className={`step ${status}`} key={step.label}>
                <span className="step-index">{idx + 1}</span>
                <div>
                  <div className="step-label">{step.label}</div>
                  <div className="step-desc">{step.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
      <div className="file-browser-content">
      <div className="fb-left">
        <div className="fb-path">
          <label>Folder path</label>
          <div className="fb-path-row">
            <input
              value={folder}
              onChange={e => setFolder(e.target.value)}
              onKeyDown={handleFolderKeyDown}
              placeholder="Enter the folder path"
            />
            <button onClick={scanFolder} disabled={!folder || loading}>Scan</button>
          </div>
          {error && <div className="fb-error">{error}</div>}
        </div>

        {/* Filter bar */}
        <div className="fb-filter-bar">
          <div className="filter-grid">
            <div className="filter-group search">
              <label>Quick search</label>
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Type part of a deck name"
              />
            </div>
            <div className="filter-group name">
              <label>Name</label>
              <select value={filters.name} onChange={e => setFilters({ ...filters, name: e.target.value })}>
                <option value="ALL">All</option>
                {uniqueNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="filter-group ext">
              <label>Extension</label>
              <select value={filters.ext} onChange={e => setFilters({ ...filters, ext: e.target.value })}>
                <option value="ALL">All</option>
                {uniqueExts.map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
            </div>
            <div className="filter-group size">
              <label>Size Bucket</label>
              <select value={filters.sizeBucket} onChange={e => setFilters({ ...filters, sizeBucket: e.target.value })}>
                <option value="ANY">Any</option>
                <option value="<1MB">&lt; 1 MB</option>
                <option value="1-5MB">1 - 5 MB</option>
                <option value="5-20MB">5 - 20 MB</option>
                <option value=">20MB">&gt; 20 MB</option>
              </select>
            </div>
          </div>
          <div className="filter-actions">
            <button type="button" onClick={resetFilters}>Reset Filters</button>
          </div>
        </div>

        <div className="fb-table">
          <div className="fb-table-meta">
            <div className="meta-summary">
              {filtered.length > 0 ? `${filtered.length} deck${filtered.length !== 1 ? 's' : ''} ready to customize` : 'No decks match the current filters'}
            </div>
            {selected && (
              <button className="meta-clear" type="button" onClick={clearSelection}>Clear selection</button>
            )}
          </div>
          <div className="fb-hscroll">
            <div className="fb-body">
              <table className="fb-grid">
                <colgroup>
                  <col className="col-name" />
                  <col className="col-ext" />
                  <col className="col-size" />
                  <col className="col-modified" />
                  <col className="col-slides" />
                  <col className="col-action" />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col" className="th-name">Name</th>
                    <th scope="col" className="th-ext">Ext</th>
                    <th scope="col" className="th-size">Size</th>
                    <th scope="col" className="th-modified">Last Modified</th>
                    <th scope="col" className="th-slides">Slides</th>
                    <th scope="col" className="th-action">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && (
                    <tr className="state-row">
                      <td colSpan="6">Scanning...</td>
                    </tr>
                  )}
                  {!loading && filtered.length === 0 && (
                    <tr className="state-row">
                      <td colSpan="6">No files</td>
                    </tr>
                  )}
                  {!loading && filtered.map(f => (
                    <tr
                      key={f.fullPath}
                      className={selected && selected.fullPath === f.fullPath ? 'selected' : ''}
                      onClick={() => onSelect(f)}
                    >
                      <td className="cell name" title={f.name}><span className="file-name-text">{f.name}</span></td>
                      <td className="cell ext">{f.extension}</td>
                      <td className="cell size">{formatBytes(f.sizeBytes)}</td>
                      <td className="cell mtime" title={f.modifiedTime}>{new Date(f.modifiedTime).toLocaleString()}</td>
                      <td className="cell slides">{f.slides ?? '-'}</td>
                      <td className="cell action">
                        <button
                          className="btn-customize"
                          onClick={(e) => { e.stopPropagation(); onOpen && onOpen(f.fullPath); }}
                        >
                          Customize
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
  </div>

  <div className="fb-right">
        <div className="preview-panel">
          <div className="preview-header">
            <div className="title">Slide Preview</div>
            {selected && (
              <div className="actions">
                <button className="btn-customize" onClick={() => onOpen && onOpen(selected.fullPath)}>Customize this deck</button>
              </div>
            )}
          </div>
          <div className="preview-body">
            {!selected && <div className="placeholder">Select a file to preview</div>}
            {selected && preview.loading && <div className="placeholder">Loading preview…</div>}
            {selected && !preview.loading && preview.slides.length > 0 && (
              <div className="slide-plain">
                <div className="slide-toolbar">
                  <button onClick={prevSlide} disabled={preview.index === 0}>{'<'}</button>
                  <span>Slide {preview.index + 1} / {preview.total || preview.slides.length}</span>
                  <button onClick={nextSlide} disabled={preview.index >= preview.slides.length - 1}>{'>'}</button>
                </div>
                <div className="slide-content">
                  <div className="slide-title">{preview.slides[preview.index].title || '(no title)'}</div>
                  <div className="slide-texts">
                    {preview.slides[preview.index].texts.map((t, i) => (
                      <pre key={i}>{t}</pre>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default FileBrowser;
