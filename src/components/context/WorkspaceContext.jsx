import { createContext, useContext, useState, useEffect } from "react";
import { crmClient } from "@/api/crmClient";

const WorkspaceContext = createContext(null);

const fallbackWorkspaceValue = {
  workspace: null,
  workspaceLoading: false,
  refetchWorkspace: async () => {}
};

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);

  useEffect(() => {
    bootstrapWorkspace();
  }, []);

  const bootstrapWorkspace = async () => {
    try {
      const user = await crmClient.auth.me();
      if (!user) {
        setWorkspaceLoading(false);
        return;
      }

      // Buscar si el usuario ya tiene un workspace (user_id puede ser email o UUID según el esquema)
      let members = [];
      if (user.email) {
        members = await crmClient.entities.WorkspaceMember.filter({ user_id: user.email });
      }
      if (members.length === 0 && user.id) {
        members = await crmClient.entities.WorkspaceMember.filter({ user_id: user.id });
      }

      if (members.length > 0) {
        // Tomar el primer workspace (admin preferido)
        const adminMembership = members.find(m => m.role === "admin") || members[0];
        const workspaces = await crmClient.entities.Workspace.filter({ id: adminMembership.workspace_id });
        if (workspaces.length > 0) {
          setWorkspace(workspaces[0]);
        }
      } else {
        // Crear workspace nuevo para este usuario
        const displayName =
          user.user_metadata?.full_name ||
          user.user_metadata?.name ||
          "";
        const ownerKey = user.email || user.id;
        const newWorkspace = await crmClient.entities.Workspace.create({
          name: displayName ? `Workspace de ${displayName}` : "Mi Workspace",
          owner_user_id: ownerKey
        });
        await crmClient.entities.WorkspaceMember.create({
          workspace_id: newWorkspace.id,
          user_id: ownerKey,
          role: "admin"
        });
        setWorkspace(newWorkspace);
      }
    } catch (err) {
      console.error("Error bootstrapping workspace:", err);
    } finally {
      setWorkspaceLoading(false);
    }
  };

  return (
    <WorkspaceContext.Provider value={{ workspace, workspaceLoading, refetchWorkspace: bootstrapWorkspace }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  return ctx ?? fallbackWorkspaceValue;
}
