# RAYDAR 2.3 (React + Motion)

A component-based port of `RAYDAR_2.2.html`, built to use the full charles-ux-animation skill.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — needs a web server (e.g. `npm run preview`); double-clicking dist/index.html shows a blank page
npm run build:single   # one self-contained file, written to ../RAYDAR_2.3.html — opens by double-click
```

After changing anything in `src/`, run `npm run build:single` again to refresh `RAYDAR_2.3.html`.

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine/data.js` | Studies, prohibited lists and questions, generated unchanged from 2.2 |
| `src/engine/store.js` | State, eligibility rules and `act()`, generated from 2.2; `commit()` replaces `render()` |
| `src/motion/tokens.js` | Every duration and curve, plus the stage-change storyboard |
| `src/motion/components.jsx` | `Expander`, `IconSwap`, `Row`, `Piece`, `Err`, `shake()` |
| `src/views/*` | One file per area: header, intake, pre-screen, med log, planner, Dr enquiry, finish, side panel, tools, tooltip |
| `src/styles.css` | 2.2 base styles plus the CSS motion layer (press, hover, expanders) |

## Motion at a glance

- **Answers, question navigation, undo, toggles**: instant, by design (frequency rule). `FREQ` in `store.js` lists them.
- **Stages**: the old stage leaves while the new one's pieces stagger in, 90ms apart.
- **Panels and expanders**: grid rows 0fr → 1fr (250ms open, 190ms closed) with a fade, so content below glides.
- **Lists** (studies, logged meds, form rows, away dates): FLIP reorders, rows rise in and fade out.
- **Toast, tooltip, icon swaps, async Copy button, error shake**: as in the skill's recipes.
- **Reduced motion**: every animation off, fades included; the spinner keeps turning.

In dev, `window.raydar` exposes the store (`raydar.S`, `raydar.act('confirm')`).
