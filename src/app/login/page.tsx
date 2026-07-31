import { getTranslations } from "next-intl/server";
import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("login");
  const { next } = await searchParams;

  return (
    <div className="flex flex-1">
      {/* Panel de marca — visible solo en pantallas medianas+; en móvil el formulario
          ocupa todo el ancho. Refuerza identidad de producto desde el primer segundo,
          en vez de una pantalla de login genérica de formulario suelto. */}
      <div className="brand-dot-grid relative hidden flex-1 flex-col justify-between overflow-hidden bg-brand-700 p-10 text-brand-50 md:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-sm font-semibold text-white">
            TT
          </div>
          <div className="text-sm font-semibold text-white">Treatment Tech</div>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold leading-tight text-white">
            Simplify compliance. Strengthen care.
          </h1>
          <p className="mt-4 text-sm text-brand-100">
            Manage assessments, documentation, treatment plans, billing, and
            reporting from one secure platform built for DUI treatment providers.
          </p>
          <div className="mt-6 flex items-center gap-2 text-xs text-brand-100">
            <ShieldCheck className="h-4 w-4" />
            Piloto activo — DUI Metropolitan Services, Archer
          </div>
        </div>

        <div className="text-xs text-brand-200">
          © {new Date().getFullYear()} Treatment Tech
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-background p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white">
              TT
            </div>
            <div className="text-sm font-semibold text-ink-900">Treatment Tech</div>
          </div>

          <div className="rounded-xl border border-border-subtle bg-surface p-8 shadow-[var(--shadow-md)]">
            <h1 className="mb-1 text-xl font-semibold text-ink-900">{t("title")}</h1>
            <p className="mb-6 text-sm text-ink-500">
              DUI Metropolitan Services, Inc. — Archer
            </p>
            <LoginForm next={next ?? "/dashboard"} />
          </div>
        </div>
      </div>
    </div>
  );
}
