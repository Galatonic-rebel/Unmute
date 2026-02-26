import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type TranslationInput } from "@shared/routes";
import { useToast } from "@/hooks/use-toast";

export function useTranslations() {
  return useQuery({
    queryKey: [api.translations.list.path],
    queryFn: async () => {
      const res = await fetch(api.translations.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch translations");
      return api.translations.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreateTranslation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: TranslationInput) => {
      const res = await fetch(api.translations.create.path, {
        method: api.translations.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create translation");
      return api.translations.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.translations.list.path] });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Translation Error",
        description: error.message || "Failed to save translation. Please try again.",
      });
    },
  });
}
