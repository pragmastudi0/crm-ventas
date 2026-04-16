export const tablePrefix = process.env.DATABASE_PREFIX || "crm_ventas_tech";

export const tableMap = {
  users: `${tablePrefix}_users`,
  workspaces: `${tablePrefix}_workspaces`,
  workspaceMembers: `${tablePrefix}_workspace_members`,
  deals: `${tablePrefix}_consultas`,
  contacts: `${tablePrefix}_contactos`,
  activities: `${tablePrefix}_actividades`
};

export const fieldMap = {
  users: {
    id: "legacy_id",
    email: "email",
    full_name: "full_name"
  },
  workspaces: {
    id: "legacy_id",
    name: "name",
    owner_user_id: "owner_user_id"
  },
  workspaceMembers: {
    id: "legacy_id",
    workspace_id: "workspace_id",
    user_id: "user_id",
    role: "role"
  },
  deals: {
    id: "legacy_id",
    contactoId: "contacto_id",
    contactoNombre: "contacto_nombre",
    etapa: "etapa",
    stage_id: "stage_id",
    workspace_id: "workspace_id"
  },
  contacts: {
    id: "legacy_id",
    nombre: "nombre",
    whatsapp: "whatsapp",
    workspace_id: "workspace_id"
  },
  activities: {
    id: "legacy_id",
    consultaId: "consulta_id",
    type: "tipo",
    created_date: "created_at"
  }
};
