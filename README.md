<div align="center">
    </a>
    <br />
    <img align="center" width="128" height="128" src="./readme/ascendara.png">
    <br />
    <br />
    
    
   ![GitHub last commit](https://img.shields.io/github/last-commit/t-a-g-o/ascendara)
   ![GitHub issues](https://img.shields.io/github/issues-raw/t-a-g-o/ascendara)
   ![GitHub](https://img.shields.io/github/license/t-a-g-o/ascendara)
    
</div>

![Development](https://img.shields.io/badge/UNDER%20DEVELOPMENT-FF3100)


> With Ascendara, you can easily download, manage, and play pre-installed games without needs to go through the hassle of extracting, installing, and moving files. Ascendara's game list comes from a custom webscraper which for now only has games from [STEAMRIP](https://steamrip.com/), but plans for more sources later on

# Building the app
### Note: The Ascendara API requires a key which is private as of now. Game browsing will not function properly.

1. Build the React app
    ```sh
    npm run build
    ```
    This will build the app in `src` into a single index, css, and js file. Look in `src/dist` for the files.

2. In the dist, move the assets folder into the parent folder

3. In the index.html file of the built react app, you will see "assets/index.css", and "assets/index.js". Simply remove the "assets/" leaving just the file
   name in the source.

4. Move all files into the `build` directory

5. Build the Electron app
   ```sh
   npm run dist
   ```


# Development Roadmap

### Ascendara App
- [ ] Auto create shortcuts
- [x] Add news section
- [x] Make game searches less harsh
- [ ] Show recent games
- [ ] Storage information ontop of games library
- [ ] Theme settings
- [ ] Add different filtering options
- [ ] Add additional game sources
- [x] Populate pages
- [ ] Add notifications for games status
- [ ] -Small-undisturbing advertisments-
- [ ] Add different sources
- [ ] Welcome to app screens/info
- [x] Move tabs to the top left
- [ ] ~Make seperate library, downloads, and browse~
- [x] Add your own games
- [ ] Create Public API Keys for accounts
- [ ] Create Retry Download & Extract
- [ ] Add mulitple checks to alert if antivirus ruined a operation

### Ascendara Docs
- [ ] Create Installation Guide for Ascendara
- [ ] Source and how it works
- [ ] API Documentation
- [ ] Common Game Libraries & How to install
- [ ] All game sources currently used

# License & Contact 📃
This project is published under the [Apache License Version 2.0 License](./LICENSE)

If you are interested in working together, or want to get in contact with me please email me at santiago@tago.works
