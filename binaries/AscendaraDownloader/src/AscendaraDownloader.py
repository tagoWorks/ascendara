import json
import urllib.error
import urllib.request
import ssl
from datetime import timedelta
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from concurrent.futures import ThreadPoolExecutor
import logging
import os
import shutil
import string
import sys
import zipfile
from unrar import rarfile
import time
from tempfile import NamedTemporaryFile
import requests

logging.basicConfig(filename='debug.log', level=logging.DEBUG)

class SSLContextAdapter(HTTPAdapter):
    def init_poolmanager(self, connections, maxsize, block=False):
        self.poolmanager = PoolManager(num_pools=connections,
                                       maxsize=maxsize,
                                       block=block,
                                       ssl_version=ssl.PROTOCOL_TLSv1_2)

def resource_path(relative_path):
    try:
        base_path = sys._MEIPASS
    except Exception:
        base_path = os.path.abspath(".")

def sanitize_folder_name(name):
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    sanitized_name = ''.join(c for c in name if c in valid_chars)
    return sanitized_name

def retryfolder(game, online, dlc, version, download_dir, newfolder):
    logging.debug("Entering retryfolder function")
    game_info_path = os.path.join(download_dir, f"{game}.ascendara.json")
    newfolder = sanitize_folder_name(newfolder)

    game_info = {
        "game": game,
        "online": online,
        "dlc": dlc,
        "version": version if version else "",
        "executable": os.path.join(download_dir, f"{game}.exe"),
        "isRunning": False,
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressUntilComplete": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }
    logging.debug("Created game_info dictionary")
    game_info["downloadingData"]["extracting"] = True
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)
    logging.debug("Wrote game_info to file")

    extracted_folder = os.path.join(download_dir, newfolder)
    tempdownloading = os.path.join(download_dir, f"temp-{os.urandom(6).hex()}")
    shutil.copytree(extracted_folder, tempdownloading)
    logging.debug("Copied extracted folder to temp folder")
    shutil.rmtree(extracted_folder)
    logging.debug("Removed extracted folder")
    shutil.copytree(tempdownloading, os.path.join(download_dir), dirs_exist_ok=True)
    logging.debug("Copied temp folder to download dir")
    for file in os.listdir(os.path.join(download_dir)):
        if file.endswith(".url"):
            os.remove(os.path.join(download_dir, file))
    logging.debug("Removed.url files")
    game_info["downloadingData"]["extracting"] = False
    del game_info["downloadingData"]
    logging.debug("Updated game_info dictionary")
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)
    logging.debug("Wrote updated game_info to file")
    shutil.rmtree(tempdownloading, ignore_errors=True)
    logging.debug("Removed temp folder")

def safe_write_json(filepath, data):
    logging.debug("Entering safe_write_json function")
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
    logging.debug("Wrote data to file")

def extract_archive(archive_path, extract_to):
    if archive_path.endswith('.zip'):
        with zipfile.ZipFile(archive_path) as zip_ref:
            zip_ref.extractall(extract_to)
    elif archive_path.endswith('.rar'):
        with rarfile.RarFile(archive_path) as rar_ref:
            rar_ref.extractall(extract_to)
    else:
        raise ValueError(f"Unsupported archive format: {archive_path}")


def handleerror(game_info, game_info_path, e):
    logging.debug("Entering handleerror function")
    game_info['online'] = ""
    game_info['dlc'] = ""
    game_info['isRunning'] = False
    game_info['version'] = ""
    game_info['executable'] = ""
    del game_info['downloadingData']
    game_info['downloadingData'] = {
        "error": True,
        "message": str(e)
    }
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)
    logging.debug("Wrote error to file")

