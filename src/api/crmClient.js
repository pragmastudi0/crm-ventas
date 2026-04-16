import { supabase, DATABASE_PREFIX } from "@/lib/supabaseClient";

const ENTITY_TABLES = {
  User: `${DATABASE_PREFIX}_users`,
  Consulta: `${DATABASE_PREFIX}_consultas`,
  Contacto: `${DATABASE_PREFIX}_contactos`,
  Venta: `${DATABASE_PREFIX}_ventas`,
  Proveedor: `${DATABASE_PREFIX}_proveedores`,
  PipelineStage: `${DATABASE_PREFIX}_pipeline_stages`,
  PlantillaWhatsApp: `${DATABASE_PREFIX}_plantillas_whatsapp`,
  VariablePlantilla: `${DATABASE_PREFIX}_variables_plantilla`,
  EnvioWhatsApp: `${DATABASE_PREFIX}_envios_whatsapp`,
  ListaWhatsApp: `${DATABASE_PREFIX}_listas_whatsapp`,
  Mensaje: `${DATABASE_PREFIX}_mensajes`,
  Workspace: `${DATABASE_PREFIX}_workspaces`,
  WorkspaceMember: `${DATABASE_PREFIX}_workspace_members`
};

/** Nombres de orden usados en el front → columnas reales en Postgres/Supabase */
const SORT_COLUMN_ALIASES = {
  created_date: "created_date",
  updated_date: "updated_date",
  created_at: "created_date",
  updated_at: "updated_date"
};

const normalizeSort = (sort) => {
  if (!sort) return { column: "created_date", ascending: false };
  const descending = sort.startsWith("-");
  const raw = descending ? sort.slice(1) : sort;
  const column = SORT_COLUMN_ALIASES[raw] ?? raw;
  return { column, ascending: !descending };
};

const applyFilters = (query, filter = {}) => {
  let builder = query;
  Object.entries(filter).forEach(([key, value]) => {
    if (Array.isArray(value)) builder = builder.in(key, value);
    else builder = builder.eq(key, value);
  });
  return builder;
};

const createEntityApi = (entityName) => {
  const tableName = ENTITY_TABLES[entityName];
  if (!tableName) throw new Error(`Missing table mapping for entity ${entityName}`);

  return {
    async filter(filter = {}, sort = "-created_date", limit = 1000) {
      const { column, ascending } = normalizeSort(sort);
      let query = supabase.from(tableName).select("*").limit(limit);
      query = applyFilters(query, filter);
      const { data, error } = await query.order(column, { ascending });
      if (error) throw error;
      return data || [];
    },
    async list(sort = "-created_date", limit = 1000) {
      const { column, ascending } = normalizeSort(sort);
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .order(column, { ascending })
        .limit(limit);
      if (error) throw error;
      return data || [];
    },
    async create(payload) {
      const { data, error } = await supabase.from(tableName).insert(payload).select().single();
      if (error) throw error;
      return data;
    },
    async bulkCreate(payloads) {
      const { data, error } = await supabase.from(tableName).insert(payloads).select();
      if (error) throw error;
      return data || [];
    },
    async update(id, payload) {
      const { data, error } = await supabase
        .from(tableName)
        .update(payload)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    async delete(id) {
      const { error } = await supabase.from(tableName).delete().eq("id", id);
      if (error) throw error;
      return { success: true };
    }
  };
};

const entityNames = Object.keys(ENTITY_TABLES);
const entities = entityNames.reduce((acc, name) => {
  acc[name] = createEntityApi(name);
  return acc;
}, {});

const auth = {
  async me() {
    const { data: sessionData, error: sessionError } = await supabase.auth.getUser();
    if (sessionError) throw sessionError;
    return sessionData?.user ?? null;
  },
  async updateMe(updates) {
    const { data, error } = await supabase.auth.updateUser({ data: updates });
    if (error) throw error;
    return data?.user ?? null;
  },
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
  redirectToLogin() {
    window.location.href = "/login";
  }
};

export const crmClient = {
  entities,
  auth,
  users: {
    async inviteUser() {
      throw new Error("Invitations must be implemented with Supabase admin APIs.");
    }
  },
  appLogs: {
    async logUserInApp() {
      return null;
    }
  }
};
