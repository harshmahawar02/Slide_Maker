import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(__file__))

# Import the excel parser
import importlib.util
excel_parser_path = os.path.join(os.path.dirname(__file__), "utils", "excel_parser.py")
spec = importlib.util.spec_from_file_location("excel_parser", excel_parser_path)
excel_parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(excel_parser)

print("Testing Excel parser...")
print("-" * 50)

try:
    # Test file discovery
    file_path = excel_parser.find_latest_query_file()
    print(f"Found file: {file_path}")
    print()
    
    # Test data loading
    print("Loading Excel data...")
    df = excel_parser.get_excel_data()
    print(f"Loaded {len(df)} rows")
    print(f"Columns: {list(df.columns)}")
    print()
    
    # Show first row
    if len(df) > 0:
        print("First row:")
        for col in df.columns:
            print(f"  {col}: {df.iloc[0][col]}")
        print()
    
    # Test filter options
    print("Getting filter options...")
    options = excel_parser.get_filter_options()
    print(f"Sub Solutions: {options['subSolution'][:3]}...")  # Show first 3
    print()
    
    # Test conversion if _SharePointURL exists
    if '_SharePointURL' in df.columns and len(df) > 0:
        test_url = df.iloc[0]['_SharePointURL']
        print(f"Testing URL conversion:")
        print(f"  Input URL: {test_url}")
        local_path = excel_parser.convert_sharepoint_to_local_path(test_url)
        print(f"  Local path: {local_path}")
    
except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
