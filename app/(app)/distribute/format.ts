/** Shared pure formatters for the 發券 ledger + history. */

export function pad5(n: number): string {
  return String(n).padStart(5, "0");
}

/** Collapse a set of serial ints into compact ranges, e.g. "27001–27010、27025". */
export function collapseRanges(nums: number[]): string {
  const sorted = [...nums].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    if (i < sorted.length && sorted[i] === prev + 1) {
      prev = sorted[i];
      continue;
    }
    parts.push(start === prev ? pad5(start) : `${pad5(start)}–${pad5(prev)}`);
    if (i < sorted.length) {
      start = sorted[i];
      prev = sorted[i];
    }
  }
  return parts.join("、");
}

/** Compact M/D label for a 發券 date (month is already implied by context). */
export function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** One date if all on the same day, else "起–迄" (ISO strings sort chronologically). */
export function dateRangeLabel(isos: string[]): string {
  if (isos.length === 0) return "—";
  let minISO = isos[0];
  let maxISO = isos[0];
  for (const iso of isos) {
    if (iso < minISO) minISO = iso;
    if (iso > maxISO) maxISO = iso;
  }
  const minLabel = fmtDate(minISO);
  const maxLabel = fmtDate(maxISO);
  return minLabel === maxLabel ? minLabel : `${minLabel}–${maxLabel}`;
}
