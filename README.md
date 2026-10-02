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

- 14 potion colors, endless levels; every level is generated from its number and checked by a solver, so it is always solvable.
- Difficulty ramps up as you progress:

  | Levels | Colors | Tube height | Mystery layers |
  |-------:|-------:|------------:|---------------:|
  | 1–3    | 3      | 4           | –              |
  | 4–11   | 4–6    | 4           | –              |
  | 12–24  | 6–10   | 4           | 30% → 54% hidden (`?`) |
  | 25–34  | 11–14  | 5           | up to 80% hidden |
  | 35+    | 14     | 5           | 80% hidden     |

  Hidden layers show `?` until they reach the top of their tube.
- Per level: 5 **Undo**, 1 extra **Tube**, 3 **Hints** (the solver shows the next good move).
- Stars for finishing in few moves, level select, progress saved on the device.
- Settings: sound on/off, color-blind **symbols** on each color.

## Project layout

- `app/src/main/assets/www/` – the game itself (HTML5 canvas + JavaScript). Open `index.html` in a browser to play on a computer.
- `app/src/main/java/.../MainActivity.java` – full-screen WebView wrapper.
- `.github/workflows/build-apk.yml` – builds the APK and publishes the release.
- `tools/playtest.js` – automated test: checks levels 1–80 are solvable and auto-plays some levels (`node tools/playtest.js` with Playwright installed).
- `tools/make-icons.js` – regenerates the launcher icons.

## Building locally

With the Android SDK installed: `./gradlew assembleRelease` →
`app/build/outputs/apk/release/app-release.apk`.

The APK is signed with `app/potionsort.keystore` (password `potionsort`) so new builds
install over old ones. It is fine for personal use; generate your own private key before
publishing on Google Play.
