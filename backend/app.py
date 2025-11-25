from flask import Flask, request, send_file, jsonify
from flask_cors import CORS
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.enum.shapes import PP_PLACEHOLDER
from pptx.enum.text import PP_ALIGN
from pptx.enum.dml import MSO_THEME_COLOR
from pptx.dml.color import RGBColor
from pptx.oxml.xmlchemy import OxmlElement
from pptx.oxml.ns import qn
import io
import traceback
import os
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
import sys
import tempfile
import json
import zipfile
import shutil

# Add the backend_Mass_Update directory to Python path for mass update utilities
BACKEND_MASS_UPDATE_PATH = os.path.join(os.path.dirname(__file__), 'backend_Mass_Update')
if BACKEND_MASS_UPDATE_PATH not in sys.path:
    sys.path.insert(0, BACKEND_MASS_UPDATE_PATH)

# Import Mass Update utilities (from backend_Mass_Update/utils/)
from utils.ppt_processor import update_ppt_text

# Import Excel parser utilities using importlib to avoid naming conflicts
import importlib.util
EXCEL_PARSER_PATH = os.path.join(os.path.dirname(__file__), 'utils', 'excel_parser.py')
spec = importlib.util.spec_from_file_location("excel_parser_module", EXCEL_PARSER_PATH)
excel_parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(excel_parser)

# Extract functions from the module
get_filter_options = excel_parser.get_filter_options
get_folder_by_filters = excel_parser.get_folder_by_filters
convert_sharepoint_to_local_path = excel_parser.convert_sharepoint_to_local_path
get_excel_data = excel_parser.get_excel_data

app = Flask(__name__)
CORS(app, expose_headers='Content-Disposition')

# Configuration
MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp'}

# Predefined layouts that will be matched against the uploaded PPTX
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
        'keywords': ['picture', 'image', 'content', 'photo', 'text'],
        'has_image': True,
        'content_boxes': 1
    },
    'title_image': {
        'name': 'Title and Image',
        'keywords': ['picture', 'image', 'photo', 'blank'],
        'has_image': True,
        'content_boxes': 0,
        'prefer_simple': True  # Prefer simpler layouts
    }
}


def remove_bullets(paragraph):
    """Ensure a paragraph has no bullets."""
    try:
        pPr = paragraph._p.get_or_add_pPr()
        # Remove any existing bullet definitions
        for child in list(pPr):
            if child.tag in (
                qn('a:buNone'),
                qn('a:buChar'),
                qn('a:buAutoNum'),
                qn('a:buBlip'),
            ):
                pPr.remove(child)
        pPr.append(OxmlElement('a:buNone'))
    except Exception:
        pass
    paragraph.level = 0


def populate_text_frame(text_frame, text):
    """Fill a text frame with plain text (no bullets)."""
    text_frame.clear()
    text_frame.word_wrap = True
    lines = text.split('\n') if text is not None else ['']
    for idx, line in enumerate(lines):
        paragraph = text_frame.paragraphs[0] if idx == 0 else text_frame.add_paragraph()
        paragraph.text = line.strip()
        paragraph.alignment = PP_ALIGN.LEFT
        remove_bullets(paragraph)

def validate_file_size(file_storage, max_size, file_type="File"):
    """Validate file size before processing"""
    file_storage.seek(0, os.SEEK_END)
    size = file_storage.tell()
    file_storage.seek(0)
    
    if size > max_size:
        size_mb = size / (1024 * 1024)
        max_mb = max_size / (1024 * 1024)
        raise ValueError(f"{file_type} too large: {size_mb:.2f}MB (max: {max_mb}MB)")
    
    return size

def validate_image_format(filename):
    """Validate image file extension"""
    if '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    return ext in ALLOWED_IMAGE_EXTENSIONS

