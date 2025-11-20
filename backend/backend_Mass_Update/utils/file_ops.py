import os
import shutil

def copy_ppt_files(input_dir, output_dir):
    """
    Copies all .pptx files from input_dir to output_dir.
    Returns a list of copied file paths.
    """
    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
    copied_files = []
    for filename in os.listdir(input_dir):
        if filename.lower().endswith('.pptx'):
            src = os.path.join(input_dir, filename)
            dst = os.path.join(output_dir, filename)
            shutil.copy2(src, dst)
            copied_files.append(dst)
    return copied_files
