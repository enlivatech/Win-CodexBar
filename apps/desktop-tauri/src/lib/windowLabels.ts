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
  return localizeProviderLabel(raw, t);
}

/**
 * Generic English labels that providers emit for windows and detail rows.
 * Brand, model and plan names are not listed, so they pass through unchanged.
 */
const PROVIDER_LABEL_KEYS: Record<string, LocaleKey> = {
  credits: "CreditsLabel",
  balance: "DetailCostBalance",
  spend: "UsageSpendSpend",
  usage: "ProviderUsage",
  requests: "OpenAIChartRequests",
  tokens: "OpenAIChartMetricTokens",
  quota: "WindowLabelQuota",
  daily: "WindowLabelDaily",
  budget: "WindowLabelBudget",
  "weekly quota": "WindowLabelWeeklyQuota",
  "monthly quota": "WindowLabelMonthlyQuota",
  status: "WindowLabelStatus",
  "shared pool": "WindowLabelSharedPool",
  reviews: "WindowLabelReviews",
  premium: "WindowLabelPremium",
  "premium weekly": "WindowLabelPremiumWeekly",
  plan: "WindowLabelPlan",
  personal: "WindowLabelPersonal",
  models: "WindowLabelModels",
  billing: "WindowLabelBilling",
  "api key limit": "WindowLabelApiKeyLimit",
  "weekly cost": "WindowLabelWeeklyCost",
  "daily cost": "WindowLabelDailyCost",
  cost: "WindowLabelCost",
  voices: "WindowLabelVoices",
  "team budget": "WindowLabelTeamBudget",
  "personal budget": "WindowLabelPersonalBudget",
  "secondary budget": "WindowLabelSecondaryBudget",
  subscription: "WindowLabelSubscription",
  standard: "WindowLabelStandard",
  "shared credits": "WindowLabelSharedCredits",
  "plan credits": "WindowLabelPlanCredits",
  "monthly credits": "WindowLabelMonthlyCredits",
  "bonus credits": "WindowLabelBonusCredits",
  "add-on credits": "WindowLabelAddOnCredits",
  savings: "WindowLabelSavings",
  rolling: "WindowLabelRolling",
  refresh: "WindowLabelRefresh",
  "rate limit": "WindowLabelRateLimit",
  points: "WindowLabelPoints",
  packages: "WindowLabelPackages",
  overage: "WindowLabelOverage",
  "on-demand": "WindowLabelOnDemand",
  memory: "WindowLabelMemory",
  "key allowance": "WindowLabelKeyAllowance",
  edits: "WindowLabelEdits",
  deployment: "WindowLabelDeployment",
  "daily free tokens": "WindowLabelDailyFreeTokens",
  cycle: "WindowLabelCycle",
  chat: "WindowLabelChat",
  cash: "WindowLabelCash",
  base: "WindowLabelBase",
  "agent usage": "WindowLabelAgentUsage",
  version: "WindowLabelVersion",
  project: "WindowLabelProject",
  key: "WindowLabelKey",
  email: "WindowLabelEmail",
  account: "WindowLabelAccount",
  "usage (last 7 days)": "WindowLabelUsageLast7Days",
};

/** Localize a generic provider label ("Credits", "5-hour", ...); other text passes through. */
export function localizeProviderLabel(
  raw: string | null | undefined,
  t: (key: LocaleKey) => string,
): string {
  const trimmed = raw?.trim() ?? "";
  const normalized = trimmed.toLowerCase();
  if (!normalized) return raw ?? "";
  const key = PROVIDER_LABEL_KEYS[normalized];
  if (key) return t(key);
  if (normalized === "session") return t("ProviderSessionLabel");
  if (normalized === "weekly") return t("ProviderWeeklyLabel");
  const session = /^session \((\d+h)\)$/.exec(normalized);
  if (session) return `${t("ProviderSessionLabel")} (${session[1]})`;
  const hours = /^(\d+)(?:-| )hours?$/.exec(normalized);
  if (hours) return t("WindowLabelHours").replace("{}", hours[1]);
  const hourQuota = /^(\d+)-hour quota$/.exec(normalized);
  if (hourQuota) return t("WindowLabelHourQuota").replace("{}", hourQuota[1]);
  const days = /^(\d+)-day$/.exec(normalized);
  if (days) return t("WindowLabelDays").replace("{}", days[1]);
  return raw ?? "";
}
