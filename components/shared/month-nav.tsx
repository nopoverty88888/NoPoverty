"use client";

import { useRouter } from "next/navigation";
import type { ChangeEvent } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** A month picker that navigates to `${basePath}?ym=YYYY-MM`. */
export function MonthNav({
  yearMonth,
  basePath,
  label = "月份",
}: {
  yearMonth: string;
  basePath: string;
  label?: string;
}) {
  const router = useRouter();

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.value) {
      router.push(`${basePath}?ym=${event.target.value}`);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="ym">{label}</Label>
      <Input
        id="ym"
        type="month"
        value={yearMonth}
        onChange={onChange}
        className="w-44"
      />
    </div>
  );
}
