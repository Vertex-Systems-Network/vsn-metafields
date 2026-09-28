# Dependency Security Overrides

This file documents temporary npm overrides used to keep the VSN Metafields dependency tree on patched versions without using `npm audit fix --force`.

## `deepmerge-ts` → `^8.0.2`

- **Reason:** production dependency remediation for GHSA-ggr8-5vv4-36mx in the Prisma/session-storage chain.
- **Scope:** transitive dependency used through Prisma / Shopify session storage.
- **Compatibility evidence:** App Validation, Prisma validate/migrate, contract smoke tests, build, production dependency audit, full-tree audit, and ANPOS Quality Gates are required before changes merge.
- **Removal condition:** remove the override once the upstream Prisma/Shopify session-storage dependency graph resolves a patched `deepmerge-ts` version without an override.

## `lodash` → `4.18.1`

- **Reason:** GHSA-f23m-r3pf-42rh affects lodash 4.17.23. The Shopify GraphQL codegen dependency tree previously installed `@graphql-codegen/plugin-helpers@5.1.1` with nested `lodash@4.17.23` because that package declares `lodash ~4.17.0`.
- **Scope:** development/build-time GraphQL code generation only; the production dependency audit was already green before this override.
- **Chosen version:** `4.18.1`, which is on the patched 4.18.x line.
- **Compatibility evidence:** npm-generated lockfile, GraphQL codegen/build path, lint, typecheck, contract smoke tests, build, full-tree high audit, and ANPOS Quality Gates must all pass.
- **Removal condition:** remove the override once the upstream GraphQL codegen dependency range admits a patched lodash release or no longer installs the vulnerable 4.17.x copy.

## TypeScript-ESLint remediation

The minimatch advisory was not handled with a permanent override. Instead:

- `@typescript-eslint/parser` and `@typescript-eslint/eslint-plugin` were upgraded together from 6.21.0 to 8.70.1;
- Node baseline was raised from 22.12 to 22.13 because the upgraded toolchain includes `eslint-visitor-keys@5.0.1`, which requires Node 22.13+ on the Node 22 line;
- the npm-generated lockfile resolves `@typescript-eslint/typescript-estree` to 8.70.1 and its nested `minimatch` to 10.2.6.

The dependency security workflow gates the complete installed tree at **high** severity so future dev/build high or critical advisories cannot silently regress.
