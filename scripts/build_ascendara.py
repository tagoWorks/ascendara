# This script is used to easily and quickly build Ascendara from source to EXE

import os
import subprocess
import shutil
import re

def run_npm_build():
    print("Running npm build...")
    try:
        npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'
        subprocess.run([npm_cmd, 'run', 'build'], check=True, cwd=os.getcwd())
        print("Build completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Build failed with error: {e}")
        return False

def run_electron_builder():
    print("Running electron-builder...")
    try:
        npm_cmd = 'npm.cmd' if os.name == 'nt' else 'npm'
        subprocess.run([npm_cmd, 'run', 'buildwithelectron'], check=True, cwd=os.getcwd())
        print("Electron build completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Electron build failed with error: {e}")
        return False

def modify_index_html():
    print("Modifying index.html...")
    src_index_path = 'src/dist/index.html'
    
    try:
        if not os.path.exists(src_index_path):
            print(f"Error: {src_index_path} does not exist")
            return False
            
        with open(src_index_path, 'r', encoding='utf-8') as file:
            content = file.read()
        
        modified_content = re.sub(r'"/assets/', '"', content)
        
        with open(src_index_path, 'w', encoding='utf-8') as file:
            file.write(modified_content)
        print("index.html modified successfully")
        return True
    except Exception as e:
        print(f"Failed to modify index.html: {e}")
        return False

def move_files():
    print("Moving files to build directory...")
    try:
        if os.path.exists('build/index.html'):
            os.system("cls" if os.name == 'nt' else "clear")
            
        os.makedirs('build', exist_ok=True)
        
        if not os.path.exists('src/dist/index.html'):
            print("Error: src/dist/index.html not found")
            return False
            
        if not os.path.exists('src/dist/assets'):
            print("Error: src/dist/assets directory not found")
            return False
        
        # Move index.html
        shutil.move('src/dist/index.html', 'build/index.html')
        
        # Move all files from assets directory
        assets_dir = 'src/dist/assets'
        for file in os.listdir(assets_dir):
            src_path = os.path.join(assets_dir, file)
            dst_path = os.path.join('build', file)
            shutil.move(src_path, dst_path)

        # Guide directory
        guide_dir = 'src/dist/guide'
        for file in os.listdir(guide_dir):
            src_path = os.path.join(guide_dir, file)
            os.makedirs(os.path.join('build', 'guide'), exist_ok=True)
            dst_path = os.path.join('build', 'guide', file)
            shutil.move(src_path, dst_path)

        # Move icon.png and no-image.png if they exist
        image_files = ['icon.png', 'no-image.png']
        for image in image_files:
            src_path = os.path.join('src/dist', image)
            if os.path.exists(src_path):
                dst_path = os.path.join('build', image)
                shutil.move(src_path, dst_path)
            else:
                print(f"Warning: {image} not found in src/dist/")
            
        print("Files moved successfully")
        return True
    except Exception as e:
        print(f"Failed to move files: {e}")
        return False

def main():
    print("Buliding Ascendara from source to EXE...")  
    if not run_npm_build():
        return
    
    if not modify_index_html():
        return
    
    if not move_files():
        return
    
    if not run_electron_builder():
        return
    
    print("Build process complete.")

if __name__ == "__main__":
    main()
