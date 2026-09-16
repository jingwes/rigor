# Rigor

_Working name — not final branding._

Rigor is a free, privacy-preserving, browser-based alternative to the parts
of GraphPad Prism that high-school researchers most commonly need. Instead of
starting from a statistical test, Rigor starts from the experimental design:
students describe how their experiment was actually performed, and the app
determines which analyses and visualizations are statistically defensible
for that design.

**Statistics that start with your experiment.**

## What Rigor is / is not

Rigor **is**:

- A tool that helps students pick statistically appropriate analyses based on
  how their experiment was designed.
- A 100% static, client-side web app with no account, no API, and no server
  required to use it.
- Free and open source.

Rigor **is not**:

- A replacement for a statistician, teacher, or mentor. It supports
  judgment, it doesn't replace it.
- An AI system that determines scientific truth. It encodes statistical
  reasoning rules; it does not interpret or validate the science itself.
- A service that requires (or has) accounts, servers, or API keys.

## Privacy

All experimental data a student enters stays in their browser. Rigor has no
backend, no database, and sends nothing to any server. There is no analytics
or telemetry of any kind in this codebase.

## Development

Requirements: Node.js (LTS) and npm.

```bash
git clone https://github.com/jingwes/rigor.git
cd rigor
npm install
npm run dev
```

Other scripts:

```bash
npm run build      # production build
npm run preview    # preview the production build locally
npm run lint        # ESLint
npm run typecheck   # TypeScript, no emit
npm test            # Vitest
npm run format       # Prettier, write mode
```

## Project status

This is an early-stage, open-source project following a milestone-based
roadmap. This repository currently reflects **Milestone 0: repository
scaffold only** — build tooling, linting, testing, CI/CD, and folder
structure. The experimental-design wizard, rules engine, statistics engine
(client-side, via Pyodide + SciPy), and chart rendering are **not
implemented yet**.

## License

[MIT](./LICENSE)
