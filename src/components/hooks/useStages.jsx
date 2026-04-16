import { useQuery } from "@tanstack/react-query";
import { fetchPipelineStages } from "@/api/crmApi";
import { useWorkspace } from "@/components/context/WorkspaceContext";

export function useStages() {
  const { workspace } = useWorkspace();

  return useQuery({
    queryKey: ["pipeline-stages", workspace?.id],
    queryFn: () => fetchPipelineStages(workspace?.id),
    enabled: !!workspace?.id
  });
}
