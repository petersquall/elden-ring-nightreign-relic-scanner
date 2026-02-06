# Relic Scanner - Elden Ring: Nightreign

> Scan your in-game relics with your phone camera and export them to [relics.pro](https://relics.pro) for build optimization.

**[Try it now](https://petersquall.github.io/elden-ring-nightreign-relic-scanner/)** | Alpha v0.2

---

## The Problem

In Elden Ring: Nightreign, relics are the core of your build. As you collect more and more relics, it becomes nearly impossible to keep track of which ones you have and which combinations would be optimal.

[relics.pro](https://relics.pro) is an amazing community tool for planning and optimizing relic builds - but its relic recognition feature only supports **PC and PS4**. If you're on **PS5**, there's no way to import your relics... until now.

## The Solution

**Relic Scanner** is a mobile-friendly PWA that uses your phone's camera + OCR to read relic effects directly off your TV/monitor screen. It works with **any platform** - PS5, Xbox, PC, whatever is displayed on your screen.

### How It Works

1. **Point your phone** at a relic's effect list on your TV/monitor
2. **OCR reads the text** and fuzzy-matches each effect against a database of 546+ known relic effects
3. **Auto-detects** relic color, Deep Night status, and unique relic names (like Glass Necklace, Silver Tear, etc.)
4. **Save & repeat** for each relic in your collection
5. **Export as JSON** and upload to [relics.pro/my-relics](https://relics.pro/my-relics)
6. **Optimize your build** using relics.pro's build optimizer with your actual relic collection

## Features

- **Real-time OCR scanning** - Powered by Tesseract.js v5, scans every few seconds automatically
- **Fuzzy text matching** - Uses Fuse.js to match OCR text against effect names, tolerant of reading errors
- **546+ relic effects** - Complete effect database sourced from [community spreadsheet](https://docs.google.com/spreadsheets/d/1Gz6fqIBNr2BXr45te9ewTolHJr4zZ_Apbqa09gL3VbI)
- **45 unique relic names** - Recognizes quest relics like Glass Necklace, Old Pocketwatch, Night of the Beast, etc.
- **Auto color detection** - Detects relic color (Red/Green/Blue/Yellow) from the camera feed
- **Deep Night detection** - Automatically identifies Deep Night relics from OCR text
- **Adjustable crop box** - Position saved between sessions, frame just the effect text for best results
- **Tunable settings** - Contrast, threshold, blur, scale, match sensitivity, scan interval
- **relics.pro compatible export** - JSON format with real effect IDs, ready to import
- **Works offline** - Full PWA with Service Worker caching
- **iOS & Android** - Share API for iOS file export, blob download for Android/desktop

## Screenshots

| Home Screen | Scanner | Export | Help |
|:-----------:|:-------:|:------:|:----:|
| ![Home](assets/screenshots/home.jpg) | ![Scanner](assets/screenshots/scanner.jpg) | ![Export](assets/screenshots/export.jpg) | ![Help](assets/screenshots/help.jpg) |
| View your scanned relics, tap to expand and see all effects | Point camera at relic effects, auto-scan with OCR | Export JSON, upload to relics.pro | Built-in tutorial for new users |

## Quick Start

1. Open **[petersquall.github.io/elden-ring-nightreign-relic-scanner](https://petersquall.github.io/elden-ring-nightreign-relic-scanner/)** on your phone
2. Tap **Scan** and allow camera access
3. Point your phone at a relic's effect list on your TV
4. Adjust the crop box to frame the effects text
5. Tap **Start Scan** - the app reads effects automatically every few seconds
6. Verify the matched effects and tap **Save Relic**
7. Repeat for each relic
8. Go back to home, tap the **export icon** (top-right)
9. Tap **Download JSON**
10. Open **[relics.pro/my-relics](https://relics.pro/my-relics)** and upload your JSON

## Tips for Best Results

- **Frame the effects text tightly** with the crop box - exclude the relic name/header area
- **Hold your phone steady** and parallel to the screen to minimize distortion
- **Good lighting helps** - avoid glare on your TV/monitor
- **Adjust settings** if OCR accuracy is low:
  - Increase **contrast** for faded text
  - Tweak **threshold** for better binarization
  - Lower **match threshold** if effects aren't matching (but too low = false positives)
  - Try **PSM 4 (Column)** if effects are in a single column layout
- **Check & correct** matched effects before saving - you can remove wrong matches and manually adjust color/DN

## Tech Stack

- **Tesseract.js v5** - OCR engine (loaded from CDN)
- **Fuse.js v7** - Fuzzy text search (loaded from CDN)
- **Vanilla JS** - No framework, no build step
- **PWA** - Service Worker + Web App Manifest for offline support
- **getUserMedia API** - Camera access
- **Share API** - iOS-compatible file export

## Data Sources

- **Effect database**: [Nightreign Effect Data](https://docs.google.com/spreadsheets/d/1Gz6fqIBNr2BXr45te9ewTolHJr4zZ_Apbqa09gL3VbI) community spreadsheet (546 relic effects with IDs)
- **Relic names**: Items sheet from the same spreadsheet (45 unique quest relics)

## Local Development

No build step required. Just serve the files over HTTPS (needed for camera access):

```bash
# Using Node.js
npx serve .

# Or any static file server
# localhost is treated as secure context, so HTTP works too
```

Open `https://localhost:3000` (or whatever port) on your phone on the same network.

## Why This Exists

The relics.pro relic scanner uses screenshot recognition that only works on PC and PS4. PS5 players had no way to import their relic collection. This app bridges that gap by using OCR on a phone camera pointed at any screen, making it platform-independent.

Built during the Nightreign launch window when managing 50+ relics became a real pain.

## Support This Project

If this tool saved you time, consider supporting development:

- **[Buy me a coffee on Ko-fi](https://ko-fi.com/YOUR_KOFI_USERNAME)** - One-time support, every bit helps
- **[Star this repo](https://github.com/petersquall/elden-ring-nightreign-relic-scanner)** - Helps others discover the tool
- **Share it** - Post in your Elden Ring communities, Discord servers, and Reddit

## Contributing

Found a bug or have a suggestion? [Open an issue](https://github.com/petersquall/elden-ring-nightreign-relic-scanner/issues).

## License

MIT

---

*Built for the Nightreign community. Not affiliated with FromSoftware, Bandai Namco, or relics.pro.*
