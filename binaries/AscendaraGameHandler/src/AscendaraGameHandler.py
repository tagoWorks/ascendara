# ==============================================================================
# Ascendara Game Handler
# ==============================================================================
# Game process manager for the Ascendara Game Launcher. Handles game execution,
# process monitoring, and Discord Rich Presence integration.
# Read more about the Game Handler here:
# https://ascendara.app/docs/developer/game-handler










import os
import sys
import time
import json
import logging
import atexit
import subprocess
from pypresence import Presence
import argparse
import psutil
import asyncio
from datetime import datetime

CLIENT_ID = '1277379302945718356'

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [crash_reporter_path, "maindownloader", str(error_code), error_message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    """Register the crash reporter to launch on exit with the given error details"""
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

def setup_discord_rpc():
    try:
        rpc = Presence(CLIENT_ID)
        rpc.connect()
        return rpc
    except Exception as e:
        logging.error(f"Failed to connect to Discord RPC: {e}")
        return None

def update_discord_presence(rpc, game_name):
    if rpc:
        try:
            rpc.update(
                details="Playing a Game",
                state=game_name,
                start=int(time.time()),
                large_image="ascendara",
                large_text="Ascendara",
                buttons=[{"label": "Play on Ascendara", "url": "https://ascendara.app/"}]
            )
        except Exception as e:
            logging.error(f"Failed to update Discord presence: {e}")

def clear_discord_presence(rpc):
    if rpc:
        try:
            rpc.clear()
            rpc.close()
        except Exception as e:
            logging.error(f"Failed to clear Discord presence: {e}")

def is_process_running(exe_path):
    for proc in psutil.process_iter(['name']):
        try:
            if proc.info['name'] == os.path.basename(exe_path):
                return True
        except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
            pass
    return False

def execute(game_path, is_custom_game, is_shortcut=False):
    rpc = None
    if is_shortcut:
        rpc = setup_discord_rpc()

    if not is_custom_game:
        game_dir, exe_name = os.path.split(game_path)
        exe_path = os.path.join(game_dir, exe_name)
        
        # Try the current directory first
        game_name = os.path.basename(game_dir)
        json_file_path = os.path.join(game_dir, f"{game_name}.ascendara.json")
        
        # If not found, try one level up (for versioned games)
        if not os.path.exists(json_file_path):
            parent_dir = os.path.dirname(game_dir)
            parent_name = os.path.basename(parent_dir)
            json_file_path = os.path.join(parent_dir, f"{parent_name}.ascendara.json")
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

    # Update running status in both files before launching
    if not is_custom_game:
        with open(json_file_path, "r") as f:
            game_data = json.load(f)
        game_name = game_data.get('game', os.path.basename(game_dir))
    else:
        game_name = game_entry['game']

    if is_shortcut and rpc:
        update_discord_presence(rpc, game_name)

    # Update settings.json
    try:
        with open(settings_file, 'r') as f:
            settings_data = json.load(f)
        if 'runningGames' not in settings_data:
            settings_data['runningGames'] = {}
        settings_data['runningGames'][game_name] = True
        with open(settings_file, 'w') as f:
            json.dump(settings_data, f, indent=4)
    except Exception as e:
        logging.error(f"Error updating settings.json: {e}")

    # Update game-specific json
    if not is_custom_game:
        try:
            with open(json_file_path, "r") as f:
                data = json.load(f)
            data["isRunning"] = True
            with open(json_file_path, "w") as f:
                json.dump(data, f, indent=4)
        except Exception as e:
            logging.error(f"Error updating game json: {e}")

    # Run the game process separately from the executable process
    if os.name == 'nt':  # Windows
        process = subprocess.Popen(exe_path, creationflags=subprocess.DETACHED_PROCESS)
    else:  # Unix/Linux
        process = subprocess.Popen(exe_path, start_new_session=True)

    running = True
    while running:
        if process.poll() is not None:
            running = False
            # Update settings.json
            try:
                with open(settings_file, 'r') as f:
                    settings_data = json.load(f)
                if 'runningGames' in settings_data:
                    if game_name in settings_data['runningGames']:
                        del settings_data['runningGames'][game_name]
                with open(settings_file, 'w') as f:
                    json.dump(settings_data, f, indent=4)
            except Exception as e:
                logging.error(f"Error updating settings.json on exit: {e}")

            # Update game-specific json
            if not is_custom_game:
                try:
                    with open(json_file_path, "r") as f:
                        data = json.load(f)
                    data["isRunning"] = False
                    with open(json_file_path, "w") as f:
                        json.dump(data, f, indent=4)
                except Exception as e:
                    logging.error(f"Error updating game json on exit: {e}")
            
            if is_shortcut and rpc:
                clear_discord_presence(rpc)

        time.sleep(1)  # Check more frequently

if __name__ == "__main__":
    # The script is called with: [script] [game_path] [is_custom_game] [--shortcut]
    # Skip the first argument (script name)
    args = sys.argv[1:]
    
    if len(args) < 2:
        print("Error: Not enough arguments")
        print("Usage: AscendaraGameHandler.exe [game_path] [is_custom_game] [--shortcut]")
        sys.exit(1)
        
    game_path = args[0]
    is_custom_game = args[1] == '1' or args[1].lower() == 'true'
    is_shortcut = "--shortcut" in args

    # Configure logging
    log_file = os.path.join(os.path.dirname(__file__), 'gamehandler.log')
    logging.basicConfig(filename=log_file, level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

    try:
        execute(game_path, is_custom_game, is_shortcut)
    except Exception as e:
        logging.error(f"Failed to execute game: {e}")
        atexit.register(launch_crash_reporter, 1, str(e))
