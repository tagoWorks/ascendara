# ==============================================================================
# Ascendara GoFile Helper
# ==============================================================================
# Specialized downloader component for handling GoFile.io downloads in Ascendara.
# Manages authentication, file downloads, and extraction.
# support. Read more about the GoFile Helper Tool here:
# https://ascendara.app/docs/developer/gofile-helper









import os
import json
import sys
import time
import shutil
from tempfile import NamedTemporaryFile, gettempdir
import requests
import atexit
from threading import Lock
from hashlib import sha256
from argparse import ArgumentParser, ArgumentTypeError, ArgumentError
import patoolib
import subprocess
import logging
from datetime import datetime

# Set up logging to both console and temp file
def setup_logging():
    log_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    
    # Create temp log file with timestamp
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    temp_log_path = os.path.join(gettempdir(), f'ascendara_gofile_{timestamp}.log')
    
    # File handler for temp file
    file_handler = logging.FileHandler(temp_log_path)
    file_handler.setFormatter(log_formatter)
    file_handler.setLevel(logging.DEBUG)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(log_formatter)
    console_handler.setLevel(logging.INFO)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)
    root_logger.addHandler(file_handler)
    root_logger.addHandler(console_handler)
    
    logging.info(f"Detailed logs will be saved to: {temp_log_path}")
    return temp_log_path

# Initialize logging
temp_log_file = setup_logging()

NEW_LINE = "\n" if sys.platform != "Windows" else "\r\n"
IS_DEV = False  # Development mode flag

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
    # Only register once
    if not hasattr(launch_crash_reporter, "_registered"):
        atexit.register(_launch_crash_reporter_on_exit, error_code, error_message)
        launch_crash_reporter._registered = True

