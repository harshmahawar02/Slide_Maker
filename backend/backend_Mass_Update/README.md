# PPT Mass Update Tool

Update text across multiple PowerPoint files (.pptx) using a simple properties file. The tool copies presentations from `input/` to `output/` and performs safe, in-place text replacements in slides and table cells.

## Features
- Replaces text in all text boxes and table cells.
- Handles text split across runs (e.g., bold/italic parts) within a paragraph.
- Keeps run/style containers intact (new text is applied to the first run; others are cleared to preserve styling structure).
- Ignores comments and blank lines in config; warns on malformed lines and duplicate keys.
- Detects inverse/conflicting mappings (e.g., `A=B` and `B=A`) and fails fast with a clear error.

## Requirements
- Python 3.x
- Package: `python-pptx`

Install dependency:

```powershell
pip install --user python-pptx
```

## Project structure
- `input/` — Put source .pptx files here (only .pptx is processed).
- `output/` — Processed files are written here (copied from input, then updated).
- `config/replace.properties` — Text replacement rules.
- `utils/` — Modules for config parsing, file copying, and PPT processing.
- `main.py` — Entry point for the full workflow.

## Configuration file format (`config/replace.properties`)
- One mapping per line: `old_text=new_text`
- Lines starting with `#` are treated as comments
- Blank lines are ignored
- Duplicate keys: later values overwrite earlier ones (a warning is printed)
- Malformed lines (without `=`) are ignored (a warning is printed)
- Inverse/conflicting pairs (e.g., `A=B` and `B=A`) raise an error to prevent ambiguous results

Example:

```
John Doe=Jane Smith
Presented by :=Presented by : Jane Smith
Improve=Improved
Process=Procedure
```

## How it works (high level)
1. Copies all `.pptx` files from `input/` to `output/`.
2. Loads replacements from `config/replace.properties` with tolerant parsing.
3. For each file in `output/`, replaces text in:
	 - Shapes with text frames (slide text boxes)
	 - Table cells (all rows/columns)
4. Replacements are applied per paragraph by concatenating run texts, performing replacements, then writing the new text back into the paragraph while keeping the run containers.

## Run the tool
From any working directory (paths are resolved relative to `main.py`):

```powershell
python c:\Users\I755488\Desktop\ppt_mass_update_table\ppt_mass_update\main.py
# or, if you are already in the project folder:
cd c:\Users\I755488\Desktop\ppt_mass_update_table\ppt_mass_update
py .\main.py
```

Outputs will be written to `output/`.

## Testing
Run unit tests (validates config parsing and cross-run/table replacements):

```powershell
cd c:\Users\I755488\Desktop\ppt_mass_update_table\ppt_mass_update
python -m unittest -v
```

## Troubleshooting
- Error: `Config file not found: config\replace.properties`
	- Ensure you have `config/replace.properties` next to `main.py`, or run `main.py` as shown above (the script resolves paths relative to itself).

- Error about inverse/conflicting pairs
	- Remove one side of mappings like `A=B` and `B=A` to avoid ambiguity.

- No files updated
	- Confirm your files are `.pptx` (not `.ppt`).
	- Verify the exact text (including spaces/case) exists in the presentations.

- `ModuleNotFoundError: No module named 'pptx'`
	- Install python-pptx: `pip install --user python-pptx`

## Notes
- Only `.pptx` files are processed.
