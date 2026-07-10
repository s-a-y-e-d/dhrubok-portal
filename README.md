# Dhrubok Portal

School and coaching center management portal built with:

- Next.js App Router
- React
- TypeScript
- Tailwind CSS
- Convex

## Development

Install dependencies:

```bash
npm install
```

Run the Next.js app:

```bash
npm run dev
```

Run Convex in another terminal:

```bash
npm run convex:dev
```

The first Convex setup created a local deployment and wrote the required local environment variables to `.env.local`.

## Convex

Convex backend functions live in `convex/`.

Useful commands:

```bash
npm run convex:dev
npm run convex:codegen
npx convex ai-files update
npx convex ai-files status
```

Convex AI helper files are installed:

- `convex/_generated/ai/guidelines.md`
- Convex-managed section in `AGENTS.md`
- Convex-managed section in `CLAUDE.md`
- Convex agent skills

Before changing Convex code, read `convex/_generated/ai/guidelines.md`.

## Checks

```bash
npm run lint
npm run build
```
