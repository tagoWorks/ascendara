import argparse
import logging
import math
import os
import json
import string
import time
import requests
import hashlib
from tempfile import NamedTemporaryFile

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s][%(funcName)20s()][%(levelname)-8s]: %(message)s",
    handlers=[
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger("GoFile")

def safe_write_json(filepath, data):
    temp_dir = os.path.dirname(filepath)
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
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def sanitize_filename(name: str) -> str:
    """Sanitize a filename by removing invalid characters"""
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    sanitized_name = ''.join(c for c in name if c in valid_chars)
    return sanitized_name

class ProgressBar:
    def __init__(self, name: str, cur: int, total: int) -> None:
        self.reset(name, cur, total)

    def reset(self, name: str, cur: int, total: int):
        self.name = name
        self.cur = cur
        self.total = total

    def print(self):
        self.cur += 1
        if self.cur <= self.total:
            percentage = int(100 * self.cur // self.total)
            fill = "█" * percentage
            empty = " " * (100 - percentage)
            print(f"\r {self.name}: {fill}{empty} {percentage}%", end="\r")
        if self.cur == self.total:
            print()

class GoFileMeta(type):
    _instances = {}

    def __call__(cls, *args, **kwargs):
        if cls not in cls._instances:
            instance = super().__call__(*args, **kwargs)
            cls._instances[cls] = instance
        return cls._instances[cls]

class GoFile(metaclass=GoFileMeta):
    def __init__(self, game_name: str) -> None:
        self.token = ""
        self.wt = ""
        self.game_name = game_name

    def update_token(self) -> None:
        if self.token == "":
            data = requests.post("https://api.gofile.io/accounts").json()
            if data["status"] == "ok":
                self.token = data["data"]["token"]
                logger.info(f"Updated token: {self.token}")
            else:
                raise Exception("Cannot get token")

    def update_wt(self) -> None:
        if self.wt == "":
            alljs = requests.get("https://gofile.io/dist/js/alljs.js").text
            if 'wt: "' in alljs:
                self.wt = alljs.split('wt: "')[1].split('"')[0]
                logger.info(f"Updated wt: {self.wt}")
            else:
                raise Exception("Cannot get wt")

    def execute(self, dir: str, content_id: str = None, url: str = None, password: str = None, game_info_path: str = None) -> None:
        if content_id is not None:
            self.update_token()
            self.update_wt()
            hash_password = hashlib.sha256(password.encode()).hexdigest() if password else ""
            data = requests.get(
                f"https://api.gofile.io/contents/{content_id}?wt={self.wt}&cache=true&password={hash_password}",
                headers={
                    "Authorization": "Bearer " + self.token,
                },
            ).json()

            if data["status"] == "ok":
                if data["data"].get("passwordStatus", "passwordOk") == "passwordOk":
                    if data["data"]["type"] == "folder":
                        dirname = data["data"]["name"]
                        dir = os.path.join(dir, sanitize_filename(dirname))
                        for children_id in data["data"]["childrenIds"]:
                            child_data = data["data"]["children"][children_id]
                            if game_info_path:
                                with open(game_info_path, 'r') as f:
                                    game_info = json.load(f)
                                game_info["downloadingData"]["progressCompleted"] = "Downloading..."
                                safe_write_json(game_info_path, game_info)
                            if child_data["type"] == "folder":
                                self.execute(dir=dir, content_id=children_id, password=password, game_info_path=game_info_path)
                            else:
                                filename = child_data["name"]
                                file = os.path.join(dir, sanitize_filename(filename))
                                link = child_data["link"]
                                self.download(link, file, game_info_path=game_info_path)
                    else:
                        filename = data["data"]["name"]
                        file = os.path.join(dir, sanitize_filename(filename))
                        link = data["data"]["link"]
                        self.download(link, file, game_info_path=game_info_path)
                else:
                    logger.error(f"Invalid password: {data['data'].get('passwordStatus')}")
            else:
                logger.error(f"Failed to get content data: {data['status']}")
        elif url is not None:
            if url.startswith("https://gofile.io/d/"):
                self.execute(dir=dir, content_id=url.split("/")[-1], password=password, game_info_path=game_info_path)
            else:
                logger.error(f"Invalid URL: {url}")
        else:
            logger.error(f"Invalid parameters")

    def download(self, link: str, file: str, chunk_size: int = 8192, game_info_path: str = None):
        try:
            dir = os.path.dirname(file)
            if not os.path.exists(dir):
                os.makedirs(dir)
            if not os.path.exists(file):
                with requests.get(link, headers={"Cookie": "accountToken=" + self.token}, stream=True) as r:
                    r.raise_for_status()
                    content_length = int(r.headers.get("Content-Length", 0))
                    progress_bar = ProgressBar("Downloading", 0, math.ceil(content_length / chunk_size))
                    downloaded_size = 0
                    start_time = time.time()

                    with open(file, "wb") as f:
                        for chunk in r.iter_content(chunk_size=chunk_size):
                            if chunk:
                                f.write(chunk)
                                downloaded_size += len(chunk)
                                progress = downloaded_size / content_length
                                progress_bar.print()

                                if game_info_path:
                                    with open(game_info_path, 'r') as f:
                                        game_info = json.load(f)
                                    game_info["downloadingData"]["progressCompleted"] = f"{progress * 100:.2f}%"

                                    elapsed_time = time.time() - start_time
                                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                                    if download_speed < 1024:
                                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                                    elif download_speed < 1024 * 1024:
                                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                                    else:
                                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                                    remaining_size = content_length - downloaded_size
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

                    logger.info(f"Downloaded: {file} ({link})")
        except Exception as e:
            logger.error(f"Failed to download ({e}): {file} ({link})")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("url", help="GoFile download URL")
    parser.add_argument("-d", type=str, dest="dir", help="Output directory")
    parser.add_argument("-p", type=str, dest="password", help="Password")
    parser.add_argument("-g", type=str, dest="game_name", help="Game name", required=True)
    args = parser.parse_args()

    gofile = GoFile(game_name=args.game_name)
    gofile.execute(dir=args.dir, url=args.url, password=args.password)
