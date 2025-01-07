import json
import os
import subprocess
import sys
import time
import psutil
import logging
import argparse
from pypresence import Presence
import asyncio
from datetime import datetime
import traceback

# Constants
CLIENT_ID = '1277379302945718356'

def launch_crash_reporter(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen for better process control
            subprocess.Popen(
                [crash_reporter_path, "gamehandler", str(error_code), error_message],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")
        logging.debug(f"Error details: {traceback.format_exc()}")

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
    try:
        rpc = None
        if is_shortcut:
            rpc = setup_discord_rpc()

        if not os.path.exists(game_path):
            error_msg = f"Game not found at path: {game_path}"
            logging.error(error_msg)
            launch_crash_reporter(1100, str(error_msg))
            return

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
            
            try:
                with open(settings_file, 'r') as f:
                    settings = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError) as e:
                error_msg = f"Failed to read settings file: {str(e)}"
                logging.error(error_msg)
                launch_crash_reporter(1104, str(e))
                return
                
            download_dir = settings.get('downloadDirectory')
            if not download_dir:
                error_msg = 'Download directory not found in ascendarasettings.json'
                logging.error(error_msg)
                launch_crash_reporter(1105, error_msg)
                return
                
            games_file = os.path.join(download_dir, 'games.json')
            try:
                with open(games_file, 'r') as f:
                    games_data = json.load(f)
            except (FileNotFoundError, json.JSONDecodeError) as e:
                error_msg = f"Failed to read games file: {str(e)}"
                logging.error(error_msg)
                launch_crash_reporter(1106, str(e))
                return
                
            game_entry = next((game for game in games_data['games'] if game['executable'] == exe_path), None)
            if game_entry is None:
                error_msg = f"Game not found in games.json for executable path: {exe_path}"
                logging.error(error_msg)
                launch_crash_reporter(1107, error_msg)
                return

        logging.info(f"game_dir: {os.path.dirname(exe_path)}, exe_path: {exe_path}")

        if not os.path.isfile(exe_path):
            error_msg = f"The executable file does not exist: {exe_path}"
            if not is_custom_game:
                try:
                    with open(json_file_path, "r") as f:
                        data = json.load(f)
                    data["runError"] = error_msg
                    with open(json_file_path, "w") as f:
                        json.dump(data, f, indent=4)
                except Exception as e:
                    logging.error(f"Failed to update game json with error: {e}")
            logging.error(error_msg)
            launch_crash_reporter(1101, str(error_msg))
            return

        # Get game name
        if not is_custom_game:
            try:
                with open(json_file_path, "r") as f:
                    game_data = json.load(f)
                game_name = game_data.get('game', os.path.basename(game_dir))
            except Exception as e:
                error_msg = f"Failed to read game data: {str(e)}"
                logging.error(error_msg)
                launch_crash_reporter(1102, str(e))
                return
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
            error_msg = f"Error updating settings.json: {str(e)}"
            logging.error(error_msg)
            launch_crash_reporter(1103, str(e))
            return

        # Update game-specific json
        if not is_custom_game:
            try:
                with open(json_file_path, "r") as f:
                    data = json.load(f)
                data["isRunning"] = True
                with open(json_file_path, "w") as f:
                    json.dump(data, f, indent=4)
            except Exception as e:
                error_msg = f"Error updating game json: {str(e)}"
                logging.error(error_msg)
                launch_crash_reporter(1103, str(e))
                return

        # Run the game process
        try:
            if os.name == 'nt':  # Windows
                process = subprocess.Popen(exe_path, creationflags=subprocess.DETACHED_PROCESS)
            else:  # Unix/Linux
                process = subprocess.Popen(exe_path, start_new_session=True)
        except Exception as e:
            error_msg = f"Failed to launch game process: {str(e)}"
            logging.error(error_msg)
            launch_crash_reporter(1103, str(e))
            return

        running = True
        while running:
            try:
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
                        error_msg = f"Error updating settings.json on exit: {str(e)}"
                        logging.error(error_msg)
                        launch_crash_reporter(1103, str(e))

                    # Update game-specific json
                    if not is_custom_game:
                        try:
                            with open(json_file_path, "r") as f:
                                data = json.load(f)
                            data["isRunning"] = False
                            with open(json_file_path, "w") as f:
                                json.dump(data, f, indent=4)
                        except Exception as e:
                            error_msg = f"Error updating game json on exit: {str(e)}"
                            logging.error(error_msg)
                            launch_crash_reporter(1103, str(e))
                    
                    if is_shortcut and rpc:
                        clear_discord_presence(rpc)

                time.sleep(1)  # Check more frequently
                
            except Exception as e:
                error_msg = f"Error monitoring game process: {str(e)}"
                logging.error(error_msg)
                launch_crash_reporter(1108, str(e))
                running = False
                
    except Exception as e:
        error_msg = f"An unexpected error occurred in execute: {str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        logging.error(error_msg)
        launch_crash_reporter(1109, str(e))

def main():
    try:
        if len(sys.argv) < 2:
            error_msg = "No arguments provided. Required: game_path [--custom-game] [--shortcut]"
            print(error_msg)
            launch_crash_reporter(1109, error_msg)
            sys.exit(1)

        parser = argparse.ArgumentParser(description='Launch and monitor games')
        parser.add_argument('game_path', help='Path to the game executable')
        parser.add_argument('--custom-game', action='store_true', help='Is this a custom game')
        parser.add_argument('--shortcut', action='store_true', help='Is this launched from a shortcut')

        try:
            args = parser.parse_args()
        except Exception as e:
            error_msg = f"Invalid arguments: {str(e)}"
            print(error_msg)
            launch_crash_reporter(1109, error_msg)
            sys.exit(1)

        try:
            execute(args.game_path, args.custom_game, args.shortcut)
        except Exception as e:
            error_msg = f"Failed to execute game: {str(e)}"
            print(error_msg)
            launch_crash_reporter(1109, error_msg)
            sys.exit(1)

    except Exception as e:
        error_msg = f"An unexpected error occurred: {str(e)}\n\nTraceback:\n{traceback.format_exc()}"
        print(error_msg)
        launch_crash_reporter(1109, error_msg)
        sys.exit(1)

if __name__ == "__main__":
    main()