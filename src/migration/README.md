# Data Migration Runbook

This folder contains scripts to migrate legacy exports into Supabase.

## Input files

Place export files under `src/migration/data/`:

- `users.json`
- `deals.json`
- `contacts.json`
- `activities.json`

## Field mapping

Mappings are defined in `src/migration/fieldMap.ts`.

## Run in dry mode

```bash
node --loader ts-node/esm src/migration/migrateData.ts --dry-run
```

## Run migration

```bash
node --loader ts-node/esm src/migration/migrateData.ts
```

## Safety checks

1. Backup Supabase before production migration.
2. Run first in a staging environment.
3. Compare source/export counts vs destination counts after import.
4. Run `src/migration/backfillWorkspaceIdentity.sql` to normalize `workspace_id` and UUID `user_id`.
