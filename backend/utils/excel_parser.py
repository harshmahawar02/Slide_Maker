"""
Excel/IQY Parser Utility
Parses SharePoint metadata from .iqy files and provides filtering capabilities.
"""
import os
import glob
from pathlib import Path
from typing import Dict, List, Optional, Any
import pandas as pd
from urllib.parse import parse_qs, urlparse
import threading


class ExcelDataCache:
    """Thread-safe cache for parsed Excel data."""
    
    def __init__(self):
        self._data: Optional[pd.DataFrame] = None
        self._lock = threading.Lock()
        self._file_path: Optional[str] = None
        self._last_modified: Optional[float] = None
    
    def get_data(self) -> Optional[pd.DataFrame]:
        """Get cached data if still valid."""
        with self._lock:
            if self._data is None or self._file_path is None:
                return None
            
            # Check if file has been modified
            if os.path.exists(self._file_path):
                current_mtime = os.path.getmtime(self._file_path)
                if current_mtime != self._last_modified:
                    # File changed, invalidate cache
                    self._data = None
                    return None
            
            return self._data.copy() if self._data is not None else None
    
    def set_data(self, data: pd.DataFrame, file_path: str):
        """Cache parsed data."""
        with self._lock:
            self._data = data.copy()
            self._file_path = file_path
            if os.path.exists(file_path):
                self._last_modified = os.path.getmtime(file_path)


# Global cache instance
_excel_cache = ExcelDataCache()


def find_latest_query_file() -> Optional[str]:
    """
    Find the most recent SharePoint data file in the user's Downloads folder.
    Looks for: sharepoint_data.xlsx, query*.iqy, or query*.xlsx
    
    Returns:
        str: Full path to the latest file, or None if not found.
    """
    try:
        downloads_path = Path.home() / "Downloads"
        
        # Priority 1: Look for sharepoint_data.xlsx (recommended format)
        xlsx_file = downloads_path / "sharepoint_data.xlsx"
        if xlsx_file.exists():
            return str(xlsx_file)
        
        # Priority 2: Look for query*.xlsx files
        xlsx_pattern = str(downloads_path / "query*.xlsx")
        xlsx_files = glob.glob(xlsx_pattern)
        if xlsx_files:
            latest_file = max(xlsx_files, key=os.path.getmtime)
            return latest_file
        
        # Priority 3: Look for query*.iqy files (requires network access)
        iqy_pattern = str(downloads_path / "query*.iqy")
        iqy_files = glob.glob(iqy_pattern)
        if iqy_files:
            latest_file = max(iqy_files, key=os.path.getmtime)
            return latest_file
        
        return None
    except Exception as e:
        print(f"Error finding query file: {e}")
        return None


def parse_iqy_file(file_path: str) -> pd.DataFrame:
    """
    Parse .iqy file and extract SharePoint data.
    
    .iqy files are Microsoft Web Query files that reference SharePoint data URLs.
    We need to fetch the actual data from the URL within the .iqy file.
    
    Args:
        file_path: Path to .iqy file
        
    Returns:
        DataFrame with parsed SharePoint metadata
    """
    import requests
    import xml.etree.ElementTree as ET
    from io import StringIO
    
    try:
        # Read .iqy file content
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        print(f"Reading .iqy file: {file_path}")
        
        # Extract the SharePoint data URL from .iqy file
        # .iqy files contain lines like: WEB\n1\nURL
        lines = [line.strip() for line in content.split('\n') if line.strip()]
        
        # Find the URL (usually starts with http/https)
        data_url = None
        for line in lines:
            if line.startswith('http://') or line.startswith('https://'):
                data_url = line
                break
        
        if not data_url:
            raise ValueError("No SharePoint URL found in .iqy file")
        
        print(f"Found SharePoint URL: {data_url[:100]}...")
        
        # Fetch data from SharePoint URL
        # The URL typically returns XML data in SharePoint list format
        try:
            response = requests.get(data_url, timeout=30)
            response.raise_for_status()
            xml_content = response.text
            
            # Parse XML response
            root = ET.fromstring(xml_content)
            
            # SharePoint returns data in <z:row> elements with attributes as columns
            rows = []
            for row in root.findall('.//{http://www.w3.org/2003/05/soap-envelope}row') or \
                       root.findall('.//{#RowsetSchema}row') or \
                       root.findall('.//z:row', {'z': 'urn:schemas-microsoft-com:rowset'}):
                row_data = {}
                for attr, value in row.attrib.items():
                    # Clean attribute names (remove namespace prefixes)
                    clean_attr = attr.split('}')[-1] if '}' in attr else attr
                    clean_attr = clean_attr.replace('ows_', '')  # Remove SharePoint prefix
                    row_data[clean_attr] = value
                if row_data:
                    rows.append(row_data)
            
            if not rows:
                raise ValueError("No data rows found in SharePoint response")
            
            # Create DataFrame
            df = pd.DataFrame(rows)
            
            # Clean column names
            df.columns = df.columns.str.strip()
            
            print(f"Successfully fetched SharePoint data with columns: {list(df.columns)}")
            print(f"Total rows: {len(df)}")
            
            return df
            
        except requests.RequestException as e:
            print(f"Failed to fetch SharePoint data: {e}")
            raise ValueError(
                f"Cannot access SharePoint URL. Please ensure you're on the corporate network "
                f"and have access to SharePoint. Error: {str(e)}"
            )
        
    except Exception as e:
        print(f"Error parsing .iqy file: {e}")
        import traceback
        traceback.print_exc()
        
        # Provide helpful error message
        raise ValueError(
            f"Could not parse .iqy file. This file references a SharePoint list that requires authentication. "
            f"Please export the SharePoint data to Excel (.xlsx) format instead and save it as 'sharepoint_data.xlsx' "
            f"in your Downloads folder. Error: {str(e)}"
        )


