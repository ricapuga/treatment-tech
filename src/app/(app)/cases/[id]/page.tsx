import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, asc, sql } from "drizzle-orm";
import { CalendarDays, MapPin, UserRound, ShieldCheck, Receipt } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { schema } from "@/lib/db/client";
import { recordAuditTx } from "@/lib/audit";
import { getRequiredPrograms, UnresolvedLOIError, type ProgramBlock } from "@/lib/rules/loi";
import { CASE_STAGE_LABEL, type CaseStage } from "@/lib/rules/case-stages";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STAGE_STATUS_TONE: Record<string, BadgeTone> = {
  pending: "neutral",
  in_progress: "brand",
  completed: "success",
  suspended: "danger",
};

const PROGRAM_LABEL: Record<ProgramBlock, string> = {
  RE: "Risk Education",
  EI: "Early Intervention",
  OP: "Outpatient",
  CCP: "Continuing Care Plan",
};

function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CaseHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const data = await withTenant(session.tenantId, async (tx) => {
    const rows = await tx
      .select({
        id: schema.cases.id,
        caseNumber: schema.cases.caseNumber,
        admissionDate: schema.cases.admissionDate,
        loi: schema.cases.loi,
        status: schema.cases.status,
        county: schema.cases.county,
        referralSource: schema.cases.referralSource,
        firstName: schema.patients.firstName,
        lastName: schema.patients.lastName,
        dob: schema.patients.dob,
        locationName: schema.locations.name,
      })
      .from(schema.cases)
      .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
      .innerJoin(schema.locations, eq(schema.cases.locationId, schema.locations.id))
      .where(eq(schema.cases.id, id))
      .limit(1);

    const caseRow = rows[0];
    if (!caseRow) return null;

    const stages = await tx
      .select()
      .from(schema.caseStages)
      .where(eq(schema.caseStages.caseId, id))
      .orderBy(asc(schema.caseStages.updatedAt));

    const consents = await tx
      .select()
      .from(schema.consents)
      .where(eq(schema.consents.caseId, id));

    const balanceResult = await tx.execute(sql`
      SELECT balance_cents FROM case_balances WHERE case_id = ${id}::uuid
    `);
    const balanceRows = balanceResult.rows as unknown as { balance_cents: number }[];
    const balanceCents = balanceRows[0] ? Number(balanceRows[0].balance_cents) : 0;

    // Blueprint / CLAUDE.md: "toda mutación y toda lectura de expediente escribe
    // audit_log" — abrir el hub de un caso es exactamente ese tipo de lectura.
    await recordAuditTx(tx, {
      tenantId: session.tenantId,
      userId: session.userId,
      action: "view_case",
      entity: "cases",
      entityId: id,
    });

    return { caseRow, stages, consents, balanceCents };
  });

  if (!data) notFound();
  const { caseRow, stages, consents, balanceCents } = data;

  let programs: ProgramBlock[] = [];
  let loiError: string | null = null;
  if (caseRow.loi) {
    try {
      programs = getRequiredPrograms(caseRow.loi);
    } catch (err) {
      if (err instanceof UnresolvedLOIError) loiError = err.message;
      else throw err;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-semibold text-ink-900">
                  {caseRow.firstName} {caseRow.lastName}
                </h1>
                <Badge tone="brand">{caseRow.caseNumber}</Badge>
                <Badge tone={caseRow.status === "active" ? "success" : "neutral"}>
                  {caseRow.status}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-500">
                <span className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> Admitido {caseRow.admissionDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" /> {caseRow.locationName}
                </span>
                <span className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" /> DOB {caseRow.dob}
                </span>
              </div>
            </div>
            <div className="rounded-lg bg-ink-50 px-4 py-3 text-right">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-400">
                Saldo
              </div>
              <div
                className={`text-xl font-semibold ${balanceCents > 0 ? "text-danger-700" : "text-ink-900"}`}
              >
                {centsToUsd(balanceCents)}
              </div>
              <Link
                href={`/cases/${caseRow.id}/ledger`}
                className="mt-1 flex items-center justify-end gap-1 text-xs font-medium text-brand-600 hover:underline"
              >
                <Receipt className="h-3 w-3" />
                Ver ledger
              </Link>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-border-subtle pt-4 text-sm">
            <span className="font-medium text-ink-700">LOI:</span>
            <span className="text-ink-500">{caseRow.loi ?? "sin definir"}</span>
            {loiError ? (
              <Badge tone="warning">sin mapeo de programas (RN-2)</Badge>
            ) : (
              programs.map((p) => (
                <Badge key={p} tone="info">
                  {PROGRAM_LABEL[p]}
                </Badge>
              ))
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Etapas del expediente"
          description="Orden borrador (ver src/lib/rules/case-stages.ts) — se ajusta al curar M3."
        />
        <CardBody>
          <ol className="flex flex-col gap-3">
            {stages.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-4">
                <span className="text-sm text-ink-900">
                  {CASE_STAGE_LABEL[s.stage as CaseStage]?.es ?? s.stage}
                </span>
                <Badge tone={STAGE_STATUS_TONE[s.status] ?? "neutral"}>{s.status}</Badge>
              </li>
            ))}
          </ol>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Consentimientos"
          description="RN-6 — divulgación de información protegida por 42 CFR Part 2."
          action={
            <span className="flex items-center gap-1 text-xs text-ink-400">
              <ShieldCheck className="h-3.5 w-3.5" />
              {consents.length} activo{consents.length === 1 ? "" : "s"}
            </span>
          }
        />
        <CardBody>
          {consents.length === 0 ? (
            <p className="text-sm text-ink-400">
              Sin consentimientos capturados todavía — se registran desde el intake
              (Forms 1-7, Milestone 2 en curso).
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {consents.map((c) => (
                <li key={c.id} className="text-sm text-ink-700">
                  {c.recipientOrg} — vence {c.expiresAt ?? "sin vencimiento"}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
