"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ScanLine, ImageUp } from "lucide-react";

import { serialNumberSchema } from "@/lib/schemas/voucher";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type ScanResult = { ok: boolean; message: string };
type TesseractWorker = {
  setParameters: (p: Record<string, string>) => Promise<unknown>;
  recognize: (img: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
  terminate: () => Promise<unknown>;
};

const TARGET_WIDTH = 1400; // upscale small frames so digits are legible
const RED_THRESHOLD = 45; // r - max(g,b) above this = "red ink" → black

/**
 * Draw the source upscaled to TARGET_WIDTH. When `binarize`, isolate the
 * voucher's RED serial ink from the busy food-photo background: pixels where
 * red clearly dominates become black, everything else white. The serial sits in
 * a corner ("NO. #####"), so we always process the WHOLE frame.
 */
function drawToCanvas(
  source: CanvasImageSource,
  sw: number,
  sh: number,
  binarize: boolean,
): HTMLCanvasElement | null {
  if (!sw || !sh) return null;
  const scale = TARGET_WIDTH / sw;
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  if (!binarize) return canvas;

  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const redness = d[i] - Math.max(d[i + 1], d[i + 2]);
    const v = redness > RED_THRESHOLD ? 0 : 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

/** Pick the most frequent 5-digit run (both printed NO.s should agree). */
function extractSerial(text: string): string | null {
  const matches = text.match(/\d{5}/g);
  if (!matches || matches.length === 0) return null;
  const counts = new Map<string, number>();
  for (const m of matches) counts.set(m, (counts.get(m) ?? 0) + 1);
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0][0];
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url); // decoded bitmap stays valid after revoke
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("load failed"));
    };
    el.src = url;
  });
}

/**
 * Camera + in-browser OCR (Tesseract.js) for voucher serial numbers. Three ways
 * to capture, all routed through `onDetect` (which the page uses to stage/record
 * the serial): live camera (one at a time), or "選擇多張相片" — pick MANY photos
 * and each detected serial is sent through `onDetect`. The single camera result
 * stays editable before adding (manual fallback).
 */