def get_excel_data(force_refresh: bool = False) -> pd.DataFrame:
    """
    Get SharePoint metadata from Excel file with caching.
    
    Args:
        force_refresh: If True, bypass cache and reload from file
        
    Returns:
        DataFrame with SharePoint metadata
        
    Raises:
        FileNotFoundError: If no query file found in Downloads
        ValueError: If file cannot be parsed
    """
    # Try to get from cache first
    if not force_refresh:
        cached_data = _excel_cache.get_data()
        if cached_data is not None:
            return cached_data
    
    # Find latest query file
    file_path = find_latest_query_file()
    if not file_path:
        raise FileNotFoundError(
            "No SharePoint data file found in Downloads folder. "
            "Please export SharePoint data as Excel (.xlsx) and save as 'sharepoint_data.xlsx' in your Downloads folder."
        )
    
    print(f"Using data file: {os.path.basename(file_path)}")
    
    # Parse the file based on extension
    if file_path.lower().endswith('.xlsx'):
        # Use openpyxl to read hyperlinks
        from openpyxl import load_workbook
        
        # First get the data with pandas
        df = pd.read_excel(file_path)
        df.columns = df.columns.str.strip()
        print(f"Loaded Excel file with {len(df)} rows and columns: {list(df.columns)}")
        
        # Now extract hyperlinks from Name column
        try:
            wb = load_workbook(file_path)
            ws = wb.active
            
            # Find the Name column index
            header_row = list(ws.iter_rows(min_row=1, max_row=1, values_only=False))[0]
            name_col_idx = None
            for idx, cell in enumerate(header_row):
                if cell.value and 'name' in str(cell.value).lower():
                    name_col_idx = idx + 1  # openpyxl uses 1-based indexing
                    break
            
            if name_col_idx:
                # Extract hyperlinks
                hyperlinks = []
                for row_idx in range(2, ws.max_row + 1):  # Start from row 2 (skip header)
                    cell = ws.cell(row=row_idx, column=name_col_idx)
                    if cell.hyperlink:
                        hyperlinks.append(cell.hyperlink.target)
                    else:
                        hyperlinks.append(cell.value)
                
                # Add hyperlinks as a new column
                df['_SharePointURL'] = hyperlinks[:len(df)]
                print(f"DEBUG: Extracted {len([h for h in hyperlinks if h and str(h).startswith('http')])} hyperlinks from Name column")
            
            wb.close()
        except Exception as e:
            print(f"Warning: Could not extract hyperlinks: {e}")
            # Fallback to using Name column as-is
            df['_SharePointURL'] = df['Name']
    elif file_path.lower().endswith('.iqy'):
        df = parse_iqy_file(file_path)
    else:
        raise ValueError(f"Unsupported file format: {file_path}")
    
    # Create a column mapping to handle different naming conventions
    column_mapping = {}
    df_columns_lower = {col.lower(): col for col in df.columns}
    
    # Map required columns (case-insensitive, flexible matching)
    required_mappings = {
        'Name': ['name', 'folder name', 'folder', 'title'],
        'SessionDescription': ['sessiondescription', 'session description', 'description', 'session'],
        'Sub Solution': ['sub solution', 'subsolution', 'solution'],
        'Service Type': ['service type', 'servicetype', 'type', 'service']
    }
    
    for standard_name, possible_names in required_mappings.items():
        found = False
        for possible in possible_names:
            if possible.lower() in df_columns_lower:
                column_mapping[standard_name] = df_columns_lower[possible.lower()]
                found = True
                break
        if not found:
            # Check for partial matches
            for col in df.columns:
                if any(poss in col.lower() for poss in possible_names):
                    column_mapping[standard_name] = col
                    found = True
                    break
    
    # Check if we found all required columns
    missing = [name for name in required_mappings.keys() if name not in column_mapping]
    if missing:
        print(f"Available columns: {list(df.columns)}")
        raise ValueError(
            f"Missing required columns: {', '.join(missing)}. "
            f"Available columns: {', '.join(df.columns)}"
        )
    
    # Rename columns to standard names
    df = df.rename(columns={v: k for k, v in column_mapping.items()})
    print(f"Mapped columns successfully: {column_mapping}")
    
    # Cache the data
    _excel_cache.set_data(df, file_path)
    
    return df


