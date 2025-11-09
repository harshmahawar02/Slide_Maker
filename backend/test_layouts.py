import sys
from pptx import Presentation

# Usage: python test_layouts.py path/to/template.pptx

if len(sys.argv) < 2:
    print("Usage: python test_layouts.py path/to/template.pptx")
    sys.exit(1)

template_path = sys.argv[1]

try:
    prs = Presentation(template_path)
    slide_master = prs.slide_masters[0]
    
    print(f"\n{'='*80}")
    print(f"TEMPLATE LAYOUTS - Total: {len(slide_master.slide_layouts)}")
    print(f"{'='*80}\n")
    
    for idx, layout in enumerate(slide_master.slide_layouts):
        print(f"{idx}. {layout.name}")
        print(f"   Placeholders:")
        
        for shape in layout.placeholders:
            try:
                phf = shape.placeholder_format
                print(f"      - {shape.name} (Type: {phf.type})")
            except:
                print(f"      - {shape.name} (Unknown type)")
        print()
    
    print(f"{'='*80}")
    print("RECOMMENDATIONS FOR EACH LAYOUT TYPE:")
    print(f"{'='*80}\n")
    
    # Exclude patterns
    exclude_patterns = ['mango', 'cover', 'branded', 'anvil', 'thank', 'section', 'divider']
    
    print("For 'title_image' layout, clean options:")
    for idx, layout in enumerate(slide_master.slide_layouts):
        layout_name_lower = layout.name.lower()
        if any(pattern in layout_name_lower for pattern in exclude_patterns):
            continue
        if 'picture' in layout_name_lower or 'image' in layout_name_lower or 'photo' in layout_name_lower:
            print(f"   ✓ {idx}. {layout.name}")
    
    print("\nFor 'title_content' layout, clean options:")
    for idx, layout in enumerate(slide_master.slide_layouts):
        layout_name_lower = layout.name.lower()
        if any(pattern in layout_name_lower for pattern in exclude_patterns):
            continue
        if ('content' in layout_name_lower or 'text' in layout_name_lower) and 'two' not in layout_name_lower:
            print(f"   ✓ {idx}. {layout.name}")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()
