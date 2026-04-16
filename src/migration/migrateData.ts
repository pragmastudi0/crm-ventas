import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createSupabaseAdminClient } from "../lib/supabaseAdmin.js";
import { fieldMap, tableMap } from "./fieldMap";

type EntityKey = keyof typeof tableMap;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, "data");
const dryRun = process.argv.includes("--dry-run");

const supabase = createSupabaseAdminClient();

function transformRecord(entity: EntityKey, record: Record<string, unknown>) {
  const mapping = fieldMap[entity];
  const transformed: Record<string, unknown> = {};
  Object.entries(mapping).forEach(([sourceKey, targetKey]) => {
    transformed[targetKey] = record[sourceKey];
  });
  return transformed;
}

async function readExport(entity: EntityKey) {
  const filePath = path.join(dataDir, `${entity}.json`);
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return JSON.parse(raw) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

async function upsertEntity(entity: EntityKey, records: Array<Record<string, unknown>>) {
  const tableName = tableMap[entity];
  let success = 0;
  let failure = 0;

  for (const record of records) {
    const payload = transformRecord(entity, record);
    try {
      if (!dryRun) {
        const { error } = await supabase
          .from(tableName)
          .upsert(payload, { onConflict: "legacy_id" });
        if (error) throw error;
      }
      success += 1;
    } catch (error) {
      failure += 1;
      console.error(`[${entity}] failed record`, payload, error);
    }
  }

  return { success, failure, total: records.length };
}

async function run() {
  const entities: EntityKey[] = ["users", "workspaces", "workspaceMembers", "contacts", "deals", "activities"];
  const summary: Record<string, { success: number; failure: number; total: number }> = {};

  for (const entity of entities) {
    const records = await readExport(entity);
    summary[entity] = await upsertEntity(entity, records);
  }

  console.log("Migration complete", summary);
}

run().catch((error) => {
  console.error("Migration failed", error);
  process.exit(1);
});
