import os
from utils.config_loader import load_replacements
from utils.file_ops import copy_ppt_files
from utils.ppt_processor import update_ppt_text

# Get the directory where this script is located
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(SCRIPT_DIR, 'config', 'replace.properties')
INPUT_DIR = os.path.join(SCRIPT_DIR, 'input')
OUTPUT_DIR = os.path.join(SCRIPT_DIR, 'output')

def main():
    print("\n=== PPT Mass Update Tool ===\n")
    # Load replacements
    try:
        import os
        try:
            stat = os.stat(CONFIG_PATH)
            print(f"Loading config: {CONFIG_PATH} (size={stat.st_size} bytes, mtime={stat.st_mtime})")
        except Exception:
            print(f"Loading config: {CONFIG_PATH}")
        replacements = load_replacements(CONFIG_PATH)
    except Exception as e:
        print(f"Error loading config: {e}")
        return
    print(f"Loaded replacements: {replacements}\n")
    # Copy files
    copied_files = copy_ppt_files(INPUT_DIR, OUTPUT_DIR)
    print(f"Copied {len(copied_files)} PPT files to output folder.\n")
    # Update files
    updated_count = 0
    for ppt_path in copied_files:
        print(f"Processing: {ppt_path}")
        try:
            updated = update_ppt_text(ppt_path, replacements)
            if updated:
                print("  Updated.")
                updated_count += 1
            else:
                print("  No changes needed.")
        except Exception as e:
            print(f"  Error: {e}")
    print(f"\nProcess complete!\nTotal files processed: {len(copied_files)}\nFiles updated: {updated_count}\n")

if __name__ == "__main__":
    main()
