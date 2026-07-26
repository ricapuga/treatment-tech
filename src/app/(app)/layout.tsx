import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { LocaleToggle } from "@/components/locale-toggle";

/**
 * Shell base (blueprint M1 paso 7): sidebar + header + toggle es/en.
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
      <aside className="w-56 shrink-0 border-r border-neutral-200 bg-white p-4">
        <div className="mb-8 text-lg font-semibold">{t("appName")}</div>
        <nav className="flex flex-col gap-1 text-sm">
          <Link
            href="/dashboard"
            className="rounded px-2 py-1.5 hover:bg-neutral-100"
          >
            {t("dashboard")}
          </Link>
          <Link href="/cases" className="rounded px-2 py-1.5 hover:bg-neutral-100">
            {t("cases")}
          </Link>
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-neutral-200 bg-white px-6 py-3">
          <LocaleToggle />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
