import { getTranslations } from "next-intl/server";
import { Users, FileText, Clock, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { RulesDemo } from "./rules-demo";

/**
 * Tarjetas de KPI — datos de ejemplo, etiquetados explícitamente como tal. El tablero
 * real (admisiones, etapas pendientes, consents por vencer, saldos) es Milestone 5 —
 * ver blueprint. Esto existe para que la primera pantalla después de iniciar sesión
 * ya se sienta como un producto terminado, no como una placeholder en blanco, mientras
 * ese milestone llega.
 */
const DEMO_STATS = [
  { key: "activeCases", value: "—", icon: Users, tone: "brand" as const },
  { key: "pendingDocs", value: "—", icon: FileText, tone: "warning" as const },
  { key: "expiringConsents", value: "—", icon: Clock, tone: "danger" as const },
  { key: "completionRate", value: "—", icon: TrendingUp, tone: "success" as const },
];

const STAT_TONE_CLASSES = {
  brand: "bg-brand-50 text-brand-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  success: "bg-success-50 text-success-600",
};

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {DEMO_STATS.map(({ key, value, icon: Icon, tone }) => (
          <Card key={key} className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium uppercase tracking-wide text-ink-400">
                {t(`stats.${key}`)}
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-lg ${STAT_TONE_CLASSES[tone]}`}
              >
                <Icon className="h-4 w-4" />
              </span>
            </div>
            <div className="mt-3 text-2xl font-semibold text-ink-900">{value}</div>
            <div className="mt-1 text-xs text-ink-400">{t("stats.comingInM5")}</div>
          </Card>
        ))}
      </div>

      <RulesDemo />
    </div>
  );
}
