import { supabase } from "@/integrations/supabase/client";

export type MediaKind = "photo" | "video" | "voice";

export async function uploadCapsuleMedia(params: {
  capsuleId: string;
  userId: string;
  blob: Blob;
  kind: MediaKind;
  mime: string;
  durationMs?: number;
}) {
  const { capsuleId, userId, blob, kind, mime, durationMs } = params;
  const id = crypto.randomUUID();
  const ext = mime.includes("jpeg") ? "jpg" : mime.includes("png") ? "png" : mime.includes("webm") ? "webm" : mime.includes("mp4") ? "mp4" : "bin";
  const path = `${capsuleId}/${userId}/${id}.${ext}`;

  const { error: upErr } = await supabase.storage.from("capsule-media").upload(path, blob, {
    contentType: mime, upsert: false,
  });
  if (upErr) throw upErr;

  const { error: insErr } = await supabase.from("media_items").insert({
    id, capsule_id: capsuleId, user_id: userId, kind, file_path: path, mime_type: mime, duration_ms: durationMs ?? null,
  });
  if (insErr) {
    // attempt cleanup
    await supabase.storage.from("capsule-media").remove([path]).catch(() => {});
    throw insErr;
  }
  return { id, path };
}

export function blobFromFile(file: File): { blob: Blob; kind: MediaKind; mime: string } {
  const mime = file.type || "application/octet-stream";
  const kind: MediaKind = mime.startsWith("image/") ? "photo" : mime.startsWith("video/") ? "video" : "voice";
  return { blob: file, kind, mime };
}
