import { createContext, useContext, useState, useEffect } from "react";
import { crmClient } from "@/api/crmClient";

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(null);

  useEffect(() => {
    bootstrapWorkspace();
  }, []);

  const bootstrapWorkspace = async () => {
    try {
      setWorkspaceError(null);
      const user = await crmClient.auth.me();
      if (!user) {
        setWorkspace(null);
        setWorkspaceLoading(false);
        return;
      }

      // Workspace membership is keyed by Supabase auth.users.id (UUID)
      const members = await crmClient.entities.WorkspaceMember.filter({ user_id: user.id });

      if (members.length > 0) {
        // Tomar el primer workspace (admin preferido)
        const adminMembership = members.find(m => m.role === "admin") || members[0];
        const workspaces = await crmClient.entities.Workspace.filter({ id: adminMembership.workspace_id });
        if (workspaces.length > 0) {
          setWorkspace(workspaces[0]);
        } else {
          setWorkspaceError("No se encontro el workspace asociado al usuario.");
          setWorkspace(null);
        }
      } else {
        // Crear workspace nuevo para este usuario
        const newWorkspace = await crmClient.entities.Workspace.create({
          name: user.full_name ? `Workspace de ${user.full_name}` : "Mi Workspace",
          owner_user_id: user.id
        });
        await crmClient.entities.WorkspaceMember.create({
          workspace_id: newWorkspace.id,
          user_id: user.id,
          role: "admin"
        });
        setWorkspace(newWorkspace);
      }
    } catch (err) {
      console.error("Error bootstrapping workspace:", err);
      setWorkspace(null);
      setWorkspaceError(err.message || "No se pudo inicializar el workspace.");
    } finally {
      setWorkspaceLoading(false);
    }
  };

  return (
    <WorkspaceContext.Provider
      value={{ workspace, workspaceLoading, workspaceError, refetchWorkspace: bootstrapWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}