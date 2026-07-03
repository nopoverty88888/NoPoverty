"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { toast } from "sonner";
import { Upload, FileDown, RotateCcw } from "lucide-react";
import type { PostgrestError } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/client";
import { caseCreateSchema } from "@/lib/schemas/case";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

/** Accepted CSV header names → canonical field. Chinese or English both work. */
const HEADER_ALIASES: Record<string, "name" | "id_number" | "note"> = {
  姓名: "name",
  名字: "name",
  name: "name",
  身分證字號: "id_number",
  身分證: "id_number",
  id_number: "id_number",
  id: "id_number",
  備註: "note",
  說明: "note",
  note: "note",
};

const MAX_ROWS = 1000;
const IMPORT_CHUNK = 10;

type ParsedRow = {
  line: number; // 1-based data-row number (header excluded)
  name: string;
  idNumber: string;
  note: string;
  error: string | null; // validation / in-file-duplicate error; null = importable
};

type ImportResult = {
  imported: number; // count
  failed: { line: number; reason: string }[];
};

function mapPgError(error: PostgrestError): string {
  if (error.code === "23505") return "此身分證字號已存在";
  return error.message;
}

export function CaseImportDialog({
  ngoId,
  userId,
}: {
  ngoId: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [result, setResult] = useState<ImportResult | null>(null);

  const validCount = rows.filter((r) => !r.error).length;
  const invalidCount = rows.length - validCount;

  function reset() {
    setFileName(null);
    setRows([]);
    setParseError(null);
    setNotice(null);
    setImporting(false);
    setProgress({ done: 0, total: 0 });
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function downloadTemplate() {
    const csv = Papa.unparse({
      fields: ["姓名", "身分證字號", "備註"],
      data: [["王小明", "A123456789", "範例備註（選填）"]],
    });
    // BOM so Excel opens UTF-8 correctly.
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "個案匯入範本.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    reset();
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => HEADER_ALIASES[h.trim()] ?? h.trim(),
      complete: (res) => {
        const fields = res.meta.fields ?? [];
        if (!fields.includes("name") || !fields.includes("id_number")) {
          setParseError(
            "找不到必要欄位。CSV 需包含「姓名」與「身分證字號」欄位，可先下載範本。",
          );
          return;
        }
        const data = res.data.slice(0, MAX_ROWS);
        if (res.data.length > MAX_ROWS) {
          setNotice(`檔案超過 ${MAX_ROWS} 筆，僅載入前 ${MAX_ROWS} 筆。`);
        }
        // Track first occurrence of each id_number to flag in-file duplicates.
        const seen = new Map<string, number>();
        const parsed: ParsedRow[] = data.map((raw, i) => {
          const line = i + 1;
          const name = (raw.name ?? "").trim();
          const idNumber = (raw.id_number ?? "").trim();
          const note = (raw.note ?? "").trim();
          const check = caseCreateSchema.safeParse({
            name,
            id_number: idNumber,
            note: note.length > 0 ? note : undefined,
          });
          let error: string | null = null;
          if (!check.success) {
            error = check.error.issues[0]?.message ?? "資料格式錯誤";
          } else {
            const key = idNumber.toUpperCase();
            const firstLine = seen.get(key);
            if (firstLine !== undefined) {
              error = `身分證字號與第 ${firstLine} 列重複`;
            } else {
              seen.set(key, line);
            }
          }
          return { line, name, idNumber, note, error };
        });
        if (parsed.length === 0) {
          setParseError("檔案沒有可匯入的資料列。");
          return;
        }
        setRows(parsed);
      },
      error: (err) => {
        setParseError(`檔案解析失敗：${err.message}`);
      },
    });
  }

  async function runImport() {
    const valid = rows.filter((r) => !r.error);
    if (valid.length === 0) return;
    setImporting(true);
    setProgress({ done: 0, total: valid.length });

    const failed: { line: number; reason: string }[] = [];
    let completed = 0;
    for (let i = 0; i < valid.length; i += IMPORT_CHUNK) {
      const chunk = valid.slice(i, i + IMPORT_CHUNK);
      await Promise.all(
        chunk.map(async (r) => {
          const { error } = await supabase.from("cases").insert({
            name: r.name,
            id_number: r.idNumber,
            note: r.note.length > 0 ? r.note : null,
            ngo_id: ngoId,
            created_by_id: userId,
          });
          completed += 1;
          setProgress({ done: completed, total: valid.length });
          if (error) failed.push({ line: r.line, reason: mapPgError(error) });
        }),
      );
    }

    setImporting(false);
    setResult({ imported: valid.length - failed.length, failed });
    router.refresh();
    if (failed.length === 0) {
      toast.success(`已匯入 ${valid.length} 筆個案`);
    } else {
      toast.warning(
        `匯入完成：成功 ${valid.length - failed.length} 筆，失敗 ${failed.length} 筆`,
      );
    }
  }

  const failedLines = new Set(result?.failed.map((f) => f.line));
  function statusCell(r: ParsedRow) {
    if (result) {
      const f = result.failed.find((x) => x.line === r.line);
      if (f) return <span className="text-destructive">✕ {f.reason}</span>;
      if (!r.error) return <span className="text-green-600">✓ 已匯入</span>;
      return <span className="text-muted-foreground">已略過（{r.error}）</span>;
    }
    return r.error ? (
      <span className="text-destructive">{r.error}</span>
    ) : (
      <span className="text-green-600">可匯入</span>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="sm:flex-1">
          <Upload className="mr-1 size-4" /> 批次匯入 CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>批次匯入個案</DialogTitle>
          <DialogDescription>
            上傳 CSV 檔案一次新增多筆個案。欄位：<b>姓名</b>、<b>身分證字號</b>、
            <b>備註</b>（選填）。身分證字號存檔後不可再檢視（僅顯示後 4 碼）。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={downloadTemplate}>
              <FileDown className="mr-1 size-4" /> 下載範本
            </Button>
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
            >
              <Upload className="mr-1 size-4" /> 選擇 CSV 檔案
            </Button>
            {rows.length > 0 && !importing ? (
              <Button variant="ghost" size="sm" onClick={reset}>
                <RotateCcw className="mr-1 size-4" /> 重新選擇
              </Button>
            ) : null}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {fileName ? (
            <p className="text-xs text-muted-foreground">已選擇：{fileName}</p>
          ) : null}
          {parseError ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
              {parseError}
            </p>
          ) : null}
          {notice ? (
            <p className="text-xs text-amber-600">{notice}</p>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center gap-3 text-sm">
                {result ? (
                  <span className="text-muted-foreground">
                    匯入完成：成功 {result.imported} 筆
                    {result.failed.length > 0
                      ? `，失敗 ${result.failed.length} 筆`
                      : ""}
                  </span>
                ) : (
                  <>
                    <span className="text-green-600">
                      {validCount} 筆可匯入
                    </span>
                    {invalidCount > 0 ? (
                      <span className="text-destructive">
                        {invalidCount} 筆有誤（將略過）
                      </span>
                    ) : null}
                  </>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>姓名</TableHead>
                      <TableHead>身分證字號</TableHead>
                      <TableHead>備註</TableHead>
                      <TableHead>狀態</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow
                        key={r.line}
                        className={cn(
                          r.error && !result ? "bg-destructive/5" : undefined,
                          failedLines.has(r.line) ? "bg-destructive/5" : undefined,
                        )}
                      >
                        <TableCell className="text-muted-foreground">
                          {r.line}
                        </TableCell>
                        <TableCell className="font-medium">
                          {r.name || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {r.idNumber || "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {r.note || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{statusCell(r)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          ) : null}
        </div>

        <DialogFooter>
          {result ? (
            <Button onClick={() => setOpen(false)}>關閉</Button>
          ) : (
            <Button
              onClick={runImport}
              disabled={importing || validCount === 0}
            >
              {importing
                ? `匯入中… ${progress.done}/${progress.total}`
                : `匯入 ${validCount} 筆`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
