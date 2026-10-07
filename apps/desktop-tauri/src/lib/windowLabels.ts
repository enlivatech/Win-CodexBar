import type { LocaleKey } from "../i18n/keys";

/** Localize raw provider window labels using the active locale. */
export function localizeWindowLabel(
  raw: string | undefined,
  t: (key: LocaleKey) => string,
  language?: string,
  windowMinutes?: number | null,
  windowId?: string,
): string {
  const normalized = raw?.trim().toLowerCase();
  if (windowId?.startsWith("claude-weekly-scoped-")) {
    const modelName = raw?.trim().replace(/\s+only\s*$/i, "").trim();
    const template = t("ClaudeScopedWeeklyLabel");
    return modelName ? template.replace("{}", modelName) : template.replace("{}", "");
  }
  // Upstream 0.55.0 #3070: quota windows in Simplified Chinese use their
  // actual duration instead of the conversational Session wording.
  if (language === "chinese" && normalized === "session" && windowMinutes != null) {
    if (windowMinutes === 7 * 24 * 60) return t("ProviderWeeklyLabel");
    if (windowMinutes >= 60 && windowMinutes <= 12 * 60 && windowMinutes % 60 === 0) {
      return `${windowMinutes / 60} 小时`;
    }
  }
  if (normalized === "session") {
    return t("ProviderSessionLabel");
  }
  if (normalized === "weekly") {
    return t("ProviderWeeklyLabel");
  }
  // F5 (upstream 0.48.0): monthly (30-day) window label.
  if (normalized === "monthly") {
    return t("ProviderMonthly");
  }
  return raw ?? "";
}
