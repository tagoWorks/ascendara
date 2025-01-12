# ==============================================================================
# Ascendara GoFile Helper
# ==============================================================================
# Specialized downloader component for handling GoFile.io downloads in Ascendara.
# Manages authentication, file downloads, and extraction with multi-threading
# support. Read more about the GoFile Helper Tool here:
# https://ascendara.app/docs/developer/gofile-helper










import os
import json
import sys
import time
import shutil
import signal
from tempfile import NamedTemporaryFile
import requests
import atexit
from concurrent.futures import ThreadPoolExecutor
from threading import Lock, Event
from hashlib import sha256
from argparse import ArgumentParser, ArgumentTypeError
from unrar import rarfile
import logging

NEW_LINE = "\n" if sys.platform != "Windows" else "\r\n"
IS_DEV = False  # Development mode flag
stop_event = Event()

def signal_handler(signum, frame):
    print("\nReceived stop signal. Stopping downloads gracefully...")
    stop_event.set()

signal.signal(signal.SIGINT, signal_handler)
signal.signal(signal.SIGTERM, signal_handler)

def _launch_crash_reporter_on_exit(error_code, error_message):
    try:
        crash_reporter_path = os.path.join('./AscendaraCrashReporter.exe')
        if os.path.exists(crash_reporter_path):
            # Use cmd.exe with START to hide console
            cmd = f'cmd.exe /c START /B "" "{crash_reporter_path}" maindownloader {error_code} "{error_message}"'
            os.system(cmd)
        else:
            logging.error(f"Crash reporter not found at: {crash_reporter_path}")
    except Exception as e:
        logging.error(f"Failed to launch crash reporter: {e}")

def launch_crash_reporter(error_code, error_message):
    # Only register once
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

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

