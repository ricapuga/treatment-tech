import Link from "next/link";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Plus } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { schema } from "@/lib/db/client";
import { Card } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

const STATUS_TONE: Record<string, BadgeTone> = {
  active: "success",
  completed: "info",
  closed: "neutral",
  suspended: "warning",
};

function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ location?: string; status?: string; month?: string }>;
}) {
  const session = await requireSession();
  const { location, status, month } = await searchParams;

  const { rows, locations, balances } = await withTenant(session.tenantId, async (tx) => {
    const conditions = [eq(schema.cases.tenantId, session.tenantId)];
    if (location) conditions.push(eq(schema.cases.locationId, location));
    if (status) conditions.push(eq(schema.cases.status, status));
    if (month) {
      const start = `${month}-01`;
      const [y, m] = month.split("-").map(Number);
      const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
      conditions.push(gte(schema.cases.admissionDate, start));
      conditions.push(lt(schema.cases.admissionDate, nextMonth));
    }

    const rows = await tx
      .select({
        id: schema.cases.id,
        caseNumber: schema.cases.caseNumber,
        admissionDate: schema.cases.admissionDate,
        loi: schema.cases.loi,
        status: schema.cases.status,
        firstName: schema.patients.firstName,
        lastName: schema.patients.lastName,
        locationName: schema.locations.name,
      })
      .from(schema.cases)
      .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
      .innerJoin(schema.locations, eq(schema.cases.locationId, schema.locations.id))
      .where(and(...conditions))
      .orderBy(desc(schema.cases.admissionDate));

    const locations = await tx
      .select({ id: schema.locations.id, name: schema.locations.name })
      .from(schema.locations)
      .where(eq(schema.locations.tenantId, session.tenantId));

    // case_balances es una VISTA de SQL crudo (RN-5: el saldo nunca se almacena, ver
    // drizzle/sql/0001_rls_and_roles.sql) — no está modelada en schema.ts, así que se
    // consulta aparte y se combina en memoria; hereda RLS de ledger_entries igual.
    // sql`...ANY(${arr}::uuid[])` NO funciona con el driver `pg`: drizzle expande un
    // array de JS en parámetros separados por coma ($1, $2, ...) en vez de pasarlo
    // como un solo parámetro de tipo array — produce SQL inválido
    // "ANY(($1, $2)::uuid[])". La forma correcta con SQL crudo dinámico es
    // `IN (${sql.join(...)})`, uniendo un placeholder por id. Encontrado corriendo la
    // vista /cases de verdad (no en typecheck ni en los tests unitarios).
    const caseIds = rows.map((r) => r.id);
    const balanceRows =
      caseIds.length === 0
        ? []
        : (
            await tx.execute(sql`
              SELECT case_id, balance_cents FROM case_balances
              WHERE case_id IN (${sql.join(
                caseIds.map((id) => sql`${id}::uuid`),
                sql`, `
              )})
            `)
          ).rows as unknown as { case_id: string; balance_cents: number }[];

    const balances = new Map(balanceRows.map((b) => [b.case_id, Number(b.balance_cents)]));
    return { rows, locations, balances };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold text-ink-900">Admisiones</h1>
          <p className="mt-1 text-sm text-ink-500">
            {rows.length} {rows.length === 1 ? "caso" : "casos"}
            {location || status || month ? " con los filtros actuales" : ""}
          </p>
        </div>
        <Link
          href="/cases/new"
          className="flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-700"
        >
          <Plus className="h-4 w-4" />
          Nueva admisión
        </Link>
      </div>

      <form className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-700">Ubicación</span>
          <select
            name="location"
            defaultValue={location ?? ""}
            className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-900"
          >
            <option value="">Todas</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-700">Estatus</span>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-900"
          >
            <option value="">Todos</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="closed">Closed</option>
            <option value="suspended">Suspended</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-ink-700">Mes de admisión</span>
          <input
            type="month"
            name="month"
            defaultValue={month ?? ""}
            className="rounded-lg border border-ink-200 bg-surface px-3 py-1.5 text-sm text-ink-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-ink-200 px-4 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
        >
          Filtrar
        </button>
      </form>

      <Card className="overflow-hidden">
        {rows.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink-400">
            Sin casos {location || status || month ? "con estos filtros" : "todavía"} —{" "}
            <Link href="/cases/new" className="font-medium text-brand-600 hover:underline">
              admite el primer paciente
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-subtle bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                <th className="px-4 py-2.5 font-medium"># Caso</th>
                <th className="px-4 py-2.5 font-medium">Paciente</th>
                <th className="px-4 py-2.5 font-medium">Ubicación</th>
                <th className="px-4 py-2.5 font-medium">LOI</th>
                <th className="px-4 py-2.5 font-medium">Admisión</th>
                <th className="px-4 py-2.5 font-medium">Estatus</th>
                <th className="px-4 py-2.5 text-right font-medium">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-border-subtle last:border-0 hover:bg-ink-50"
                >
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/cases/${r.id}`}
                      className="font-medium text-brand-700 hover:underline"
                    >
                      {r.caseNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-900">
                    {r.firstName} {r.lastName}
                  </td>
                  <td className="px-4 py-2.5 text-ink-500">{r.locationName}</td>
                  <td className="px-4 py-2.5 text-ink-500">{r.loi ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-500">{r.admissionDate}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={STATUS_TONE[r.status] ?? "neutral"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right font-medium text-ink-900">
                    {centsToUsd(balances.get(r.id) ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
