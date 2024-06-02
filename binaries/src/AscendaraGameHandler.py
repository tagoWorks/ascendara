import json
import os
import subprocess
import sys
import time
import psutil

running = False

def is_process_running(exe_path):
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name'] == os.path.basename(exe_path):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def execute(game_path):
    game_dir, exe_name = os.path.split(game_path)
    print(f"game_dir: {game_dir}, exe_name: {exe_name}")
    exe_path = os.path.join(game_dir, exe_name)
    json_file_path = os.path.join(game_dir, f"{os.path.basename(game_dir)}.ascendara.json")
    print(f"json_file_path: {json_file_path}")
    if not os.path.isfile(exe_path):
        error = "The exe file does not exist"
        with open(json_file_path, "r") as f:
            data = json.load(f)
        data["runError"] = error
        with open(json_file_path, "w") as f:
            json.dump(data, f, indent=4)
        return
    process = subprocess.Popen(exe_path)
    running = True
    while running:
        if os.path.isfile(exe_path):
            with open(json_file_path, "r") as f:
                data = json.load(f)
            data["isRunning"] = is_process_running(exe_path)
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        else:
            running = False
            break

        if process.poll() is not None:
            running = False
            data["isRunning"] = False
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        time.sleep(5)
if __name__ == "__main__":
    _, game_path = sys.argv
    execute(game_path)