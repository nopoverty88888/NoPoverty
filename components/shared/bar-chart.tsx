/** Simple horizontal bar chart (server-renderable, no chart library). */
export function BarChart({
  data,
  emptyText = "無資料",
}: {
  data: { label: string; value: number }[];
  emptyText?: string;
}) {
  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="space-y-1">
          <div className="flex justify-between gap-2 text-sm">
            <span className="min-w-0 truncate">{d.label}</span>
            <span className="shrink-0 text-muted-foreground">{d.value}</span>
          </div>
          <div className="h-2 overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded bg-primary"
              style={{ width: `${(d.value / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
