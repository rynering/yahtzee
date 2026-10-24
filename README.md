# Lucky Roll

A calm, accessible, single-player Yahtzee PWA. Five animated dice, classic scoring (including Joker rules), optional synthesized sound, a saved game, and the ten best completed scores. No account, database, or build step is needed.

## Deploy with GitHub Pages

1. Create a GitHub repository, with `main` as the default branch, and upload this project's contents. Include the hidden `.github` directory. A public repository can use GitHub Pages on GitHub Free; private repository Pages availability depends on your plan. The published game will be accessible to anyone with the URL.
2. In the repository, open **Settings → Pages → Build and deployment → Source**, and choose **GitHub Actions**.
3. Open **Actions → Deploy Lucky Roll to GitHub Pages → Run workflow** (or push a change to `main`). The workflow tests the rules and publishes the `dist` directory.
4. Copy the URL from the completed deployment, typically `https://YOUR-USERNAME.github.io/YOUR-REPOSITORY/`, and send it to Dad. All paths work under a repository subdirectory.

If you prefer Netlify or Cloudflare Pages, publish the `dist` directory as static files with no build command. HTTPS is required for offline support and installation, except on localhost.

## Add it to his home screen

- **iPhone/iPad:** open the published link in Safari → Share → Add to Home Screen → Add.
- **Android:** open in Chrome → ⋮ → Install app / Add to Home screen.
- **Computer:** use Chrome or Edge's install icon in the address bar when available.

Visit once while online and wait for the “Ready for offline play” message before relying on offline mode. The game caches its files using a service worker. Keep the same URL: moving to a new domain creates a separate local score history. Installed and browser contexts may keep separate data on some devices. Clearing browser/site data deletes saved games and scores. The app has no cloud sync.

## Run locally

From this directory: `python3 -m http.server 8000 --directory dist`, then open `http://localhost:8000`.

Run rule tests: `node --test tests/*.test.mjs`. The GitHub Pages workflow also checks the real browser layout at phone and desktop sizes, verifies scoring and offline play, and saves screenshots before deployment. To run that check locally, install `playwright@1.62.1`, set `CHROME_BIN` if Chrome is not at `/usr/bin/google-chrome`, and run `node scripts/browser-check.mjs`.

## Updating

Edit files in `dist`, bump the cache version in `dist/sw.js`, and update the matching CSS/JavaScript `?v=` values in both `dist/index.html` and the service-worker asset list. Test, then push to `main`. Versioned asset URLs let existing installations load the matching UI and code together. Close all app windows and reopen to activate an installed update. The current game is stored under the stable `lucky-roll-v1` local-storage key.

## Rules

13 categories, up to three rolls per turn, a 35-point upper bonus at 63, and 100 points for each additional Yahtzee when the Yahtzee box contains 50. Five matching dice after the Yahtzee box has been filled invoke the Joker placement rule. Full house is exactly a pair plus a triple except under Joker rules.

The game uses browser Web Audio, localStorage, a web app manifest, and a service worker. Visual fonts fall back to local system fonts offline. No external scripts, trackers, or paid services are required. This is an independent fan project; Yahtzee is a trademark of its respective owner.
