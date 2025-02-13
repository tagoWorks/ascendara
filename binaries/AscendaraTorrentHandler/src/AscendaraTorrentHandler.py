# ==============================================================================
# Ascendara Torrent Handler
# ==============================================================================
# A command-line tool for handling Ascendara torrents
# Read more about the Torrent Handler Tool here:
# https://ascendara.app/docs/developer/torrent-handler






import os
import json
import sys
import atexit
import time
import threading
from tempfile import NamedTemporaryFile
import logging
import qbittorrentapi
import argparse

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            cmd = f'cmd.exe /c START /B "" "{crash_reporter_path}" maintorrent {error_code} "{error_message}"'
            os.system(cmd)
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def safe_write_json(filepath, data):
    temp_dir = os.path.dirname(filepath)
    temp_file_path = None
    try:
        with NamedTemporaryFile('w', delete=False, dir=temp_dir) as temp_file:
            json.dump(data, temp_file, indent=4)
            temp_file_path = temp_file.name
        retry_attempts = 3
        for attempt in range(retry_attempts):
            try:
                os.replace(temp_file_path, filepath)
                break
            except PermissionError as e:
                if attempt < retry_attempts - 1:
                    time.sleep(1)
                else:
                    raise e
    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def handleerror(game_info, game_info_path, e):
    game_info['online'] = ""
    game_info['dlc'] = ""
    game_info['isRunning'] = False
    game_info['version'] = ""
    game_info['executable'] = ""
    game_info['downloadingData'] = {
        "error": True,
        "message": str(e)
    }
    safe_write_json(game_info_path, game_info)

class TorrentManager:
    def __init__(self):
        # Connect to local qBittorrent Web UI
        self.qbt_client = qbittorrentapi.Client(
            host='localhost',
            port=8080,
            username='admin',  # Default credentials
            password='adminadmin'
        )
        try:
            self.qbt_client.auth_log_in()
        except qbittorrentapi.LoginFailed as e:
            raise Exception("Failed to connect to qBittorrent. Make sure it's running with Web UI enabled.") from e
        
    def download_torrent(self, magnet_link, game, online, dlc, version, size, download_dir):
        game_info_path = os.path.join(download_dir, f"{game}.ascendara.json")
        
        game_info = {
            "game": game,
            "online": online,
            "dlc": dlc,
            "version": version if version else "",
            "size": size,
            "executable": os.path.join(download_dir, f"{game}.exe"),
            "isRunning": False,
            "downloadingData": {
                "downloading": True,
                "extracting": False,
                "updating": False,
                "progressCompleted": "0.00",
                "progressDownloadSpeeds": "0.00 KB/s",
                "timeUntilComplete": "0s"
            }
        }
        
        safe_write_json(game_info_path, game_info)
        
        try:
            # Add the torrent to qBittorrent
            self.qbt_client.torrents_add(
                urls=magnet_link,
                save_path=download_dir,
                use_auto_torrent_management=False,
                sequential_download=True
            )
            
            # Get the torrent hash from the magnet link
            torrent_hash = magnet_link.split('&')[0].split(':')[-1]
            
            while True:
                # Get torrent info
                torrent = self.qbt_client.torrents_info(torrent_hashes=torrent_hash)[0]
                
                if torrent.state_enum.is_complete:
                    break
                
                # Update progress
                progress = torrent.progress * 100
                download_rate = torrent.dlspeed / 1024  # KB/s
                if torrent.dlspeed > 0:
                    eta_seconds = torrent.eta
                else:
                    eta_seconds = 0
                
                game_info["downloadingData"].update({
                    "progressCompleted": f"{progress:.2f}",
                    "progressDownloadSpeeds": f"{download_rate:.2f} KB/s",
                    "timeUntilComplete": f"{int(eta_seconds)}s"
                })
                
                safe_write_json(game_info_path, game_info)
                time.sleep(1)
            
            # Download complete, now find and run setup
            game_info["downloadingData"]["downloading"] = False
            game_info["downloadingData"]["extracting"] = True
            safe_write_json(game_info_path, game_info)

            # Find setup executable
            setup_file = None
            torrent_folder = os.path.join(download_dir, torrent.name)
            for file in os.listdir(torrent_folder):
                if file.lower().startswith(('setup', game.lower())) and file.lower().endswith('.exe'):
                    setup_file = os.path.join(torrent_folder, file)
                    break
            
            if not setup_file:
                raise Exception("Could not find setup executable")

            # Run setup silently with target directory
            install_dir = os.path.join(download_dir, game)
            os.makedirs(install_dir, exist_ok=True)
            
            # Run setup and wait for completion
            import subprocess
            process = subprocess.Popen([setup_file, '/VERYSILENT', f'/DIR="{install_dir}"'], 
                                    stdout=subprocess.PIPE, 
                                    stderr=subprocess.PIPE)
            
            while process.poll() is None:
                time.sleep(1)
                game_info["downloadingData"]["extracting"] = True
                safe_write_json(game_info_path, game_info)

            if process.returncode != 0:
                raise Exception(f"Setup failed with code {process.returncode}")

            # Update game info with final path
            game_info["downloadingData"]["extracting"] = False
            del game_info["downloadingData"]
            game_info["executable"] = os.path.join(install_dir, f"{game}.exe")
            safe_write_json(game_info_path, game_info)
            
        except Exception as e:
            handleerror(game_info, game_info_path, e)
            launch_crash_reporter(1, str(e))
            raise

def parse_boolean(value):
    if isinstance(value, bool):
        return value
    if value.lower() in ('true', 't', 'yes', 'y', '1'):
        return True
    if value.lower() in ('false', 'f', 'no', 'n', '0'):
        return False
    raise argparse.ArgumentTypeError('Boolean value expected.')

def main():
    parser = argparse.ArgumentParser(description='Ascendara Torrent Handler')
    parser.add_argument('--magnet', required=True, help='Magnet link to download')
    parser.add_argument('--game', required=True, help='Game name')
    parser.add_argument('--online', type=parse_boolean, default=False, help='Is online game')
    parser.add_argument('--dlc', type=parse_boolean, default=False, help='Is DLC')
    parser.add_argument('--version', help='Game version')
    parser.add_argument('--size', required=True, help='Download size')
    parser.add_argument('--dir', required=True, help='Download directory')
    
    args = parser.parse_args()
    
    torrent_manager = TorrentManager()
    torrent_manager.download_torrent(
        args.magnet,
        args.game,
        args.online,
        args.dlc,
        args.version,
        args.size,
        args.dir
    )

if __name__ == "__main__":
    main()