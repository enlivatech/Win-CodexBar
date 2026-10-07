import { describe, expect, it } from "vitest";
import type { LocaleKey } from "../i18n/keys";
import { localizeWindowLabel } from "./windowLabels";

const t = (key: LocaleKey) => `t:${key}`;

describe("localizeWindowLabel", () => {
  it("translates the generic provider window labels", () => {
    expect(localizeWindowLabel("Session", t)).toBe("t:ProviderSessionLabel");
    expect(localizeWindowLabel("Weekly", t)).toBe("t:ProviderWeeklyLabel");
    expect(localizeWindowLabel("Monthly", t)).toBe("t:ProviderMonthly");
  });

  it("keeps provider-specific labels as declared", () => {
    expect(localizeWindowLabel("5-hour", t)).toBe("5-hour");
    expect(localizeWindowLabel(undefined, t)).toBe("");
  });
});
