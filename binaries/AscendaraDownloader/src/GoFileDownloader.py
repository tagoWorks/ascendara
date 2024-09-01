import os
import json
import sys
import time
import shutil
from tempfile import NamedTemporaryFile
import requests
from concurrent.futures import ThreadPoolExecutor
from threading import Lock
from hashlib import sha256
from argparse import ArgumentParser, ArgumentTypeError
from unrar import rarfile

# Constants
NEW_LINE = "\n" if sys.platform != "Windows" else "\r\n"

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
    def __init__(self, game, online, dlc, version, download_dir, max_workers=5):
        self._token = self._getToken()
        self._max_workers = max_workers
        self._lock = Lock()
        self.game = game
        self.online = online
        self.dlc = dlc
        self.version = version
        self.download_dir = os.path.join(download_dir, game)
        os.makedirs(self.download_dir, exist_ok=True)
        self.game_info_path = os.path.join(self.download_dir, f"{game}.ascendara.json")
        self.game_info = {
            "game": game,
            "online": online,
            "dlc": dlc,
            "version": version if version else "",
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
        total_size = int(response.headers.get("Content-Length", 0))
        self.total_size = total_size
        if os.path.exists(filepath) and os.path.getsize(filepath) > 0:
            print(f"{filepath} already exists, skipping.{NEW_LINE}")
            return

        tmp_file = f"{filepath}.part"
        url = file_info["link"]
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

        try:
            with requests.get(url, headers=headers, stream=True, timeout=(9, 27)) as response:
                if ((response.status_code in (403, 404, 405, 500)) or
                    (part_size == 0 and response.status_code != 200) or
                    (part_size > 0 and response.status_code != 206)):
                    print(f"Couldn't download the file from {url}. Status code: {response.status_code}{NEW_LINE}")
                    return

                total_size = int(response.headers.get("Content-Length", 0))
                if not total_size:
                    print(f"Couldn't find the file size from {url}.{NEW_LINE}")
                    return

                with open(tmp_file, "ab") as handler:
                    start_time = time.time()
                    for chunk in response.iter_content(chunk_size=chunk_size):
                        handler.write(chunk)
                        progress = (part_size + handler.tell()) / total_size * 100
                        rate = handler.tell() / (time.time() - start_time)

                        self._update_progress(file_info['filename'], progress, rate)

        finally:
            if os.path.getsize(tmp_file) == total_size:
                self._update_progress(file_info['filename'], 100, 0, done=True)
                os.rename(tmp_file, filepath)

    def _update_progress(self, filename, progress, rate, done=False):
        with self._lock:
            self.game_info["downloadingData"]["downloading"] = not done
            self.game_info["downloadingData"]["progressCompleted"] = f"{progress:.2f}"
            
            if rate < 1024:
                speed = f"{rate:.2f} B/s"
            elif rate < 1024 * 1024:
                speed = f"{rate / 1024:.2f} KB/s"
            elif rate < 1024 * 1024 * 1024:
                speed = f"{rate / (1024 * 1024):.2f} MB/s"
            else:
                speed = f"{rate / (1024 * 1024 * 1024):.2f} GB/s"
            
            self.game_info["downloadingData"]["progressDownloadSpeeds"] = speed
            
            # Calculate remaining time
            if not done and rate > 0:
                remaining_size = (100 - progress) / 100 * self.total_size
                remaining_time = remaining_size / rate
                hours, remainder = divmod(remaining_time, 3600)
                minutes, seconds = divmod(remainder, 60)
                self.game_info["downloadingData"]["timeUntilComplete"] = f"{int(hours):02d}:{int(minutes):02d}:{int(seconds):02d}"
            else:
                self.game_info["downloadingData"]["timeUntilComplete"] = "0s"
            
            if done:
                print(f"\rDownloading {filename}: 100% Complete!{NEW_LINE}")
            else:
                print(f"\rDownloading {filename}: {progress:.1f}% {speed}", end="")
            
            safe_write_json(self.game_info_path, self.game_info)

    def _extract_files(self):
        self.game_info["downloadingData"]["extracting"] = True
        safe_write_json(self.game_info_path, self.game_info)

        for root, _, files in os.walk(self.download_dir):
            for file in files:
                if file.endswith(('.zip', '.rar')):
                    archive_path = os.path.join(root, file)
                    print(f"Extracting {archive_path}")
                    
                    if file.endswith('.zip'):
                        shutil.unpack_archive(archive_path, root, format="zip")
                    elif file.endswith('.rar'):
                        with rarfile.RarFile(archive_path, 'r') as rar_ref:
                            rar_ref.extractall(root)
                    os.remove(archive_path)
        for root, dirs, files in os.walk(self.download_dir):
            print("Debug Info")
            print ("root", root)
            print ("dirs", dirs)
            print ("files", files)
            if root != self.download_dir:
                for file in files:
                    shutil.move(os.path.join(root, file), os.path.join(self.download_dir, file))
                for dir in dirs:
                    shutil.move(os.path.join(root, dir), os.path.join(self.download_dir, dir))
                shutil.rmtree(root)
                
        # Clean up extracted files
        for file in os.listdir(self.download_dir):
            if file.endswith(".url") or file.endswith(".txt"):
                os.remove(os.path.join(self.download_dir, file))

        # move contents from the folder name self.game, into self.downloaddir
        for root, dirs, files in os.walk(self.download_dir):
            if root != self.download_dir:
                for file in files:
                    if "_CommonRedist" not in root:  # Skip _CommonRedist folder
                        shutil.move(os.path.join(root, file), os.path.join(self.download_dir, file))
                for dir in dirs:
                    if dir != "_CommonRedist":  # Skip _CommonRedist folder
                        shutil.move(os.path.join(root, dir), os.path.join(self.download_dir, dir))
                if "_CommonRedist" not in root:  # Skip _CommonRedist folder
                    shutil.rmtree(root)
            

        self.game_info["downloadingData"]["extracting"] = False
        del self.game_info["downloadingData"]
        safe_write_json(self.game_info_path, self.game_info)

        print(f"Extraction complete for {self.game}")

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
    parser.add_argument("version", help="Version of the game")
    parser.add_argument("download_dir", help="Directory to save the downloaded files")
    parser.add_argument("--password", help="Password for protected content", default=None)

    args = parser.parse_args()

    try:
        downloader = GofileDownloader(args.game, args.online, args.dlc, args.version, args.download_dir)
        downloader.download_from_gofile(args.url, args.password)
    except Exception as e:
        handleerror(downloader.game_info, downloader.game_info_path, e)
        print(f"An error occurred: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()