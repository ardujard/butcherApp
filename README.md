# Butcher Counter Stock Tracker

A single-iPad Progressive Web App for tracking which production dates make up
a butchery counter's current stock, so aging stock can be caught before it
becomes waste. All data is stored locally on the device (IndexedDB) — there is
no backend and nothing leaves the iPad.

## Develop

```
npm install
npm run dev
```

## Test

```
npm test
```

Domain logic (the LIFO batch-replay engine) lives in `src/domain/` and is
fully unit-tested; `src/data/` (IndexedDB) is tested against
`fake-indexeddb`.

## Build & deploy

```
npm run build
```

Produces a static `dist/` bundle (including an offline-capable service
worker) that can be hosted anywhere static files are served, e.g. GitHub
Pages. Open the deployed URL in Safari on the iPad and use
Share → "Add to Home Screen" to install it.
