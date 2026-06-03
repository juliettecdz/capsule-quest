import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, Send, Lock, Sparkles, Clock } from "lucide-react";
import { formatDistanceToNowStrict, format } from "date-fns";
import { toast } from "sonner";
import { RevealGrid } from "@/components/reveal-grid";

export const Route = createFileRoute("/_authenticated/capsules/$id")({
  head: () => ({ meta: [{ title: "Capsule — Vault" }] }),
  component: CapsuleRoom,
});

type FeedItem =
  | { kind: "msg"; id: string; user_id: string; body: string; created_at: string }
  | { kind: "media"; id: string; user_id: string; created_at: string };

function CapsuleRoom() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: capsule } = useQuery({
    queryKey: ["capsule", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("capsules").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const revealed = capsule && (capsule.status === "revealed" || new Date(capsule.unlock_at) <= new Date());

  const { data: members = [] } = useQuery({
    queryKey: ["capsule-members", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capsule_members")
        .select("user_id, profiles!inner(id, username, avatar_url)")
        .eq("capsule_id", id);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const memberMap = new Map<string, { username: string; avatar_url: string | null }>();
  members.forEach((m: any) => memberMap.set(m.user_id, { username: m.profiles.username, avatar_url: m.profiles.avatar_url }));

  const { data: messages = [] } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("messages").select("*").eq("capsule_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: notifs = [] } = useQuery({
    queryKey: ["media-notifs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("media_notifications").select("*").eq("capsule_id", id).order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase.channel(`capsule:${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `capsule_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["messages", id] }))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "media_items", filter: `capsule_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["media-notifs", id] }))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "capsules", filter: `id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["capsule", id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  const feed: FeedItem[] = [
    ...messages.map((m): FeedItem => ({ kind: "msg", id: m.id, user_id: m.user_id, body: m.body, created_at: m.created_at })),
    ...notifs
      .filter((n) => n.id && n.user_id && n.created_at)
      .map((n): FeedItem => ({ kind: "media", id: n.id as string, user_id: n.user_id as string, created_at: n.created_at as string })),
  ].sort((a, b) => a.created_at.localeCompare(b.created_at));

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [feed.length]);

  async function send() {
    const body = text.trim();
    if (!body) return;
    setText("");
    const { error } = await supabase.from("messages").insert({ capsule_id: id, user_id: user.id, body });
    if (error) { toast.error(error.message); setText(body); }
  }

  async function sealCapsule() {
    const { error } = await supabase.from("capsules").update({ status: "sealed" }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Capsule sealed. No more uploads.");
  }

  async function markRevealed() {
    await supabase.from("capsules").update({ status: "revealed" }).eq("id", id);
  }

  if (!capsule) return <div className="flex h-[100svh] items-center justify-center text-muted-foreground">Loading capsule…</div>;

  const isAdmin = capsule.admin_id === user.id;
  const sealed = capsule.status === "sealed";

  return (
    <div className="flex h-[100svh] flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-3 backdrop-blur">
        <Link to="/capsules"><ArrowLeft className="h-5 w-5" /></Link>
        <div className="min-w-0 flex-1">
          <div className="truncate font-display text-base">{capsule.title}</div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {revealed ? (
              <span className="text-amber">Unsealed · {format(new Date(capsule.unlock_at), "MMM d, yyyy")}</span>
            ) : sealed ? (
              <>Sealed · unlocks in {formatDistanceToNowStrict(new Date(capsule.unlock_at))}</>
            ) : (
              <>Unlocks in {formatDistanceToNowStrict(new Date(capsule.unlock_at))}</>
            )}
          </div>
        </div>
        {isAdmin && !revealed && !sealed && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" className="border-amber text-amber hover:bg-amber/10">
                <Lock className="mr-1.5 h-3.5 w-3.5" /> Seal
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Seal this capsule?</AlertDialogTitle>
                <AlertDialogDescription>
                  No further uploads will be accepted from anyone. Text chat stays open. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={sealCapsule} className="bg-amber text-amber-foreground hover:bg-amber/90">Seal capsule</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </header>

      {revealed ? (
        <RevealGrid capsuleId={id} memberMap={memberMap} onMount={() => { if (capsule.status !== "revealed") markRevealed(); }} />
      ) : (
        <>
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
            <div className="mx-auto max-w-md space-y-3">
              <div className="rounded-2xl border border-border bg-card/40 p-4 text-center">
                <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-amber/10 text-amber">
                  <Lock className="h-5 w-5" />
                </div>
                <p className="text-xs text-muted-foreground">
                  Drops stay invisible until the unlock date. Nobody — not even admins — can preview them early.
                </p>
              </div>

              {feed.map((item) => {
                const author = memberMap.get(item.user_id)?.username ?? "someone";
                const mine = item.user_id === user.id;
                if (item.kind === "media") {
                  return (
                    <div key={item.id} className="flex justify-center">
                      <div className="rounded-full bg-amber/10 px-3 py-1.5 text-xs text-amber/80">
                        🔒 @{author} dropped a memory
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={item.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-3.5 py-2 ${mine ? "bg-amber text-amber-foreground" : "bg-secondary"}`}>
                      {!mine && <div className="mb-0.5 text-[10px] font-medium opacity-70">@{author}</div>}
                      <div className="text-sm leading-snug">{item.body}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border bg-card p-3">
            <div className="flex items-center gap-2">
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") send(); }}
                placeholder="Message the group…"
                className="rounded-full"
              />
              <Button size="icon" onClick={send} disabled={!text.trim()} className="h-10 w-10 rounded-full bg-amber text-amber-foreground hover:bg-amber/90">
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!sealed && (
              <button onClick={() => navigate({ to: "/capture" })} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-full bg-secondary py-2 text-xs text-muted-foreground hover:text-foreground">
                <Sparkles className="h-3.5 w-3.5" /> Add a memory from camera
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
