# SlideMaker

A web application to add custom slides to PowerPoint presentations while **preserving theme, headers, footers, and working with ANY language or custom template**.

**Critical Fix Applied:** The app now uses your presentation's **actual layout names** instead of guessing. This means:
- Works with presentations in **any language** (Spanish, French, German, Chinese, Arabic, etc.)
- Works with **custom corporate templates** with unique layout names
- Shows you the **exact layouts from your file** - no assumptions!

## Quick Start

### Easy Setup (Windows)

**One-time setup:**
```bash
setup.bat
```
This will automatically install all dependencies for both backend and frontend.

**Start the app:**
```bash
start.bat
```
This opens both servers in separate terminal windows automatically!

### Manual Setup

**Backend:**
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on `http://localhost:5000`

**Frontend:**
```bash
cd frontend
npm install
npm start
```
Frontend runs on `http://localhost:3000`

## How to Use

1. **Upload** your PowerPoint file (.pptx)
2. **Select** a layout from the dropdown - these are YOUR presentation's slide master layouts!
3. **Fill in** content (title, content, and image as per the choosen layout)
4. **Choose** position (0 = beginning, default = end)
5. **Click** "Add Slide" to add it to your presentation
6. **Repeat** steps 2-5 to add more slides
7. **Download** your complete presentation when ready

## Features

### Core Functionality
- **International Support** - Works with any language
- **Dynamic Layout Detection** - Uses your file's actual layouts
- **Theme Preservation** - Matches backgrounds, fonts, colors, logos
- **Flexible Positioning** - Insert slides anywhere
- **Multi-Slide Workflow** - Add multiple slides before downloading
- **Content Validation** - Real-time warnings for overflow issues
- **Health Monitoring** - Shows when backend is online/offline


## Technical Improvement
### What Was Fixed
1. **Layout Detection (CRITICAL)** - Now reads actual layout names from uploaded file
2. **International Support** - Eliminated hardcoded English-only layout names
3. **Custom Templates** - Works with any custom-named layouts
4. **Button Labels** - Changed "Add Slide and Download" to just "Add Slide"
5. **Code Cleanup** - Removed unused imports and improved error handling
6. **Slide Positioning** - Enhanced with better error recovery
7. **Memory Management** - Proper cleanup of resources
8. **Validation** - Comprehensive input validation
9. **Documentation** - Complete architecture and testing guides

### How It Works Now
```
1. Upload PPTX → Backend reads layouts → Returns actual names
2. Select layout → Frontend uses exact name
3. Add content → Backend finds layout by exact match
4. Slide created → Theme/formatting preserved
5. Download → Complete presentation ready
```

## Documentation

Comprehensive documentation in the `docs/` folder:
- **ARCHITECTURE.md** - System design, data flow, and technical decisions
- **TESTING_GUIDE.md** - 60+ test cases for thorough validation
- **FIXES_APPLIED.md** - Complete list of all fixes and improvements
- **TROUBLESHOOTING.md** - Common issues and solutions
- **LOGO_REPLACEMENT_GUIDE.md** - How to customize the logo

## Tech Stack

**Frontend:** React 19, CSS3, Fetch API  
**Backend:** Flask 3.0, python-pptx 0.6.23, Flask-CORS

## Important Notes

### File Requirements
- Format: `.pptx` only (not `.ppt`)
- Max size: 50MB for PowerPoint, 10MB for images
- Supported images: PNG, JPG, JPEG, GIF, BMP

### Content Guidelines
- Title: Optional (not all layouts require it)
- Content: Required (main purpose of the app)
- Image: Optional (only if needed)
- Position: 0 = beginning, leave as default for end

### Validation Warnings
The app warns you if:
- Title exceeds 100 characters
- Content exceeds 500 characters
- Content has more than 15 lines
- Image exceeds 5MB
- Image type may not be supported
- Position seems too high

These are **warnings**, not errors - you can still proceed!

## Why This Update Matters

### Before (Broken for many users):
```
App: "Looking for 'Title and Content' layout..."
User's Spanish file: Has "Título y contenido"
App: "Layout not found!"
```

### After (Works for everyone):
```
App: "What layouts are in your file?"
Backend: "Título y contenido, Diapositiva en blanco, ..."
App: "Here are your layouts, pick one!"
User: Selects "Título y contenido"
App: Uses exact name - works perfectly!
```

## Known Limitations

1. **Slide Positioning** - Uses internal python-pptx API (may break in future updates)
2. **Single Slide Master** - Only uses first slide master from presentation
3. **No Preview** - Cannot preview slide before adding
4. **No Undo** - Must re-upload to start over (or use Reset button)

## For Developers

### Project Structure
```
slideMaker/
├── README.md                    # You are here
├── setup.bat                    # Windows setup script
├── start.bat                    # Windows start script
├── backend/
│   ├── app.py                  # Flask API server
│   ├── requirements.txt        # Python dependencies
│   └── venv/                   # Virtual environment
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SlideCreator.js       # Main container
│   │   │   ├── LayoutSelector.js     # Dynamic layout dropdown
│   │   │   ├── SlideForm.js          # Content form
│   │   │   └── SlideCreator.css      # Styles
│   │   ├── App.js
│   │   └── index.js
│   ├── package.json
│   └── public/
└── docs/
    ├── ARCHITECTURE.md          # System design
    ├── TESTING_GUIDE.md        # Test cases
    └── ...
```

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/get-layouts` - Get layouts from uploaded PPTX
- `POST /api/add-slide` - Add slide with content

---

## Need Help?

1. **Common issues?** → Check `docs/TROUBLESHOOTING.md`
2. **How it works?** → Read `docs/ARCHITECTURE.md`
3. **Want to test?** → See `docs/TESTING_GUIDE.md`
4. **Backend errors?** → Check Flask terminal output
5. **Frontend errors?** → Check browser console (F12)

---
