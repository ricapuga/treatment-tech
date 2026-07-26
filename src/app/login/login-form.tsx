"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { loginAction, type LoginState } from "./actions";
import { cn } from "@/lib/utils";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next: string }) {
  const t = useTranslations("login");
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-neutral-700">
          {t("email")}
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium text-neutral-700">
          {t("password")}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="rounded border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
        />
      </div>

      {state.error && <p className="text-sm text-red-600">{t("error")}</p>}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "mt-2 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800",
          isPending && "opacity-50"
        )}
      >
        {t("submit")}
      </button>
    </form>
  );
}
