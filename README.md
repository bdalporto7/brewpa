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
cd apps/roasting
npm install
npx prisma migrate dev
npm run dev
```

Then open http://localhost:3000.
