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

export async function fetchDeals(workspaceId) {
  let query = supabase.from(TABLES.deals).select("*").order("created_at", { ascending: false });
  if (workspaceId) query = query.eq("workspace_id", workspaceId);
  return requireNoError(query, "Failed to fetch deals");
}

export async function fetchPipelineStages(workspaceId) {
  let query = supabase
    .from(TABLES.stages)
    .select("*")
    .eq("activa", true)
    .order("orden", { ascending: true });

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  return requireNoError(query, "Failed to fetch pipeline stages");
}

export async function createDeal(workspaceId, dealData) {
  if (!workspaceId) throw new Error("workspace_id is required");
  const payload = { ...dealData, workspace_id: workspaceId };
  const data = await requireNoError(
    supabase.from(TABLES.deals).insert(payload).select().single(),
    "Failed to create deal"
  );
  return data;
}

export async function updateDeal(workspaceId, dealId, dealData) {
  if (!workspaceId) throw new Error("workspace_id is required");
  if (dealData.stage_id) {
    const stage = await requireNoError(
      supabase
        .from(TABLES.stages)
        .select("id")
        .eq("id", dealData.stage_id)
        .eq("workspace_id", workspaceId)
        .maybeSingle(),
      "Invalid stage"
    );
    if (!stage) throw new Error("Invalid stage_id: stage does not exist");
  }

  return requireNoError(
    supabase
      .from(TABLES.deals)
      .update(dealData)
      .eq("id", dealId)
      .eq("workspace_id", workspaceId)
      .select()
      .single(),
    "Failed to update deal"
  );
}

export async function createPipelineStage(stageName, order, color, workspaceId) {
  if (!workspaceId) throw new Error("workspace_id is required");
  const payload = { name: stageName, orden: order, color, activa: true, workspace_id: workspaceId };
  return requireNoError(
    supabase.from(TABLES.stages).insert(payload).select().single(),
    "Failed to create pipeline stage"
  );
}

export async function updatePipelineStage(workspaceId, stageId, updates) {
  if (!workspaceId) throw new Error("workspace_id is required");
  return requireNoError(
    supabase
      .from(TABLES.stages)
      .update(updates)
      .eq("id", stageId)
      .eq("workspace_id", workspaceId)
      .select()
      .single(),
    "Failed to update pipeline stage"
  );
}

export async function deletePipelineStage(workspaceId, stageId) {
  if (!workspaceId) throw new Error("workspace_id is required");
  const stage = await requireNoError(
    supabase
      .from(TABLES.stages)
      .select("id,name")
      .eq("id", stageId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    "Failed to find stage"
  );
  if (!stage) throw new Error("Stage does not exist");

  const linkedDeals = await requireNoError(
    supabase
      .from(TABLES.deals)
      .select("id")
      .eq("stage_id", stageId)
      .eq("workspace_id", workspaceId),
    "Failed to validate stage usage"
  );

  const count = linkedDeals.length;
  if (count > 0) {
    throw new Error("Cannot delete stage with linked deals. Move deals first.");
  }

  return requireNoError(
    supabase
      .from(TABLES.stages)
      .delete()
      .eq("id", stageId)
      .eq("workspace_id", workspaceId),
    "Failed to delete pipeline stage"
  );
}

export { toAppError };
