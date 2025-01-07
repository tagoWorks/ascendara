import os
import json
import ssl
import shutil
import string
import sys
import time
import logging
import subprocess
from tempfile import NamedTemporaryFile
import requests
from unrar import rarfile
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
import argparse
from datetime import datetime
import traceback

def launch_crash_reporter(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use subprocess.Popen for better process control
            subprocess.Popen(
                [crash_reporter_path, "maindownloader", str(error_code), error_message],
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")
        logging.debug(f"Error details: {traceback.format_exc()}")

def safe_write_json(filepath, data):
    try:
        temp_dir = os.path.dirname(filepath)
        temp_file_path = None
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
    except Exception as e:
        error_msg = f"Failed to write JSON file {filepath}: {str(e)}"
        logging.error(error_msg)
        launch_crash_reporter(1306, str(e))
        raise

def read_json_file(filepath):
    try:
        with open(filepath, 'r') as f:
            return json.load(f)
    except Exception as e:
        error_msg = f"Failed to read JSON file {filepath}: {str(e)}"
        logging.error(error_msg)
        launch_crash_reporter(1306, str(e))
        raise

def update_game_info(game_info_path, updates):
    try:
        if os.path.exists(game_info_path):
            game_info = read_json_file(game_info_path)
            game_info.update(updates)
            safe_write_json(game_info_path, game_info)
    except Exception as e:
        error_msg = f"Failed to update game info: {str(e)}"
        logging.error(error_msg)
        launch_crash_reporter(1307, str(e))
        raise

def launch_gofile_helper(game, online, dlc, version, size, url, download_dir, password=None):
    try:
        helper_path = os.path.join(os.path.dirname(__file__), 'AscendaraGofileHelper.exe')
        if not os.path.exists(helper_path):
            error_msg = f"GoFile helper not found at: {helper_path}"
            logging.error(error_msg)
            launch_crash_reporter(1308, error_msg)
            return False

        args = [
            helper_path,
            url,
            game,
            str(online).lower(),
            str(dlc).lower(),
            version or "",
            size,
            download_dir
        ]
        
        if password:
            args.extend(["--password", password])

        process = subprocess.Popen(args, creationflags=subprocess.CREATE_NO_WINDOW)
        return_code = process.wait()
        
        if return_code != 0:
            error_msg = f"GoFile helper process failed with return code: {return_code}"
            logging.error(error_msg)
            launch_crash_reporter(1308, error_msg)
            return False
            
        return True
    except Exception as e:
        error_msg = f"Failed to launch GoFile helper: {str(e)}"
        logging.error(error_msg)
        launch_crash_reporter(1308, str(e))
        raise

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")
    return os.path.join(base_path, relative_path)

def sanitize_folder_name(name):
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    sanitized_name = ''.join(c for c in name if c in valid_chars)
    return sanitized_name

def retryfolder(game, online, dlc, version, size, download_dir, newfolder):
    game_info_path = os.path.join(download_dir, f"{game}.ascendara.json")
    newfolder = sanitize_folder_name(newfolder)

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "size": size,
        "executable": os.path.join(download_dir, f"{game}.exe"),
        "isRunning": False,
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressCompleted": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }
    game_info["downloadingData"]["extracting"] = True
    safe_write_json(game_info_path, game_info)

    extracted_folder = os.path.join(download_dir, newfolder)
    tempdownloading = os.path.join(download_dir, f"temp-{os.urandom(6).hex()}")

    if os.path.exists(extracted_folder):
        shutil.copytree(extracted_folder, tempdownloading)
        shutil.rmtree(extracted_folder)
        shutil.copytree(tempdownloading, os.path.join(download_dir), dirs_exist_ok=True)

    for file in os.listdir(os.path.join(download_dir)):
        if file.endswith(".url"):
            os.remove(os.path.join(download_dir, file))

    game_info["downloadingData"]["extracting"] = False
    del game_info["downloadingData"]
    shutil.rmtree(tempdownloading, ignore_errors=True)
    safe_write_json(game_info_path, game_info)

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

class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT@SECLEVEL=1')
        kwargs['ssl_context'] = context 
        return super().init_poolmanager(*args, **kwargs)

def download_file(link, game, online, dlc, version, size, download_dir):
    game = sanitize_folder_name(game)
    download_path = os.path.join(download_dir, game)
    os.makedirs(download_path, exist_ok=True)
    
    game_info_path = os.path.join(download_path, f"{game}.ascendara.json")

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "size": size,
        "executable": os.path.join(download_path, f"{game}.exe"),
        "isRunning": False,
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressCompleted": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }

    def download_with_requests():
        session = requests.Session()
        session.mount('https://', SSLContextAdapter())
        try:
            response = session.get(link, stream=True, timeout=(10, 30))
            response.raise_for_status()
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            # Default to .rar if we can't determine the extension
            archive_ext = "rar"
            content_disposition = response.headers.get('Content-Disposition')
            if content_disposition and 'filename=' in content_disposition:
                filename = content_disposition.split('filename=')[-1].strip('"\'')
                if '.' in filename:
                    archive_ext = filename.split('.')[-1].lower()
            elif '.' in link:
                # Try to get extension from URL as fallback
                possible_ext = link.split('?')[0].split('.')[-1].lower()
                if possible_ext in ['rar', 'zip']:
                    archive_ext = possible_ext

            archive_file_path = os.path.join(download_path, f"{game}.{archive_ext}")
            total_size = int(response.headers.get('content-length', 0) or 0)
            block_size = 1024 * 1024
            downloaded_size = 0
            game_info["downloadingData"]["downloading"] = True
            start_time = time.time()

            safe_write_json(game_info_path, game_info)

            with open(archive_file_path, "wb") as file:
                for data in response.iter_content(block_size):
                    if not data:
                        break
                    file.write(data)
                    downloaded_size += len(data)
                    progress = downloaded_size / total_size if total_size > 0 else 0
                    game_info["downloadingData"]["progressCompleted"] = f"{progress * 100:.2f}"

                    elapsed_time = time.time() - start_time
                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                    if download_speed < 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                    elif download_speed < 1024 * 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                    else:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                    remaining_size = total_size - downloaded_size
                    if download_speed > 0:
                        time_until_complete = remaining_size / download_speed
                        minutes, seconds = divmod(time_until_complete, 60)
                        hours, minutes = divmod(minutes, 60)
                        if hours > 0:
                            game_info["downloadingData"]["timeUntilComplete"] = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
                        else:
                            game_info["downloadingData"]["timeUntilComplete"] = f"{int(minutes)}m {int(seconds)}s"
                    else:
                        game_info["downloadingData"]["timeUntilComplete"] = "Calculating..."

                    safe_write_json(game_info_path, game_info)

            game_info["downloadingData"]["downloading"] = False
            game_info["downloadingData"]["extracting"] = True
            safe_write_json(game_info_path, game_info)
            return archive_file_path, archive_ext
        except Exception as e:
            handleerror(game_info, game_info_path, e)
            raise e
        finally:
            session.close()

    safe_write_json(game_info_path, game_info)

    try:
        archive_file_path, archive_ext = download_with_requests()

        try:
            if archive_ext == "rar":
                with rarfile.RarFile(archive_file_path, 'r') as fs:
                    fs.extractall(download_path)
            elif archive_ext == "zip":
                shutil.unpack_archive(archive_file_path, download_path, format="zip")
            os.remove(archive_file_path)
            game_info["downloadingData"]["extracting"] = False

            # Clean up extracted files
            for file in os.listdir(download_path):
                if file.endswith(".url") or file.endswith(".txt"):
                    os.remove(os.path.join(download_path, file))

            extracted_folder = os.path.join(download_path, game)
            tempdownloading = os.path.join(download_path, f"temp-{os.urandom(6).hex()}")
            if os.path.exists(extracted_folder):
                shutil.copytree(extracted_folder, tempdownloading)
                shutil.rmtree(extracted_folder)
                shutil.copytree(tempdownloading, download_path, dirs_exist_ok=True)
                shutil.rmtree(tempdownloading, ignore_errors=True)

            del game_info["downloadingData"]
            safe_write_json(game_info_path, game_info)


        except Exception as e:
            handleerror(game_info, game_info_path, e)
            raise e

    except Exception as e:
        print(f"Failed to download or extract {game}. Error: {e}")

def parse_boolean(value):
    """Helper function to parse boolean values from command-line arguments."""
    if value.lower() in ['true', '1', 'yes']:
        return True
    elif value.lower() in ['false', '0', 'no']:
        return False
    else:
        raise argparse.ArgumentTypeError(f"Invalid boolean value: {value}")

def main():
    try:
        if len(sys.argv) < 2:
            error_msg = "No arguments provided. Required: link game online dlc version size download_dir"
            print(error_msg)
            launch_crash_reporter(1300, error_msg)
            sys.exit(1)

        parser = argparse.ArgumentParser(description="Download and manage game files.")
        parser.add_argument("link", help="URL of the file to download")
        parser.add_argument("game", help="Name of the game")
        parser.add_argument("online", type=parse_boolean, help="Is the game online (true/false)?")
        parser.add_argument("dlc", type=parse_boolean, help="Is DLC included (true/false)?")
        parser.add_argument("version", help="Version of the game")
        parser.add_argument("size", help="Size of the file in (ex: 12 GB, 439 MB)")
        parser.add_argument("download_dir", help="Directory to save the downloaded files")

        try:
            args = parser.parse_args()
        except Exception as e:
            error_msg = f"Invalid arguments: {str(e)}"
            print(error_msg)
            launch_crash_reporter(1300, error_msg)
            sys.exit(1)

        try:
            download_file(args.link, args.game, args.online, args.dlc, args.version, args.size, args.download_dir)
        except Exception as e:
            error_msg = f"Download failed: {str(e)}"
            print(error_msg)
            launch_crash_reporter(1300, error_msg)
            sys.exit(1)

    except Exception as e:
        error_msg = f"An unexpected error occurred: {str(e)}"
        print(error_msg)
        launch_crash_reporter(1300, error_msg)
        sys.exit(1)

if __name__ == "__main__":
    main()