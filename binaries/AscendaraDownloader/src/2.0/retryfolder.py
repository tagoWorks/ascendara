import os
import json
import shutil
from utils import sanitize_folder_name

def retryfolder(game, online, dlc, version, download_dir, newfolder):
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
    game_info["downloadingData"]["extracting"] = True
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)

    extracted_folder = os.path.join(download_dir, newfolder)
    tempdownloading = os.path.join(download_dir, f"temp-{os.urandom(6).hex()}")
    shutil.copytree(extracted_folder, tempdownloading)
    shutil.rmtree(extracted_folder)
    shutil.copytree(tempdownloading, os.path.join(download_dir), dirs_exist_ok=True)
    for file in os.listdir(os.path.join(download_dir)):
        if file.endswith(".url"):
            os.remove(os.path.join(download_dir, file))
    game_info["downloadingData"]["extracting"] = False
    del game_info["downloadingData"]
    shutil.rmtree(tempdownloading, ignore_errors=True)
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)