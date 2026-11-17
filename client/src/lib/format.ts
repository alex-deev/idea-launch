export function getAppLocale(language: string | undefined) {
  return language?.startsWith("es") ? "es-ES" : "en-US";
}

export function formatCurrencyCents(
  cents: number,
  language?: string,
  currency = "USD",
) {
  const locale = getAppLocale(language);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format((cents || 0) / 100);
}

export function formatDate(
  value: string | number | Date,
  language?: string,
  options?: Intl.DateTimeFormatOptions,
) {
  const locale = getAppLocale(language);
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, options).format(date);
}
