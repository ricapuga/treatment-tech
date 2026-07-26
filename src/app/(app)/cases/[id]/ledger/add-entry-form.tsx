"use client";

import { useActionState, useRef, useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { createLedgerEntry, type LedgerEntryState } from "@/lib/actions/ledger";
import { cn } from "@/lib/utils";

const initialState: LedgerEntryState = { error: null };
const inputClass =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-xs font-medium text-ink-700";

export function AddEntryForm({ caseId }: { caseId: string }) {
  const [state, formAction, isPending] = useActionState(createLedgerEntry, initialState);
  const formRef = useRef<HTMLFormElement>(null);

  // Limpiar el formulario tras un envío exitoso (sin error) — más agradable que dejar
  // los valores del último movimiento capturado ahí, invitando a repetirlo sin querer.
  useEffect(() => {
    if (!isPending && state.error === null) {
      formRef.current?.reset();
    }
  }, [isPending, state.error]);

  return (
    <form ref={formRef} action={formAction} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="caseId" value={caseId} />

      {state.error && (
        <p className="flex w-full items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Tipo</span>
        <select name="kind" required defaultValue="charge" className={inputClass}>
          <option value="charge">Cargo</option>
          <option value="payment">Pago</option>
          <option value="adjustment">Ajuste</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Monto (USD)</span>
        <input
          name="amount"
          required
          inputMode="decimal"
          placeholder="0.00"
          className={cn(inputClass, "w-28")}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Método</span>
        <select name="method" required defaultValue="cash" className={inputClass}>
          <option value="cash">Efectivo</option>
          <option value="check">Cheque</option>
          <option value="card_terminal">Terminal</option>
          <option value="stripe">Stripe</option>
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className={labelClass}>Fecha</span>
        <input
          name="entryDate"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </label>

      <label className="flex flex-1 flex-col gap-1" style={{ minWidth: 140 }}>
        <span className={labelClass}>Servicio (opcional)</span>
        <input name="service" placeholder="ej. Session fee" className={inputClass} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-700",
          isPending && "opacity-60"
        )}
      >
        {isPending ? "…" : "Agregar"}
      </button>
    </form>
  );
}
