/**
 * migrate-csv.mjs
 * Migra datos de los archivos CSV exportados a Supabase (crm-ventas).
 * Filtra únicamente datos de gasparquintana00@gmail.com y fedegonberetta@gmail.com.
 *
 * USO:
 *   node migrate-csv.mjs             → migración real (auto-detecta columnas)
 *   node migrate-csv.mjs --dry-run   → solo muestra qué se insertaría, sin tocar la BD
 *
 * REQUISITOS:
 *   1. Completar el archivo .env con SUPABASE_URL y SUPABASE_SERVICE_KEY
 *   2. Los archivos CSV deben estar en ../data/ (ya están ahí)
 */

import { createClient } from "./node_modules/@supabase/supabase-js/dist/index.mjs";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ─── Configuración ────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv(envPath) {
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf-8").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, ".env"));
loadEnv(path.join(__dirname, ".env.local"));

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_PREFIX = process.env.DATABASE_PREFIX || process.env.VITE_DATABASE_PREFIX || "crm_ventas_tech";
const DRY_RUN = process.argv.includes("--dry-run");
const DATA_DIR = path.join(__dirname, "../data");

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error("❌  Faltan credenciales. Completá el archivo .env con:");
  console.error("    SUPABASE_URL=https://xxxx.supabase.co");
  console.error("    SUPABASE_SERVICE_KEY=eyJhbGci...");
  process.exit(1);
}

const supabase = (SUPABASE_URL && SUPABASE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

// ─── Workspaces a migrar ──────────────────────────────────────────────────────

const TARGET_EMAILS = ["gasparquintana00@gmail.com", "fedegonberetta@gmail.com"];
const TARGET_WORKSPACE_IDS = [
  "69a5e1ea15eb8e1958a5bcf1", // gasparquintana00@gmail.com
  "69bd3080e70ce5d9acbb5241", // fedegonberetta@gmail.com
];

/** id de workspace en el CSV (ObjectId) → email del dueño (mismo orden que TARGET_*) */
const WORKSPACE_LEGACY_ID_TO_OWNER_EMAIL = Object.fromEntries(
  TARGET_WORKSPACE_IDS.map((legacyWsId, i) => [legacyWsId, TARGET_EMAILS[i]]),
);

/** ObjectId de MongoDB en export CSV (24 hex). Postgres usa uuid → hay que mapear. */
const LEGACY_OBJECT_ID = /^[a-f0-9]{24}$/i;

// Columnas de auditoría del sistema antiguo — nunca existen en Supabase
const ALWAYS_STRIP = new Set(["created_by", "created_by_id", "is_sample"]);

/**
 * UUID determinístico por legacy id (misma entrada → mismo uuid en todas las tablas / FKs).
 */
function legacyObjectIdToUuid(legacy24) {
  const digest = createHash("sha256").update(`crm-ventas-legacy|${legacy24}`).digest();
  const buf = Buffer.from(digest.subarray(0, 16));
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = buf.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/** Columnas que en el esquema Supabase son uuid y en el CSV vienen como ObjectId. */
const UUID_REFERENCE_KEYS = new Set([
  "workspace_id",
  "stage_id",
  "contactoId",
  "contacto_id",
  "consultaId",
  "consulta_id",
  "proveedorId",
  "proveedor_id",
  "plantillaId",
  "plantilla_id",
  "listaId",
  "lista_id",
  "envioId",
  "envio_id",
  "variableId",
  "variable_id",
  "user_id",
  "owner_user_id",
]);

function isLegacyObjectIdString(value) {
  return typeof value === "string" && LEGACY_OBJECT_ID.test(value);
}

/**
 * Tras transformRow: convierte id + FKs tipo ObjectId a uuid; guarda legacy_id en el id original.
 */
function mapLegacyObjectIdsToUuids(row) {
  const out = { ...row };

  if (isLegacyObjectIdString(out.id)) {
    const legacy = out.id;
    if (out.legacy_id == null || out.legacy_id === "") out.legacy_id = legacy;
    out.id = legacyObjectIdToUuid(legacy);
  }

  for (const key of Object.keys(out)) {
    if (key === "id" || key === "legacy_id") continue;
    const val = out[key];
    if (!isLegacyObjectIdString(val)) continue;

    if (key === "owner_user_id" || key === "user_id") {
      // Si en el futuro el CSV trae email, no tocar (no matchea LEGACY_OBJECT_ID).
      out[key] = legacyObjectIdToUuid(val);
      continue;
    }

    if (
      UUID_REFERENCE_KEYS.has(key) ||
      key.endsWith("_id") ||
      /Id$/.test(key)
    ) {
      out[key] = legacyObjectIdToUuid(val);
    }
  }

  return out;
}

/**
 * El CSV legacy usa nombres distintos a las columnas NOT NULL de Supabase.
 * - pipeline_stages: "nombre" del export → "name" en BD
 * - plantillas_whatsapp: "nombrePlantilla" → "nombre"
 */
function normalizeLegacyCsvColumns(tableSlug, row) {
  const out = { ...row };
  if (tableSlug === "pipeline_stages") {
    const nameMissing = out.name == null || out.name === "";
    if (nameMissing && out.nombre != null && out.nombre !== "") {
      out.name = out.nombre;
    }
  }
  if (tableSlug === "plantillas_whatsapp") {
    const nombreMissing = out.nombre == null || out.nombre === "";
    if (nombreMissing && out.nombrePlantilla != null && out.nombrePlantilla !== "") {
      out.nombre = out.nombrePlantilla;
    }
  }
  return out;
}

/**
 * WorkspaceContext filtra miembros por auth.users.id. El CSV suele dejar user_id vacío o con ObjectId.
 * Antes de mapear a UUID, guardamos el email del dueño (texto); luego ejecutá en Supabase:
 *   src/migration/backfillWorkspaceIdentity.sql
 */
function injectWorkspaceOwnerEmailsForAuthBackfill(tableSlug, row) {
  const out = { ...row };
  if (tableSlug === "workspaces") {
    const email = WORKSPACE_LEGACY_ID_TO_OWNER_EMAIL[out.id];
    if (email) {
      const o = out.owner_user_id;
      if (o == null || o === "" || isLegacyObjectIdString(o)) {
        out.owner_user_id = email;
      }
    }
  }
  if (tableSlug === "workspace_members") {
    const email = WORKSPACE_LEGACY_ID_TO_OWNER_EMAIL[out.workspace_id];
    if (email) {
      const u = out.user_id;
      if (u == null || u === "" || isLegacyObjectIdString(u)) {
        out.user_id = email;
      }
    }
  }
  return out;
}

// ─── Parser CSV ───────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === 0) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] ?? ""; });
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ─── Transformación de valores ────────────────────────────────────────────────

const BOOLEAN_FIELDS = new Set([
  "concretado", "cotizacionEnviada", "activa", "activo",
  "enviado", "postventaActiva", "verificado",
]);
const JSON_FIELDS = new Set(["tags", "categorias", "monedas", "metodosPago"]);
const NUMERIC_FIELDS = new Set([
  "orden", "precioCotizado", "presupuestoMax", "ganancia",
  "comision", "venta", "costo", "postventaPaso", "canje",
]);

function transformValue(key, raw) {
  if (raw === "" || raw === undefined || raw === null) return null;
  if (BOOLEAN_FIELDS.has(key)) return raw === "true" || raw === "1";
  if (JSON_FIELDS.has(key)) {
    try { return JSON.parse(raw); } catch { return raw; }
  }
  if (NUMERIC_FIELDS.has(key)) {
    const n = Number(raw);
    return isNaN(n) ? raw : n;
  }
  return raw;
}

function transformRow(row, stripCols = new Set()) {
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    if (ALWAYS_STRIP.has(key) || stripCols.has(key)) continue;
    result[key] = transformValue(key, value);
  }
  return result;
}

// ─── Extraer nombre de columna del mensaje de error de Supabase ───────────────

function extractMissingColumn(errorMessage) {
  // "Could not find the 'columnName' column of 'tableName' in the schema cache"
  const match = errorMessage.match(/Could not find the '([^']+)' column/);
  return match ? match[1] : null;
}

