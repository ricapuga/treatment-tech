import { notFound } from "next/navigation";
import Link from "next/link";
import { eq, asc, sql } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { schema } from "@/lib/db/client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { AddEntryForm } from "./add-entry-form";
import { LedgerTable, type LedgerRow } from "./ledger-table";

function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CaseLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const data = await withTenant(session.tenantId, async (tx) => {
    const caseRows = await tx
      .select({
        id: schema.cases.id,
        caseNumber: schema.cases.caseNumber,
        firstName: schema.patients.firstName,
        lastName: schema.patients.lastName,
      })
      .from(schema.cases)
      .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
      .where(eq(schema.cases.id, id))
      .limit(1);

    const caseRow = caseRows[0];
    if (!caseRow) return null;

    const entries = await tx
      .select()
      .from(schema.ledgerEntries)
      .where(eq(schema.ledgerEntries.caseId, id))
      .orderBy(asc(schema.ledgerEntries.entryDate), asc(schema.ledgerEntries.createdAt));

    const balanceResult = await tx.execute(sql`
      SELECT balance_cents FROM case_balances WHERE case_id = ${id}::uuid
    `);
    const balanceRows = balanceResult.rows as unknown as { balance_cents: number }[];
    const balanceCents = balanceRows[0] ? Number(balanceRows[0].balance_cents) : 0;

    return { caseRow, entries, balanceCents };
  });

  if (!data) notFound();
  const { caseRow, entries, balanceCents } = data;

  const rows: LedgerRow[] = entries.map((e) => ({
    id: e.id,
    entryDate: e.entryDate,
    service: e.service,
    kind: e.kind as LedgerRow["kind"],
    amountCents: e.amountCents,
    method: e.method,
    voided: e.voided ?? false,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/cases/${id}`}
          className="mb-3 flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al expediente
        </Link>
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-ink-900">
              Ledger — {caseRow.firstName} {caseRow.lastName}
            </h1>
            <p className="mt-1 text-sm text-ink-500">Caso {caseRow.caseNumber}</p>
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
          </div>
        </div>
      </div>

      <Card>
        <CardHeader
          title="Nuevo movimiento"
          description="El saldo se recalcula solo — nunca se guarda directo (RN-5)."
        />
        <CardBody>
          <AddEntryForm caseId={id} />
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <LedgerTable caseId={id} rows={rows} />
      </Card>
    </div>
  );
}
