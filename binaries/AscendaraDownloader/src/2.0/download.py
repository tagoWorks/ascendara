import os
import urllib.error
import urllib.request
import ssl
import math
import time
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
import requests
from utils import ProgressBar, sanitize_folder_name, safe_write_json, handleerror

class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        context = ssl.create_default_context()
        context.set_ciphers('DEFAULT@SECLEVEL=1')  # Lower security level to increase compatibility
        context.options |= ssl.OP_NO_SSLv2
        context.options |= ssl.OP_NO_SSLv3
        context.options |= ssl.OP_NO_TLSv1
        kwargs['ssl_context'] = context
        return super(SSLContextAdapter, self).init_poolmanager(*args, **kwargs)

class GoFileDownloader:
    def __init__(self):
        self.token = ""
        self.wt = ""

    def update_token(self):
        if self.token == "":
            data = requests.post("https://api.gofile.io/accounts").json()
            if data["status"] == "ok":
                self.token = data["data"]["token"]
            else:
                raise Exception("cannot get token")

    def update_wt(self):
        if self.wt == "":
            alljs = requests.get("https://gofile.io/dist/js/alljs.js").text
            if 'wt: "' in alljs:
                self.wt = alljs.split('wt: "')[1].split('"')[0]
            else:
                raise Exception("cannot get wt")

    def download(self, link, file_path):
        self.update_token()
        self.update_wt()
        with requests.get(link, headers={"Cookie": "accountToken=" + self.token}, stream=True) as r:
            r.raise_for_status()
            if "Content-Length" in r.headers:
                content_length = int(r.headers["Content-Length"])
            else:
                content_length = None  # or some default value
            chunk_size = 8192
            progress_bar = ProgressBar("Downloading", 0, math.ceil(content_length / chunk_size) if content_length else 1)
            with open(file_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=chunk_size):
                    f.write(chunk)
                    if content_length:
                        progress_bar.print()
def download_with_urllib(link, download_path, game_info_path, game_info):
    try:
        with urllib.request.urlopen(link) as response:
            if response.status!= 200:
                raise Exception(f"Response code was not 200. Instead got {response.status}")
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            archive_ext = link.split('.')[-1]
            archive_file_path = os.path.join(download_path, f"{game_info['game']}.{archive_ext}")
            total_size = int(response.headers.get('content-length', 0) or 0)
            block_size = 1024 * 1024
            downloaded_size = 0
            game_info["downloadingdata"]["downloading"] = True
            start_time = time.time()

            safe_write_json(game_info_path, game_info)

            with open(archive_file_path, "wb") as file:
                while True:
                    data = response.read(block_size)
                    if not data:
                        break
                    file.write(data)
                    downloaded_size += len(data)
                    progress = downloaded_size / total_size if total_size > 0 else 0
                    game_info["downloadingdata"]["progressUntilComplete"] = f"{progress * 100:.2f}"

                    elapsed_time = time.time() - start_time
                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                    if download_speed < 1024:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                    elif download_speed < 1024 * 1024:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                    else:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                    remaining_size = total_size - downloaded_size
                    if download_speed > 0:
                        time_until_complete = remaining_size / download_speed
                        minutes, seconds = divmod(time_until_complete, 60)
                        hours, minutes = divmod(minutes, 60)
                        if hours > 0:
                            game_info["downloadingdata"]["timeUntilComplete"] = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
                        else:
                            game_info["downloadingdata"]["timeUntilComplete"] = f"{int(minutes)}m {int(seconds)}s"
                    else:
                        game_info["downloadingdata"]["timeUntilComplete"] = "Calculating..."

                    safe_write_json(game_info_path,game_info)

            game_info["downloadingdata"]["downloading"] = False
            safe_write_json(game_info_path, game_info)
            return archive_file_path, archive_ext
    except Exception as e:
        handleerror(game_info, game_info_path, e)
        raise

def download_with_requests(link, download_path, game_info_path, game_info):
    try:
        with requests.get(link, stream=True) as response:
            if response.status_code!= 200:
                raise Exception(f"Response code was not 200. Instead got {response.status_code}")
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            archive_ext = link.split('.')[-1]
            archive_file_path = os.path.join(download_path, f"{game_info['game']}.{archive_ext}")
            total_size = int(response.headers.get('content-length', 0) or 0)
            block_size = 1024 * 1024
            downloaded_size = 0
            game_info["downloadingdata"]["downloading"] = True
            start_time = time.time()

            safe_write_json(game_info_path, game_info)

            with open(archive_file_path, "wb") as file:
                for data in response.iter_content(block_size):
                    file.write(data)
                    downloaded_size += len(data)
                    progress = downloaded_size / total_size if total_size > 0 else 0
                    game_info["downloadingdata"]["progressUntilComplete"] = f"{progress * 100:.2f}"

                    elapsed_time = time.time() - start_time
                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                    if download_speed < 1024:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                    elif download_speed < 1024 * 1024:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                    else:
                        game_info["downloadingdata"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                    remaining_size = total_size - downloaded_size
                    if download_speed > 0:
                        time_until_complete = remaining_size / download_speed
                        minutes, seconds = divmod(time_until_complete, 60)
                        hours, minutes = divmod(minutes, 60)
                        if hours > 0:
                            game_info["downloadingdata"]["timeUntilComplete"] = f"{int(hours)}h {int(minutes)}m {int(seconds)}s"
                        else:
                            game_info["downloadingdata"]["timeUntilComplete"] = f"{int(minutes)}m {int(seconds)}s"
                    else:
                        game_info["downloadingdata"]["timeUntilComplete"] = "Calculating..."

                    safe_write_json(game_info_path, game_info)

            game_info["downloadingdata"]["downloading"] = False
            safe_write_json(game_info_path, game_info)
            return archive_file_path, archive_ext
    except Exception as e:
        handleerror(game_info, game_info_path, e)
        raise

def download_file(link, game, online, dlc, version, download_dir):
    game = sanitize_folder_name(game)
    download_path = os.path.join(download_dir, game)
    os.makedirs(download_path, exist_ok=True)
    
    game_info_path = os.path.join(download_path, f"{game}.ascendara.json")

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "executable": os.path.join(download_path, f"{game}.exe"),
        "isRunning": False,
        "downloadingdata": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressUntilComplete": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }

    if link.startswith("https://gofile.io/d/"):
        gofile_downloader = GoFileDownloader()
        archive_file_path, archive_ext = link.split("/")[-1], "rar"  # assume rar for now
        gofile_downloader.download(link, os.path.join(download_path, f"{game}.{archive_ext}"))
    else:
        try:
            archive_file_path, archive_ext = download_with_urllib(link, download_path, game_info_path, game_info)
        except Exception:
            archive_file_path, archive_ext =  download_with_requests(link, download_path, game_info_path, game_info)

    # implementation of extraction and cleanup
    pass