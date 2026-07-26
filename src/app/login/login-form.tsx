"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Mail, Lock, AlertCircle } from "lucide-react";
import { loginAction, type LoginState } from "./actions";
import { cn } from "@/lib/utils";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-700">
          {t("email")}
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-ink-200 bg-surface py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-700">
          {t("password")}
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="w-full rounded-lg border border-ink-200 bg-surface py-2 pl-9 pr-3 text-sm text-ink-900 outline-none transition-colors placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </div>
      </div>

      {state.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {t("error")}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "mt-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-700",
          isPending && "opacity-60"
        )}
      >
        {isPending ? "…" : t("submit")}
      </button>
    </form>
  );
}
