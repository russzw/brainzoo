# 🧠 Brain Zoo

An interactive 3D comparison of brain sizes across the animal kingdom. Every
brain on the turntable is a **procedurally generated 3D model** — no external
meshes — scaled in real time by the metric you choose. Switch metrics and watch
the brains reshape and re-rank, revealing the twist that **bigger isn't always
smarter**.

Built with [Three.js](https://threejs.org/) + [Vite](https://vitejs.dev/).

## ✨ Features

- **Four comparison metrics** — resize and re-sort the whole zoo by any of:
  - **Brain Mass** — absolute brain weight in grams (the classic "how big is it?" view).
  - **Neuron Count** — estimated total neurons (billions). The elephant overtakes
    the whale here; the human stays remarkably dense.
  - **Encephalization Quotient (EQ)** — brain size relative to what's expected for
    an animal's body mass. Humans top the chart; dolphins come second.
  - **Brain∶Body Ratio** — brain mass divided by body mass. Flips the ranking
    entirely: the sperm whale shrinks to a speck while small, neuron-dense animals
    loom large.
- **True Scale ↔ Normalized** — see brains at real relative sizes, or normalize
  them to a uniform display size with the value shown as a label.
- **Animated sorting** — hit *Sort* to glide the brains into ascending/descending
  order by the active metric.
- **Play Tour** — auto-cycles through all four metrics every few seconds.
- **Search / filter** — type a species name to isolate it.
- **Hover & click** — highlight a brain and open an info panel with its stats and a fact.
- **Day / Night theme** — switch the whole scene's lighting and palette.
- **About modal** — project info and a link back to this repo.

## 🚀 Getting started

```bash
npm install
npm run dev
```

Then open the printed local URL (default http://localhost:5173).

```bash
npm run build     # production build into dist/
npm run preview   # preview the production build
```

## 🧬 The data

All figures live in a single editable file, [`src/data.js`](src/data.js):

- **Brain & body masses** are taken from standard comparative neuroanatomy /
  brain–body weight tables.
- **Neuron counts** and **EQ** are representative, rounded figures drawn from the
  literature (e.g. Herculano-Houzel et al. on neuron counts; Jerison's
  encephalization-quotient tables). They're accurate enough for visualization and
  easy to refine.

## 🛠️ How it works

- [`src/brain.js`](src/brain.js) — generates each brain from an icosahedron, then
  displaces vertices with layered **ridged simplex noise** to carve gyri/wrinkles,
  cuts a longitudinal fissure down the midline, and appends a cerebellum and brain
  stem.
- [`src/main.js`](src/main.js) — scene, lighting, arc layout, metric/scaling logic,
  animated transitions, raycasting for selection, and the UI controls.
- [`src/data.js`](src/data.js) — the species dataset.
- [`index.html`](index.html) / [`src/style.css`](src/style.css) — markup and UI styling.

## 📝 License

MIT — do whatever you like.
