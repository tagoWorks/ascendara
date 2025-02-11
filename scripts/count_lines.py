# This script counts the number of lines of code used in Ascendara, including
# all files in the src, installer, build, and binaries directories. It excludes
# any whitespace lines (lines that are just indented) by default.

# View the results of the latest count in 'lineCountResult.txt'.

import os

def count_lines_in_file(filepath):
    """Count non-empty lines in a file."""
    try:
        with open(filepath, 'r', encoding='utf-8') as file:
            # Read lines and filter out whitespace-only lines
            lines = [line.strip() for line in file if line.strip()]
            return len(lines)
    except Exception as e:
        print(f"Error reading {filepath}: {e}")
        return 0

def main():
    # File extensions to look for
    target_extensions = {'.css', '.jsx', '.js', '.html', '.py'}
    
    # Target directories
    target_directories = ['src', 'installer', 'build', 'binaries']
    
    # Initialize counters
    total_lines = 0
    file_counts = {ext: 0 for ext in target_extensions}
    line_counts = {ext: 0 for ext in target_extensions}
    dir_counts = {dir: 0 for dir in target_directories}
    
    # Get the project root directory (one level up from scripts)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)  # Go up one directory
    
    # Process each target directory
    for target_dir in target_directories:
        dir_path = os.path.join(project_root, target_dir)
        if not os.path.exists(dir_path):
            print(f"Warning: Directory '{target_dir}' not found")
            continue
            
        print(f"\nProcessing directory: {target_dir}")
        dir_line_count = 0
        
        # Walk through directory
        for root, _, files in os.walk(dir_path):
            for file in files:
                # Skip files in any path containing 'debian'
                if 'debian' in root.replace('\\', '/').lower():
                    continue
                    
                ext = os.path.splitext(file)[1].lower()
                if ext in target_extensions:
                    filepath = os.path.join(root, file)
                    lines = count_lines_in_file(filepath)
                    total_lines += lines
                    dir_line_count += lines
                    file_counts[ext] += 1
                    line_counts[ext] += lines
        
        dir_counts[target_dir] = dir_line_count
    
    # Print results
    print("\nCode Line Count Summary:")
    print("-" * 50)
    for ext in target_extensions:
        if file_counts[ext] > 0:
            print(f"{ext[1:]:>4} files: {file_counts[ext]:>5} files, {line_counts[ext]:>6} lines")
    
    print("\nLines by Directory:")
    print("-" * 50)
    for dir_name, count in dir_counts.items():
        print(f"{dir_name:>9}: {count:>6} lines")
    
    print("\nTotal Summary:")
    print("-" * 50)
    print(f"Total: {sum(file_counts.values()):>5} files, {total_lines:>6} lines")

if __name__ == "__main__":
    main()
