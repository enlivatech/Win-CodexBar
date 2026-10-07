import type { LocaleKey } from "../i18n/keys";

type Translate = (key: LocaleKey) => string;

/**
 * Provider detail lines arrive in English (cached snapshots stay
 * language-neutral). These tables translate the generic shapes at render
 * time; numbers, currency and provider names are kept verbatim, and text that
 * matches nothing passes through unchanged.
 */
const SENTENCES: Record<string, LocaleKey> = {
  "no quota reported": "ProviderTextNoQuotaReported",
  "no quota data": "ProviderTextNoQuotaData",
  "usage unavailable": "ProviderTextUsageUnavailable",
  "no balance information returned": "ProviderTextNoBalanceInfo",
  unlimited: "ProviderTextUnlimited",
  unavailable: "ProviderTextUnavailable",
  "overdue invoices": "ProviderTextOverdueInvoices",
  "subscription active": "ProviderTextSubscriptionActive",
  "virtual key is inactive": "ProviderTextVirtualKeyInactive",
  "credit usage unavailable": "ProviderTextCreditUsageUnavailable",
  "no token quota": "ProviderTextNoTokenQuota",
  "token quota unavailable": "ProviderTextTokenQuotaUnavailable",
  "no active model quota": "ProviderTextNoActiveModelQuota",
  "billing usage unavailable": "ProviderTextBillingUsageUnavailable",
  "no applicable budgets reported": "ProviderTextNoApplicableBudgets",
  "no active subscription kwh": "ProviderTextNoActiveSubscriptionKwh",
  "no token-plan usage": "ProviderTextNoTokenPlanUsage",
  "no edit predictions included": "ProviderTextNoEditPredictions",
  "daily usage": "ProviderTextDailyUsage",
  "resets daily": "ProviderTextResetsDaily",
  "no active 5h session": "ProviderTextNoActiveSession",
  "key quota": "ProviderTextKeyQuota",
  "account balance": "ProviderTextAccountBalance",
  "monthly budget": "ProviderTextMonthlyBudget",
  "api spend": "ProviderTextApiSpend",
  offline: "ProviderTextOffline",
};

/** "<value> <unit phrase>" lines, keyed by the lowercase unit phrase. */
const UNITS: Record<string, LocaleKey> = {
  requests: "ProviderTextRequests",
  tokens: "ProviderTextTokens",
  credits: "ProviderTextCredits",
  "weekly credits": "ProviderTextWeeklyCredits",
  "add-on credits": "ProviderTextAddOnCredits",
  "event credits": "ProviderTextEventCredits",
  "refresh credits": "ProviderTextRefreshCredits",
  "credits available": "ProviderTextCreditsAvailable",
  units: "ProviderTextUnits",
  predictions: "ProviderTextPredictions",
  flows: "ProviderTextFlows",
  conversations: "ProviderTextConversations",
  available: "ProviderTextAvailable",
  remaining: "ProviderTextRemaining",
  used: "ProviderTextUsed",
  "tokens today": "ProviderTextTokensToday",
  "tokens remaining": "ProviderTextTokensRemaining",
  "spent this month": "ProviderTextSpentThisMonth",
  "monthly grant": "ProviderTextMonthlyGrant",
  "total usable": "ProviderTextTotalUsable",
  "model(s)": "ProviderTextModels",
  "api-rate": "ProviderTextApiRate",
};

/** "<prefix> <value>" lines, keyed by the lowercase prefix. */
const PREFIXES: Array<[string, LocaleKey]> = [
  ["spent this month: ", "ProviderTextSpentThisMonthPrefix"],
  ["monthly spend ", "ProviderTextMonthlySpendPrefix"],
  ["deployment: ", "ProviderTextDeploymentPrefix"],
  ["balance ", "ProviderTextBalancePrefix"],
  ["cash ", "ProviderTextCashPrefix"],
  ["ends ", "ProviderTextEnds"],
];

const V = String.raw`[-+]?[$¥€£]?\d[\d,]*(?:\.\d+)?\s?[KMBkmb]?%?`;
const VALUE = new RegExp(String.raw`^(${V}(?:\s*/\s*${V})?)\s+(.+)$`);
const PATTERNS: Array<[RegExp, LocaleKey]> = [
  [new RegExp(String.raw`^(${V}) of (${V}) credits$`, "i"), "ProviderTextOfCredits"],
  [new RegExp(String.raw`^(${V}) tokens over last (\d+) days$`, "i"), "ProviderTextTokensOverLastDays"],
  [new RegExp(String.raw`^(${V}) over last (\d+) days$`, "i"), "ProviderTextOverLastDays"],
  [new RegExp(String.raw`^(${V}) used, (${V}) remaining$`, "i"), "ProviderTextUsedRemaining"],
  [new RegExp(String.raw`^(${V}) total credits \((${V}) free\)$`, "i"), "ProviderTextTotalCreditsFree"],
  [new RegExp(String.raw`^(${V}) used / (\w+)$`, "i"), "ProviderTextUsedPerPeriod"],
  [/^no (.+) budget quota reported$/i, "ProviderTextNoBrandBudgetQuotaReported"],
  [/^no cached (.+) quota details$/i, "ProviderTextNoCachedBrandQuota"],
  [/^no active (.+) tier allowance$/i, "ProviderTextNoActiveBrandTier"],
  [/^no (.+) quota reported$/i, "ProviderTextNoBrandQuotaReported"],
];

function fill(template: string, values: string[]): string {
  return values.reduce<string>((text, value) => text.replace("{}", value), template);
}

function localizeSegment(segment: string, t: Translate): string {
  const trimmed = segment.trim();
  const lower = trimmed.toLowerCase();
  if (!/[a-z]{2}/i.test(trimmed)) return segment;
  const sentence = SENTENCES[lower];
  if (sentence) return t(sentence);
  for (const [pattern, key] of PATTERNS) {
    const m = pattern.exec(trimmed);
    if (m) return fill(t(key), m.slice(1));
  }
  const value = VALUE.exec(trimmed);
  if (value) {
    const unit = UNITS[value[2].toLowerCase()];
    if (unit) return fill(t(unit), [value[1]]);
    if (value[2].toLowerCase() === "conversation") return fill(t("ProviderTextConversations"), [value[1]]);
  }
  for (const [prefix, key] of PREFIXES) {
    if (lower.startsWith(prefix)) return fill(t(key), [trimmed.slice(prefix.length).trim()]);
  }
  const balance = /^(.+) balance$/i.exec(trimmed);
  if (balance) return fill(t("ProviderTextBalanceSuffix"), [balance[1]]);
  return segment;
}

/** Localize a provider detail line; " · "-joined parts are translated one by one. */
export function localizeProviderText(
  text: string | null | undefined,
  t: Translate,
): string {
  if (!text) return text ?? "";
  return text
    .split(" · ")
    .map((segment) => localizeSegment(segment, t))
    .join(" · ");
}
