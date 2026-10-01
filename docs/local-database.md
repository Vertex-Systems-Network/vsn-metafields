# Database routing

| Environment | Database | Prisma schema | Session data |
| --- | --- | --- | --- |
| Local development | SQLite file `prisma/local/dev.db` | `prisma/local/schema.prisma` | Local only |
| Staging | Neon PostgreSQL staging endpoint `ep-snowy-surf-b3gxl2wf` | `prisma/schema.prisma` | Staging only |
| Live | Neon PostgreSQL production endpoint `ep-flat-mouse-b5z1wu54` | `prisma/schema.prisma` | Live only |

Local SQLite is the selected setup; a Laragon database is not used. Sessions and access tokens are isolated by environment. Do not copy production sessions into a local database.

## Local setup

1. Install dependencies with the project's Node 22.13+ (<23) runtime.
2. Copy `.env.local.example` to `.env.local`, fill in the **local development Shopify app** credentials, and keep `VSN_DB_TARGET=local-sqlite` and `DATABASE_URL=file:./dev.db`.
3. Run `npm run db:local:setup` to generate the SQLite Prisma client and apply local migrations. The database file is created under `prisma/local/` and ignored by Git.
4. Run `npm run dev:local`. This repeats the safe migration check before starting the Shopify local dev command.

The PostgreSQL schema and its migrations continue to govern staging/live. Those environments use their own protected `DATABASE_URL` (pooled) and `DIRECT_URL` (direct) secrets. The existing deployment workflows validate that each URL matches the certified Neon endpoint, and local commands reject PostgreSQL URLs. Whenever the Session model changes, update **both** Prisma schemas and the provider-specific migrations; `npm run check:db-contract` catches model drift.

SQLite contains Shopify session tokens, so keep the file private and out of backups/shared uploads unless the tokens are protected. Delete the local file only when intentionally resetting local sessions; this requires signing in again.
