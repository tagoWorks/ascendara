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

    # Get the download directory from the ascendara settings
    user_app_data_dir = os.getenv('APPDATA')
    ascendara_settings_file = os.path.join(user_app_data_dir, 'Ascendara', 'ascendarasettings.json')
    with open(ascendara_settings_file, 'r') as f:
        ascendara_settings = json.load(f)
    download_directory = ascendara_settings['downloadDirectory']

    # Load the games.json file
    games_file = os.path.join(download_directory, 'games.json')
    with open(games_file, 'r') as f:
        games_data = json.load(f)

    # Find the game in the games.json file
    for game in games_data['games']:
        if game['executable'] == exe_path:
            game_index = games_data['games'].index(game)
            break

    if not os.path.isfile(exe_path):
        error = "The exe file does not exist"
        games_data['games'][game_index]['runError'] = error
        with open(games_file, 'w') as f:
            json.dump(games_data, f, indent=4)
        return

    process = subprocess.Popen(exe_path)
    running = True
    while running:
        games_data['games'][game_index]['isRunning'] = is_process_running(exe_path)
        with open(games_file, 'w') as f:
            json.dump(games_data, f, indent=4)

        if process.poll() is not None:
            running = False
            games_data['games'][game_index]['isRunning'] = False
            with open(games_file, 'w') as f:
                json.dump(games_data, f, indent=4)
        time.sleep(5)

def customExecute():
    # Get the user app data directory
    user_app_data_dir = os.getenv('APPDATA')

    # Construct the path to the ascendara settings file
    ascendara_settings_file = os.path.join(user_app_data_dir, 'Ascendara', 'ascendarasettings.json')

    # Load the ascendara settings
    with open(ascendara_settings_file, 'r') as f:
        ascendara_settings = json.load(f)

    # Get the download directory from the settings
    download_directory = ascendara_settings['downloadDirectory']

    # Construct the path to the games.json file
    games_file = os.path.join(download_directory, 'games.json')

    # Load the games.json file
    with open(games_file, 'r') as f:
        games_data = json.load(f)

    # Iterate over the games and execute them
    for game in games_data['games']:
        game_path = game['executable']
        execute(game_path)

if __name__ == "__main__":
    if len(sys.argv) > 1:
        customExecute()
    else:
        game_path = sys.argv[0]
        execute(game_path)