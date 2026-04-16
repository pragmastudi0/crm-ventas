import { supabase, DATABASE_PREFIX } from "@/lib/supabaseClient";

const TABLES = {
  users: `${DATABASE_PREFIX}_users`,
  deals: `${DATABASE_PREFIX}_consultas`,
  stages: `${DATABASE_PREFIX}_pipeline_stages`
};

function toAppError(error, fallbackMessage) {
  return new Error(error?.message || fallbackMessage || "Unexpected Supabase error");
}

async function requireNoError(promise, fallbackMessage) {
  const { data, error } = await promise;
  if (error) throw toAppError(error, fallbackMessage);
  return data;
}

export async function fetchUsers() {
  return requireNoError(
    supabase.from(TABLES.users).select("*").order("created_at", { ascending: false }),
    "Failed to fetch users"
  );
}

export async function fetchDeals(userId) {
  let query = supabase.from(TABLES.deals).select("*").order("created_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  return requireNoError(query, "Failed to fetch deals");
}

export async function fetchPipelineStages(userId) {
  let query = supabase
    .from(TABLES.stages)
    .select("*")
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (userId) query = query.eq("user_id", userId);

  return requireNoError(query, "Failed to fetch pipeline stages");
}

export async function createDeal(userId, dealData) {
  const payload = { ...dealData, user_id: userId };
  const data = await requireNoError(
    supabase.from(TABLES.deals).insert(payload).select().single(),
    "Failed to create deal"
  );
  return data;
}

export async function updateDeal(dealId, dealData) {
  if (dealData.stage_id) {
    const stage = await requireNoError(
      supabase.from(TABLES.stages).select("id").eq("id", dealData.stage_id).maybeSingle(),
      "Invalid stage"
    );
    if (!stage) throw new Error("Invalid stage_id: stage does not exist");
  }

  return requireNoError(
    supabase.from(TABLES.deals).update(dealData).eq("id", dealId).select().single(),
    "Failed to update deal"
  );
}

export async function createPipelineStage(stageName, order, color, userId) {
  const payload = { name: stageName, orden: order, color, activa: true, user_id: userId };
  return requireNoError(
    supabase.from(TABLES.stages).insert(payload).select().single(),
    "Failed to create pipeline stage"
  );
}

export async function updatePipelineStage(stageId, updates) {
  return requireNoError(
    supabase.from(TABLES.stages).update(updates).eq("id", stageId).select().single(),
    "Failed to update pipeline stage"
  );
}

export async function deletePipelineStage(stageId) {
  const stage = await requireNoError(
    supabase.from(TABLES.stages).select("id,name").eq("id", stageId).maybeSingle(),
    "Failed to find stage"
  );
  if (!stage) throw new Error("Stage does not exist");

  const linkedDeals = await requireNoError(
    supabase.from(TABLES.deals).select("id").eq("stage_id", stageId),
    "Failed to validate stage usage"
  );

  const count = linkedDeals.length;
  if (count > 0) {
    throw new Error("Cannot delete stage with linked deals. Move deals first.");
  }

  return requireNoError(
    supabase.from(TABLES.stages).delete().eq("id", stageId),
    "Failed to delete pipeline stage"
  );
}

export { toAppError };