class GofileDownloader:
    def __init__(self, game, online, dlc, version, size, download_dir):
        self._max_retries = 3
        self._download_timeout = 30 
        self._token = self._getToken()
        
        # Read thread count from settings
        try:
            settings_path = os.path.join(os.getenv('APPDATA'), 'ascendara', 'ascendarasettings.json')
            if os.path.exists(settings_path):
                with open(settings_path, 'r') as f:
                    settings = json.load(f)
                    self._max_workers = settings.get('threadCount', 32)
            else:
                self._max_workers = 32
        except Exception:
            self._max_workers = 32
            
        self._lock = Lock()
        self._last_progress = 0
        self._last_speed = 0
        self._speed_samples = []
        self._MAX_SPEED_SAMPLES = 5  # Use last 5 samples for moving average
        self.game = game
        self.online = online
        self.dlc = dlc
        self.version = version
        self.size = size
        # Remove k9bsbM from path if present
        if "k9bsbM" in download_dir:
            download_dir = download_dir.replace(os.path.join("k9bsbM", game), "").replace("k9bsbM", "")
        self.download_dir = os.path.join(download_dir, game)
        os.makedirs(self.download_dir, exist_ok=True)
        self.game_info_path = os.path.join(self.download_dir, f"{game}.ascendara.json")
        self.game_info = {
            "game": game,
            "online": online,
            "dlc": dlc,
            "version": version if version else "",
            "size": size,
            "executable": os.path.join(self.download_dir, f"{game}.exe"),
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
        safe_write_json(self.game_info_path, self.game_info)
        self._stop_event = stop_event

    @staticmethod
    def _getToken():
        user_agent = os.getenv("GF_USERAGENT", "Mozilla/5.0")
        headers = {
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip, deflate, br",
            "Accept": "*/*",
            "Connection": "keep-alive",
        }
        create_account_response = requests.post("https://api.gofile.io/accounts", headers=headers).json()
        if create_account_response["status"] != "ok":
            raise Exception("Account creation failed!")
        return create_account_response["data"]["token"]

    def download_from_gofile(self, url, password=None):
        # Fix URL if it starts with //
        if url.startswith("//"):
            url = "https:" + url
        
        content_id = url.split("/")[-1]
        _password = sha256(password.encode()).hexdigest() if password else None

        files_info = self._parseLinksRecursively(content_id, _password)
        
        if not files_info:
            print(f"No files found for download from {url}")
            return

        with ThreadPoolExecutor(max_workers=self._max_workers) as executor:
            for item in files_info.values():
                executor.submit(self._downloadContent, item)

        self._extract_files()

    def _parseLinksRecursively(self, content_id, password, current_path=""):
        url = f"https://api.gofile.io/contents/{content_id}?wt=4fd6sg89d7s6&cache=true"
        if password:
            url = f"{url}&password={password}"

        headers = {
            "User-Agent": os.getenv("GF_USERAGENT", "Mozilla/5.0"),
            "Accept-Encoding": "gzip, deflate, br",
            "Accept": "*/*",
            "Connection": "keep-alive",
            "Authorization": f"Bearer {self._token}",
        }

        response = requests.get(url, headers=headers).json()

        if response["status"] != "ok":
            print(f"Failed to get a link as response from the {url}.{NEW_LINE}")
            return {}

        data = response["data"]
        files_info = {}

        if data["type"] == "folder":
            folder_path = os.path.join(current_path, data["name"])
            os.makedirs(os.path.join(self.download_dir, folder_path), exist_ok=True)

            for child_id in data["children"]:
                child = data["children"][child_id]
                if child["type"] == "folder":
                    files_info.update(self._parseLinksRecursively(child["id"], password, folder_path))
                else:
                    files_info[child["id"]] = {
                        "path": folder_path,
                        "filename": child["name"],
                        "link": child["link"]
                    }
        else:
            files_info[data["id"]] = {
                "path": current_path,
                "filename": data["name"],
                "link": data["link"]
            }

        return files_info

    def _downloadContent(self, file_info, chunk_size=16384):
        filepath = os.path.join(self.download_dir, file_info["path"], file_info["filename"])
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            print(f"{filepath} already exists, skipping.{NEW_LINE}")
            return

        tmp_file = f"{filepath}.part"
        url = file_info["link"]
        
        for retry in range(self._max_retries):
            try:
                headers = {
                    "Cookie": f"accountToken={self._token}",
                    "Accept-Encoding": "gzip, deflate, br",
                    "User-Agent": os.getenv("GF_USERAGENT", "Mozilla/5.0"),
                    "Accept": "*/*",
                    "Referer": f"{url}{('/' if not url.endswith('/') else '')}",
                    "Origin": url,
                    "Connection": "keep-alive",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-site",
                    "Pragma": "no-cache",
                    "Cache-Control": "no-cache"
                }

                part_size = 0
                if os.path.isfile(tmp_file):
                    part_size = int(os.path.getsize(tmp_file))
                    headers["Range"] = f"bytes={part_size}-"

                with requests.get(url, headers=headers, stream=True, timeout=(9, self._download_timeout)) as response:
                    if ((response.status_code in (403, 404, 405, 500)) or
                        (part_size == 0 and response.status_code != 200) or
                        (part_size > 0 and response.status_code != 206)):
                        print(f"Couldn't download the file from {url}. Status code: {response.status_code}{NEW_LINE}")
                        if retry < self._max_retries - 1:
                            print(f"Retrying download ({retry + 2}/{self._max_retries})...{NEW_LINE}")
                            time.sleep(2 ** retry)  # Exponential backoff
                            continue
                        return

                    total_size = int(response.headers.get("Content-Length", 0)) + part_size
                    if not total_size:
                        print(f"Couldn't find the file size from {url}.{NEW_LINE}")
                        if retry < self._max_retries - 1:
                            print(f"Retrying download ({retry + 2}/{self._max_retries})...{NEW_LINE}")
                            time.sleep(2 ** retry)
                            continue
                        return

                    with open(tmp_file, "ab") as handler:
                        start_time = time.time()
                        downloaded_size = part_size
                         
                        for chunk in response.iter_content(chunk_size=chunk_size):
                            if self._stop_event.is_set():
                                print(f"\nStopping download of {file_info['filename']}")
                                handler.close()
                                if os.path.exists(tmp_file):
                                    os.remove(tmp_file)
                                return
                                
                            if not chunk:  # Keep-alive new chunks
                                continue
                                 
                            handler.write(chunk)
                            downloaded_size += len(chunk)
                            progress = (downloaded_size / total_size) * 100
                             
                            # Calculate speed using total time elapsed
                            elapsed_time = time.time() - start_time
                            if elapsed_time > 0:
                                download_speed = downloaded_size / elapsed_time
                                remaining_size = total_size - downloaded_size
                                eta_seconds = remaining_size / download_speed if download_speed > 0 else 0
                                 
                                self._update_progress(file_info['filename'], progress, download_speed, eta_seconds)

                        # Check if stopped before finalizing
                        if self._stop_event.is_set():
                            handler.close()
                            if os.path.exists(tmp_file):
                                os.remove(tmp_file)
                            return

                        # Verify file size after download
                        final_size = handler.tell() + part_size
                        if final_size == total_size:
                            # Close the file before renaming
                            handler.flush()
                            os.fsync(handler.fileno())
                        else:
                            print(f"Download incomplete, retrying... (Got {final_size} bytes, expected {total_size}){NEW_LINE}")
                            if retry < self._max_retries - 1:
                                time.sleep(2 ** retry)
                                continue
                            return

                # Ensure the download directory exists
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                
                # Move the completed download to its final location
                try:
                    os.replace(tmp_file, filepath)
                    self._update_progress(file_info['filename'], 100, 0, done=True)
                    print(f"Successfully downloaded {filepath}")
                    return
                except OSError as e:
                    print(f"Error moving completed download: {e}{NEW_LINE}")
                    if retry < self._max_retries - 1:
                        time.sleep(2 ** retry)
                        continue
                    return

            except (requests.RequestException, IOError) as e:
                print(f"Error downloading {url}: {str(e)}{NEW_LINE}")
                if retry < self._max_retries - 1:
                    print(f"Retrying download ({retry + 2}/{self._max_retries})...{NEW_LINE}")
                    time.sleep(2 ** retry)
                    continue

        print(f"Failed to download {url} after {self._max_retries} attempts{NEW_LINE}")
        if os.path.exists(tmp_file):
            os.remove(tmp_file)

    def _update_progress(self, filename, progress, rate, eta_seconds=0, done=False):
        with self._lock:
            # Ensure progress never goes backwards
            if progress >= self._last_progress or done:
                self._last_progress = progress
                self.game_info["downloadingData"]["downloading"] = not done
                self.game_info["downloadingData"]["progressCompleted"] = f"{progress:.2f}"
            
            # Use moving average for download speed to prevent wild fluctuations
            self._speed_samples.append(rate)
            if len(self._speed_samples) > self._MAX_SPEED_SAMPLES:
                self._speed_samples.pop(0)
            avg_rate = sum(self._speed_samples) / len(self._speed_samples)
            
            # Prevent speed from dropping too drastically
            if avg_rate < self._last_speed * 0.5 and self._last_speed > 0:
                avg_rate = self._last_speed * 0.5
            self._last_speed = avg_rate
            
            # Format speed with consistent decimal places and thresholds
            def format_speed(rate):
                if rate < 0.1:  # Very slow speeds
                    return "0.00 B/s"
                elif rate < 1024:
                    return f"{rate:.2f} B/s"
                elif rate < 1024 * 1024:
                    return f"{(rate / 1024):.2f} KB/s"
                elif rate < 1024 * 1024 * 1024:
                    return f"{(rate / (1024 * 1024)):.2f} MB/s"
                else:
                    return f"{(rate / (1024 * 1024 * 1024)):.2f} GB/s"
            
            self.game_info["downloadingData"]["progressDownloadSpeeds"] = format_speed(avg_rate)
            
            # Calculate ETA based on smoothed speed
            if done:
                eta = "0s"
            elif avg_rate <= 0:
                eta = "calculating..."
            else:
                # Recalculate ETA using smoothed speed
                remaining_progress = 100 - progress
                total_size = self.size * 1024 * 1024  # Convert MB to bytes
                remaining_bytes = (remaining_progress / 100.0) * total_size
                eta_seconds = remaining_bytes / avg_rate
                
                # Cap maximum ETA at 24 hours
                eta_seconds = min(eta_seconds, 86400)
                
                if eta_seconds < 60:
                    eta = f"{int(eta_seconds)}s"
                elif eta_seconds < 3600:
                    minutes = int(eta_seconds / 60)
                    seconds = int(eta_seconds % 60)
                    eta = f"{minutes}m {seconds}s"
                elif eta_seconds < 86400:
                    hours = int(eta_seconds / 3600)
                    minutes = int((eta_seconds % 3600) / 60)
                    eta = f"{hours}h {minutes}m"
                else:
                    days = int(eta_seconds / 86400)
                    hours = int((eta_seconds % 86400) / 3600)
                    eta = f"{days}d {hours}h"
            
            self.game_info["downloadingData"]["timeUntilComplete"] = eta
            
            if done:
                print(f"\rDownloading {filename}: 100% Complete!{NEW_LINE}")
            else:
                print(f"\rDownloading {filename}: {progress:.1f}% {format_speed(avg_rate)} ETA: {eta}", end="")
            
            safe_write_json(self.game_info_path, self.game_info)

    def _extract_files(self):
        self.game_info["downloadingData"]["extracting"] = True
        safe_write_json(self.game_info_path, self.game_info)

        # First extract all archives
        for root, _, files in os.walk(self.download_dir):
            for file in files:
                if file.endswith(('.zip', '.rar')):
                    archive_path = os.path.join(root, file)
                    extract_dir = os.path.dirname(archive_path)  # Extract to same directory as archive
                    print(f"Extracting {archive_path}")
                    
                    if file.endswith('.zip'):
                        shutil.unpack_archive(archive_path, extract_dir, format="zip")
                    elif file.endswith('.rar'):
                        with rarfile.RarFile(archive_path, 'r') as rar_ref:
                            rar_ref.extractall(extract_dir)
                    os.remove(archive_path)

        # Clean up unwanted files
        for root, _, files in os.walk(self.download_dir):
            for file in files:
                if file.endswith((".url", ".txt")):
                    file_path = os.path.join(root, file)
                    os.remove(file_path)

        # Move files from gofileID/gamename structure to correct location
        contents = os.listdir(self.download_dir)
        for content in contents:
            content_path = os.path.join(self.download_dir, content)
            if os.path.isdir(content_path):
                # Look for game directory inside potential gofileID directory
                subcontents = os.listdir(content_path)
                for subcontent in subcontents:
                    subcontent_path = os.path.join(content_path, subcontent)
                    if os.path.isdir(subcontent_path) and subcontent.lower() == self.game.lower():
                        # Found game directory inside gofileID, move its contents up
                        for item in os.listdir(subcontent_path):
                            src_path = os.path.join(subcontent_path, item)
                            dst_path = os.path.join(self.download_dir, item)
                            if os.path.exists(dst_path):
                                if os.path.isdir(dst_path):
                                    shutil.rmtree(dst_path)
                                else:
                                    os.remove(dst_path)
                            shutil.move(src_path, dst_path)
                        # Remove empty directories
                        shutil.rmtree(content_path)
                        break

        # Clean up empty directories except _CommonRedist
        for root, dirs, files in os.walk(self.download_dir, topdown=False):
            if root != self.download_dir and "_CommonRedist" not in root and not os.listdir(root):
                shutil.rmtree(root)

        # Remove downloadingData after extraction is complete
        del self.game_info["downloadingData"]
        safe_write_json(self.game_info_path, self.game_info)

def open_console():
    if IS_DEV and sys.platform == "win32":
        import ctypes
        kernel32 = ctypes.WinDLL('kernel32')
        kernel32.AllocConsole()

def parse_boolean(value):
    if value.lower() in ['true', '1', 'yes']:
        return True
    elif value.lower() in ['false', '0', 'no']:
        return False
    else:
        raise ArgumentTypeError(f"Invalid boolean value: {value}")

def main():
    try:
        if IS_DEV:
            open_console()
            
        parser = ArgumentParser(description="Download files from Gofile, extract them, and manage game info.")
        parser.add_argument("url", help="Gofile URL to download from")
        parser.add_argument("game", help="Name of the game")
        parser.add_argument("online", type=parse_boolean, help="Is the game online (true/false)?")
        parser.add_argument("dlc", type=parse_boolean, help="Is DLC included (true/false)?")
        parser.add_argument("version", help="Version of the game")
        parser.add_argument("size", help="Size of the file in (ex: 12 GB, 439 MB)")
        parser.add_argument("download_dir", help="Directory to save the downloaded files")
        parser.add_argument("--password", help="Password for protected content", default=None)

        args = parser.parse_args()

        try:
            downloader = GofileDownloader(args.game, args.online, args.dlc, args.version, args.size, args.download_dir)
            downloader.download_from_gofile(args.url, args.password)
        except Exception as e:
            handleerror(downloader.game_info, downloader.game_info_path, e)
            launch_crash_reporter(1, str(e))
            if IS_DEV:
                input("\nPress Enter to exit...")
            sys.exit(1)
        
        if IS_DEV:
            input("\nPress Enter to exit...")

    except Exception as e:
        launch_crash_reporter(1, str(e))
        print(f"An error occurred: {str(e)}")
        if IS_DEV:
            input("\nPress Enter to exit...")
        sys.exit(1)

if __name__ == "__main__":
    main()