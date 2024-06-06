import requests
import time
import sys

# Set the current version
CURRENT_VERSION = "1.0"

# Set the URLs
VERSION_URL = "https://storage.ascendara.app/files/version.json"
VERSIONINFO_URL = "https://storage.ascendara.app/files/binaries/versioninfo.json"

while True:
    response = requests.get(VERSION_URL)
    if response.status_code == 200:
        latest_version = response.json()["version"]
        print(f"Latest version: {latest_version}")
        if latest_version!= CURRENT_VERSION:
            print("Update available! Updating...")
            CURRENT_VERSION = latest_version
            response = requests.get(VERSIONINFO_URL)
            if response.status_code == 200:
                version_info = response.json()
                print("Version info:")
                for component, versions in version_info.items():
                    for version in versions:
                        print(f"  {component}: {version['version']}")
                for component, versions in version_info.items():
                    for version in versions:
                        if version["version"]!= getattr(sys.modules[__name__], f"CURRENT_{component}_VERSION", "0.0"):
                            print(f"Updating {component} to version {version['version']}...")
                            setattr(sys.modules[__name__], f"CURRENT_{component}_VERSION", version["version"])
                            print(f"Updated {component} to version {version['version']}!")
            else:
                print(" Failed to get version info.")
        else:
            print("No update available.")
    else:
        print("Failed to get latest version.")
    time.sleep(3600)