// ─── Upsert con auto-detección de columnas faltantes ─────────────────────────

async function upsertBatch(tableName, rows, conflictField = "id") {
  if (rows.length === 0) {
    console.log(`  ⏭  ${tableName}: sin registros para migrar`);
    return { inserted: 0, errors: 0, skippedCols: [] };
  }

  if (DRY_RUN) {
    console.log(`  🔍 [DRY-RUN] ${tableName}: ${rows.length} registros`);
    console.log(`     Ejemplo:`, JSON.stringify(rows[0]).slice(0, 150) + "...");
    return { inserted: rows.length, errors: 0, skippedCols: [] };
  }

  const CHUNK = 200;
  let inserted = 0;
  let errors = 0;
  const skippedCols = [];

  // Columnas a eliminar para esta tabla (se van descubriendo en tiempo real)
  const badCols = new Set();

  for (let i = 0; i < rows.length; i += CHUNK) {
    let chunk = rows.slice(i, i + CHUNK);
    let attempts = 0;

    while (attempts < 20) {
      // Filtrar columnas problemáticas ya detectadas
      const cleanChunk = chunk.map(r => {
        const clean = { ...r };
        for (const col of badCols) delete clean[col];
        return clean;
      });

      const { error } = await supabase
        .from(tableName)
        .upsert(cleanChunk, { onConflict: conflictField, ignoreDuplicates: false });

      if (!error) {
        inserted += chunk.length;
        break;
      }

      const missingCol = extractMissingColumn(error.message);
      if (missingCol) {
        badCols.add(missingCol);
        if (!skippedCols.includes(missingCol)) {
          skippedCols.push(missingCol);
          console.log(`  ⚠️  Columna '${missingCol}' no existe en ${tableName} — omitiendo`);
        }
        attempts++;
        continue;
      }

      // Error no relacionado con columnas → fallo real
      console.error(`  ❌ Error en ${tableName} (chunk ${Math.floor(i / CHUNK) + 1}):`, error.message);
      errors += chunk.length;
      break;
    }
  }

  return { inserted, errors, skippedCols };
}

