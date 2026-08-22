# brewpa

A monorepo for coffee-related applications.

## What's here

```
apps/
└── roasting/        Active — a local roasting app built for a Fresh Roast SR800.
archive/
└── coffee-journal/  Archived — a brew-logging app, frozen, kept for reference.
```

Start with [`apps/roasting`](apps/roasting/README.md) — that's where active
development is happening. See [AGENTS.md](AGENTS.md) for full project
context: repo layout rationale, the roasting app's data model, and the
design standards this project holds itself to.

## Quick start

```bash
./start.sh
```

Installs dependencies and sets up the local database on first run (safe to
re-run — it skips both once they're done), then starts the dev server. Open
http://localhost:3000.
