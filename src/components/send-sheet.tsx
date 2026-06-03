import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Send, Timer, Repeat, MessageSquare } from "lucide-react";
import { uploadCapsuleMedia, type MediaKind } from "@/lib/upload-media";

export function SendSheet({
  open, onOpenChange, capture, userId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  capture: { blob: Blob; kind: MediaKind; mime: string; durationMs?: number; previewUrl: string } | null;
  userId: string;
}) {
  const [search, setSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => { if (!open) { setSelected(new Set()); setSearch(""); } }, [open]);

  const { data: capsules = [] } = useQuery({
    queryKey: ["capsules-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("capsules")
        .select("id, title, type, cover_url, status, unlock_at")
        .eq("status", "active")
        .gt("unlock_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const filtered = capsules.filter((c) => c.title.toLowerCase().includes(search.toLowerCase()));

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  async function send() {
    if (!capture || selected.size === 0) return;
    setSending(true);
    try {
      for (const cid of selected) {
        await uploadCapsuleMedia({
          capsuleId: cid, userId,
          blob: capture.blob, kind: capture.kind, mime: capture.mime, durationMs: capture.durationMs,
        });
      }
      toast.success(`Vaulted to ${selected.size} ${selected.size === 1 ? "capsule" : "capsules"}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally { setSending(false); }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[78vh] rounded-t-3xl border-border bg-card p-0">
        <div className="flex h-full flex-col">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle className="font-display text-2xl">Send to capsule</SheetTitle>
          </SheetHeader>

          {capture && (
            <div className="mx-5 mt-3 flex items-center gap-3 rounded-2xl border border-border bg-background/40 p-3">
              {capture.kind === "photo" ? (
                <img src={capture.previewUrl} className="h-14 w-14 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-amber text-amber-foreground">
                  {capture.kind === "voice" ? "🎙️" : "▶︎"}
                </div>
              )}
              <div className="text-sm text-muted-foreground">
                {capture.kind} · ready to drop
              </div>
            </div>
          )}

          <div className="px-5 pt-4">
            <Input placeholder="Search capsules…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-4 pt-3 no-scrollbar">
            {filtered.length === 0 && (
              <div className="px-3 py-10 text-center text-sm text-muted-foreground">No active capsules. Create one first.</div>
            )}
            {filtered.map((c) => {
              const Icon = c.type === "transformation" ? Repeat : c.type === "individual" ? MessageSquare : Timer;
              const active = selected.has(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${active ? "bg-amber/10 ring-1 ring-amber" : "hover:bg-accent"}`}
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-secondary">
                    {c.cover_url ? <img src={c.cover_url} className="h-full w-full object-cover" /> : <Icon className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{c.title}</div>
                    <div className="text-xs text-muted-foreground">Unlocks {new Date(c.unlock_at).toLocaleDateString()}</div>
                  </div>
                  <div className={`h-5 w-5 rounded-full border-2 ${active ? "border-amber bg-amber" : "border-muted-foreground"}`} />
                </button>
              );
            })}
          </div>

          <div className="border-t border-border bg-card p-4">
            <Button
              disabled={!capture || selected.size === 0 || sending}
              onClick={send}
              className="h-14 w-full bg-amber text-amber-foreground hover:bg-amber/90"
            >
              <Send className="mr-2 h-5 w-5" />
              {sending ? "Vaulting…" : selected.size > 1 ? `Drop to ${selected.size}` : "Drop in vault"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
