"use client";

import { useActionState } from "react";
import { AlertCircle } from "lucide-react";
import { createAdmission, type AdmissionState } from "@/lib/actions/admissions";
import { cn } from "@/lib/utils";

const LOI_OPTIONS = [
  "Minimal Risk",
  "Moderate Risk",
  "Significant Risk",
  "High Risk",
  "Risk Education",
  "Early Intervention",
  "Outpatient",
] as const;

const initialState: AdmissionState = { error: null };

const inputClass =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const labelClass = "text-sm font-medium text-ink-700";

export function AdmissionForm({
  locations,
  counselors,
}: {
  locations: { id: string; name: string }[];
  counselors: { id: string; name: string }[];
}) {
  const [state, formAction, isPending] = useActionState(createAdmission, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state.error && (
        <p className="flex items-center gap-1.5 rounded-lg bg-danger-50 px-3 py-2 text-xs font-medium text-danger-700">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-ink-900">Paciente</legend>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Nombre</span>
          <input name="firstName" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Apellido</span>
          <input name="lastName" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Fecha de nacimiento</span>
          <input name="dob" type="date" required className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Licencia de conducir</span>
          <input name="driversLicense" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Idioma preferido</span>
          <select name="language" className={inputClass} defaultValue="">
            <option value="">—</option>
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 border-t border-border-subtle pt-6 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-ink-900">Caso</legend>

        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Ubicación</span>
          <select name="locationId" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Selecciona una ubicación
            </option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Fecha de admisión</span>
          <input
            name="admissionDate"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Level of Intervention (LOI)</span>
          <select name="loi" required className={inputClass} defaultValue="">
            <option value="" disabled>
              Selecciona un LOI
            </option>
            {LOI_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Counselor asignado</span>
          <select name="counselorId" className={inputClass} defaultValue="">
            <option value="">Sin asignar todavía</option>
            {counselors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Condado</span>
          <input name="county" className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={labelClass}>Fuente de referencia</span>
          <input name="referralSource" className={inputClass} />
        </label>
      </fieldset>

      <div className="flex justify-end border-t border-border-subtle pt-6">
        <button
          type="submit"
          disabled={isPending}
          className={cn(
            "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-[var(--shadow-sm)] transition-colors hover:bg-brand-700",
            isPending && "opacity-60"
          )}
        >
          {isPending ? "Creando…" : "Admitir paciente"}
        </button>
      </div>
    </form>
  );
}
