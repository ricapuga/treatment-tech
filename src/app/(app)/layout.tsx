import { getTranslations } from "next-intl/server";
import { LayoutDashboard, Users, ShieldCheck } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { NavLink } from "@/components/nav-link";

/**
 * Shell base (blueprint M1 paso 7): sidebar + header + toggle es/en.
 * Rediseñado (sesión de estrategia visual vs. BestNotes — ver
 * "Estrategia Competitiva — Superar a BestNotes.md"): sistema de diseño con tokens
 * de globals.css, navegación con iconos y estado activo, y una pista visual constante
 * de tenant/piloto en el pie del sidebar (importante en un producto multi-tenant: el
 * usuario siempre debe poder confirmar en qué clínica está parado).
 * Autenticación real y datos de sesión (nombre, rol, tenant) se conectan aquí una
 * vez que auth.api.getSession() esté disponible con DATABASE_URL configurada.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("shell");

  return (
    <div className="flex flex-1">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border-subtle bg-surface">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-semibold text-white shadow-[var(--shadow-sm)]">
            TT
          </div>
          <div className="text-sm font-semibold text-ink-900">{t("appName")}</div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3">
          <NavLink href="/dashboard" icon={<LayoutDashboard className="h-4 w-4" />}>
            {t("dashboard")}
          </NavLink>
          <NavLink href="/cases" icon={<Users className="h-4 w-4" />}>
            {t("cases")}
          </NavLink>
        </nav>

        <div className="border-t border-border-subtle px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg bg-ink-50 px-2.5 py-2 text-xs text-ink-600">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-brand-600" />
            <div className="leading-tight">
              <div className="font-medium text-ink-800">DUI Metropolitan — Archer</div>
              <div className="text-ink-400">Piloto · aislamiento por tenant activo</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface px-6 py-3">
          <div className="text-sm font-medium text-ink-500">
            {t("appName")} <span className="text-ink-300">/</span>{" "}
            <span className="text-ink-900">{t("dashboard")}</span>
          </div>
          <div className="flex items-center gap-3">
            <LocaleToggle />
            <div className="h-8 w-8 rounded-full bg-brand-100 text-center text-sm font-medium leading-8 text-brand-700">
              JT
            </div>
          </div>
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