export function SerialScanner({
  onDetect,
  buttonLabel = "掃描流水號",
  disabled = false,
}: {
  onDetect: (serial: string) => Promise<ScanResult>;
  buttonLabel?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [recognized, setRecognized] = useState("");
  const [ocrBusy, setOcrBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [history, setHistory] = useState<{ serial: string; result: ScanResult }[]>(
    [],
  );

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<TesseractWorker | null>(null);
  // Set when the dialog closes so an in-flight multi-image loop stops (instead of
  // OCR-ing on, staging serials after close, and recreating the terminated worker).
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    cancelledRef.current = false;

    async function start() {
      setCameraError(null);
      // Laptops only have a front camera; request the rear one but fall back.
      const tries: MediaStreamConstraints[] = [
        { video: { facingMode: "environment" } },
        { video: true },
      ];
      for (const constraints of tries) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop());
            return;
          }
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            await videoRef.current.play().catch(() => undefined);
          }
          return;
        } catch {
          // try next constraint
        }
      }
      setCameraError(
        "無法開啟相機（權限不足、非 HTTPS 或裝置不支援）。可改用「選擇多張相片」或手動輸入。",
      );
    }
    void start();

    return () => {
      cancelled = true;
      cancelledRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      void workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [open]);

  async function getWorker(): Promise<TesseractWorker> {
    if (workerRef.current) return workerRef.current;
    const { createWorker } = await import("tesseract.js");
    const worker = (await createWorker("eng")) as unknown as TesseractWorker;
    // Allow the "NO." label so it isn't misread as digits; we extract \d{5}.
    await worker.setParameters({ tessedit_char_whitelist: "0123456789NO." });
    workerRef.current = worker;
    return worker;
  }

  // Two-pass OCR over the whole frame: red-isolated first, then raw fallback.
  async function ocrSourceSerial(
    source: CanvasImageSource,
    sw: number,
    sh: number,
  ): Promise<string | null> {
    if (!sw || !sh) return null;
    const worker = await getWorker();
    for (const binarize of [true, false]) {
      const canvas = drawToCanvas(source, sw, sh, binarize);
      if (!canvas) continue;
      const { data } = await worker.recognize(canvas);
      const serial = extractSerial(data.text);
      if (serial) return serial;
    }
    return null;
  }

  async function captureFromCamera() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) {
      setStatus("相機尚未就緒。");
      return;
    }
    setOcrBusy(true);
    setStatus("辨識中…");
    try {
      const serial = await ocrSourceSerial(
        video,
        video.videoWidth,
        video.videoHeight,
      );
      if (serial) {
        setRecognized(serial);
        setStatus("已辨識，請確認後加入。");
      } else {
        setStatus("未能辨識 5 位數字，請對準紅色 NO. 號碼重試，或手動輸入。");
      }
    } catch {
      setStatus("辨識失敗，請手動輸入。");
    } finally {
      setOcrBusy(false);
    }
  }

  // OCR many photos at once; each detected serial goes through onDetect.
  async function recognizeFiles(files: File[]) {
    if (files.length === 0) return;
    setOcrBusy(true);
    let added = 0;
    for (let i = 0; i < files.length; i++) {
      if (cancelledRef.current) break; // dialog closed mid-loop
      setStatus(`辨識中 ${i + 1}/${files.length}…`);
      const file = files[i];
      try {
        const img = await loadImage(file);
        const serial = await ocrSourceSerial(
          img,
          img.naturalWidth,
          img.naturalHeight,
        );
        if (cancelledRef.current) break;
        if (serial) {
          const result = await onDetect(serial);
          if (result.ok) added += 1;
          setHistory((prev) => [{ serial, result }, ...prev].slice(0, 16));
        } else {
          setHistory((prev) =>
            [
              {
                serial: file.name.slice(0, 14),
                result: { ok: false, message: "未辨識到號碼" },
              },
              ...prev,
            ].slice(0, 16),
          );
        }
      } catch {
        if (!cancelledRef.current) {
          setHistory((prev) =>
            [
              {
                serial: file.name.slice(0, 14),
                result: { ok: false, message: "讀取失敗" },
              },
              ...prev,
            ].slice(0, 16),
          );
        }
      }
    }
    setOcrBusy(false);
    if (!cancelledRef.current) {
      setStatus(`已辨識 ${files.length} 張相片，成功加入 ${added} 筆。`);
    }
  }

  async function addRecognized() {
    const parsed = serialNumberSchema.safeParse(recognized);
    if (!parsed.success) {
      setStatus("請輸入 5 位數字流水號。");
      return;
    }
    setAdding(true);
    const result = await onDetect(parsed.data);
    setAdding(false);
    setHistory((prev) => [{ serial: parsed.data, result }, ...prev].slice(0, 16));
    if (result.ok) {
      setRecognized("");
      setStatus("已加入，可繼續掃描下一張。");
    } else {
      setStatus(result.message);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          <Camera className="mr-2 size-4" /> {buttonLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>掃描流水號</DialogTitle>
          <DialogDescription>
            用相機逐張辨識（紅色 NO. 號碼清楚可見），或「選擇多張相片」一次辨識多張。
            辨識結果會加入待記錄清單，可再修正。
          </DialogDescription>
        </DialogHeader>

        {cameraError ? (
          <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
            {cameraError}
          </p>
        ) : (
          <div className="relative overflow-hidden rounded-md border bg-black">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <video
              ref={videoRef}
              playsInline
              muted
              className="aspect-video w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-4 rounded border-2 border-primary/70" />
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            onClick={captureFromCamera}
            disabled={ocrBusy || Boolean(cameraError)}
            className="flex-1"
          >
            <ScanLine className="mr-2 size-4" />
            {ocrBusy ? "辨識中…" : "辨識"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileRef.current?.click()}
            disabled={ocrBusy}
          >
            <ImageUp className="mr-2 size-4" /> 選擇多張相片
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length) void recognizeFiles(files);
              e.target.value = "";
            }}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="recognized" className="text-sm font-medium">
            流水號（可修正）
          </label>
          <div className="flex gap-2">
            <Input
              id="recognized"
              value={recognized}
              onChange={(e) => setRecognized(e.target.value)}
              inputMode="numeric"
              maxLength={5}
            />
            <Button onClick={addRecognized} disabled={adding}>
              {adding ? "加入中…" : "加入"}
            </Button>
          </div>
          {status ? (
            <p className="text-sm text-muted-foreground">{status}</p>
          ) : null}
        </div>

        {history.length > 0 ? (
          <ul className="max-h-32 space-y-1 overflow-y-auto text-sm">
            {history.map((h, i) => (
              <li
                key={`${h.serial}-${i}`}
                className={h.result.ok ? "text-foreground" : "text-destructive"}
              >
                {h.result.ok ? "✓" : "✗"} {h.serial} — {h.result.message}
              </li>
            ))}
          </ul>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
