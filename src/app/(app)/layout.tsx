import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { LayoutDashboard, Users, ShieldCheck, LogOut } from "lucide-react";
import { LocaleToggle } from "@/components/locale-toggle";
import { NavLink } from "@/components/nav-link";
import { getCurrentSession } from "@/lib/session";
import { db, schema } from "@/lib/db/client";
import { logoutAction } from "./actions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/**
 * Shell base (blueprint M1 paso 7): sidebar + header + toggle es/en.
 * Sesión real conectada aquí (antes placeholder — ver DEVIATIONS.md / PROGRESS.md):
 * getCurrentSession() trae el perfil de negocio real (nombre, rol, tenant); sin
 * sesión válida o con usuario desactivado, redirige a /login — defensa en profundidad
 * además del proxy (que solo verifica que exista cookie, no que el usuario siga activo).
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations("shell");
  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const [tenant] = await db
    .select({ name: schema.tenants.name })
    .from(schema.tenants)
    .where(eq(schema.tenants.id, session.tenantId))
    .limit(1);

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
              <div className="font-medium text-ink-800">
                {tenant?.name ?? "—"}
              </div>
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
            <div
              title={`${session.name} — ${session.role}`}
              className="h-8 w-8 rounded-full bg-brand-100 text-center text-sm font-medium leading-8 text-brand-700"
            >
              {initials(session.name)}
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                title={t("logout")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-ink-100 hover:text-ink-700"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 bg-background p-6">{children}</main>
      </div>
    </div>
  );
}
