import { useCallback, useEffect, useRef, useState } from "react";

export type CaptureResult = {
  blob: Blob;
  kind: "photo" | "video";
  mime: string;
  durationMs?: number;
  previewUrl: string;
};

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [error, setError] = useState<string | null>(null);

  const start = useCallback(async (mode: "user" | "environment") => {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1080 }, height: { ideal: 1920 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setReady(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Camera unavailable");
      setReady(false);
    }
  }, []);

  useEffect(() => {
    start(facing);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, [facing, start]);

  const flip = () => setFacing((f) => (f === "user" ? "environment" : "user"));

  const takePhoto = useCallback(async (): Promise<CaptureResult | null> => {
    const video = videoRef.current;
    if (!video || !ready) return null;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0);
    return await new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return resolve(null);
        resolve({ blob, kind: "photo", mime: "image/jpeg", previewUrl: URL.createObjectURL(blob) });
      }, "image/jpeg", 0.92);
    });
  }, [ready]);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const mr = new MediaRecorder(streamRef.current, { mimeType: mime });
    mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    recorderRef.current = mr;
    startedAtRef.current = Date.now();
    mr.start();
  }, []);

  const stopRecording = useCallback((): Promise<CaptureResult | null> => {
    const mr = recorderRef.current;
    if (!mr) return Promise.resolve(null);
    return new Promise((resolve) => {
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        resolve({
          blob, kind: "video", mime: mr.mimeType,
          durationMs: Date.now() - startedAtRef.current,
          previewUrl: URL.createObjectURL(blob),
        });
      };
      mr.stop();
    });
  }, []);

  return { videoRef, ready, error, facing, flip, takePhoto, startRecording, stopRecording };
}

export async function recordVoiceNote(maxMs = 60_000): Promise<CaptureResult | null> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
  const mr = new MediaRecorder(stream, { mimeType: mime });
  const chunks: Blob[] = [];
  const startedAt = Date.now();
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  return new Promise((resolve) => {
    const stop = () => mr.state !== "inactive" && mr.stop();
    mr.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: mr.mimeType });
      resolve({ blob, kind: "video", mime: mr.mimeType, durationMs: Date.now() - startedAt, previewUrl: URL.createObjectURL(blob) });
    };
    mr.start();
    setTimeout(stop, maxMs);
    (window as any).__stopVoice = stop;
  });
}
