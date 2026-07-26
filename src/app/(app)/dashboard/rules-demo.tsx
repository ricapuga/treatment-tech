"use client";

import { useMemo, useState } from "react";
import {
  getRequiredPrograms,
  isValidHoursForProgram,
  UnresolvedLOIError,
  type ProgramBlock,
} from "@/lib/rules/loi";
import {
  sessionsForRiskEducation,
  sessionsForEarlyIntervention,
  sessionsForOutpatient,
} from "@/lib/rules/sessions";

const LOI_OPTIONS = [
  "Minimal Risk",
  "Moderate Risk",
  "Significant Risk",
  "High Risk",
  "Risk Education",
  "Early Intervention",
  "Outpatient",
] as const;

const PROGRAM_LABEL: Record<ProgramBlock, string> = {
  RE: "Risk Education",
  EI: "Early Intervention",
  OP: "Outpatient",
  CCP: "Continuing Care Plan",
};

function sessionsFor(program: ProgramBlock, hours: number): number | null {
  switch (program) {
    case "RE":
      return sessionsForRiskEducation(hours);
    case "EI":
      return sessionsForEarlyIntervention(hours);
    case "OP":
      return sessionsForOutpatient(hours);
    case "CCP":
      return null; // CCP se mide en meses, no en sesiones — ver RN-2.
  }
}

/**
 * Simulador de RN-2/RN-3 — esto NO es parte del producto final (el flujo real vive
 * en /cases/[id] a partir de M2). Existe para que se pueda ver, en un navegador,
 * que las reglas de Jorge quedaron bien capturadas — sin tener que leer código ni
 * pruebas automatizadas. Se puede borrar sin problema cuando el hub del expediente
 * (M2) exista de verdad.
 */
export function RulesDemo() {
  const [loi, setLoi] = useState<(typeof LOI_OPTIONS)[number]>("Significant Risk");
  const [hours, setHours] = useState(75);

  const result = useMemo(() => {
    try {
      const programs = getRequiredPrograms(loi);
      return { programs, error: null as string | null };
    } catch (err) {
      if (err instanceof UnresolvedLOIError) {
        return { programs: [] as ProgramBlock[], error: err.message };
      }
      throw err;
    }
  }, [loi]);

  return (
    <div className="rounded border border-neutral-200 bg-white p-6">
      <h2 className="mb-1 text-sm font-semibold text-neutral-900">
        Simulador de reglas clínicas (RN-2 / RN-3)
      </h2>
      <p className="mb-4 text-xs text-neutral-500">
        Mismo código que corre en <code>src/lib/rules/</code> y que pasa las pruebas
        automatizadas — esto solo le pone una pantalla encima. Nota: aquí un solo campo
        de horas se aplica a todos los programas solo para ilustrar el cálculo; en el
        expediente real (M2/M3) cada programa lleva sus propias horas por separado.
      </p>

      <div className="mb-4 flex flex-wrap gap-4">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Level of Intervention (LOI)</span>
          <select
            value={loi}
            onChange={(e) => setLoi(e.target.value as (typeof LOI_OPTIONS)[number])}
            className="rounded border border-neutral-300 px-2 py-1.5"
          >
            {LOI_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-neutral-700">Horas asignadas</span>
          <input
            type="number"
            min={0}
            step={0.5}
            value={hours}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-28 rounded border border-neutral-300 px-2 py-1.5"
          />
        </label>
      </div>

      {result.error ? (
        <p className="rounded bg-amber-50 p-3 text-xs text-amber-800">
          {result.error}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-xs uppercase text-neutral-500">
              <th className="py-1.5">Programa requerido</th>
              <th className="py-1.5">Rango de horas válido</th>
              <th className="py-1.5">Sesiones (con las horas de arriba)</th>
            </tr>
          </thead>
          <tbody>
            {result.programs.map((program) => {
              const sessions = sessionsFor(program, hours);
              const valid =
                program === "CCP" ? null : isValidHoursForProgram(program, hours);
              return (
                <tr key={program} className="border-b border-neutral-100">
                  <td className="py-1.5">{PROGRAM_LABEL[program]}</td>
                  <td className="py-1.5 text-neutral-500">
                    {program === "CCP" ? "3 / 6 / 12 meses" : null}
                    {program !== "CCP" && (
                      <span className={valid === false ? "text-amber-600" : undefined}>
                        {valid === false ? "fuera de rango" : "dentro de rango"}
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 font-medium">
                    {sessions === null ? "—" : sessions}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
