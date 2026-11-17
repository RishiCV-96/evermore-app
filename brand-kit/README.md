# Tandem brand kit

The designer's files, copied as they are from `tandem-brand-kit.zip` (draft v1, 2026-11-16). They are the source of truth for the logo, the app icons and the favicon. "Tandem" is a placeholder name pending trademark clearance; the name the app shows comes from `src/config/brand.ts`.

- Never edit these files to change the app: replace them with a new kit and rerun `node scripts/make-brand-assets.mjs`.
- `scripts/check-brand.mjs` fails if a logo file in `assets/` differs from what this kit makes.
- `tandem-brand-guide.png` is the visual reference: clear space, minimum sizes, colors and what not to do.
