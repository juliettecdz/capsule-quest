import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useCamera, recordVoiceNote, type CaptureResult } from "@/hooks/use-camera";
import { blobFromFile } from "@/lib/upload-media";
import { SendSheet } from "@/components/send-sheet";
import { Image as ImageIcon, Mic, SwitchCamera, Layers, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/capture")({
  head: () => ({ meta: [{ title: "Capture — Vault" }] }),
  component: CapturePage,
});

function CapturePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const { videoRef, ready, error, flip, takePhoto, startRecording, stopRecording } = useCamera();
  const [capture, setCapture] = useState<CaptureResult | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [voiceRec, setVoiceRec] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const holdTimerRef = useRef<number | null>(null);
  const isHoldRef = useRef(false);

  // swipe-right -> /capsules
  const startX = useRef<number | null>(null);
  useEffect(() => {
    const onStart = (e: TouchEvent) => { startX.current = e.touches[0].clientX; };
    const onEnd = (e: TouchEvent) => {
      if (startX.current == null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      if (dx > 80) navigate({ to: "/capsules" });
      startX.current = null;
    };
    window.addEventListener("touchstart", onStart);
    window.addEventListener("touchend", onEnd);
    return () => { window.removeEventListener("touchstart", onStart); window.removeEventListener("touchend", onEnd); };
  }, [navigate]);

  function openSend(result: CaptureResult) {
    setCapture(result);
    setSheetOpen(true);
  }

  async function handlePointerDown() {
    isHoldRef.current = false;
    holdTimerRef.current = window.setTimeout(async () => {
      isHoldRef.current = true;
      setRecording(true);
      startRecording();
    }, 220);
  }
  async function handlePointerUp() {
    if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    if (isHoldRef.current) {
      setRecording(false);
      const r = await stopRecording();
      if (r) openSend(r);
    } else {
      const r = await takePhoto();
      if (r) openSend(r);
    }
  }

  async function handleVoice() {
    if (voiceRec) { (window as any).__stopVoice?.(); return; }
    setVoiceRec(true);
    try {
      const r = await recordVoiceNote(30_000);
      if (r) openSend({ ...r, kind: "video", mime: r.mime });
      // mark as voice
      if (r) openSend({ ...r, kind: "video", mime: r.mime } as any);
    } catch (e) { toast.error("Mic unavailable"); }
    setVoiceRec(false);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const { blob, kind, mime } = blobFromFile(file);
    openSend({ blob, kind: kind === "voice" ? "video" : kind, mime, previewUrl: URL.createObjectURL(blob) });
    e.target.value = "";
  }

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-black text-white">
      <video ref={videoRef} playsInline muted className="absolute inset-0 h-full w-full object-cover" />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">Waking camera…</div>
      )}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
          <div className="font-display text-xl">Camera blocked</div>
          <div className="text-sm text-white/60">{error}</div>
          <div className="text-xs text-white/40">Allow camera access in your browser, then reload.</div>
        </div>
      )}

      {/* top gradient + controls */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/70 to-transparent" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-5 pt-4">
        <Link to="/settings" className="rounded-full bg-black/40 p-2.5 backdrop-blur">
          <Settings className="h-5 w-5" />
        </Link>
        <div className="font-display text-sm uppercase tracking-[0.3em] text-white/70">Vault</div>
        <button onClick={flip} className="rounded-full bg-black/40 p-2.5 backdrop-blur">
          <SwitchCamera className="h-5 w-5" />
        </button>
      </div>

      {/* swipe hint */}
      <Link to="/capsules" className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-l-2xl bg-black/40 px-2 py-3 text-[10px] uppercase tracking-widest text-white/60 backdrop-blur">
        Capsules →
      </Link>

      {/* recording ring */}
      {recording && (
        <div className="absolute left-1/2 top-12 z-20 -translate-x-1/2 rounded-full bg-destructive px-3 py-1 text-xs font-medium">● REC</div>
      )}

      {/* bottom controls */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between px-8 pb-8">
        <button onClick={() => fileRef.current?.click()} className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 backdrop-blur">
          <ImageIcon className="h-6 w-6" />
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFile} />

        <button
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={() => { if (holdTimerRef.current) clearTimeout(holdTimerRef.current); }}
          className={`relative flex h-20 w-20 items-center justify-center rounded-full shadow-capture transition-transform active:scale-95 ${recording ? "bg-destructive" : "bg-amber"}`}
          aria-label="Capture"
        >
          <span className={`h-16 w-16 rounded-full ${recording ? "bg-destructive ring-4 ring-white/30" : "bg-amber ring-4 ring-white/30"}`} />
        </button>

        <button
          onClick={handleVoice}
          className={`flex h-14 w-14 items-center justify-center rounded-full backdrop-blur ${voiceRec ? "bg-destructive" : "bg-white/10"}`}
        >
          <Mic className="h-6 w-6" />
        </button>
      </div>

      <SendSheet open={sheetOpen} onOpenChange={setSheetOpen} capture={capture} userId={user.id} />
    </div>
  );
}
