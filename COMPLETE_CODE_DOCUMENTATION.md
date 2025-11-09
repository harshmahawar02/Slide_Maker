# SlideMaker Application - Complete Code Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Backend Documentation](#backend-documentation)
4. [Frontend Documentation](#frontend-documentation)
5. [Workflow Explanation](#workflow-explanation)
6. [API Endpoints](#api-endpoints)

---

## Project Overview

**SlideMaker** is a web application that allows users to:
- Upload PowerPoint (.pptx) templates
- Select predefined slide layouts
- Add custom slides with content and images
- Download the modified presentation

**Technology Stack:**
- **Backend**: Python Flask (REST API)
- **Frontend**: React.js
- **Design**: SAP Fiori Design System
- **Libraries**: python-pptx, React hooks

---

## Architecture

```
slideMaker/
├── backend/                    # Flask REST API
│   ├── app.py                 # Main Flask application
│   ├── requirements.txt       # Python dependencies
│   └── test_layouts.py        # Layout debugging utility
├── frontend/                   # React application
│   ├── public/                # Static assets
│   ├── src/
│   │   ├── App.js            # Main React component
│   │   ├── App.css           # Global styles (SAP theme)
│   │   ├── index.js          # React entry point
│   │   └── components/       # React components
│   │       ├── FileUpload.js
│   │       ├── LayoutSelector.js
│   │       ├── SlideForm.js
│   │       ├── SlidePreview.js
│   │       └── SlideCreator.js
│   └── package.json          # Node dependencies
└── docs/                      # Documentation files
```

---

## Backend Documentation

### File: `backend/app.py`

**Purpose**: Flask REST API server that handles PowerPoint manipulation using python-pptx library.

#### Key Components:

##### 1. **Imports and Configuration**
```python
from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import PP_PLACEHOLDER
from pptx.enum.text import PP_ALIGN
from pptx.dml.color import RGBColor
```
- **Flask**: Web framework for creating REST API
- **CORS**: Enables cross-origin requests from React frontend
- **python-pptx**: Library for reading and writing PowerPoint files
- **PP_PLACEHOLDER**: Enumeration for placeholder types (TITLE, BODY, PICTURE, etc.)
- **RGBColor**: For setting colors in PowerPoint

**Configuration Constants:**
```python
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB limit for .pptx files
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB limit for images
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}
```

##### 2. **PREDEFINED_LAYOUTS Dictionary**
This defines 4 layout types that the app supports:

```python
PREDEFINED_LAYOUTS = {
    'title_content': {
        'name': 'Title and Content',
        'keywords': ['title', 'content', 'body', 'text', 'only'],
        'has_image': False,
        'content_boxes': 1
    },
    'title_two_content': {
        'name': 'Title and Two Content',
        'keywords': ['two', 'comparison', 'columns', 'divided'],
        'has_image': False,
        'content_boxes': 2
    },
    'title_image_content': {
        'name': 'Title Image and Content',
        'keywords': ['picture', 'image', 'content', 'caption', 'photo', 'text'],
        'has_image': True,
        'content_boxes': 1
    },
    'title_image': {
        'name': 'Title and Image',
        'keywords': ['picture', 'image', 'photo', 'blank'],
        'has_image': True,
        'content_boxes': 0,
        'prefer_simple': True
    }
}
```

**Explanation:**
- Each layout type has keywords used for matching against template layouts
- `has_image`: Whether this layout requires an image
- `content_boxes`: How many text content areas needed (0, 1, or 2)
- `prefer_simple`: Prefer layouts with fewer placeholders

##### 3. **Helper Functions**

**`validate_file_size(file_storage, max_size, file_type)`**
- Validates uploaded file size
- Returns size in bytes
- Raises ValueError if file exceeds max_size

**`validate_image_format(filename)`**
- Checks if image file extension is allowed
- Returns True/False

**`find_layout_by_type(slide_master, layout_type)`**
- **Most Complex Function** - Finds the best matching layout from the template
- **3-Stage Matching Process:**
  1. **Exact Name Match**: Looks for exact layout name match (case-insensitive)
  2. **Keyword Match**: Scores layouts based on keyword matches, excludes branded layouts
  3. **Structure Match**: Analyzes placeholders (title, body, picture) and scores based on structure
- **Exclude Patterns**: Avoids layouts with: 'mango', 'cover', 'branded', 'anvil', 'thank', 'section', 'divider'
- **Scoring System**: Prefers simpler layouts (fewer placeholders) for cleaner results
- Returns the best matching layout or None

##### 4. **API Endpoints**

**`/api/health` [GET]**
- Simple health check endpoint
- Returns: `{"status": "ok"}`
- Used by frontend to verify backend is running

**`/api/get-slide-count` [POST]**
- Accepts: `.pptx` file upload
- Counts total slides in the presentation
- Returns: `{"total_slides": <number>}`
- Used when user uploads template to show slide count

**`/api/debug-layouts` [POST]**
- Debug endpoint to inspect available layouts in a template
- Accepts: `.pptx` file upload
- Returns: JSON with all layouts and their placeholders
- Useful for troubleshooting layout selection issues

**`/api/add-slide` [POST]** - **Main Endpoint**
- **Accepts:**
  - `file`: PowerPoint template (.pptx)
  - `layout`: Layout type ('title_content', 'title_two_content', etc.)
  - `title`: Slide title text
  - `text`: Main content text
  - `text2`: Second content text (for two-column layouts)
  - `image`: Image file (optional)
  - `position`: Slide position (0 = beginning, blank = end)

- **Process Flow:**
  1. Validates all inputs (file type, size, required fields)
  2. Loads the PowerPoint presentation
  3. Finds best matching layout using `find_layout_by_type()`
  4. Creates new slide with selected layout
  5. **Sets white background** to remove template colors
  6. Positions slide at requested location
  7. Sets title in title placeholder
  8. Adds content to body placeholders (1 or 2)
  9. Inserts image into picture placeholder
  10. Saves modified presentation
  11. Returns file for download

- **Returns:** Modified .pptx file with filename: `<original>_updated.pptx`

##### 5. **Slide Creation Logic**

**Title Setting:**
```python
if new_slide.shapes.title:
    new_slide.shapes.title.text = title
```
- Uses the built-in title placeholder
- Simple and reliable

**Content Setting (Single):**
- First tries to find `PP_PLACEHOLDER.BODY` or `PP_PLACEHOLDER.OBJECT`
- Clears existing text and adds new content
- Sets left alignment
- Fallback: Creates textbox if no placeholder found

**Content Setting (Two Columns):**
- Looks for two content placeholders
- Fills them in order
- Fallback: Creates two side-by-side textboxes

**Image Setting:**
- Finds `PP_PLACEHOLDER.PICTURE` placeholder
- **Important**: Deletes placeholder and adds image in its position
  - This is because placeholders don't have an `insert_picture()` method
  - Must get placeholder's position (left, top, width, height)
  - Remove placeholder from XML
  - Add image as regular shape at that position
- Fallback: Adds image on right side of slide if no placeholder

**Background Setting:**
```python
background = new_slide.background
fill = background.fill
fill.solid()
fill.fore_color.rgb = RGBColor(255, 255, 255)  # White
```
- Overrides template background with solid white
- Prevents colorful branded backgrounds

##### 6. **Error Handling**
- ValueError: User input validation errors (400)
- Generic exceptions: Logged with traceback (500)
- Image errors: Non-fatal, slide still created without image

---

### File: `backend/requirements.txt`

**Purpose**: Lists Python package dependencies

```
Flask==3.0.0          # Web framework
flask-cors==4.0.0     # CORS support
python-pptx==0.6.23   # PowerPoint manipulation
```

**Installation**: `pip install -r requirements.txt`

---

### File: `backend/test_layouts.py`

**Purpose**: Debugging utility to inspect PowerPoint template layouts

**Usage:**
```bash
python test_layouts.py path/to/template.pptx
```

**Output:**
- Lists all layouts in the template with their placeholders
- Shows recommendations for each layout type
- Identifies which layouts would be excluded
- Helpful for troubleshooting layout selection issues

---

## Frontend Documentation

### File: `frontend/src/index.js`

**Purpose**: React application entry point

```javascript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

**Explanation:**
- Creates root React element
- Mounts `<App />` component
- `StrictMode`: Enables additional development checks

---

### File: `frontend/src/App.js`

**Purpose**: Main application component - provides header, footer, and layout structure

```javascript
import React from 'react';
import './App.css';
import SlideCreator from './components/SlideCreator';
import sapLogo from './SAP-Logo.png';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div className="header-content">
          <div className="sap-logo">
            <img src={sapLogo} alt="SAP" />
          </div>
          <div className="header-title">
            <h1>Slide Maker</h1>
            <span className="header-subtitle">Create PowerPoint Slides Effortlessly</span>
          </div>
        </div>
      </header>
      <main className="App-main">
        <SlideCreator />
      </main>
      <footer className="App-footer">
        <div className="footer-content">
          <span className="footer-text">INTERNAL - SAP and Partners Only</span>
          <span className="footer-icon">#</span>
        </div>
      </footer>
    </div>
  );
}
```

**Structure:**
- **Header**: SAP logo (left), "Slide Maker" title (right)
- **Main**: Contains `<SlideCreator />` component
- **Footer**: "INTERNAL - SAP and Partners Only" message

---

### File: `frontend/src/App.css`

**Purpose**: Global styles with SAP Fiori Design System

**Key Styles:**

**Color Palette:**
```css
Primary Blue: #0A6ED1 (lighter, professional)
Secondary Gold: #F0AB00
Success Green: #107E3E
Dark Background: #2C2C2C
Text: #32363A
```

**Header:**
```css
.App-header {
  background: linear-gradient(180deg, #0A6ED1 0%, #0854A0 100%);
  /* Blue gradient from light to darker blue */
}
```
- Sticky positioning (stays at top when scrolling)
- Flexbox layout with space-between (logo left, title right)

**Footer:**
```css
.App-footer {
  background: #2C2C2C;  /* Dark gray */
  border-top: 3px solid #F0AB00;  /* Gold accent line */
}
```

**Layout:**
- Max-width: 1600px (centered)
- Responsive breakpoints at 1400px, 768px

---

### File: `frontend/src/components/SlideCreator.js`

**Purpose**: Main orchestrator component - manages state and coordinates all sub-components

**State Variables:**
```javascript
const [layout, setLayout] = useState('');              // Selected layout type
const [currentFile, setCurrentFile] = useState(null);  // Uploaded .pptx file
const [downloadFilename, setDownloadFilename] = useState('');
const [slideCount, setSlideCount] = useState(0);       // # of slides added
const [totalSlides, setTotalSlides] = useState(0);     // # in original template
const [showDownload, setShowDownload] = useState(false);
const [backendStatus, setBackendStatus] = useState('checking');
const [previewData, setPreviewData] = useState({
    title: '', content: '', content2: '', imagePreview: null
});
```

**Key Functions:**

**`handleFileUploaded(file)`**
- Called when user selects a .pptx file
- Sets `currentFile` state
- Sends file to `/api/get-slide-count` endpoint
- Updates `totalSlides` state
- **Critical**: Must set currentFile immediately for UI to update

**`handleSlideAdded(updatedFile, filename)`**
- Called after successfully adding a slide
- Updates currentFile with new version
- Increments slideCount
- Shows download button

**`handleContentChange(data)`**
- Receives live updates from SlideForm
- Updates previewData for live preview
- Data includes: title, content, content2, imagePreview

**`handleDownload()`**
- Creates download link from currentFile
- Downloads file with proper filename
- Uses `window.URL.createObjectURL()` for browser download
- Cleans up object URL after download

**`handleReset()`**
- Confirms with user if slides have been added
- Clears all state
- Revokes all object URLs
- Resets to initial state

**Component Structure:**
```javascript
<div className="slide-creator-new">
  {/* Status alerts */}
  
  <div className="creator-layout">  {/* Two-column grid */}
    <div className="creator-left">
      <FileUpload />          {/* Step 1 */}
      <LayoutSelector />      {/* Step 2 */}
      <SlideForm />          {/* Steps 3-4 */}
    </div>
    
    <div className="creator-right">
      {slideCount > 0 && <SessionStatus />}
      <SlidePreview />       {/* Live preview */}
      {showDownload && <DownloadButtons />}
    </div>
  </div>
</div>
```

**Backend Health Check:**
- Checks `/api/health` on mount
- Re-checks every 30 seconds
- Shows warning if backend offline

---

### File: `frontend/src/components/FileUpload.js`

**Purpose**: Step 1 - File upload component

**Props:**
- `onFileUploaded`: Callback when file selected
- `currentFile`: Currently uploaded file
- `totalSlides`: Slide count to display

**Implementation:**
```javascript
const FileUpload = ({ onFileUploaded, currentFile, totalSlides }) => {
    const fileInputRef = useRef(null);  // Reference to hidden input

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && onFileUploaded) {
            onFileUploaded(selectedFile);  // Pass to parent
        }
    };

    const handleClick = () => {
        if (currentFile === null && fileInputRef.current) {
            fileInputRef.current.click();  // Trigger hidden input
        }
    };
```

**UI States:**
1. **No file**: Shows "📄 Click to select .pptx file"
2. **File uploaded**: Shows "✓ filename (X slides found)" with green background

**Why Hidden Input:**
- Native file inputs are hard to style
- Uses `<input type="file" style={{display: 'none'}} />`
- Custom styled div triggers the input click
- Provides better UX with custom design

---

### File: `frontend/src/components/LayoutSelector.js`

**Purpose**: Step 2 - Dropdown for selecting slide layout type

**Props:**
- `onLayoutChange`: Callback when selection changes
- `currentLayout`: Currently selected layout

**Implementation:**
```javascript
const layouts = [
    { id: '', name: 'Select a layout...' },  // Default option
    { id: 'title_content', name: 'Title and Content' },
    { id: 'title_two_content', name: 'Title and Two Content' },
    { id: 'title_image_content', name: 'Title Image and Content' },
    { id: 'title_image', name: 'Title and Image' }
];

return (
    <select value={currentLayout} onChange={(e) => onLayoutChange(e.target.value)}>
        {layouts.map(layout => (
            <option key={layout.id} value={layout.id}>
                {layout.name}
            </option>
        ))}
    </select>
);
```

**Styling:**
- Custom dropdown arrow using SVG background image
- SAP blue accent color (#0A6ED1)
- Focus states for accessibility

---

### File: `frontend/src/components/SlideForm.js`

**Purpose**: Steps 3-4 - Main form for slide content input

**State Variables:**
```javascript
const [title, setTitle] = useState('');
const [text, setText] = useState('');
const [text2, setText2] = useState('');
const [image, setImage] = useState(null);
const [imagePreview, setImagePreview] = useState(null);
const [file, setFile] = useState(initialFile);  // Synced with parent
const [position, setPosition] = useState('');
const [loading, setLoading] = useState(false);
const [error, setError] = useState('');
const [success, setSuccess] = useState('');
```

**Key Functions:**

**`getLayoutRequirements()`**
- Returns object with boolean flags:
```javascript
{
    needsContent: true/false,   // Show content textarea
    needsContent2: true/false,  // Show second textarea
    needsImage: true/false      // Show image upload
}
```
- Based on selected layout type
- Controls which form fields are displayed

**`handleImageChange(e)`**
```javascript
const selectedImage = e.target.files[0];
setImage(selectedImage);

// Create preview URL for live preview
const previewUrl = URL.createObjectURL(selectedImage);
setImagePreview(previewUrl);

// Pass to parent for preview
onContentChange({ ...currentData, imagePreview: previewUrl });
```

**`handleSubmit(e)`** - **Main Form Submission**
1. Prevents default form behavior
2. Validates all required fields based on layout
3. Creates FormData object:
```javascript
formData.append('file', file);
formData.append('layout', layout);
formData.append('title', title);
formData.append('text', text);
formData.append('text2', text2);
formData.append('image', image);
formData.append('position', position);
```
4. Sends POST to `/api/add-slide`
5. Receives updated .pptx file
6. Calls `onSlideAdded(blob, filename)`
7. Resets form fields (keeps file)
8. Shows success message

**Conditional Rendering:**
- Position field: Only shown if file uploaded
- Content fields: Shown based on `getLayoutRequirements()`
- Image field: Only for image-based layouts
- Submit button: Disabled if no file or layout selected

**Error Handling:**
- Network errors: "Cannot connect to server..."
- Validation errors: Shown at top of form
- Success messages: Green alert with success icon

---

### File: `frontend/src/components/SlidePreview.js`

**Purpose**: Live preview of slide content as user types

**Props:**
- `layout`: Selected layout type
- `title`: Slide title
- `content`: Main content text
- `content2`: Second content text
- `imagePreview`: Image preview URL

**Implementation:**
```javascript
const renderPreview = () => {
    switch (layout) {
        case 'title_content':
            return (
                <div className="preview-slide">
                    <div className="preview-title">{title || 'Your title here...'}</div>
                    <div className="preview-content">{content || 'Your content here...'}</div>
                </div>
            );
        
        case 'title_two_content':
            return (
                <div className="preview-slide">
                    <div className="preview-title">{title || 'Your title here...'}</div>
                    <div className="preview-two-content">
                        <div className="preview-content-box">{content || 'First content...'}</div>
                        <div className="preview-content-box">{content2 || 'Second content...'}</div>
                    </div>
                </div>
            );
        
        case 'title_image_content':
            return (
                <div className="preview-slide">
                    <div className="preview-title">{title || 'Your title here...'}</div>
                    <div className="preview-image-content">
                        <div className="preview-image-box">
                            {imagePreview ? 
                                <img src={imagePreview} alt="Preview" /> : 
                                <div className="preview-image-placeholder">📷 Image</div>
                            }
                        </div>
                        <div className="preview-content">{content || 'Your content...'}</div>
                    </div>
                </div>
            );
        
        case 'title_image':
            return (
                <div className="preview-slide">
                    <div className="preview-title">{title || 'Your title here...'}</div>
                    <div className="preview-image-only">
                        {imagePreview ? 
                            <img src={imagePreview} alt="Preview" /> : 
                            <div className="preview-image-placeholder">📷 Image</div>
                        }
                    </div>
                </div>
            );
        
        default:
            return <div className="preview-placeholder">Select a layout to see preview</div>;
    }
};
```

**Styling:**
- 16:9 aspect ratio (matches PowerPoint)
- White background with border
- Title with blue color (#0A6ED1) and gold underline (#F0AB00)
- Image: `object-fit: contain` (no stretching/cropping)
- Live updates via `useEffect` monitoring props

---

## Workflow Explanation

### User Journey:

1. **Page Load**
   - React app loads, renders App component
   - SlideCreator checks backend health
   - Shows "Checking backend connection..." alert

2. **Upload Template (Step 1)**
   - User clicks FileUpload area
   - Browser file picker opens (.pptx only)
   - File selected → `handleFileChange()` → `onFileUploaded()`
   - SlideCreator sends file to `/api/get-slide-count`
   - Backend returns slide count
   - UI shows "✓ filename (5 slides found)" with green background

3. **Select Layout (Step 2)**
   - User opens LayoutSelector dropdown
   - Selects layout type (e.g., "Title and Image")
   - `onLayoutChange()` updates SlideCreator state
   - SlideForm re-renders with appropriate fields
   - SlidePreview shows default preview for that layout

4. **Enter Position (Step 3)**
   - User enters slide position number (0 = start)
   - Or leaves blank to add at end
   - Placeholder shows: "Leave blank to add at end (5)"

5. **Enter Content (Step 4)**
   - User types title → Live preview updates title
   - User types content → Live preview updates content
   - If image layout:
     - User selects image → Preview shows image
     - `URL.createObjectURL()` creates preview URL
   - All changes flow through `onContentChange()` → SlideCreator → SlidePreview

6. **Add Slide**
   - User clicks "Add Slide" button
   - SlideForm validates all required fields
   - Creates FormData with all inputs
   - Sends POST to `/api/add-slide`
   - **Backend Process:**
     - Validates inputs
     - Loads PowerPoint
     - Finds best layout match
     - Creates slide
     - Sets white background
     - Adds title, content, image
     - Saves modified .pptx
     - Returns file
   - **Frontend Process:**
     - Receives file blob
     - Calls `onSlideAdded(blob, filename)`
     - Updates currentFile
     - Increments slideCount
     - Shows success message
     - Clears form fields
     - Shows download button

7. **Session Status Updates**
   - "Slides Added: 1" appears
   - "Total Slides: 6" (5 original + 1 added)
   - Download button becomes available

8. **Add More Slides (Optional)**
   - User can select different layout
   - Enter new content
   - Add another slide
   - Counter updates: "Slides Added: 2", "Total Slides: 7"

9. **Download**
   - User clicks "Download Presentation"
   - `handleDownload()` creates download link
   - Browser downloads `template_updated.pptx`
   - File contains original slides + all added slides

10. **Reset (Optional)**
    - User clicks "Start New"
    - Confirmation dialog if slides added
    - Clears all state
    - Returns to initial state

---

## API Endpoints

### GET `/api/health`
**Purpose**: Health check  
**Request**: None  
**Response**: `{"status": "ok"}`  
**Usage**: Frontend checks if backend is running

### POST `/api/get-slide-count`
**Purpose**: Count slides in uploaded template  
**Request**:
- Content-Type: multipart/form-data
- Body: `file` (PowerPoint file)

**Response**:
```json
{
  "total_slides": 5
}
```
**Usage**: Called when user uploads template

### POST `/api/debug-layouts`
**Purpose**: Debug/inspect template layouts  
**Request**:
- Content-Type: multipart/form-data
- Body: `file` (PowerPoint file)

**Response**:
```json
{
  "total_layouts": 11,
  "layouts": [
    {
      "index": 0,
      "name": "Title Slide",
      "placeholders": [
        {"type": "TITLE", "name": "Title 1"},
        {"type": "SUBTITLE", "name": "Subtitle 2"}
      ]
    },
    ...
  ]
}
```
**Usage**: Troubleshooting layout selection

### POST `/api/add-slide`
**Purpose**: Add slide to presentation  
**Request**:
- Content-Type: multipart/form-data
- Body:
  - `file`: PowerPoint file (required)
  - `layout`: Layout type string (required)
  - `title`: Slide title (optional)
  - `text`: Main content (required for most layouts)
  - `text2`: Second content (required for two-column)
  - `image`: Image file (required for image layouts)
  - `position`: Slide position number (optional, defaults to end)

**Response**: Binary PowerPoint file
- Content-Type: `application/vnd.openxmlformats-officedocument.presentationml.presentation`
- Content-Disposition: `attachment; filename="template_updated.pptx"`

**Error Responses**:
- 400: Validation error (missing fields, wrong format)
- 500: Server error (processing failed)

---

## Key Design Decisions

### 1. **Why Predefined Layouts?**
- Original plan: Dynamically scan and use any template layout
- Problem: Templates have many branded/decorative layouts unsuitable for content
- Solution: 4 predefined types with smart matching algorithm
- Benefit: Consistent, predictable behavior; avoids "Mango cover" type layouts

### 2. **Why Exclude Branded Layouts?**
- Templates often have special branded layouts (covers, dividers)
- These have colorful backgrounds and fixed branding
- Exclusion patterns: 'mango', 'cover', 'anvil', 'thank', 'section'
- Result: Selects clean, content-focused layouts

### 3. **Why Replace Placeholder Instead of Fill?**
- PowerPoint placeholders don't have `.insert_picture()` method
- Must delete placeholder and add image as shape
- Preserves exact position and size from placeholder
- Alternative approach (add as separate shape) causes positioning issues

### 4. **Why Set White Background?**
```python
fill.solid()
fill.fore_color.rgb = RGBColor(255, 255, 255)
```
- Template layouts inherit master slide backgrounds
- These can be colorful branded designs
- Setting white background provides clean slate
- User content is focus, not template branding

### 5. **Why Two-Column Layout in Frontend?**
- Left: Input controls (file, layout, form)
- Right: Preview and status
- Benefit: Live preview while user types
- Responsive: Stacks vertically on mobile

### 6. **Why React Hooks Instead of Class Components?**
- Modern React best practice
- Simpler state management
- Better code reusability
- Easier to understand and maintain

### 7. **Why SAP Fiori Design System?**
- User requirement: Professional SAP-branded appearance
- Colors: SAP Blue (#0A6ED1), SAP Gold (#F0AB00)
- Typography: Clean, corporate style
- Result: Matches SAP product ecosystem

---

## Common Issues and Solutions

### Issue 1: "Backend server is not responding"
**Cause**: Flask server not running  
**Solution**: 
```bash
cd backend
python app.py
```
Check console for errors

### Issue 2: Wrong layout selected
**Cause**: Template layout names don't match keywords  
**Solution**: 
1. Run `python test_layouts.py template.pptx`
2. See which layouts available
3. Adjust keywords in PREDEFINED_LAYOUTS if needed

### Issue 3: Image not appearing in slide
**Cause**: Layout has no picture placeholder  
**Solution**: Fallback code adds image on right side  
**Better**: Use template with proper picture placeholders

### Issue 4: Extra "First level" text boxes
**Cause**: Layout has unwanted body placeholders  
**Solution**: Structure matching now prefers simpler layouts  
**Score**: Layouts with fewer placeholders score higher

### Issue 5: CSS file corruption
**Cause**: File I/O issues on Windows  
**Solution**: Use PowerShell commands to clear and rewrite files

---

## File Dependencies

### Backend Dependencies:
```
Flask → Web server framework
flask-cors → Allows React to call API
python-pptx → PowerPoint manipulation
```

### Frontend Dependencies:
```
React → UI framework
react-scripts → Build tooling
```

### Component Hierarchy:
```
App
└── SlideCreator (orchestrator)
    ├── FileUpload (Step 1)
    ├── LayoutSelector (Step 2)
    ├── SlideForm (Steps 3-4)
    │   └── uses layout requirements
    └── SlidePreview (live preview)
        └── uses preview data from SlideForm
```

---

## Environment Setup

### Backend:
```bash
cd backend
pip install -r requirements.txt
python app.py
# Server runs on http://localhost:5000
```

### Frontend:
```bash
cd frontend
npm install
npm start
# App runs on http://localhost:3001
```

### Both must be running simultaneously for the app to work.

---

## Summary

**SlideMaker** is a full-stack web application that simplifies PowerPoint slide creation:

- **Backend**: Flask REST API handles PowerPoint manipulation using python-pptx
- **Frontend**: React app provides intuitive UI with live preview
- **Design**: SAP Fiori design system for professional appearance
- **Architecture**: Clean separation of concerns with component-based design
- **Features**: Smart layout matching, live preview, file upload/download, session management

The application focuses on providing a user-friendly interface for a complex task (PowerPoint manipulation) while maintaining code quality and reliability through proper error handling, validation, and modern development practices.

---

**End of Documentation**

Generated: November 7, 2025  
Project: SlideMaker v1.0  
Author: AI Assistant
