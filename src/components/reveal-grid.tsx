import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Image as ImageIcon, Play, Mic, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type MediaItem = {
  id: string;
  user_id: string;
  kind: "photo" | "video" | "voice";
  file_path: string;
  mime_type: string | null;
  created_at: string;
};

export function RevealGrid({
  capsuleId, memberMap, onMount,
}: {
  capsuleId: string;
  memberMap: Map<string, { username: string; avatar_url: string | null }>;
  onMount?: () => void;
}) {
  useEffect(() => { onMount?.(); }, [onMount]);

  const [albumOpen, setAlbumOpen] = useState(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["media-items", capsuleId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("media_items")
        .select("id, user_id, kind, file_path, mime_type, created_at")
        .eq("capsule_id", capsuleId)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as MediaItem[];
    },
  });

  const { data: urls = {} } = useQuery({
    queryKey: ["media-urls", capsuleId, items.map((i) => i.id).join(",")],
    enabled: items.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.storage
        .from("capsule-media")
        .createSignedUrls(items.map((i) => i.file_path), 60 * 60);
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach((u, idx) => { if (u.signedUrl) map[items[idx].id] = u.signedUrl; });
      return map;
    },
  });

  function launchAlbum() {
    const photos = items.filter((i) => i.kind === "photo").map((i) => urls[i.id]).filter(Boolean);
    if (photos.length === 0) return toast.info("No photos to assemble");
    setAlbumOpen(true);
  }

  return (
    <div className="flex-1 overflow-y-auto pb-10">
      <div className="m-4 rounded-2xl border border-amber/30 bg-gradient-to-br from-amber/10 to-transparent p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber text-amber-foreground">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <div className="font-display text-sm">Your AI photo album is ready</div>
            <div className="text-xs text-muted-foreground">Preview a printed book curated from this capsule.</div>
          </div>
          <Button size="sm" onClick={launchAlbum} className="bg-amber text-amber-foreground hover:bg-amber/90">Preview</Button>
        </div>
      </div>

      {isLoading && <div className="p-10 text-center text-sm text-muted-foreground">Loading memories…</div>}

      <div className="columns-2 gap-2 px-2 md:columns-3">
        {items.map((item) => {
          const url = urls[item.id];
          const author = memberMap.get(item.user_id)?.username ?? "someone";
          return (
            <div key={item.id} className="mb-2 break-inside-avoid overflow-hidden rounded-xl bg-secondary">
              {item.kind === "photo" && url && (
                <img src={url} alt="" loading="lazy" className="w-full" />
              )}
              {item.kind === "video" && url && (
                <video src={url} controls className="w-full" />
              )}
              {item.kind === "voice" && url && (
                <div className="flex items-center gap-2 p-3">
                  <Mic className="h-4 w-4 text-amber" />
                  <audio controls src={url} className="w-full" />
                </div>
              )}
              {!url && (
                <div className="flex aspect-square items-center justify-center">
                  {item.kind === "photo" ? <ImageIcon className="h-6 w-6 text-muted-foreground" /> :
                   item.kind === "video" ? <Play className="h-6 w-6 text-muted-foreground" /> :
                   <Mic className="h-6 w-6 text-muted-foreground" />}
                </div>
              )}
              <div className="px-2 py-1 text-[11px] text-muted-foreground">@{author}</div>
            </div>
          );
        })}
      </div>

      {items.length === 0 && !isLoading && (
        <div className="px-6 py-20 text-center text-sm text-muted-foreground">
          No memories were dropped in this capsule.
        </div>
      )}

      <AlbumPreviewDialog open={albumOpen} onOpenChange={setAlbumOpen} capsuleId={capsuleId} photos={items.filter((i) => i.kind === "photo").map((i) => urls[i.id]).filter(Boolean)} />
    </div>
  );
}

function AlbumPreviewDialog({
  open, onOpenChange, capsuleId, photos,
}: { open: boolean; onOpenChange: (o: boolean) => void; capsuleId: string; photos: string[] }) {
  const [rating, setRating] = useState(0);
  const [style, setStyle] = useState<"minimalist" | "classic" | "scrapbook" | null>(null);

  function openExternal() {
    const url = new URL("https://photobook.example.com/editor");
    url.searchParams.set("capsule", capsuleId);
    url.searchParams.set("count", String(photos.length));
    window.open(url.toString(), "_blank", "noopener");
  }

  async function submitFeedback() {
    if (!rating || !style) return toast.error("Pick rating and style");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("album_feedback").insert({
      user_id: user.id, capsule_id: capsuleId, rating, style,
    });
    if (error) return toast.error(error.message);
    toast.success("Saved your style. Next album will use it.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>AI Photo Album</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{photos.length} curated photos. Open the editor to fine-tune your printed book.</p>
        <Button onClick={openExternal} className="w-full bg-amber text-amber-foreground hover:bg-amber/90">Open editor</Button>

        <div className="mt-4 space-y-3">
          <div className="text-sm font-medium">Rate this layout</div>
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={`h-9 w-9 rounded-full text-sm ${rating >= n ? "bg-amber text-amber-foreground" : "bg-secondary"}`}>★</button>
            ))}
          </div>
          <div className="text-sm font-medium">Preferred style</div>
          <div className="flex flex-wrap gap-2">
            {(["minimalist", "classic", "scrapbook"] as const).map((s) => (
              <button key={s} onClick={() => setStyle(s)} className={`rounded-full px-3 py-1.5 text-xs capitalize ${style === s ? "bg-amber text-amber-foreground" : "bg-secondary"}`}>{s}</button>
            ))}
          </div>
          <Button variant="outline" onClick={submitFeedback} className="w-full">Save preference</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
