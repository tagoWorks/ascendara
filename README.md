<div align="center">
    </a>
    <br />
    <img align="center" width="128" height="128" src="./readme/ascendara.png">
    <br />
    <br />
    
    
   ![GitHub last commit](https://img.shields.io/github/last-commit/tagoWorks/ascendara)
   ![GitHub issues](https://img.shields.io/github/issues-raw/tagoWorks/ascendara)
   ![GitHub](https://img.shields.io/github/license/tagoWorks/ascendara)
    
</div>

> With Ascendara, you can easily download, manage, and play pre-installed games without needs to go through the hassle of extracting, installing, and moving files. Ascendara's game list comes from a custom webscraper which for now only has games from [STEAMRIP](https://steamrip.com/), but plans for more sources later on.

## Download Ascendara right now! https://ascendara.app/

# Building the app [(view wiki)](https://github.com/tagoWorks/ascendara/wiki/Running-as-a-Developer)
> [!NOTE]  
> The Ascendara API requires a key which is private as of now. Game browsing will not function properly. In `Browsing.jsx` replace the link "https://api.ascendara.app/json/games" with "https://api.ascendara.app/developer/json/games" for a preview game in order to make changes to the UI. Or you can use the component in the `readme` directory with this process already completed.
1. Clone the repository
    ```sh
    git clone https://github.com/tagoWorks/ascendara.git
    ```

2. Install requirements
    ```sh
    npm install -r
    ```
    
3. Build the React app
    ```sh
    npm run build
    ```
    This will build the app in `src` into a single index, css, and js file. Look in `src/dist` for the files.

4. In the dist, move the assets folder into the parent folder

4. In the index.html file of the built react app, you will see "assets/index-########.css", and "assets/index-########.js". Simply remove the "assets/" leaving just the file
   name in the source.
   "########" being a random string of characters
6. Move all files into the `build` directory

7. In the main.js, go towards the bottom and delete `mainWindow.loadURL('http://localhost:5173/')`, and uncomment `mainWindow.loadURL('file://' + path.join(__dirname, 'index.html'));` in order to run correctly

8. Build the Electron app
   ```sh
   npm run dist
   ```
Open settings and click F5 for development tools

# Development Roadmap

### [Ascendara App](https://github.com/tagoWorks/ascendara/wiki/Contributing#development-roadmap)
- [ ] Auto create shortcuts
- [x] Add news section
- [x] Make game searches less harsh
- [ ] ~Show recent games~
- [ ] Storage information ontop of games library
- [ ] Theme settings
- [ ] Add different filtering options
- [ ] Add total time played
- [x] Add tooltips
- [x] Populate pages
- [ ] Add notifications for games status
- [ ] ~Small undisturbing advertisments~
- [ ] Add different sources
- [x] Welcome to app screens/info
- [x] Move tabs to the top left
- [ ] ~Make seperate library, downloads, and browse~
- [x] Add your own games
- [ ] Create Public API Keys for accounts
- [ ] Create Retry Download & Extract
- [ ] Add mulitple checks to alert if antivirus ruined a operation
- [ ] Add older game versions
- [x] Sort by popularity

# License & Contact 📃
This project is published under the [Apache License Version 2.0 License](./LICENSE)

If you are interested in working together, or want to get in contact with me please email me at santiago@tago.works
