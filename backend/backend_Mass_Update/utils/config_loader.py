import os


def load_replacements(config_path):
    """
    Loads key-value pairs from a property file for text replacements.
    Returns a dictionary: {old_word: new_word}

    This function is intentionally tolerant:
    - Reads file with 'utf-8-sig' to tolerate BOMs.
    - Normalizes CR/LF variations.
    - Skips blank lines and comment lines starting with '#'.
    - Reports malformed lines (no '=' present) via printed warnings.
    - If duplicate keys appear, later values overwrite earlier ones but a warning is printed.
    """
    replacements = {}
    if not os.path.exists(config_path):
        raise FileNotFoundError(f"Config file not found: {config_path}")

    # Try to read with utf-8-sig (handles BOM). If that fails, fall back to latin-1.
    text = None
    try:
        with open(config_path, 'r', encoding='utf-8-sig') as f:
            text = f.read()
    except Exception:
        # Fallback to latin-1 to ensure we can at least parse something
        with open(config_path, 'r', encoding='latin-1') as f:
            text = f.read()

    # Normalize newlines and split into logical lines
    text = text.replace('\r\n', '\n').replace('\r', '\n')
    lines = text.split('\n')

    import re

    malformed = []
    duplicates = []
    for idx, raw in enumerate(lines, start=1):
        # Remove common invisible/zero-width characters that may appear before the '#'
        cleaned_start = raw.lstrip('\ufeff\u200b\u200e\u200f \t')

        # If the first non-whitespace character is '#', treat the whole line as a comment
        if re.match(r'^\s*#', raw):
            continue

        # Trim surrounding whitespace for parsing
        line = raw.strip()
        if not line:
            continue

        if '=' not in line:
            malformed.append((idx, raw))
            continue

        old, new = line.split('=', 1)
        key = old.strip()
        val = new.strip()

        if not key:
            malformed.append((idx, raw))
            continue

        if key in replacements and replacements[key] != val:
            duplicates.append((idx, key))
            print(f"Warning: duplicate key on line {idx}: '{key}' (overwriting previous value)")

        replacements[key] = val

    if malformed:
        print(f"Warning: {len(malformed)} malformed line(s) in config file '{config_path}':")
        for idx, raw in malformed:
            print(f"  line {idx}: {repr(raw)}")

    if duplicates:
        print(f"Note: {len(duplicates)} duplicate key(s) were encountered (see warnings above).")

    # Detect inverse/conflicting mappings (A->B and B->A). These create ambiguous behavior.
    inverses = []
    for a, b in list(replacements.items()):
        # Only consider inverse if both keys are present and mapping back points to a
        if b in replacements and replacements.get(b) == a:
            inverses.append((a, b))

    if inverses:
        pairs = ', '.join([f"'{a}'<->'{b}'" for a, b in inverses])
        raise ValueError(
            f"Inverse/conflicting replacement pairs found in config '{config_path}': {pairs}.\n"
            "Please remove or comment out one side of each pair to avoid ambiguous replacements."
        )

    return replacements
