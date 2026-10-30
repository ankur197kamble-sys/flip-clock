# Flip Clock

A calm flip clock with a focus timer. It installs on a phone or laptop straight from the browser (no app store, no emulator) and works offline once installed.

## Features
- Flip clock with 12/24-hour time, optional seconds, date, week and day of year
- Focus mode: 25/5, 50/10 and 90/20 presets or custom lengths, long break every few sessions, session dots, minutes focused today
- Chime, vibration and a notification when a timer ends
- Light, dark, or Auto (follows the device)
- Controls fade out after 4 seconds; full screen with **F** or a double-click
- Keeps the screen on while open (can be turned off)

## Install
The app has to be served over **https** for phones to install it. Host this folder on any static host (GitHub Pages, Netlify, Cloudflare Pages), then:

- **Android (Chrome):** open the link, then tap menu ⋮ → *Install app* / *Add to Home screen*
- **iPhone (Safari):** open the link, then tap Share → *Add to Home Screen*
- **Windows / Mac (Chrome or Edge):** open the link, then click the install icon in the address bar, or use *Install app* from the menu

## Run locally
```
python -m http.server 5180
```
Then open http://localhost:5180. You can install it from there on the same laptop too.
