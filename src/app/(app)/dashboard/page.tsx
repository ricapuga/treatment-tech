import Link from "next/link";
import { and, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { getTranslations } from "next-intl/server";
import { Users, FileText, Clock, TrendingUp, Plus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { schema } from "@/lib/db/client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  completed: "info",
  closed: "neutral",
  suspended: "warning",
};

const STAT_ICON = {
  activeCases: Users,
  pendingDocs: FileText,
  expiringConsents: Clock,
  completionRate: TrendingUp,
} as const;

const STAT_TONE_CLASSES = {
  brand: "bg-brand-50 text-brand-600",
  warning: "bg-warning-50 text-warning-600",
  danger: "bg-danger-50 text-danger-600",
  success: "bg-success-50 text-success-600",
};

/**
 * Dashboard con datos reales (Milestone 5 adelantado en parte — se necesitaba antes de
 * la demo con Jorge, ver DEVIATIONS.md 2026-07-31 "Dashboard: datos reales"). Antes
 * mostraba 4 tarjetas con "—" fijo y la leyenda "Datos reales en Milestone 5" — quitado
 * el "Simulador de reglas clínicas" que vivía aquí (confundía como primera pantalla
 * tras iniciar sesión) e implementadas las 4 métricas reales con consultas directas,
 * más una lista de admisiones recientes — mismo espíritu visual que las referencias de
 * diseño que trajo Ricardo (tarjetas de KPI + tabla de registros recientes), pero con
 * datos reales del tenant, no maqueta.
 *
 * Deliberadamente NO incluido todavía (M5 completo): saldos por vencer, alertas de
 * cumplimiento accionables, gráfica de reporting mensual — quedan como próximos pasos,
 * no se inventan aquí solo por parecerse más a la referencia visual.
 */
export default async function DashboardPage() {
  const t = await getTranslations("dashboard");
  const session = await requireSession();

  const { activeCases, pendingDocs, expiringConsents, completionRate, totalCases, recentCases } =
    await withTenant(session.tenantId, async (tx) => {
      const [{ value: totalCases }] = await tx
        .select({ value: count() })
        .from(schema.cases)
        .where(eq(schema.cases.tenantId, session.tenantId));

      const [{ value: activeCases }] = await tx
        .select({ value: count() })
        .from(schema.cases)
        .where(
          and(eq(schema.cases.tenantId, session.tenantId), eq(schema.cases.status, "active"))
        );

      const [{ value: pendingDocs }] = await tx
        .select({ value: count() })
        .from(schema.documents)
        .where(
          and(eq(schema.documents.tenantId, session.tenantId), eq(schema.documents.status, "draft"))
        );

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      const in30Str = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
      const [{ value: expiringConsents }] = await tx
        .select({ value: count() })
        .from(schema.consents)
        .where(
          and(
            eq(schema.consents.tenantId, session.tenantId),
            isNull(schema.consents.revokedAt),
            gte(schema.consents.expiresAt, todayStr),
            lte(schema.consents.expiresAt, in30Str)
          )
        );

      const [{ value: totalStages }] = await tx
        .select({ value: count() })
        .from(schema.caseStages)
        .innerJoin(schema.cases, eq(schema.caseStages.caseId, schema.cases.id))
        .where(eq(schema.cases.tenantId, session.tenantId));

      const [{ value: completedStages }] = await tx
        .select({ value: count() })
        .from(schema.caseStages)
        .innerJoin(schema.cases, eq(schema.caseStages.caseId, schema.cases.id))
        .where(
          and(eq(schema.cases.tenantId, session.tenantId), eq(schema.caseStages.status, "completed"))
        );

      const recentCases = await tx
        .select({
          id: schema.cases.id,
          caseNumber: schema.cases.caseNumber,
          admissionDate: schema.cases.admissionDate,
          status: schema.cases.status,
          loi: schema.cases.loi,
          firstName: schema.patients.firstName,
          lastName: schema.patients.lastName,
          locationName: schema.locations.name,
        })
        .from(schema.cases)
        .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
        .innerJoin(schema.locations, eq(schema.cases.locationId, schema.locations.id))
        .where(eq(schema.cases.tenantId, session.tenantId))
        .orderBy(desc(schema.cases.admissionDate))
        .limit(5);

      return {
        activeCases,
        pendingDocs,
        expiringConsents,
        completionRate: totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : null,
        totalCases,
        recentCases,
      };
    });

  const stats = [
    {
      key: "activeCases" as const,
      value: String(activeCases),
      caption:
        totalCases > 0
          ? t("stats.captions.activeCases", { total: totalCases })
          : t("stats.captions.noCasesYet"),
      tone: "brand" as const,
    },
    {
      key: "pendingDocs" as const,
      value: String(pendingDocs),
      caption: t("stats.captions.pendingDocs"),
      tone: "warning" as const,
    },
    {
      key: "expiringConsents" as const,
      value: String(expiringConsents),
      caption: t("stats.captions.expiringConsents"),
      tone: "danger" as const,
    },
    {
      key: "completionRate" as const,
      value: completionRate === null ? "—" : `${completionRate}%`,
      caption:
        completionRate === null
          ? t("stats.captions.noStagesYet")
          : t("stats.captions.completionRate"),
      tone: "success" as const,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">{t("title")}</h1>
        <p className="mt-1 text-sm text-ink-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map(({ key, value, caption, tone }) => {
          const Icon = STAT_ICON[key];
          return (
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
              <div className="mt-1 text-xs text-ink-400">{caption}</div>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader
          title={t("recentCases.title")}
          description={t("recentCases.description")}
          action={
            <Link
              href="/cases"
              className="text-xs font-medium text-brand-600 hover:underline"
            >
              {t("recentCases.viewAll")}
            </Link>
          }
        />
        <CardBody className={recentCases.length === 0 ? undefined : "p-0"}>
          {recentCases.length === 0 ? (
            <div className="flex flex-col items-start gap-3 text-sm text-ink-400">
              <p>{t("recentCases.empty")}</p>
              <Link
                href="/cases/new"
                className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-700"
              >
                <Plus className="h-4 w-4" />
                {t("recentCases.newCase")}
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-6 py-2.5 font-medium">{t("recentCases.columns.caseNumber")}</th>
                  <th className="px-6 py-2.5 font-medium">{t("recentCases.columns.patient")}</th>
                  <th className="px-6 py-2.5 font-medium">{t("recentCases.columns.location")}</th>
                  <th className="px-6 py-2.5 font-medium">{t("recentCases.columns.admissionDate")}</th>
                  <th className="px-6 py-2.5 font-medium">{t("recentCases.columns.status")}</th>
                </tr>
              </thead>
              <tbody>
                {recentCases.map((c) => (
                  <tr key={c.id} className="border-b border-border-subtle last:border-0 hover:bg-ink-50">
                    <td className="px-6 py-2.5">
                      <Link
                        href={`/cases/${c.id}`}
                        className="font-medium text-brand-700 hover:underline"
                      >
                        {c.caseNumber}
                      </Link>
                    </td>
                    <td className="px-6 py-2.5 text-ink-900">
                      {c.firstName} {c.lastName}
                    </td>
                    <td className="px-6 py-2.5 text-ink-500">{c.locationName}</td>
                    <td className="px-6 py-2.5 text-ink-500">{c.admissionDate}</td>
                    <td className="px-6 py-2.5">
                      <Badge tone={STATUS_TONE[c.status] ?? "neutral"}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
