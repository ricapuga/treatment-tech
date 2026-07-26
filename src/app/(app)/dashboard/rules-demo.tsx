"use client";

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
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
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";

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

const PROGRAM_TONE: Record<ProgramBlock, BadgeTone> = {
  RE: "info",
  EI: "brand",
  OP: "warning",
  CCP: "success",
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
    <Card>
      <CardHeader
        title="Simulador de reglas clínicas (RN-2 / RN-3)"
        description="Mismo código que corre en src/lib/rules/ y que pasa las pruebas automatizadas — esto solo le pone una pantalla encima."
        action={
          <span className="flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
            <Sparkles className="h-3 w-3" />
            Vista previa
          </span>
        }
      />
      <CardBody>
        <p className="-mt-1 mb-4 text-xs text-ink-400">
          Nota: aquí un solo campo de horas se aplica a todos los programas solo para
          ilustrar el cálculo; en el expediente real (M2/M3) cada programa lleva sus
          propias horas por separado.
        </p>

        <div className="mb-5 flex flex-wrap gap-4">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-700">Level of Intervention (LOI)</span>
            <select
              value={loi}
              onChange={(e) => setLoi(e.target.value as (typeof LOI_OPTIONS)[number])}
              className="rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            >
              {LOI_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-ink-700">Horas asignadas</span>
            <input
              type="number"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(Number(e.target.value))}
              className="w-32 rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
          </label>
        </div>

        {result.error ? (
          <p className="rounded-lg bg-warning-50 p-3 text-xs text-warning-700">
            {result.error}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border-subtle">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle bg-ink-50 text-left text-xs uppercase tracking-wide text-ink-500">
                  <th className="px-4 py-2.5 font-medium">Programa requerido</th>
                  <th className="px-4 py-2.5 font-medium">Rango de horas</th>
                  <th className="px-4 py-2.5 font-medium">Sesiones</th>
                </tr>
              </thead>
              <tbody>
                {result.programs.map((program) => {
                  const sessions = sessionsFor(program, hours);
                  const valid =
                    program === "CCP" ? null : isValidHoursForProgram(program, hours);
                  return (
                    <tr key={program} className="border-b border-border-subtle last:border-0">
                      <td className="px-4 py-2.5">
                        <Badge tone={PROGRAM_TONE[program]}>
                          {PROGRAM_LABEL[program]}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-ink-500">
                        {program === "CCP" ? (
                          "3 / 6 / 12 meses"
                        ) : (
                          <Badge tone={valid === false ? "danger" : "success"}>
                            {valid === false ? "fuera de rango" : "dentro de rango"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-medium text-ink-900">
                        {sessions === null ? "—" : sessions}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