def find_layout_by_type(slide_master, layout_type):
    """
    Find the best matching layout based on predefined layout type.
    Uses keyword matching and structure analysis.
    Excludes decorative/branded layouts like 'Mango', 'Cover', etc.
    """
    if layout_type not in PREDEFINED_LAYOUTS:
        return None
    
    layout_config = PREDEFINED_LAYOUTS[layout_type]
    keywords = layout_config['keywords']
    
    # Exclude patterns - layouts to avoid
    exclude_patterns = ['mango', 'cover', 'branded', 'anvil', 'thank', 'section', 'divider']
    
    # First try: Exact name match (excluding branded layouts)
    for layout in slide_master.slide_layouts:
        layout_name_lower = layout.name.lower()
        
        # Skip if matches exclude pattern
        if any(pattern in layout_name_lower for pattern in exclude_patterns):
            continue
            
        if layout_config['name'].lower() == layout_name_lower:
            print(f"✓ Exact match found: {layout.name}")
            return layout
    
    # Second try: Keyword match (excluding branded layouts)
    best_match = None
    best_score = 0
    
    for layout in slide_master.slide_layouts:
        layout_name_lower = layout.name.lower()
        
        # Skip if matches exclude pattern
        if any(pattern in layout_name_lower for pattern in exclude_patterns):
            continue
        
        score = 0
        
        # Count keyword matches
        for keyword in keywords:
            if keyword in layout_name_lower:
                score += 1
        
        if score > best_score:
            best_score = score
            best_match = layout
    
    if best_match and best_score > 0:
        print(f"✓ Keyword match found: {best_match.name} (score: {best_score})")
        return best_match
    
    # Third try: Structure-based matching (excluding branded layouts)
    best_structure_match = None
    best_structure_score = 0
    
    for layout in slide_master.slide_layouts:
        layout_name_lower = layout.name.lower()
        
        # Skip if matches exclude pattern
        if any(pattern in layout_name_lower for pattern in exclude_patterns):
            continue
        
        has_title = False
        body_count = 0
        has_picture = False
        placeholder_count = 0
        
        for shape in layout.placeholders:
            placeholder_count += 1
            try:
                phf = shape.placeholder_format
                if phf.type == PP_PLACEHOLDER.TITLE:
                    has_title = True
                elif phf.type in [PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT]:
                    body_count += 1
                elif phf.type == PP_PLACEHOLDER.PICTURE:
                    has_picture = True
            except:
                continue
        
        # Calculate structure score (prefer simpler layouts with fewer placeholders)
        structure_score = 0
        
        # Match based on structure
        if layout_type == 'title_content':
            if has_title and body_count >= 1 and not has_picture:
                structure_score = 100 - placeholder_count  # Prefer fewer placeholders
        elif layout_type == 'title_two_content':
            if has_title and body_count >= 2:
                structure_score = 100 - placeholder_count
        elif layout_type == 'title_image_content':
            if has_title and body_count >= 1 and has_picture:
                structure_score = 100 - placeholder_count
        elif layout_type == 'title_image':
            if has_title and has_picture and body_count == 0:
                # For title+image, strongly prefer layouts with NO body placeholders
                structure_score = 200 - placeholder_count
            elif has_title and has_picture:
                # Accept layouts with body, but score them lower
                structure_score = 50 - placeholder_count
        
        if structure_score > best_structure_score:
            best_structure_score = structure_score
            best_structure_match = layout
    
    if best_structure_match:
        print(f"✓ Structure match found: {best_structure_match.name} (score: {best_structure_score})")
        return best_structure_match
    
    # Fallback: Use the most appropriate default layout
    print(f"! No perfect match, using fallback for {layout_type}")
    for layout in slide_master.slide_layouts:
        has_title = False
        has_body = False
        
        for shape in layout.placeholders:
            try:
                phf = shape.placeholder_format
                if phf.type == PP_PLACEHOLDER.TITLE:
                    has_title = True
                elif phf.type in [PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT]:
                    has_body = True
            except:
                continue
        
        if has_title and has_body:
            print(f"✓ Fallback layout: {layout.name}")
            return layout
    
    # Ultimate fallback: return first non-blank layout
    if len(slide_master.slide_layouts) > 1:
        print(f"✓ Using second layout as ultimate fallback")
        return slide_master.slide_layouts[1]
    
    return slide_master.slide_layouts[0] if len(slide_master.slide_layouts) > 0 else None

