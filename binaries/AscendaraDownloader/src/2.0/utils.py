import os
import json
import string
import time
from tempfile import NamedTemporaryFile

def sanitize_folder_name(name):
    valid_chars = "-_.() %s%s" % (string.ascii_letters, string.digits)
    sanitized_name = ''.join(c for c in name if c in valid_chars)
    return sanitized_name

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

def handleerror(game_info, game_info_path, e):
    game_info['online'] = ""
    game_info['dlc'] = ""
    game_info['isRunning'] = False
    game_info['version'] = ""
    game_info['executable'] = ""
    del game_info['downloadingdata']
    game_info['downloadingdata'] = {
        "error": True,
        "message": str(e)
    }
    with open(game_info_path, 'w') as f:
        json.dump(game_info, f, indent=4)

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