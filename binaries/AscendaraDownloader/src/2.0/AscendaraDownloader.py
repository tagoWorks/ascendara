import sys
from download import download_file
from retryfolder import retryfolder

if __name__ == "__main__":
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