def _launch_notification(theme, title, message):
    try:
        # Get the directory where the current executable is located
        exe_dir = os.path.dirname(os.path.abspath(sys.argv[0]))
        notification_helper_path = os.path.join(exe_dir, 'AscendaraNotificationHelper.exe')
        logging.debug(f"Looking for notification helper at: {notification_helper_path}")
        
        if os.path.exists(notification_helper_path):
            logging.debug(f"Launching notification helper with theme={theme}, title='{title}', message='{message}'")
            # Use subprocess.Popen with CREATE_NO_WINDOW flag to hide console
            subprocess.Popen(
                [notification_helper_path, "--theme", theme, "--title", title, "--message", message],
                creationflags=subprocess.CREATE_NO_WINDOW
            )
            logging.debug("Notification helper process started successfully")
        else:
            logging.error(f"Notification helper not found at: {notification_helper_path}")
    except Exception as e:
        logging.error(f"Failed to launch notification helper: {e}")

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
    def __init__(self, game, online, dlc, isVr, version, size, download_dir, max_workers=5):
        self._max_retries = 3
        self._download_timeout = 30 
        self._token = self._getToken()
        self._lock = Lock()
        self._rate_window = []  # Store recent rate measurements
        self._rate_window_size = 5  # Number of measurements to average
        self._last_progress = 0  # Track highest progress
        self._current_file_progress = {}  # Track progress per file
        self._total_downloaded = 0  # Track total bytes downloaded
        self._total_size = 0  # Track total bytes to download
        self.game = game
        self.online = online
        self.dlc = dlc
        self.isVr = isVr
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
            "isVr": isVr,
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
            print(f"No files found for download from {url}. Skipping...")
            handleerror(self.game_info, self.game_info_path, "no_files_error")
            return

        # Calculate total size first
        self._total_size = 0
        self._total_downloaded = 0
        for item in files_info.values():
            filepath = os.path.join(self.download_dir, item["path"], item["filename"])
            if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
                file_size = os.path.getsize(filepath)
                self._total_downloaded += file_size
                self._total_size += file_size
            else:
                # Get file size from headers
                try:
                    headers = {
                        "Cookie": f"accountToken={self._token}",
                        "User-Agent": os.getenv("GF_USERAGENT", "Mozilla/5.0")
                    }
                    response = requests.head(item["link"], headers=headers, allow_redirects=True)
                    if response.status_code == 200:
                        file_size = int(response.headers.get("Content-Length", 0))
                        self._total_size += file_size
                except:
                    continue

        total_files = len(files_info)
        current_file = 0
        
        for item in files_info.values():
            current_file += 1
            try:
                print(f"\nDownloading file {current_file}/{total_files}: {item.get('name', 'Unknown')}")
                self._downloadContent(item)
            except Exception as e:
                print(f"Error downloading {item.get('name', 'Unknown')}: {str(e)}")
                # Wait a bit before trying the next file
                time.sleep(2)
                continue

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

    def _downloadContent(self, file_info, chunk_size=32768):  
        filepath = os.path.join(self.download_dir, file_info["path"], file_info["filename"])
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            print(f"{filepath} already exists, skipping.{NEW_LINE}")
            return

        tmp_file = f"{filepath}.part"
        url = file_info["link"]
        os.makedirs(os.path.dirname(filepath), exist_ok=True)
        
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
                        return

                    mode = 'ab' if part_size > 0 else 'wb'
                    with open(tmp_file, mode) as f:
                        downloaded = part_size
                        start_time = time.time()
                        last_update = start_time
                        bytes_since_last_update = 0
                        self._rate_window = []  # Reset rate window for new download
                        file_key = f"{file_info['path']}/{file_info['filename']}"
                        self._current_file_progress[file_key] = part_size

                        for chunk in response.iter_content(chunk_size=chunk_size):
                            if not chunk:
                                continue
                            
                            f.write(chunk)
                            downloaded += len(chunk)
                            bytes_since_last_update += len(chunk)
                            current_time = time.time()
                            
                            # Update progress every 0.5 seconds
                            if current_time - last_update >= 0.5:
                                # Update both file and total progress
                                self._current_file_progress[file_key] = downloaded
                                self._total_downloaded = sum(self._current_file_progress.values())
                                
                                # Calculate overall progress percentage
                                if self._total_size > 0:
                                    progress = (self._total_downloaded / self._total_size) * 100
                                    # Ensure progress never decreases
                                    progress = max(progress, self._last_progress)
                                    self._last_progress = progress
                                else:
                                    progress = 0
                                
                                # Calculate current rate
                                current_rate = bytes_since_last_update / (current_time - last_update)
                                
                                # Update rate window
                                self._rate_window.append(current_rate)
                                if len(self._rate_window) > self._rate_window_size:
                                    self._rate_window.pop(0)
                                
                                # Use average rate for smoother updates
                                avg_rate = sum(self._rate_window) / len(self._rate_window)
                                remaining_bytes = self._total_size - self._total_downloaded
                                eta = int(remaining_bytes / avg_rate) if avg_rate > 0 else 0
                                
                                self._update_progress(
                                    file_info["filename"], 
                                    progress,
                                    avg_rate,
                                    eta
                                )
                                
                                last_update = current_time
                                bytes_since_last_update = 0

                    # Download completed successfully
                    os.replace(tmp_file, filepath)
                    # Update final progress
                    self._current_file_progress[file_key] = total_size
                    self._total_downloaded = sum(self._current_file_progress.values())
                    if self._total_size > 0:
                        final_progress = (self._total_downloaded / self._total_size) * 100
                    else:
                        final_progress = 100
                    self._update_progress(file_info["filename"], final_progress, 0, 0, done=True)
                    return
            except (requests.exceptions.RequestException, IOError) as e:
                print(f"Error downloading {url}: {str(e)}{NEW_LINE}")
                if retry < self._max_retries - 1:
                    print(f"Retrying download ({retry + 2}/{self._max_retries})...{NEW_LINE}")
                    time.sleep(2 ** retry)  # Exponential backoff
                    continue
                if os.path.exists(tmp_file):
                    os.remove(tmp_file)
                raise

        raise Exception(f"Failed to download {url} after {self._max_retries} retries")

    def _update_progress(self, filename, progress, rate, eta_seconds=0, done=False):
        with self._lock:
            self.game_info["downloadingData"]["downloading"] = not done
            self.game_info["downloadingData"]["progressCompleted"] = f"{progress:.2f}"
            
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
            
            self.game_info["downloadingData"]["progressDownloadSpeeds"] = format_speed(rate)
            
            # Format ETA with improved granularity
            if done:
                eta = "0s"
            elif eta_seconds <= 0:
                eta = "calculating..."
            elif eta_seconds < 60:
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
                print(f"\rDownloading {filename}: {progress:.1f}% {format_speed(rate)} ETA: {eta}", end="")
            
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
                    
                    # check os
                    if sys.platform == "win32":
                        if file.endswith('.zip'):
                            shutil.unpack_archive(archive_path, extract_dir, format="zip")
                        elif file.endswith('.rar'):
                            from unrar import rarfile
                            with rarfile.RarFile(archive_path, 'r') as rar_ref:
                                rar_ref.extractall(extract_dir)
                    else:
                        patoolib.extract_archive(archive_path, outdir=extract_dir)
                    os.remove(archive_path)

        # Clean up unwanted files
        for root, _, files in os.walk(self.download_dir):
            for file in files:
                if file.endswith((".url")):
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

        self.game_info["downloadingData"].clear()
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
    parser = ArgumentParser(description="Download files from Gofile, extract them, and manage game info.")
    parser.add_argument("url", help="Gofile URL to download from")
    parser.add_argument("game", help="Name of the game")
    parser.add_argument("online", type=parse_boolean, help="Is the game online (true/false)?")
    parser.add_argument("dlc", type=parse_boolean, help="Is DLC included (true/false)?")
    parser.add_argument("isVr", type=parse_boolean, help="Is the game a VR game (true/false)?")
    parser.add_argument("version", help="Version of the game")
    parser.add_argument("size", help="Size of the file in (ex: 12 GB, 439 MB)")
    parser.add_argument("download_dir", help="Directory to save the downloaded files")
    parser.add_argument("--password", help="Password for protected content", default=None)
    parser.add_argument("--withNotification", help="Theme name for notifications (e.g. light, dark, blue)", default=None)

    try:
        if len(sys.argv) == 1:  # No arguments provided
            error_msg = "No arguments provided. Please provide all required arguments."
            logging.error(error_msg)
            launch_crash_reporter(1, error_msg)
            parser.print_help()
            sys.exit(1)
            
        args = parser.parse_args()
        logging.info(f"Starting download process for game: {args.game}")
        logging.debug(f"Arguments: url={args.url}, online={args.online}, dlc={args.dlc}, "
                     f"isVr={args.isVr}, version={args.version}, size={args.size}, "
                     f"download_dir={args.download_dir}, withNotification={args.withNotification}")
        
        downloader = GofileDownloader(args.game, args.online, args.dlc, args.isVr, args.version, args.size, args.download_dir)
        if args.withNotification:
            _launch_notification(args.withNotification, "Download Started", f"Starting download for {args.game}")
        downloader.download_from_gofile(args.url, args.password)
        if args.withNotification:
            _launch_notification(args.withNotification, "Download Complete", f"Successfully downloaded and extracted {args.game}")
        
        logging.info(f"Download process completed successfully for game: {args.game}")
        logging.info(f"Detailed logs have been saved to: {temp_log_file}")
        
    except (ArgumentError, SystemExit) as e:
        error_msg = "Invalid or missing arguments. Please provide all required arguments."
        logging.error(f"{error_msg} Error: {str(e)}")
        launch_crash_reporter(1, error_msg)
        parser.print_help()
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}")
        logging.error(f"Error: {str(e)}")
        launch_crash_reporter(1, str(e))
        sys.exit(1)

if __name__ == "__main__":
    main()