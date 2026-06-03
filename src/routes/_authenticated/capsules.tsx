import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Timer, Repeat, MessageSquare, Plus, Camera, Lock, Sparkles } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/capsules")({
  head: () => ({ meta: [{ title: "Capsules — Vault" }] }),
  component: CapsulesPage,
});

function CapsulesPage() {
  const { data: capsules = [], isLoading } = useQuery({
    queryKey: ["capsules-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capsules")
        .select("id, title, type, cover_url, status, unlock_at, admin_id, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="min-h-[100svh] bg-background pb-32">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/80 px-5 py-4 backdrop-blur">
        <Link to="/capture" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <Camera className="h-4 w-4" /> Camera
        </Link>
        <h1 className="font-display text-lg">Capsules</h1>
        <Link to="/capsules/new" className="flex items-center gap-1 rounded-full bg-amber px-3 py-1.5 text-xs font-medium text-amber-foreground">
          <Plus className="h-3.5 w-3.5" /> New
        </Link>
      </header>

      <div className="divide-y divide-border">
        {isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>}
        {!isLoading && capsules.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber/10 text-amber">
              <Sparkles className="h-7 w-7" />
            </div>
            <div>
              <div className="font-display text-xl">Your vault is empty</div>
              <div className="mt-1 text-sm text-muted-foreground">Create a capsule and invite friends.</div>
            </div>
            <Link to="/capsules/new" className="mt-2 rounded-full bg-amber px-5 py-2 text-sm font-medium text-amber-foreground">Create capsule</Link>
          </div>
        )}
        {capsules.map((c) => {
          const Icon = c.type === "transformation" ? Repeat : c.type === "individual" ? MessageSquare : Timer;
          const revealed = c.status === "revealed" || new Date(c.unlock_at) <= new Date();
          const sealed = c.status === "sealed";
          return (
            <Link
              key={c.id}
              to="/capsules/$id"
              params={{ id: c.id }}
              className="flex items-center gap-4 px-5 py-4 transition hover:bg-accent/40"
            >
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-secondary">
                {c.cover_url ? (
                  <img src={c.cover_url} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <Icon className="h-6 w-6" />
                  </div>
                )}
                {sealed && !revealed && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Lock className="h-5 w-5 text-amber" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="truncate font-medium">{c.title}</span>
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  {revealed ? (
                    <span className="text-amber">● Unsealed</span>
                  ) : sealed ? (
                    <>Sealed · unlocks {formatDistanceToNow(new Date(c.unlock_at), { addSuffix: true })}</>
                  ) : (
                    <>Unlocks {formatDistanceToNow(new Date(c.unlock_at), { addSuffix: true })}</>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
