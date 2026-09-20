# Pulse H5 development guide

## Product scope

This repository is the full Pulse mobile web frontend, corresponding to the iOS client. Home, Create, Remix, assets, generation, preview, publishing, Profile, authentication, community and settings belong here. The public Web Player is one module, never a substitute for the full product.

Read `docs/product.md`, `docs/architecture.md` and `docs/roadmap.md` before implementation. Keep implemented and planned capabilities explicit. The application is runnable. Read docs/acceptance.md for verified journeys and outstanding production integration; do not equate deterministic-local checks with live model or production acceptance.

## Contracts and architecture

- Reuse `pulse-api` business contracts and generation state machines. Do not implement an independent Agent or call model providers from the browser.
- Use `pulse-ios` as a product and behavior reference; adapt lifecycle, navigation, auth and input to browsers.
- Consumer web authentication must remain separate from admin login. Never put admin headers, tokens or provider secrets in browser code.
- Original creation has no parent work. Remix starts from an explicitly selected source; the backend owns lineage.
- Keep candidate versions private until the author explicitly publishes the selected Artifact.
- Treat generated bundles as untrusted. Preserve sandbox and CSP boundaries, validate messages, and run only the active Artifact.

## Validation

When application code exists, run its typecheck, relevant tests and production build. UI changes require browser verification of the actual affected journey, including failure and recovery states. Record results and limitations; mock and local checks do not prove live generation or production readiness.

When pushing code with CI, verify remote checks for the exact submitted commit. Documentation-only changes require accurate cross-references and a diff review, not invented application test results.

## Public repository hygiene

Commit only relevant source, synthetic fixtures and public documentation. Ignore `.env` files, credentials, session data, uploads, generated bundles and local reports. Do not copy sibling repositories or their history wholesale. Do not assign an open-source license without an explicit project decision.
