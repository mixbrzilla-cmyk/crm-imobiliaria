export function formatBRLInput(raw: string) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";

  const cents = Number(digits);
  if (!Number.isFinite(cents)) return "";

  const value = cents / 100;
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function parseBRLInputToNumber(raw: string) {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;

  const cents = Number(digits);
  if (!Number.isFinite(cents)) return null;

  return cents / 100;
}

export function formatCurrencyBRL(value: number, opts?: { maximumFractionDigits?: number }) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: opts?.maximumFractionDigits ?? 2,
  });
}
