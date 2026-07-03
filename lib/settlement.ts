export const SETTLEMENT_STATUS_LABEL: Record<string, string> = {
  pending_review: "未付款",
  approved: "未付款", // legacy value; the flow is now just 未付款 / 已付款
  paid: "已付款",
};

export function settlementStatusLabel(status: string): string {
  return SETTLEMENT_STATUS_LABEL[status] ?? status;
}

export function formatNT(amount: number): string {
  return `NT$ ${amount.toLocaleString()}`;
}
