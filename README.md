<div align="center">
    </a>
    <br />
    <img align="center" width="128" height="128" src="./readme/ascendara.png">
    <br />
    <br />

</div>

> With Ascendara, you can easily download, manage, and play pre-installed games without needs to go through the hassle of extracting, installing, and moving files. Ascendara's game list comes from a custom webscraper which for now only has games from [STEAMRIP](https://steamrip.com/), but plans for more sources later on.

## This is a discountined build of Ascendara. Please use the `main` branch of Ascendara

# Building the app

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

# License & Contact 📃
This project is published under the [CC BY-NC 1.0 Universal License (Non-Commercial Use Only)](./LICENSE)

If you are interested in working together, or want to get in contact with me please email me at santiago@tago.works
