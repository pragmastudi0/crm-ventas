# WhatsApp Sales CRM (Supabase)

## Local setup

1. Install dependencies:
   - `npm install`
2. Copy `.env.example` to `.env.local` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_DATABASE_PREFIX` (default: `crm_ventas_tech`)
3. Start dev server:
   - `npm run dev`

## Migration utilities

Data migration scripts live in `src/migration/`:

- `src/migration/fieldMap.ts`
- `src/migration/migrateData.ts`
- `src/migration/README.md`

For server-side migration scripts also set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `DATABASE_PREFIX`
