# RAYDAR 2.4 (React + Motion)

A component-based port of `RAYDAR_2.2.html`, built to use the full charles-ux-animation skill.

## New in 2.4

- **Answer transition**: the answered question slides out (100ms) as the next slides in (220ms, 50ms later). The next question is live straight away, so typing ahead never waits on the animation. In the section list, the "ask next" highlight glides to the next row and sections slide.
- **Key 1 = the likely answer**: the suggested answer when RAYDAR has one, otherwise the answer that moves on (eligible, opens no follow-up). The other answers keep their order on 2, 3 and 4. The key-1 badge is filled.
- **Section list shows full questions inline**: cohort dates, away dates, alcohol and the medication and history logs appear in place of "Open full question". Medication and history now keep separate forms (`S.mf` / `S.hf`).
- **Rebindable shortcuts**: Tools → Keyboard shortcuts. Click a key, press the new one (Esc cancels); a taken key swaps. Saved per browser in `localStorage` (`src/engine/keys.js`).
- **Next-step prompts**: when Identity, Quick check, the study pre-questions or the pre-screen is complete, a prompt offers the next step (Enter by default) and the next step in the step bar pulses. The pre-screen no longer jumps to Finish by itself.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ — needs a web server (e.g. `npm run preview`); double-clicking dist/index.html shows a blank page
npm run build:single   # one self-contained file, written to ../RAYDAR_2.4.html — opens by double-click
```

After changing anything in `src/`, run `npm run build:single` again to refresh `RAYDAR_2.4.html`.

## Where things live

| Path | What it is |
| --- | --- |
| `src/engine/data.js` | Studies, prohibited lists and questions, generated unchanged from 2.2 |
| `src/engine/store.js` | State, eligibility rules and `act()`, generated from 2.2; `commit()` replaces `render()`. 2.4 adds `ansOrder()` and `nextStep()` |
| `src/engine/keys.js` | Keyboard bindings: defaults, rebinding, labels |
| `src/motion/tokens.js` | Every duration and curve, plus the stage-change storyboard |
| `src/motion/components.jsx` | `Expander`, `IconSwap`, `Row`, `Piece`, `Err`, `shake()`, `QSlide` |
| `src/views/NextStep.jsx` | The next-step prompt |
| `src/views/*` | One file per area: header, intake, pre-screen, med log, planner, Dr enquiry, finish, side panel, tools, tooltip |
| `src/styles.css` | 2.2 base styles plus the CSS motion layer (press, hover, expanders) |

## Motion at a glance

- **Answers and question navigation**: a short slide (see the answer storyboard in `tokens.js`) that never holds the next question back. Undo and toggles stay instant (frequency rule). `FREQ` in `store.js` lists them.
- **Stages**: the old stage leaves while the new one's pieces stagger in, 90ms apart.
- **Panels and expanders**: grid rows 0fr → 1fr (250ms open, 190ms closed) with a fade, so content below glides.
- **Lists** (studies, logged meds, form rows, away dates): FLIP reorders, rows rise in and fade out.
- **Toast, tooltip, icon swaps, async Copy button, error shake**: as in the skill's recipes.
- **Reduced motion**: every animation off, fades included; the spinner keeps turning.

In dev, `window.raydar` exposes the store (`raydar.S`, `raydar.act('confirm')`).
