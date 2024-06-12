import json
import os
import subprocess
import sys
import time
import psutil
import logging

def is_process_running(exe_path):
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name'] == os.path.basename(exe_path):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def execute(game_path, is_custom_game):
    if not is_custom_game:
        game_dir, exe_name = os.path.split(game_path)
        exe_path = os.path.join(game_dir, exe_name)
        json_file_path = os.path.join(game_dir, f"{os.path.basename(game_dir)}.ascendara.json")
    else:
        exe_path = game_path
        user_data_dir = os.path.join(os.environ['APPDATA'], 'ascendara')
        settings_file = os.path.join(user_data_dir, 'ascendarasettings.json')
        with open(settings_file, 'r') as f:
            settings = json.load(f)
        download_dir = settings.get('downloadDirectory')
        if not download_dir:
            logging.error('Download directory not found in ascendarasettings.json')
            return
        games_file = os.path.join(download_dir, 'games.json')
        with open(games_file, 'r') as f:
            games_data = json.load(f)
        game_entry = next((game for game in games_data['games'] if game['executable'] == exe_path), None)
        if game_entry is None:
            logging.error(f"Game not found in games.json for executable path: {exe_path}")
            return

    logging.info(f"game_dir: {os.path.dirname(exe_path)}, exe_path: {exe_path}")

    if not os.path.isfile(exe_path):
        error = "The exe file does not exist"
        if not is_custom_game:
            with open(json_file_path, "r") as f:
                data = json.load(f)
            data["runError"] = error
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        else:
            logging.error(error)
        return

    process = subprocess.Popen(exe_path)
    running = True
    while running:
        if os.path.isfile(exe_path):
            if not is_custom_game:
                with open(json_file_path, "r") as f:
                    data = json.load(f)
                data["isRunning"] = is_process_running(exe_path)
                with open(json_file_path, "w") as f:
                    json.dump(data, f, indent=4)
            else:
                pass  # No need to update the game info file for custom games

        if process.poll() is not None:
            running = False
            if not is_custom_game:
                data["isRunning"] = False
                with open(json_file_path, "w") as f:
                    json.dump(data, f, indent=4)
        time.sleep(5)

if __name__ == "__main__":
    _, game_path, is_custom_game_str = sys.argv

    # Configure logging
    log_file = os.path.join(os.path.dirname(__file__), 'gamehandler.log')
    logging.basicConfig(filename=log_file, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    is_custom_game = is_custom_game_str.lower() == 'true'
    execute(game_path, is_custom_game)