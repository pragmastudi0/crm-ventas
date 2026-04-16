import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { crmClient } from "@/api/crmClient";
import { useAuth } from "@/lib/AuthContext";

const WorkspaceContext = createContext(null);

const fallbackWorkspaceValue = {
  workspace: null,
  workspaceLoading: false,
  workspaceError: null,
  refetchWorkspace: async () => {}
};

export function WorkspaceProvider({ children }) {
  const { user: authUser } = useAuth();
  const authUserRef = useRef(authUser);
  authUserRef.current = authUser;

  const [workspace, setWorkspace] = useState(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(null);

  const bootstrapWorkspace = useCallback(async () => {
    const user = authUserRef.current;
    setWorkspaceError(null);

    if (!user) {
      setWorkspace(null);
      setWorkspaceLoading(false);
      return;
    }

    setWorkspaceLoading(true);
    try {
      let members = [];
      if (user.id) {
        members = await crmClient.entities.WorkspaceMember.filter({ user_id: user.id });
      }
      if (members.length === 0 && user.email) {
        members = await crmClient.entities.WorkspaceMember.filter({ user_id: user.email });
      }

      if (members.length > 0) {
        const adminMembership = members.find((m) => m.role === "admin") || members[0];
        const workspaces = await crmClient.entities.Workspace.filter({
          id: adminMembership.workspace_id
        });
        if (workspaces.length > 0) {
          setWorkspace(workspaces[0]);
        } else {
          setWorkspace(null);
          setWorkspaceError(
            "Tu cuenta tiene una membrecía de workspace, pero ese workspace no existe en la base de datos. Revisa la migración o contacta soporte."
          );
        }
      } else {
        const displayName =
          user.user_metadata?.full_name || user.user_metadata?.name || "";
        const ownerKey = user.id || user.email;
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
      const message =
        err?.message || err?.error_description || "No se pudo inicializar el workspace.";
      setWorkspaceError(message);
      setWorkspace(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  useEffect(() => {
    bootstrapWorkspace();
  }, [authUser?.id, authUser?.email, bootstrapWorkspace]);

  return (
    <WorkspaceContext.Provider
      value={{ workspace, workspaceLoading, workspaceError, refetchWorkspace: bootstrapWorkspace }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  return ctx ?? fallbackWorkspaceValue;
}
