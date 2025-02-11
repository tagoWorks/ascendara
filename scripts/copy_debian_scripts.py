# This script is used to easily and quickly copy the scripts to the debian folder
# The debian folder is for Linux/Mac users and allows the script to be run with python3


import os
import shutil

def copy_scripts_to_debian():
    # Get the binaries directory path
    script_dir = os.path.dirname(os.path.abspath(__file__))
    binaries_dir = os.path.join(os.path.dirname(script_dir), 'binaries')
    
    # Get the AscendaraDownloader directory
    downloader_dir = os.path.join(binaries_dir, 'AscendaraDownloader')
    src_dir = os.path.join(downloader_dir, 'src')
    
    if not os.path.isdir(src_dir):
        print("Warning: No src directory found in AscendaraDownloader")
        return
    
    # Create or clear debian directory
    debian_dir = os.path.join(src_dir, 'debian')
    if os.path.exists(debian_dir):
        # Remove all files in debian directory
        for file in os.listdir(debian_dir):
            file_path = os.path.join(debian_dir, file)
            if os.path.isfile(file_path):
                os.remove(file_path)
                print(f"Removed existing file: {file}")
    else:
        os.makedirs(debian_dir)
    
    # List of scripts to copy
    scripts = ['AscendaraDownloader.py', 'AscendaraGofileHelper.py']
    
    # Copy each script
    for script in scripts:
        script_path = os.path.join(src_dir, script)
        if not os.path.exists(script_path):
            print(f"Warning: No {script} found in {src_dir}")
            continue
            
        dest_path = os.path.join(debian_dir, script)
        shutil.copy2(script_path, dest_path)
        print(f"Copied {script} to {dest_path}")

if __name__ == '__main__':
    copy_scripts_to_debian()
