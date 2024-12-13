<div align="center">
    </a>
    <br />
    <img align="center" width="128" height="128" src="./public/icon.png">
    <br />
    <br />
    
    
   ![GitHub last commit](https://img.shields.io/github/last-commit/tagoWorks/ascendara)
   ![GitHub issues](https://img.shields.io/github/issues-raw/tagoWorks/ascendara)
   
</div>

> With Ascendara, you can easily download, manage, and play pre-installed games without needs to go through the hassle of extracting, installing, and moving files. Ascendara's game list comes from a custom webscraper which for now only has games from [STEAMRIP](https://steamrip.com/), but plans for more sources later on.


# Preview of Ascendara

#### Download Ascendara V7 right now https://ascendara.app/

Home Page
![(home)](./readme/home.png)

Search Page
![(search)](./readme/search.png)

Library Page
![(library)](./readme/library.png)

Downloads Page
![(downloads)](./readme/downloads.png)


# Building the app from source [(view wiki)](https://github.com/tagoWorks/ascendara/wiki/Running-as-a-Developer)

1. Clone the repository
    ```sh
    git clone https://github.com/tagoWorks/ascendara.git
    ```

2. Install requirements
    ```sh
    npm install -r
    ```
    
3. Build the React-Electron app (runs python script)
    ```sh
    npm run dist
    ```
Open settings and click F5 for development tools

# Development Roadmap [(view wiki)](https://github.com/tagoWorks/ascendara/wiki/Contributing#development-roadmap)

### Ascendara App
- [ ] Auto create shortcuts
- [ ] Be able to run scripts optionally instead of execute game file
- [x] Add news section
- [x] Make game searches less harsh
- [ ] Storage information ontop of games library
- [x] Theme settings
- [x] Add different filtering options
- [ ] Add total time played
- [x] Add tooltips
- [x] Populate pages
- [ ] Add notifications for games status
- [ ] Add different sources
- [x] Welcome to app screens/info
- [x] Move tabs to the top left
- [x] Make seperate library, downloads, and browse
- [x] Add your own games
- [x] Create Public API
- [ ] Create Retry Download & Extract
- [ ] Add mulitple checks to alert if antivirus ruined a operation
- [ ] Add older game versions
- [x] Sort by popularity

# License & Contact 
This project is published under the [CC BY-NC 1.0 Universal License (Non-Commercial Use Only)](./LICENSE)

If you are interested in working together, or want to get in contact with me please email me at santiago@tago.works
