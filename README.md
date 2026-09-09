# Skin Quotient

Live site: https://www.skinquotient.in  
Staff CRM: https://www.skinquotient.in/admin

**Start with [the complete project handover](docs/PROJECT-HANDOVER.md).** It explains the live application, file map, database, authentication, deployment, design requirements, tests and remaining integrations. Give that document together with this repository to a future developer or AI/no-code builder.

This is a Next.js application with a static branded guest quiz and a protected Supabase-backed staff CRM. Customers do not sign in. Staff use verified email/password and MFA. Payments, bookings and automated messages are not enabled.

Live customer files are in `public/`; application routes and CRM are in `src/app/`. Root prototype HTML is retained for history/regression checks and must not be published as the application.

## Development

Use Node 22 and pnpm compatible with the lockfile. Obtain environment values securely; `.env.example` contains names only. Use an isolated development database for changes.

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm test
pnpm build
```

Read the handover before applying database migrations: the existing migrations were applied manually to the live Supabase project, and migration history must be reconciled before automated replay. Pushing `main` triggers production deployment on Vercel.
