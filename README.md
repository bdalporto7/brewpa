# brewpa

A monorepo for coffee-related applications.

## What's here

```
apps/
└── roasting/        Active — roasting (built for a Fresh Roast SR800) and brewing.
```

Start with [`apps/roasting`](apps/roasting/README.md) — that's where active
development is happening. Its
[`docs/ARCHITECTURE.md`](apps/roasting/docs/ARCHITECTURE.md) has a
diagram-first overview (system/deployment shape, data model). See
[AGENTS.md](AGENTS.md) for full project context: repo layout rationale, and
the reasoning behind specific design decisions.

## Quick start

```bash
./start.sh
```

Installs dependencies and sets up the local database on first run (safe to
re-run — it skips both once they're done), then starts the dev server. Open
http://localhost:3000.