@app.route('/api/debug-layouts', methods=['POST'])
def debug_layouts():
    """Debug endpoint to see all available layouts in the uploaded template"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No PowerPoint file uploaded'}), 400
        
        file = request.files['file']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        try:
            prs = Presentation(file)
        except Exception as e:
            return jsonify({'error': f'Invalid PowerPoint file: {str(e)}'}), 400
        
        slide_master = prs.slide_masters[0]
        layouts_info = []
        
        for idx, layout in enumerate(slide_master.slide_layouts):
            placeholders = []
            for shape in layout.placeholders:
                try:
                    phf = shape.placeholder_format
                    placeholders.append({
                        'type': str(phf.type),
                        'name': shape.name
                    })
                except:
                    pass
            
            layouts_info.append({
                'index': idx,
                'name': layout.name,
                'placeholders': placeholders
            })
        
        return jsonify({
            'total_layouts': len(slide_master.slide_layouts),
            'layouts': layouts_info
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add-slide', methods=['POST'])
def add_slide():
    try:
        # Accept either uploaded file or a local template path
        template_path = request.form.get('templatePath')
        uploaded_file = request.files.get('file') if 'file' in request.files else None

        if not template_path and not uploaded_file:
            return jsonify({'error': 'Provide either a templatePath or upload a .pptx file'}), 400

        if uploaded_file:
            if uploaded_file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            if not uploaded_file.filename.endswith('.pptx'):
                return jsonify({'error': 'File must be a .pptx PowerPoint file'}), 400
            # Validate file size
            try:
                validate_file_size(uploaded_file, MAX_FILE_SIZE, "PowerPoint file")
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
            
        # Get form data
        layout_type = request.form.get('layout', '').strip()
        title = request.form.get('title', '').strip()
        text = request.form.get('text', '').strip()
        text2 = request.form.get('text2', '').strip()  # For two-content layout
        image = request.files.get('image')
        
        # Validate layout type provided
        if not layout_type or layout_type not in PREDEFINED_LAYOUTS:
            return jsonify({'error': 'Valid layout type is required'}), 400
        
        layout_config = PREDEFINED_LAYOUTS[layout_type]
        
        # Validate required content based on layout
        if layout_config['content_boxes'] > 0 and not text:
            return jsonify({'error': 'Content text is required for this layout'}), 400
        
        if layout_config['content_boxes'] == 2 and not text2:
            return jsonify({'error': 'Second content box is required for this layout'}), 400
        
        # Validate image if provided
        if image:
            if not validate_image_format(image.filename):
                return jsonify({'error': f'Invalid image format. Allowed: {", ".join(ALLOWED_IMAGE_EXTENSIONS)}'}), 400
            try:
                validate_file_size(image, MAX_IMAGE_SIZE, "Image")
            except ValueError as e:
                return jsonify({'error': str(e)}), 400
        
        # Validate position
        try:
            position = int(request.form.get('position', 0))
            if position < 0:
                return jsonify({'error': 'Position cannot be negative'}), 400
        except ValueError:
            return jsonify({'error': 'Position must be a valid number'}), 400

        # Load presentation
        try:
            if template_path:
                if not os.path.isfile(template_path):
                    return jsonify({'error': f'Template not found at path: {template_path}'}), 400
                if not template_path.lower().endswith('.pptx'):
                    return jsonify({'error': 'templatePath must point to a .pptx file'}), 400
                prs = Presentation(template_path)
                base_filename = os.path.basename(template_path)
            else:
                prs = Presentation(uploaded_file)
                base_filename = uploaded_file.filename
        except Exception as e:
            return jsonify({'error': f'Invalid or corrupted PowerPoint file: {str(e)}'}), 400

        # Find the layout by type
        slide_master = prs.slide_masters[0]
        
        if len(slide_master.slide_layouts) == 0:
            return jsonify({'error': 'Presentation has no slide layouts'}), 400
        
        slide_layout = find_layout_by_type(slide_master, layout_type)
        
        if not slide_layout:
            return jsonify({'error': f'Could not find suitable layout for: {layout_config["name"]}'}), 400

        print(f"\n=== Adding Slide ===")
        print(f"Requested Layout Type: {layout_type}")
        print(f"Using Layout: {slide_layout.name}")
        print(f"Title: {title}")
        print(f"Text: {text[:50]}..." if text and len(text) > 50 else f"Text: {text}")
        if text2:
            print(f"Text2: {text2[:50]}..." if len(text2) > 50 else f"Text2: {text2}")

        # Validate and adjust position
        total_slides = len(prs.slides)
        if position < 0:
            position = 0
        elif position > total_slides:
            position = total_slides

        # Create new slide
        new_slide = prs.slides.add_slide(slide_layout)
        
        # Remove background to make it plain white
        try:
            background = new_slide.background
            fill = background.fill
            fill.solid()
            fill.fore_color.rgb = RGBColor(255, 255, 255)  # White background
            print(f"✓ Background set to plain white")
        except Exception as e:
            print(f"! Could not modify background: {str(e)}")
        
        # Move slide to correct position if needed
        if position < total_slides:
            try:
                # Use private API carefully - wrap in try/except for safety
                xml_slides = prs.slides._sldIdLst
                slides = list(xml_slides)
                
                # Validate we have the slide to move
                if len(slides) > 0:
                    moved_slide = slides.pop()
                    # Ensure position is within valid range
                    insert_pos = min(position, len(slides))
                    slides.insert(insert_pos, moved_slide)
                    xml_slides.clear()
                    for slide in slides:
                        xml_slides.append(slide)
                    print(f"Slide inserted at position {insert_pos}")
                else:
                    print(f"! No slides to reposition")
            except AttributeError:
                print(f"! Slide positioning not supported in this version of python-pptx")
            except Exception as e:
                print(f"! Could not reposition slide: {str(e)}")
                # Don't fail the entire operation if positioning fails

        # SET TITLE
        title_set = False
        if title:
            try:
                if new_slide.shapes.title:
                    new_slide.shapes.title.text = title
                    print(f"✓ Title: '{title}'")
                    title_set = True
            except Exception as e:
                print(f"! Could not set title: {str(e)}")

        # SET CONTENT - Handle different layout types
        if layout_type == 'title_two_content' and text and text2:
            # Handle two content boxes
            content_placeholders = []
            for shape in new_slide.placeholders:
                try:
                    phf = shape.placeholder_format
                    if phf.type in [PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT]:
                        content_placeholders.append(shape)
                except:
                    continue
            
            if len(content_placeholders) >= 2:
                # Use first two placeholders
                try:
                    tf1 = content_placeholders[0].text_frame
                    populate_text_frame(tf1, text)
                    print(f"✓ Content 1: '{text[:50]}...'")
                    
                    tf2 = content_placeholders[1].text_frame
                    populate_text_frame(tf2, text2)
                    print(f"✓ Content 2: '{text2[:50]}...'")
                except Exception as e:
                    print(f"! Error setting two-content: {str(e)}")
            else:
                # Fallback: Create two textboxes
                try:
                    # Left textbox
                    txBox1 = new_slide.shapes.add_textbox(Inches(0.5), Inches(1.8), Inches(4.2), Inches(5))
                    tf1 = txBox1.text_frame
                    populate_text_frame(tf1, text)
                    
                    # Right textbox
                    txBox2 = new_slide.shapes.add_textbox(Inches(5.2), Inches(1.8), Inches(4.2), Inches(5))
                    tf2 = txBox2.text_frame
                    populate_text_frame(tf2, text2)
                    print(f"✓ Two content boxes created (fallback)")
                except Exception as e:
                    print(f"! Error creating two textboxes: {str(e)}")
        
        elif text:
            # Handle single content box
            content_added = False
            placeholder_found = False
            
            for shape in new_slide.placeholders:
                try:
                    phf = shape.placeholder_format
                    placeholder_found = True
                    
                    # Look for body/content placeholder
                    if phf.type in [PP_PLACEHOLDER.BODY, PP_PLACEHOLDER.OBJECT]:
                        # Found content placeholder - use it
                        tf = shape.text_frame
                        
                        if not tf:
                            print(f"! Placeholder has no text frame")
                            continue

                        populate_text_frame(tf, text)
                        tf.margin_left = Inches(0.1)
                        tf.margin_top = Inches(0.1)

                        print(f"✓ Content: '{text[:50]}...' (in placeholder)")
                        content_added = True
                        break
                except AttributeError as e:
                    print(f"! Placeholder attribute error: {str(e)}")
                    continue
                except Exception as e:
                    print(f"! Error setting placeholder content: {str(e)}")
                    continue
            
            if not placeholder_found:
                print(f"No placeholders found in slide layout")
            
            # If no placeholder found or failed, create text box
            if not content_added:
                try:
                    left = Inches(0.5)
                    top = Inches(1.8)
                    width = Inches(9)
                    height = Inches(5)
                    
                    txBox = new_slide.shapes.add_textbox(left, top, width, height)
                    tf = txBox.text_frame
                    populate_text_frame(tf, text)
                    tf.margin_left = Inches(0)
                    tf.margin_top = Inches(0)
                    
                    print(f"✓ Content: '{text[:50]}...' (in textbox fallback)")
                except Exception as e:
                    print(f"! Error creating textbox: {str(e)}")
                    raise ValueError("Could not add content to slide")

        # Add image if provided
        if image:
            image_added = False
            
            # Try to find image placeholder first
            for shape in new_slide.placeholders:
                try:
                    phf = shape.placeholder_format
                    if phf.type == PP_PLACEHOLDER.PICTURE:
                        # Found picture placeholder - use correct method
                        image.seek(0)
                        image_stream = io.BytesIO(image.read())
                        
                        # For picture placeholders, we need to delete it and add image in its place
                        left = shape.left
                        top = shape.top
                        width = shape.width
                        height = shape.height
                        
                        # Remove the placeholder
                        sp = shape.element
                        sp.getparent().remove(sp)
                        
                        # Add the picture in the same position
                        new_slide.shapes.add_picture(image_stream, left, top, width, height)
                        
                        print(f"✓ Image added to picture placeholder position")
                        image_added = True
                        break
                except Exception as e:
                    print(f"! Could not use picture placeholder: {str(e)}")
                    continue
            
            # If no placeholder, add as regular image on the right side
            if not image_added:
                try:
                    image.seek(0)  # Reset file pointer
                    image_stream = io.BytesIO(image.read())
                    
                    # Position image on the right side of the slide
                    left = Inches(6.5)
                    top = Inches(1.5)
                    max_height = Inches(5)
                    max_width = Inches(3)
                    
                    # Add image with size constraints
                    pic = new_slide.shapes.add_picture(image_stream, left, top, height=max_height)
                    
                    # Ensure width doesn't exceed bounds
                    if pic.width > max_width:
                        aspect_ratio = pic.height / pic.width
                        pic.width = max_width
                        pic.height = int(max_width * aspect_ratio)
                    
                    print(f"✓ Image added as shape on right side")
                except Exception as e:
                    print(f"! Image error: {str(e)}")
                    # Don't fail the entire operation if image fails
                    pass

        print(f"=== Complete ===\n")
        
        # Save and return
        output = io.BytesIO()
        try:
            prs.save(output)
            output.seek(0)
        except Exception as e:
            print(f"ERROR saving presentation: {str(e)}")
            return jsonify({'error': f'Failed to save presentation: {str(e)}'}), 500

        # Create a new filename for the modified presentation
        base_name = base_filename.rsplit('.', 1)[0]
        new_filename = f"{base_name}_updated.pptx"

        return send_file(
            output, 
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation',
            as_attachment=True,
            download_name=new_filename
        )
    
    except ValueError as e:
        # Validation errors
        return jsonify({'error': str(e)}), 400
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy', 'message': 'SlideMaker API is running'}), 200

@app.route('/api/get-slide-count', methods=['POST'])
def get_slide_count():
    """Get the number of slides in uploaded presentation"""
    try:
        # Support both uploaded file and templatePath via JSON
        template_path = None
        if request.is_json:
            body = request.get_json(silent=True) or {}
            template_path = body.get('templatePath')

        if template_path:
            if not os.path.isfile(template_path):
                return jsonify({'error': f'Template not found at path: {template_path}'}), 400
            if not template_path.lower().endswith('.pptx'):
                return jsonify({'error': 'templatePath must point to a .pptx file'}), 400
            try:
                prs = Presentation(template_path)
                filename = os.path.basename(template_path)
            except Exception as e:
                return jsonify({'error': f'Invalid PowerPoint file: {str(e)}'}), 400
        else:
            if 'file' not in request.files:
                return jsonify({'error': 'No PowerPoint file uploaded'}), 400
            file = request.files['file']
            if file.filename == '':
                return jsonify({'error': 'No file selected'}), 400
            if not file.filename.endswith('.pptx'):
                return jsonify({'error': 'File must be a .pptx PowerPoint file'}), 400
            try:
                prs = Presentation(file)
                filename = file.filename
            except Exception as e:
                return jsonify({'error': f'Invalid PowerPoint file: {str(e)}'}), 400
        
        return jsonify({
            'total_slides': len(prs.slides),
            'filename': filename
        }), 200
        
    except Exception as e:
        print(f"Error in get_slide_count: {str(e)}")
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# NEW: List PPT/PPTX files with metadata from a given folder (threaded)
@app.route('/api/list-ppts', methods=['POST'])
def list_ppts():
    try:
        if not request.is_json:
            return jsonify({'error': 'Expected JSON body with {"path": "C:/..."}'}), 400
        body = request.get_json(silent=True) or {}
        folder = body.get('path')
        include_details = bool(body.get('includeDetails', True))

        if not folder:
            return jsonify({'error': 'Path is required'}), 400
        if not os.path.isdir(folder):
            return jsonify({'error': f'Not a directory: {folder}'}), 400

        entries = []
        errors = []
        try:
            for name in os.listdir(folder):
                full = os.path.join(folder, name)
                if not os.path.isfile(full):
                    continue
                ext = os.path.splitext(name)[1].lower()
                if ext not in ('.ppt', '.pptx'):
                    continue
                stat = os.stat(full)
                entries.append({
                    'name': name,
                    'fullPath': full,
                    'extension': ext,
                    'sizeBytes': stat.st_size,
                    'modifiedTime': datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    'createdTime': datetime.fromtimestamp(stat.st_ctime).isoformat(),
                })
        except Exception as e:
            return jsonify({'error': f'Failed to read directory: {str(e)}'}), 500

        # Optionally compute slide counts in threads (non-blocking-ish with timeout per file)
        if include_details and entries:
            def get_slide_count_for(path):
                try:
                    if path.lower().endswith('.pptx'):
                        prs = Presentation(path)
                        return len(prs.slides)
                    else:
                        # .ppt not supported by python-pptx; return None
                        return None
                except Exception:
                    return None

            with ThreadPoolExecutor(max_workers=min(8, len(entries))) as executor:
                future_map = {executor.submit(get_slide_count_for, e['fullPath']): e for e in entries}
                for fut in as_completed(future_map, timeout=10):
                    e = future_map.get(fut)
                    try:
                        count = fut.result(timeout=0)
                    except Exception:
                        count = None
                    e['slides'] = count

        return jsonify({'files': entries, 'errors': errors}), 200
    except Exception as e:
        print('Error in list_ppts:', e)
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

# NEW: Lightweight preview - extract text content per slide
@app.route('/api/preview-texts', methods=['POST'])
def preview_texts():
    try:
        if not request.is_json:
            return jsonify({'error': 'Expected JSON body with {"templatePath": "C:/...pptx"}'}), 400
        body = request.get_json(silent=True) or {}
        template_path = body.get('templatePath')
        max_slides = int(body.get('maxSlides', 50))
        if not template_path:
            return jsonify({'error': 'templatePath is required'}), 400
        if not os.path.isfile(template_path):
            return jsonify({'error': f'File not found: {template_path}'}), 400
        if not template_path.lower().endswith('.pptx'):
            return jsonify({'error': 'Only .pptx is supported for preview'}), 400

        prs = Presentation(template_path)
        slides = []
        for idx, slide in enumerate(prs.slides):
            if idx >= max_slides:
                break
            title_text = ''
            try:
                if slide.shapes.title and slide.shapes.title.text:
                    title_text = slide.shapes.title.text
            except Exception:
                title_text = ''

            texts = []
            for shape in slide.shapes:
                try:
                    if hasattr(shape, 'text') and shape.text:
                        texts.append(shape.text)
                except Exception:
                    continue
            slides.append({
                'index': idx,
                'title': title_text,
                'texts': texts
            })

        return jsonify({'totalSlides': len(prs.slides), 'slides': slides}), 200
    except Exception as e:
        print('Error in preview_texts:', e)
        print(traceback.format_exc())
        return jsonify({'error': f'Server error: {str(e)}'}), 500

@app.route('/api/mass-update/process', methods=['POST'])
def mass_update_process():
    try:
        # Get either uploaded files or file paths
        files = request.files.getlist('files')
        file_paths_json = request.form.get('filePaths')
        
        # Parse file paths if provided
        file_paths = []
        if file_paths_json:
            try:
                file_paths = json.loads(file_paths_json)
            except json.JSONDecodeError:
                return jsonify({'error': 'Invalid file paths format'}), 400
        
        # Check if we have either files or file paths
        if (not files or len(files) == 0) and (not file_paths or len(file_paths) == 0):
            return jsonify({'error': 'No files provided'}), 400
        
        # Get replacements
        replacements_json = request.form.get('replacements')
        if not replacements_json:
            return jsonify({'error': 'No replacements provided'}), 400
        
        try:
            replacements = json.loads(replacements_json)
        except json.JSONDecodeError:
            return jsonify({'error': 'Invalid replacements format'}), 400
        
        if not replacements or len(replacements) == 0:
            return jsonify({'error': 'No replacement rules defined'}), 400
        
        # Create a temporary directory for processing
        temp_dir = tempfile.mkdtemp()
        processed_files = []
        
        # Determine total count
        total_count = len(files) if files else len(file_paths)
        
        results = {
            'total': total_count,
            'updated': 0,
            'unchanged': 0,
            'failed': 0,
            'errors': []
        }
        
        try:
            # Process uploaded files
            if files and len(files) > 0:
                for file in files:
                    try:
                        # Save uploaded file temporarily
                        temp_input_path = os.path.join(temp_dir, file.filename)
                        file.save(temp_input_path)
                        
                        # Process the file
                        updated = update_ppt_text(temp_input_path, replacements)
                        
                        if updated:
                            results['updated'] += 1
                            processed_files.append((file.filename, temp_input_path))
                        else:
                            results['unchanged'] += 1
                            processed_files.append((file.filename, temp_input_path))
                        
                    except Exception as e:
                        results['failed'] += 1
                        results['errors'].append(f"{file.filename}: {str(e)}")
                        print(f"Error processing {file.filename}: {e}")
            
            # Process files from paths
            elif file_paths and len(file_paths) > 0:
                for file_path in file_paths:
                    try:
                        if not os.path.exists(file_path):
                            results['failed'] += 1
                            results['errors'].append(f"{os.path.basename(file_path)}: File not found")
                            continue
                        
                        # Create a copy of the file in temp directory
                        filename = os.path.basename(file_path)
                        temp_input_path = os.path.join(temp_dir, filename)
                        shutil.copy2(file_path, temp_input_path)
                        
                        # Process the file
                        updated = update_ppt_text(temp_input_path, replacements)
                        
                        if updated:
                            results['updated'] += 1
                            processed_files.append((filename, temp_input_path))
                        else:
                            results['unchanged'] += 1
                            processed_files.append((filename, temp_input_path))
                        
                    except Exception as e:
                        results['failed'] += 1
                        filename = os.path.basename(file_path)
                        results['errors'].append(f"{filename}: {str(e)}")
                        print(f"Error processing {file_path}: {e}")
            
            # Create ZIP file in memory
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for filename, filepath in processed_files:
                    zip_file.write(filepath, filename)
                
                # Add a summary file
                summary = f"""Mass Update Summary
Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

