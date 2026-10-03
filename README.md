# Potion Sort

A color-sorting puzzle for Android in the style of "water sort / fill the bottle" games —
but with glass **test tubes full of potions**. Tap a tube, then tap another to pour.
You can only pour onto the same color or into an empty tube. Sort every color into its own tube to win.

<img src="icon-512.png" width="96" alt="icon">

## Download the APK

Every push builds the app on GitHub Actions and publishes it to the
**[latest release](../../releases/tag/latest)** as `PotionSort.apk`.
Open that page on your phone, download the APK and install it
(allow "Install unknown apps" when Android asks).

## Gameplay

- **1000 levels**, 14 potion colors. Every level is generated from its number and checked by a solver, so it is always solvable.
- Difficulty ramps up as you progress:

  | Levels   | Colors  | Tube height | Hidden (`?`) layers | Undo / Hint |
  |---------:|--------:|------------:|--------------------:|------------:|
  | 1–11     | 3–6     | 4           | –                   | 5 / 3       |
  | 12–24    | 6–10    | 4           | 30% → 42%           | 5 / 3       |
  | 25–149   | 10–14   | 5           | 43% → 85%           | 5 / 3       |
  | 150–299  | 14      | 6           | 85%                 | 5 / 3       |
  | 300–599  | 14      | 6           | 85%                 | 4 / 2       |
  | 600–1000 | 14      | 6           | 85%                 | 3 / 1       |

  From level 40 the game also generates a few puzzles and keeps the one with the longest solution.
  Hidden layers show `?` until they reach the top of their tube.
- Per level: Undo, Hint (the solver shows the next good move) and 1 extra **Tube**.
- **Stars are based on moves.** Each level has a target move count (the solver's solution length):
  ★★★ at or under the target, ★★ up to 40% over it, ★ otherwise. The bar under the level name shows
  your current stars and `Moves N / limit` — the limit to keep those stars. Undone moves don't count.
- Level select, progress saved on the device.
- Settings: sound on/off, color-blind **symbols** on each color.

## Project layout

- `app/src/main/assets/www/` – the game itself (HTML5 canvas + JavaScript). Open `index.html` in a browser to play on a computer.
- `app/src/main/java/.../MainActivity.java` – full-screen WebView wrapper.
- `.github/workflows/build-apk.yml` – builds the APK and publishes the release.
- `tools/playtest.js` – automated test: checks all 1000 levels are solvable and auto-plays some levels (`node tools/playtest.js` with Playwright installed).
- `tools/make-icons.js` – regenerates the launcher icons.

## Building locally

With the Android SDK installed: `./gradlew assembleRelease` →
`app/build/outputs/apk/release/app-release.apk`.

The APK is signed with `app/potionsort.keystore` (password `potionsort`) so new builds
install over old ones. It is fine for personal use; generate your own private key before
publishing on Google Play.
