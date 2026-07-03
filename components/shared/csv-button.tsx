"use client";

import Papa from "papaparse";

import { Button } from "@/components/ui/button";

/** Downloads `rows` as a UTF-8 (BOM'd, Excel-friendly) CSV named `filename`. */
export function CsvButton({
  filename,
  rows,
  label = "下載 CSV",
}: {
  filename: string;
  rows: Record<string, string | number>[];
  label?: string;
}) {
  function download() {
    const csv = Papa.unparse(rows);
    const blob = new Blob([`﻿${csv}`], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={download}>
      {label}
    </Button>
  );
}