def get_filter_options(
    sub_solution: Optional[str] = None,
    service_type: Optional[str] = None
) -> Dict[str, List[str]]:
    """
    Get available filter options based on previous selections.
    Implements cascading filter logic.
    
    Args:
        sub_solution: Selected Sub Solution (filters Service Type options)
        service_type: Selected Service Type (filters Session Description options)
        
    Returns:
        Dict with available options for each filter level
    """
    df = get_excel_data()
    
    # Remove null/empty values and get unique options
    result = {}
    
    # Level 1: Sub Solution (always available)
    sub_solutions = df['Sub Solution'].dropna().unique().tolist()
    result['subSolution'] = sorted([str(s).strip() for s in sub_solutions if str(s).strip()])
    
    # Level 2: Service Type (filtered by Sub Solution if provided)
    if sub_solution:
        filtered_df = df[df['Sub Solution'] == sub_solution]
    else:
        filtered_df = df
    
    service_types = filtered_df['Service Type'].dropna().unique().tolist()
    result['serviceType'] = sorted([str(s).strip() for s in service_types if str(s).strip()])
    
    # Level 3: Session Description (filtered by Service Type if provided)
    if service_type:
        filtered_df = filtered_df[filtered_df['Service Type'] == service_type]
    
    session_descriptions = filtered_df['SessionDescription'].dropna().unique().tolist()
    result['sessionDescription'] = sorted([str(s).strip() for s in session_descriptions if str(s).strip()])
    
    return result


def get_folder_by_filters(
    sub_solution: str,
    service_type: str,
    session_description: str
) -> Optional[str]:
    """
    Find folder SharePoint URL based on selected filters.
    
    Args:
        sub_solution: Selected Sub Solution
        service_type: Selected Service Type
        session_description: Selected Session Description
        
    Returns:
        SharePoint URL from Name column, or None if not found
        
    Raises:
        ValueError: If multiple folders found (should not happen)
    """
    df = get_excel_data()
    
    # Filter by all three criteria
    filtered = df[
        (df['Sub Solution'] == sub_solution) &
        (df['Service Type'] == service_type) &
        (df['SessionDescription'] == session_description)
    ]
    
    if len(filtered) == 0:
        return None
    
    if len(filtered) > 1:
        # Multiple rows found - this shouldn't happen but handle gracefully
        print(f"Warning: Multiple folders found for filters. Using first match.")
    
    # Get the SharePoint URL from hyperlink if available, otherwise use Name text
    if '_SharePointURL' in filtered.columns:
        folder_url = str(filtered.iloc[0]['_SharePointURL']).strip()
    else:
        folder_url = str(filtered.iloc[0]['Name']).strip()
    
    print(f"DEBUG: Found folder URL: {folder_url}")
    return folder_url


def extract_folder_path_from_url(sharepoint_url: str) -> Optional[str]:
    """
    Extract folder path from SharePoint URL.
    
    Example URLs:
    1. https://sap.sharepoint.com/.../Forms/AllItems.aspx?RootFolder=/sites%2F202961%2FOneDeliveryISBN%2F9505833&View={...}
    2. https://sap.sharepoint.com/sites/202961/OneDeliveryISBN/Forms/AllItems.aspx?View={...}&id=/sites/202961/OneDeliveryISBN/9507700
    
    Extracts: /sites/202961/OneDeliveryISBN/9505833
    
    Args:
        sharepoint_url: Full SharePoint URL
        
    Returns:
        Extracted folder path from 'RootFolder' or 'id' parameter
    """
    try:
        from urllib.parse import unquote
        parsed = urlparse(sharepoint_url)
        query_params = parse_qs(parsed.query)
        
        # Try 'RootFolder' parameter first (most common)
        if 'RootFolder' in query_params:
            folder_path = unquote(query_params['RootFolder'][0])
            print(f"DEBUG: Extracted from RootFolder: {folder_path}")
            return folder_path
        
        # Fallback to 'id' parameter
        if 'id' in query_params:
            folder_path = query_params['id'][0]
            print(f"DEBUG: Extracted from id: {folder_path}")
            return folder_path
        
        return None
    except Exception as e:
        print(f"Error parsing SharePoint URL: {e}")
        return None


