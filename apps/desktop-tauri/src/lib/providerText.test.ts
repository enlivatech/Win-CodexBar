import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { LocaleKey } from "../i18n/keys";
import { localizeProviderText } from "./providerText";

/** Translator backed by the shipped Fluent file, with `{ "{}" }` unescaped. */
function fromFtl(file: string) {
  const text = readFileSync(`${import.meta.dirname}/../../../../rust/src/locale/${file}`, "utf8");
  const table = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Za-z][\w-]*)\s*=\s?(.*)$/.exec(line);
    if (m) table.set(m[1], m[2].replace(/\{ "\{\}" \}/g, "{}"));
  }
  return (key: LocaleKey) => table.get(key) ?? key;
}

const en = fromFtl("en-US.ftl");
const ru = fromFtl("ru-RU.ftl");

describe("localizeProviderText", () => {
  it.each([
    ["7 requests", "7 requests"],
    ["$12.40 API-rate", "$12.40 API-rate"],
    ["3/10 weekly credits", "3/10 weekly credits"],
    ["Offline · 2 conversations", "Offline · 2 conversations"],
    ["No Copilot quota reported", "No Copilot quota reported"],
    ["$1.20 / $5.00", "$1.20 / $5.00"],
    ["Claude 14d: 1 input, 2 output tokens", "Claude 14d: 1 input, 2 output tokens"],
  ])("keeps English output unchanged for %j", (text, expected) => {
    expect(localizeProviderText(text, en)).toBe(expected);
  });

  it.each([
    ["7 requests", "Запросов: 7"],
    ["1,234 tokens", "Токенов: 1,234"],
    ["$12.40 API-rate", "$12.40 по тарифам API"],
    ["3/10 weekly credits", "Недельных кредитов: 3/10"],
    ["1.00 of 5.00 credits", "1.00 из 5.00 кредитов"],
    ["$4.10 over last 30 days", "$4.10 за последние 30 дн."],
    ["5 used, 3 remaining", "Использовано 5, осталось 3"],
    ["Offline · 2 conversations", "Офлайн · Диалогов: 2"],
    ["Offline · 1 conversation", "Офлайн · Диалогов: 1"],
    ["No balance information returned", "Данные о балансе не получены"],
    ["No Copilot quota reported", "Квота Copilot не сообщается"],
    ["No cached Windsurf quota details", "Нет сохраненных данных о квоте Windsurf"],
    ["Balance ¥3.00", "Баланс ¥3.00"],
    ["Hypercredit balance", "Баланс Hypercredit"],
    ["¥3.00 available", "Доступно: ¥3.00"],
  ])("translates %j", (text, expected) => {
    expect(localizeProviderText(text, ru)).toBe(expected);
  });

  it("passes unknown text and bare numbers through", () => {
    expect(localizeProviderText("$1.20 / $5.00", ru)).toBe("$1.20 / $5.00");
    expect(localizeProviderText("Gemini Pro", ru)).toBe("Gemini Pro");
    expect(localizeProviderText(null, ru)).toBe("");
  });
});
