"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNT } from "@/lib/settlement";
import { SettlementPayButton } from "./pay-button";

type StoreBreakdown = {
  storeId: string;
  storeName: string;
  prepay: number;
  compensation: number;
  total: number;
};

export type ReceiptView = {
  id: string;
  storeName: string;
  amount: number;
  date: string;
  url: string | null;
};

/**
 * An expandable settlement row: clicking the row reveals the per-store
 * breakdown inline; the NGO name links to the full detail (含他店券明細).
 */
export function SettlementRow({
  repId,
  yearMonth,
  ngoName,
  prepay,
  compensation,
  total,
  status,
  stores,
  userId,
  receipts,
}: {
  repId: string;
  yearMonth: string;
  ngoName: string;
  prepay: number;
  compensation: number;
  total: number;
  status: string;
  stores: StoreBreakdown[];
  userId: string;
  receipts: ReceiptView[];
}) {
  const [expanded, setExpanded] = useState(false);
  const [receiptsOpen, setReceiptsOpen] = useState(false);
  const href = `/admin/settlements/${repId}?ym=${yearMonth}`;

  return (
    <>
      <TableRow
        tabIndex={0}
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          // Only the row itself toggles; ignore Enter/Space bubbling up from the
          // NGO-name link or the 已付款 button inside it.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
        className="cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none"
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-1.5">
            <ChevronRight
              className={cn(
                "size-4 shrink-0 text-muted-foreground transition-transform",
                expanded && "rotate-90",
              )}
            />
            <Link
              href={href}
              onClick={(e) => e.stopPropagation()}
              className="hover:underline"
            >
              {ngoName}
            </Link>
          </div>
        </TableCell>
        <TableCell className="text-right">{formatNT(prepay)}</TableCell>
        <TableCell className="text-right">{formatNT(compensation)}</TableCell>
        <TableCell className="text-right font-medium">
          {formatNT(total)}
        </TableCell>
        <TableCell>
          {receipts.length > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setReceiptsOpen(true);
              }}
            >
              查看（{receipts.length}）
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">未上傳</span>
          )}
        </TableCell>
        <TableCell className="text-right">
          <SettlementPayButton
            repId={repId}
            yearMonth={yearMonth}
            status={status}
            userId={userId}
          />
        </TableCell>
      </TableRow>

      {expanded
        ? stores.length === 0
          ? (
              <TableRow className="bg-muted/20">
                <TableCell
                  colSpan={6}
                  className="pl-10 text-sm text-muted-foreground"
                >
                  此 NGO 本月無店家資料
                </TableCell>
              </TableRow>
            )
          : stores.map((s) => (
              <TableRow key={s.storeId} className="bg-muted/20">
                <TableCell className="pl-10 text-sm text-muted-foreground">
                  {s.storeName}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatNT(s.prepay)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatNT(s.compensation)}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatNT(s.total)}
                </TableCell>
                <TableCell />
                <TableCell />
              </TableRow>
            ))
        : null}

      <Dialog open={receiptsOpen} onOpenChange={setReceiptsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ngoName} · 收據</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {receipts.map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b pb-3">
                {r.url ? (
                  <a href={r.url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.url}
                      alt="收據"
                      className="size-20 rounded border object-cover"
                    />
                  </a>
                ) : (
                  <div className="flex size-20 items-center justify-center rounded border bg-muted text-xs text-muted-foreground">
                    無圖
                  </div>
                )}
                <div className="text-sm">
                  <p className="font-medium">{r.storeName}</p>
                  <p className="text-muted-foreground">
                    {formatNT(r.amount)} · {r.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
