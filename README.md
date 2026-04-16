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

## Análisis IA (Inteligencia de negocio)

El informe con IA no usa la clave de Anthropic en el navegador: la app llama a la Edge Function `analyze-business` en tu proyecto Supabase.

1. Creá la clave en el [dashboard de Anthropic](https://console.anthropic.com/) y guardala como secreto del proyecto:
   - `supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...`
2. Desplegá la función (desde la raíz del repo, con el CLI vinculado al proyecto):
   - `supabase functions deploy analyze-business`
3. En local, si probás con `supabase functions serve`, podés desactivar temporalmente JWT en `supabase/config.toml` o invocar con un JWT válido.

La URL que usa el front es `VITE_SUPABASE_URL/functions/v1/analyze-business` con la sesión actual (`Bearer` + header `apikey`).

## Migration utilities

Data migration scripts live in `src/migration/`:

- `src/migration/fieldMap.ts`
- `src/migration/migrateData.ts`
- `src/migration/README.md`

For server-side migration scripts also set:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `DATABASE_PREFIX`