def convert_sharepoint_to_local_path(sharepoint_url: str) -> Optional[str]:
    """
    Convert SharePoint URL or folder ID to local OneDrive path with /EN subfolder.
    
    Args:
        sharepoint_url: Full SharePoint URL from Excel or just folder ID (e.g., "9507700")
        
    Returns:
        Local path like: C:\\Users\\{user}\\OneDrive - SAP\\OneDeliveryISBN\\9507700\\EN
    """
    print(f"DEBUG: Converting SharePoint URL: {sharepoint_url}")
    
    # Check if it's a full URL or just a folder ID/number
    if sharepoint_url.startswith('http'):
        # Extract folder path from URL
        folder_path = extract_folder_path_from_url(sharepoint_url)
        print(f"DEBUG: Extracted folder path from URL: {folder_path}")
        
        if not folder_path:
            return None
        
        # Remove leading /sites/{site_id}/ to get relative path
        # Example: /sites/202961/OneDeliveryISBN/9507700 -> OneDeliveryISBN/9507700
        parts = folder_path.split('/')
        
        # Find where the actual folder structure starts (after sites/{id})
        try:
            # Skip empty, 'sites', and site ID parts
            relevant_parts = []
            skip_next = False
            for i, part in enumerate(parts):
                if not part:
                    continue
                if part == 'sites':
                    skip_next = True
                    continue
                if skip_next:
                    skip_next = False
                    continue
                relevant_parts.append(part)
            
            if not relevant_parts:
                return None
            
            relative_path = '\\'.join(relevant_parts)
        except:
            return None
    else:
        # It's just a folder ID or relative path (e.g., "9507700")
        print(f"DEBUG: Treating as folder ID: {sharepoint_url}")
        # Assume it's under OneDeliveryISBN folder
        relative_path = f"OneDeliveryISBN\\{sharepoint_url}"
    
    print(f"DEBUG: Relative path: {relative_path}")
    
    # Construct local OneDrive path
    home = Path.home()
    
    # Try multiple OneDrive base paths with different naming patterns for the SharePoint folder
    possible_patterns = [
        # Pattern 1: OneDrive - SAP SE with full SharePoint library name
        (home / "OneDrive - SAP SE", "SAP Preferred Success ASC Delivery - OneDelivery-ISBN"),
        # Pattern 2: OneDrive - SAP with full SharePoint library name
        (home / "OneDrive - SAP", "SAP Preferred Success ASC Delivery - OneDelivery-ISBN"),
        # Pattern 3: OneDrive - SAP SE with shortened name
        (home / "OneDrive - SAP SE", "OneDelivery-ISBN"),
        # Pattern 4: OneDrive - SAP with shortened name
        (home / "OneDrive - SAP", "OneDelivery-ISBN"),
        # Pattern 5: Regular OneDrive with original folder name from URL
        (home / "OneDrive", None),
    ]
    
    # Extract just the folder ID from relative path (e.g., "9505833" from "OneDeliveryISBN\9505833")
    folder_parts = relative_path.split('\\')
    folder_id = folder_parts[-1] if len(folder_parts) > 0 else relative_path
    
    for base_path, sharepoint_folder_name in possible_patterns:
        print(f"DEBUG: Checking base path: {base_path}")
        if not base_path.exists():
            continue
        
        if sharepoint_folder_name:
            # Try with SharePoint library name replacement
            full_path = base_path / sharepoint_folder_name / folder_id / "EN"
        else:
            # Use original relative path
            full_path = base_path / relative_path / "EN"
        
        print(f"DEBUG: Checking path: {full_path}")
        if full_path.exists():
            print(f"DEBUG: Found existing path: {full_path}")
            return str(full_path)
    
    # If no existing path found, return the most likely path (first pattern)
    default_path = possible_patterns[0][0] / possible_patterns[0][1] / folder_id / "EN"
    print(f"DEBUG: Using default path: {default_path}")
    return str(default_path)