Total Files: {results['total']}
Updated: {results['updated']}
Unchanged: {results['unchanged']}
Failed: {results['failed']}

Replacements Applied:
"""
                for find, replace in replacements.items():
                    summary += f"  '{find}' → '{replace}'\n"
                
                if results['errors']:
                    summary += "\nErrors:\n"
                    for error in results['errors']:
                        summary += f"  - {error}\n"
                
                zip_file.writestr('_SUMMARY.txt', summary)
            
            # Clean up temporary directory
            shutil.rmtree(temp_dir, ignore_errors=True)
            
            # Send ZIP file
            zip_buffer.seek(0)
            return send_file(
                zip_buffer,
                mimetype='application/zip',
                as_attachment=True,
                download_name=f'processed_presentations_{datetime.now().strftime("%Y%m%d_%H%M%S")}.zip'
            )
        
        except Exception as e:
            # Clean up on error
            shutil.rmtree(temp_dir, ignore_errors=True)
            raise e
    
    except Exception as e:
        print(f"Error in mass update: {e}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

# ============================================================================
# SharePoint Filter API Endpoints
# ============================================================================

@app.route('/api/sharepoint/filter-options', methods=['GET'])
def get_sharepoint_filter_options():
    """
    Get available filter options for SharePoint folders.
    Supports cascading filters based on previous selections.
    
    Query params:
        subSolution (optional): Filter Service Type options
        serviceType (optional): Filter Session Description options
    """
    try:
        sub_solution = request.args.get('subSolution')
        service_type = request.args.get('serviceType')
        
        options = get_filter_options(
            sub_solution=sub_solution,
            service_type=service_type
        )
        
        return jsonify(options), 200
        
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        print(f"Error getting filter options: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to load filter options: {str(e)}'}), 500


@app.route('/api/sharepoint/get-folder', methods=['POST'])
def get_sharepoint_folder():
    """
    Get local folder path based on selected filters.
    
    Request body:
        {
            "subSolution": "...",
            "serviceType": "...",
            "sessionDescription": "..."
        }
    
    Response:
        {
            "folderPath": "C:\\Users\\...\\OneDrive - SAP\\...\\EN",
            "sharePointUrl": "https://sap.sharepoint.com/..."
        }
    """
    try:
        if not request.is_json:
            return jsonify({'error': 'Request must be JSON'}), 400
        
        data = request.get_json()
        sub_solution = data.get('subSolution')
        service_type = data.get('serviceType')
        session_description = data.get('sessionDescription')
        
        # Validate required fields
        if not all([sub_solution, service_type, session_description]):
            return jsonify({
                'error': 'Missing required fields: subSolution, serviceType, sessionDescription'
            }), 400
        
        # Get SharePoint URL from Excel
        print(f"DEBUG API: Getting folder for: {sub_solution} / {service_type} / {session_description}")
        sharepoint_url = get_folder_by_filters(
            sub_solution=sub_solution,
            service_type=service_type,
            session_description=session_description
        )
        
        print(f"DEBUG API: SharePoint URL received: {sharepoint_url}")
        
        if not sharepoint_url:
            return jsonify({
                'error': 'No folder found matching the selected filters. Please try different filter combinations.'
            }), 404
        
        # Convert to local OneDrive path with /EN subfolder
        print(f"DEBUG API: Converting to local path...")
        local_path = convert_sharepoint_to_local_path(sharepoint_url)
        print(f"DEBUG API: Local path result: {local_path}")
        
        if not local_path:
            return jsonify({
                'error': 'Could not determine local OneDrive path. Please ensure SharePoint folder is synced.'
            }), 500
        
        # Check if folder exists
        folder_exists = os.path.isdir(local_path)
        
        return jsonify({
            'folderPath': local_path,
            'sharePointUrl': sharepoint_url,
            'exists': folder_exists
        }), 200
        
    except FileNotFoundError as e:
        return jsonify({'error': str(e)}), 404
    except Exception as e:
        print(f"Error getting folder: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to get folder: {str(e)}'}), 500


@app.route('/api/sharepoint/refresh-cache', methods=['POST'])
def refresh_sharepoint_cache():
    """Force refresh of cached Excel data."""
    try:
        get_excel_data(force_refresh=True)
        return jsonify({'message': 'Cache refreshed successfully'}), 200
    except Exception as e:
        print(f"Error refreshing cache: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/sharepoint/debug', methods=['GET'])
def debug_sharepoint_setup():
    """Debug endpoint to check SharePoint Excel setup."""
    try:
        from pathlib import Path
        import glob
        
        downloads_path = Path.home() / "Downloads"
        pattern = str(downloads_path / "query*.iqy")
        files = glob.glob(pattern)
        
        debug_info = {
            'downloadsPath': str(downloads_path),
            'downloadsExists': downloads_path.exists(),
            'queryFilesFound': len(files),
            'queryFiles': [os.path.basename(f) for f in files],
            'latestFile': max(files, key=os.path.getmtime) if files else None
        }
        
        if files:
            latest_file = max(files, key=os.path.getmtime)
            try:
                # Try to read and show first few lines
                with open(latest_file, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read(500)
                debug_info['filePreview'] = content
                
                # Try to parse
                df = get_excel_data(force_refresh=True)
                debug_info['parsedSuccessfully'] = True
                debug_info['rowCount'] = len(df)
                debug_info['columns'] = list(df.columns)
            except Exception as e:
                debug_info['parseError'] = str(e)
        
        return jsonify(debug_info), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/download-ppt', methods=['POST'])
def download_ppt():
    """Download a PowerPoint file directly."""
    try:
        data = request.get_json()
        file_path = data.get('filePath')
        
        if not file_path:
            return jsonify({'error': 'File path is required'}), 400
        
        # Security check: ensure the file exists and is a valid path
        if not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        
        # Check if it's a PPT file
        if not file_path.lower().endswith(('.ppt', '.pptx')):
            return jsonify({'error': 'Invalid file type. Only PPT/PPTX files are allowed.'}), 400
        
        # Get the filename for the download
        filename = os.path.basename(file_path)
        
        # Send the file
        return send_file(
            file_path,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.presentationml.presentation'
        )
        
    except Exception as e:
        print(f"Error downloading file: {e}")
        traceback.print_exc()
        return jsonify({'error': f'Failed to download file: {str(e)}'}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
