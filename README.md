# Joshua Qin: portfolio

The site at **https://jqin110-tech.github.io**. The top is a small galaxy you can fly through, with one planet for each part of my resume. Below it is the full resume and six projects, each with a demo you can try on the page.

## What is in this repository

| Path | What it is |
|---|---|
| `index.html`, `assets/`, `og.jpg` | The built site. GitHub Pages serves these files as they are. |
| `source/` | The code the site is built from: TypeScript, Vite and Canvas 2D, with no game engine. |

## Who built what

I designed and directed this site: the idea, the look, the interactions and what goes on the page, over more than 40 versions. The TypeScript was written by Claude Code from my specs, and I reviewed and tested each build. The other projects have their own repositories, linked below.

## The projects on the site

| Project | What it is | Links |
|---|---|---|
| Gravity Simulator | Newtonian N-body simulator, from the real solar system to a 100,000-body galaxy collision | [demo](https://jqin110-tech.github.io/nbody-gravity-simulator/) · [code](https://github.com/jqin110-tech/nbody-gravity-simulator) |
| Tickerchatter | Live site that flags stocks whose news coverage suddenly breaks from normal | [site](https://jqin110-tech.github.io/tickerchatter/) · [code](https://github.com/jqin110-tech/tickerchatter) |
| Brain Oxygen Model | One-equation model of how fast a blood choke causes unconsciousness, tested against published measurements | [code](https://github.com/jqin110-tech/blood-choke-model) |
| Backtester | Research backtester that tests a trading rule and an ML model honestly | [code](https://github.com/jqin110-tech/backtester) |
| Banking System | Command-line banking app with persistent transaction history | [code](https://github.com/jqin110-tech/banking-system) |

## How the site works

- All the resume text lives in one file, `source/src/data.ts`. The galaxy, the resume and the one-page quick resume are all drawn from it.
- The planets sit along a golden spiral, r = R₀·φ^(−2θ/π), at equal steps of arc length.
- The galaxy is drawn on one Canvas 2D element. It works with a keyboard, a mouse or touch, and it respects the reduced-motion setting.
- "Save as PDF" prints a one-page resume from the same page, using a print stylesheet.

## Run it

```
cd source
npm install
npm run dev            # local dev server
HOSTED=1 npm run build # production build in source/dist/
```

To publish, copy the contents of `source/dist/` to the top of this repository and push.

## Credits

- The picture for the Brain Oxygen Model uses anatomy from BodyParts3D, © The Database Center for Life Science, licensed under CC BY 4.0, modified.
- Album art belongs to the artists and their labels.
- Fonts: Jost, IBM Plex Mono and Bricolage Grotesque from Google Fonts, and Computer Modern for the quick resume.
