"use client";

import { useActionState, useState } from "react";
import { voidLedgerEntry, type LedgerEntryState } from "@/lib/actions/ledger";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type LedgerRow = {
  id: string;
  entryDate: string;
  service: string | null;
  kind: "charge" | "payment" | "adjustment";
  amountCents: number;
  method: string | null;
  voided: boolean;
};

const KIND_LABEL: Record<LedgerRow["kind"], string> = {
  charge: "Cargo",
  payment: "Pago",
  adjustment: "Ajuste",
};

const KIND_TONE: Record<LedgerRow["kind"], BadgeTone> = {
  charge: "warning",
  payment: "success",
  adjustment: "info",
};

function centsToUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function VoidControl({ caseId, entryId }: { caseId: string; entryId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, isPending] = useActionState<LedgerEntryState, FormData>(
    voidLedgerEntry,
    { error: null }
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs font-medium text-ink-400 hover:text-danger-700 hover:underline"
      >
        Anular
      </button>
    );
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="entryId" value={entryId} />
      <input
        name="reason"
        required
        placeholder="Motivo (mín. 3 caracteres)"
        className="w-40 rounded-md border border-ink-200 px-2 py-1 text-xs outline-none focus:border-brand-500"
      />
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-danger-600 px-2 py-1 text-xs font-medium text-white hover:bg-danger-700 disabled:opacity-60"
      >
        {isPending ? "…" : "Confirmar"}
      </button>
      {state.error && <span className="text-xs text-danger-700">{state.error}</span>}
    </form>
  );
}

export function LedgerTable({ caseId, rows }: { caseId: string; rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="p-10 text-center text-sm text-ink-400">
        Sin movimientos todavía — agrega el primer cargo o pago arriba.
      </div>
    );
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border-subtle bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
          <th className="px-4 py-2.5 font-medium">Fecha</th>
          <th className="px-4 py-2.5 font-medium">Tipo</th>
          <th className="px-4 py-2.5 font-medium">Servicio</th>
          <th className="px-4 py-2.5 font-medium">Método</th>
          <th className="px-4 py-2.5 text-right font-medium">Monto</th>
          <th className="px-4 py-2.5 text-right font-medium">Acción</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr
            key={r.id}
            className={cn(
              "border-b border-border-subtle last:border-0",
              r.voided && "opacity-50"
            )}
          >
            <td className="px-4 py-2.5 text-ink-500">{r.entryDate}</td>
            <td className="px-4 py-2.5">
              <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>
              {r.voided && (
                <Badge tone="neutral" className="ml-1.5">
                  anulado
                </Badge>
              )}
            </td>
            <td className="px-4 py-2.5 text-ink-500">{r.service ?? "—"}</td>
            <td className="px-4 py-2.5 text-ink-500">{r.method ?? "—"}</td>
            <td className="px-4 py-2.5 text-right font-medium text-ink-900">
              {r.kind === "payment" ? "-" : ""}
              {centsToUsd(r.amountCents)}
            </td>
            <td className="px-4 py-2.5 text-right">
              {!r.voided && <VoidControl caseId={caseId} entryId={r.id} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
