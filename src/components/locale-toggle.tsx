"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { setLocale } from "@/i18n/actions";
import { cn } from "@/lib/utils";

export function LocaleToggle() {
  const locale = useLocale();
  const t = useTranslations("shell");
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await setLocale(locale === "en" ? "es" : "en");
          window.location.reload();
        })
      }
      className={cn(
        "rounded-lg border border-ink-200 px-3 py-1.5 text-sm text-ink-700 transition-colors hover:bg-ink-100",
        isPending && "opacity-50"
      )}
    >
      {t("languageToggle")}
    </button>
  );
}