// ─── Runner principal ─────────────────────────────────────────────────────────

async function main() {
  console.log("\n🚀 CRM Ventas — Migración desde CSV");
  console.log("═══════════════════════════════════════");
  console.log(`📂 Directorio de datos : ${DATA_DIR}`);
  console.log(`🗄️  Supabase URL        : ${SUPABASE_URL || "(dry-run)"}`);
  console.log(`🏷️  Prefijo de tablas   : ${DB_PREFIX}`);
  console.log(`👤 Usuarios a migrar   : ${TARGET_EMAILS.join(", ")}`);
  console.log(`${DRY_RUN ? "🔍 MODO DRY-RUN (sin escritura en BD)" : "✍️  Escribiendo en la base de datos"}`);
  console.log("═══════════════════════════════════════\n");

  const byWorkspace = (r) => TARGET_WORKSPACE_IDS.includes(r.workspace_id);

  const steps = [
    { name: "Workspaces",         csv: "Workspace_export.csv",        table: "workspaces",          filter: (r) => TARGET_WORKSPACE_IDS.includes(r.id) },
    { name: "WorkspaceMembers",   csv: "WorkspaceMember_export.csv",  table: "workspace_members",   filter: byWorkspace },
    { name: "PipelineStages",     csv: "PipelineStage_export.csv",    table: "pipeline_stages",     filter: byWorkspace },
    { name: "PlantillasWhatsApp", csv: "PlantillaWhatsApp_export.csv",table: "plantillas_whatsapp", filter: byWorkspace },
    { name: "Contactos",          csv: "Contacto_export.csv",         table: "contactos",           filter: byWorkspace },
    { name: "Proveedores",        csv: "Proveedor_export.csv",        table: "proveedores",         filter: byWorkspace },
    { name: "Consultas",          csv: "Consulta_export.csv",         table: "consultas",           filter: byWorkspace },
    { name: "Ventas",             csv: "Venta_export.csv",            table: "ventas",              filter: byWorkspace },
    { name: "Mensajes",           csv: "Mensaje_export.csv",          table: "mensajes",            filter: byWorkspace },
  ];

  const summary = [];

  for (const step of steps) {
    process.stdout.write(`⏳ Migrando ${step.name}...\n`);
    const rows = parseCSV(path.join(DATA_DIR, step.csv));
    const filtered = rows
      .filter(step.filter)
      .map((r) =>
        mapLegacyObjectIdsToUuids(
          injectWorkspaceOwnerEmailsForAuthBackfill(
            step.table,
            normalizeLegacyCsvColumns(step.table, transformRow(r)),
          ),
        ),
      );
    const result = await upsertBatch(`${DB_PREFIX}_${step.table}`, filtered);
    summary.push({ entity: step.name, ...result });

    const icon = result.errors > 0 ? "⚠️ " : "✅";
    const colsMsg = result.skippedCols?.length
      ? ` (cols omitidas: ${result.skippedCols.join(", ")})`
      : "";
    console.log(`${icon} ${step.name}: ${result.inserted} insertados, ${result.errors} errores${colsMsg}\n`);
  }

  console.log("═══════════════════════════════════════");
  console.log("📊 RESUMEN FINAL");
  console.log("═══════════════════════════════════════");
  let totalInserted = 0;
  let totalErrors = 0;
  for (const row of summary) {
    const status = row.errors > 0 ? "⚠️ " : "✅";
    console.log(`${status} ${row.entity.padEnd(20)} ${String(row.inserted).padStart(4)} registros`);
    totalInserted += row.inserted;
    totalErrors += row.errors;
  }
  console.log("───────────────────────────────────────");
  console.log(`   ${"TOTAL".padEnd(20)} ${String(totalInserted).padStart(4)} registros`);

  if (totalErrors > 0) {
    console.log(`\n⚠️  ${totalErrors} errores encontrados. Revisá los mensajes arriba.`);
  } else if (!DRY_RUN) {
    console.log("\n🎉 Migración completada exitosamente!");
    console.log(
      "→ En Supabase ejecutá src/migration/backfillWorkspaceIdentity.sql (email → auth.users.id).",
    );
    console.log(
      "→ Si user_id quedó null tras un import viejo: src/migration/link_workspace_members_to_auth_users.sql",
    );
  } else {
    console.log("\n✅ Dry-run finalizado. Ejecutá sin --dry-run para migrar.");
  }
}

main().catch((err) => {
  console.error("❌ Error fatal:", err.message);
  process.exit(1);
});
