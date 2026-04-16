import { useQuery } from "@tanstack/react-query";
import { supabase, DATABASE_PREFIX } from "@/lib/supabaseClient";

export function useCurrentUser() {
  return useQuery({
    queryKey: ['current-user'],
    queryFn: async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        const authUser = data?.user ?? null;
        if (!authUser) return null;

        const { data: profile } = await supabase
          .from(`${DATABASE_PREFIX}_users`)
          .select("*")
          .eq("id", authUser.id)
          .maybeSingle();

        return {
          ...authUser,
          role: profile?.role || authUser.user_metadata?.role || "user",
          canEditContacts:
            profile?.canEditContacts ?? authUser.user_metadata?.canEditContacts ?? true,
          canSendMessages:
            profile?.canSendMessages ?? authUser.user_metadata?.canSendMessages ?? true,
          consulta_follow_up_days:
            profile?.consulta_follow_up_days ?? authUser.user_metadata?.consulta_follow_up_days ?? 3,
          postventa_follow_up_days:
            profile?.postventa_follow_up_days ?? authUser.user_metadata?.postventa_follow_up_days ?? 7
        };
      } catch (error) {
        return null;
      }
    }
  });
}