def download_file(link, game, online, dlc, version, download_dir):
    logging.debug("Entering download_file function")
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
        "downloadingData": {
            "downloading": False,
            "extracting": False,
            "updating": False,
            "progressUntilComplete": "0.00",
            "progressDownloadSpeeds": "0.00 KB/s",
            "timeUntilComplete": "0s"
        }
    }
    logging.debug("Created game_info dictionary")

    def download_gofile(link, download_path, game_info_path, game_info):
        logging.debug("Entering download_gofile function")
        _id = link.split("/")[-1]
        _downloaddir = download_path
        _root_dir = os.path.join(_downloaddir, _id)
        _files_link_list = []

        def _get_token():
            headers = {
                "User-Agent": "Mozilla/5.0",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept": "*/*",
                "Connection": "keep-alive",
            }
            response = requests.post("https://api.gofile.io/accounts", headers=headers).json()
            if response["status"] != "ok":
                logging.error("Account creation failed!")
                raise Exception("Account creation failed!")
            return response["data"]["token"]
        
        def _createDir(dirname):
            current_dir = os.getcwd()
            filepath = os.path.join(current_dir, dirname)
            try:
                os.mkdir(filepath)
            except FileExistsError:
                pass

        def _parseLinks(_id, token, password):
            url = f"https://api.gofile.io/contents/{_id}?wt=4fd6sg89d7s6&cache=true"
            if password:
                url = url + f"&password={password}"
            headers = {
                "User-Agent": "Mozilla/5.0",
                "Accept-Encoding": "gzip, deflate, br",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Authorization": "Bearer " + token,
            }
            response = requests.get(url, headers=headers).json()
            if response["status"] != "ok":
                logging.error(f"Failed to get a link as response from the {url}")
                raise Exception(f"Failed to get a link as response from the {url}")
            data = response["data"]
            if data["type"] == "folder":
                children_ids = data["childrenIds"]
                _createDir(data["name"])
                os.chdir(data["name"])
                for child_id in children_ids:
                    child = data["children"][child_id]
                    if data["children"][child_id]["type"] == "folder":
                        _parseLinks(child["code"], token, password)
                    else:
                        _cacheLink(os.getcwd(), child["name"], child["link"])
                os.chdir(os.path.pardir)
            else:
                _cacheLink(os.getcwd(), data["name"], data["link"])

        def _cacheLink(filepath, filename, link):
            _files_link_list.append({
                "path": os.path.join(filepath, filename),
                "filename": filename,
                "link": link
            })

        def _threadedDownloads():
            os.chdir(_root_dir)  
            token = _get_token()
            with ThreadPoolExecutor(max_workers=5) as executor:
                for item in _files_link_list:
                    executor.submit(_downloadContent, item, token, 16384)

        def _downloadContent(file_info, token, chunk_size):
            if os.path.exists(file_info["path"]):
                if os.path.getsize(file_info["path"]) > 0:
                    logging.info(f"{file_info['filename']} already exist, skipping.")
                    return
            filename = file_info["path"] + '.part'
            url = file_info["link"]
            headers = {
                "Cookie": "accountToken=" + token,
                "Accept-Encoding": "gzip, deflate, br",
                "User-Agent": "Mozilla/5.0",
                "Accept": "*/*",
                "Referer": url + ("/" if not url.endswith("/") else ""),
                "Origin": url,
                "Connection": "keep-alive",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site",
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            }
            
            _createDir(_id)
            os.chdir(_id)
            _parseLinks(_id, token, None)
            _threadedDownloads()
            part_size = 0
            if os.path.isfile(filename):
                part_size = int(os.path.getsize(filename))
                headers["Range"] = f"bytes={part_size}-"
            has_size = None
            message = " "
            try:
                with requests.get(url, headers=headers, stream=True, timeout=(9, 27)) as response_handler:
                    if ((response_handler.status_code in (403, 404, 405, 500)) or
                        (part_size == 0 and response_handler.status_code != 200) or
                        (part_size > 0 and response_handler.status_code != 206)):
                        logging.error(f"Couldn't download the file from {url}.")
                        return
                    has_size = response_handler.headers.get('Content-Length') \
                        if part_size == 0 \
                        else response_handler.headers.get('Content-Range').split("/")[-1]
                    if not has_size:
                        logging.error(f"Couldn't find the file size from {url}.")
                        return
                    with open(filename, 'ab') as handler:
                        total_size = float(has_size)
                        start_time = time.perf_counter()
                        for i, chunk in enumerate(response_handler.iter_content(chunk_size=chunk_size)):
                            progress = (part_size + (i * len(chunk))) / total_size * 100
                            handler.write(chunk)
                            rate = (i * len(chunk)) / (time.perf_counter() - start_time)
                            unit = "B/s"
                            if rate < (1024):
                                unit = "B/s"
                            elif rate < (1024 * 1024):
                                rate /= 1024
                                unit = "KB/s"
                            elif rate < (1024 * 1024 * 1024):
                                rate /= (1024 * 1024)
                                unit = "MB/s"
                            elif rate < (1024 * 1024 * 1024 * 1024):
                                rate /= (1024 * 1024 * 1024)
                                unit = "GB/s"
                            logging.info(f"\rDownloading {file_info['filename']}: {part_size + i * len(chunk)} of {has_size} {round(progress, 1)}% {round(rate, 1)}{unit}")
            finally:
                if os.path.getsize(filename) == int(has_size):
                    logging.info(f"\rDownloading {file_info['filename']}: {os.path.getsize(filename)} of {has_size} Done!")
                    shutil.move(filename, file_info["path"])

    def download_with_urllib():
        logging.debug("Entering download_with_urllib function")
        try:
            with urllib.request.urlopen(link) as response:
                if response.status != 200:
                    raise Exception(f"Response code was not 200. Instead got {response.status}")
                content_type = response.headers.get('Content-Type')
                if content_type and 'text/html' in content_type:
                    raise Exception("Content-Type was text/html. Link most likely expired.")

                archive_ext = link.split('.')[-1]
                archive_file_path = os.path.join(download_path, f"{game}.{archive_ext}")
                total_size = int(response.headers.get('content-length', 0) or 0)
                block_size = 1024 * 1024
                downloaded_size = 0
                game_info["downloadingData"]["downloading"] = True
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
                        game_info["downloadingData"]["progressUntilComplete"] = f"{progress * 100:.2f}"

                        elapsed_time = time.time() - start_time
                        download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                        if download_speed < 1024:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                        elif download_speed < 1024 * 1024:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                        else:
                            game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                        remaining_time = (total_size - downloaded_size) / download_speed if download_speed > 0 else 0
                        game_info["downloadingData"]["timeUntilComplete"] = str(timedelta(seconds=remaining_time))

                        safe_write_json(game_info_path, game_info)
                
                game_info["downloadingData"]["downloading"] = False
                game_info["downloadingData"]["progressUntilComplete"] = "100.00"
                game_info["downloadingData"]["progressDownloadSpeeds"] = "0.00 KB/s"
                game_info["downloadingData"]["timeUntilComplete"] = "0s"

                safe_write_json(game_info_path, game_info)
                
                extract_archive(archive_file_path, download_path)

        except Exception as e:
            logging.error(f"Failed to download file using urllib: {e}")
            raise e

    def download_with_requests():
        logging.debug("Entering download_with_requests function")
        try:
            response = requests.get(link, stream=True)
            if response.status_code != 200:
                raise Exception(f"Response code was not 200. Instead got {response.status_code}")
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            archive_ext = link.split('.')[-1]
            archive_file_path = os.path.join(download_path, f"{game}.{archive_ext}")
            total_size = int(response.headers.get('content-length', 0) or 0)
            block_size = 1024 * 1024
            downloaded_size = 0
            game_info["downloadingData"]["downloading"] = True
            start_time = time.time()

            safe_write_json(game_info_path, game_info)

            with open(archive_file_path, "wb") as file:
                for data in response.iter_content(block_size):
                    file.write(data)
                    downloaded_size += len(data)
                    progress = downloaded_size / total_size if total_size > 0 else 0
                    game_info["downloadingData"]["progressUntilComplete"] = f"{progress * 100:.2f}"

                    elapsed_time = time.time() - start_time
                    download_speed = downloaded_size / elapsed_time if elapsed_time > 0 else 0

                    if download_speed < 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed:.2f} B/s"
                    elif download_speed < 1024 * 1024:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / 1024:.2f} KB/s"
                    else:
                        game_info["downloadingData"]["progressDownloadSpeeds"] = f"{download_speed / (1024 * 1024):.2f} MB/s"

                    remaining_time = (total_size - downloaded_size) / download_speed if download_speed > 0 else 0
                    game_info["downloadingData"]["timeUntilComplete"] = str(time.timedelta(seconds=remaining_time))

                    safe_write_json(game_info_path, game_info)

            game_info["downloadingData"]["downloading"] = False
            game_info["downloadingData"]["progressUntilComplete"] = "100.00"
            game_info["downloadingData"]["progressDownloadSpeeds"] = "0.00 KB/s"
            game_info["downloadingData"]["timeUntilComplete"] = "0s"

            safe_write_json(game_info_path, game_info)

            extract_archive(archive_file_path, download_path)

        except Exception as e:
            logging.error(f"Failed to download file using requests: {e}")
            raise e

    logging.info(f"Trying to download game {game} using: {link}")
    try:
        if "gofile.io" in link:
            download_gofile(link, download_path, game_info_path, game_info)
        else:
            try:
                download_with_requests()
            except Exception as e:
                logging.warning(f"Requests failed with error: {e}. Attempting urllib.")
                download_with_urllib()
    except Exception as e:
        logging.error(f"Failed to download the game {game}. Error: {e}")
        raise e
        
    def download_with_requests(link, download_path, game_info_path, game_info):
        logging.debug("Entering download_with_requests function")
        session = requests.Session()
        session.mount('https://', SSLContextAdapter())

        try:
            response = session.get(link, stream=True)
            if response.status_code != 200:
                raise Exception(f"Response code was not 200. Instead got {response.status_code}")
            content_type = response.headers.get('Content-Type')
            if content_type and 'text/html' in content_type:
                raise Exception("Content-Type was text/html. Link most likely expired.")

            archive_ext = link.split('.')[-1]
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
                    game_info["downloadingData"]["progressUntilComplete"] = f"{progress * 100:.2f}"

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
        
    safe_write_json(game_info_path, game_info)

    try:
        if "gofile.io" in link:
            try:
                download_gofile(link, download_path)
            except Exception as e:
                handleerror(game_info, game_info_path, e)
                return
        try:
            archive_file_path, archive_ext = download_with_urllib()
        except Exception:
            archive_file_path, archive_ext =  download_with_requests(link, download_path)

        try:
            if archive_ext == "rar":
                rarfile.unrarlib.lib_path
                with rarfile.RarFile(archive_file_path, 'r') as fs:
                    files = fs.namelist()
                    fs.extractall(download_path, files)
            elif archive_ext == "zip":
                shutil.unpack_archive(archive_file_path, download_path, format="zip")
            os.remove(archive_file_path)
            game_info["downloadingData"]["extracting"] = False
            for file in os.listdir(download_path):
                if file.endswith(".url") or file.endswith(".txt"):
                    os.remove(os.path.join(download_path, file))
            extracted_folder = os.path.join(download_path, game)
            tempdownloading = os.path.join(download_path, f"temp-{os.urandom(6).hex()}")
            shutil.copytree(extracted_folder, tempdownloading)
            shutil.rmtree(extracted_folder)
            shutil.copytree(tempdownloading, os.path.join(download_dir, game), dirs_exist_ok=True)
            for file in os.listdir(os.path.join(download_dir, game)):
                if file.endswith(".url"):
                    os.remove(os.path.join(download_path, file))
            game_info["downloadingData"]["extracting"] = False
            del game_info["downloadingData"]
            shutil.rmtree(tempdownloading, ignore_errors=True)
            safe_write_json(game_info_path, game_info)
        except Exception as e:
            if "[WinError 183]" in str(e):
                handleerror(game_info, game_info_path, "Your antivirus software may be blocking the extraction process. Please whitelist the directories to extract automatically in the future.")
            handleerror(game_info, game_info_path, e)
    except Exception as e:
        handleerror(game_info, game_info_path, e)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--debug":
        logging.basicConfig(filename='debug.log', level=logging.DEBUG)
    _, function, *args = sys.argv
    if function == "download":
        link, game, online, dlc, version, download_dir = args
        download_file(link, game, online.lower() == 'true', dlc.lower() == 'true', version, download_dir)
    elif function == "retryfolder":
        game, online, dlc, version, download_dir, newfolder = args
        retryfolder(game, online.lower() == 'true', dlc.lower() == 'true', version, download_dir, newfolder)
    else:
        print(f"Invalid function: {function}")
        sys.exit(1)