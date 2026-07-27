import { describe, it, expect } from "vitest";
import { programFeeCents, totalFeeCents, DEFAULT_FEE_PER_SESSION_CENTS } from "@/lib/rules/fees";
import { sessionsForRiskEducation, sessionsForOutpatient } from "@/lib/rules/sessions";

describe("RN-3 extendida: sesiones -> costo (Forms 1-7 página 7, campos RE0011/OP0011/TC0002)", () => {
  it("Risk Education: 10 horas -> 5 sesiones -> $250.00 a la cuota por defecto", () => {
    const sessions = sessionsForRiskEducation(10);
    expect(sessions).toBe(5);
    expect(programFeeCents(sessions, DEFAULT_FEE_PER_SESSION_CENTS)).toBe(25000);
  });

  it("Outpatient: 75 horas -> 25 sesiones -> $1,250.00 a la cuota por defecto", () => {
    const sessions = sessionsForOutpatient(75);
    expect(sessions).toBe(25);
    expect(programFeeCents(sessions, DEFAULT_FEE_PER_SESSION_CENTS)).toBe(125000);
  });

  it("cuota distinta a la del default (consejero la cambió en el formulario)", () => {
    expect(programFeeCents(5, 4000)).toBe(20000); // 5 sesiones x $40.00
  });

  it("costo total = suma de los programas que sí aplican al caso (RN-2), no todos", () => {
    // Significant Risk -> [RE, OP, CCP] (EI no aplica, no entra a la suma)
    const re = programFeeCents(5, DEFAULT_FEE_PER_SESSION_CENTS); // $250
    const op = programFeeCents(10, DEFAULT_FEE_PER_SESSION_CENTS); // $500 (20h -> 10 ses.)
    const ccp = programFeeCents(6, DEFAULT_FEE_PER_SESSION_CENTS); // $300 (6 meses = 6 ses.)
    expect(totalFeeCents([re, op, ccp])).toBe(105000); // $1,050.00
  });

  it("sin programas aplicables, el total es 0 (no NaN ni undefined)", () => {
    expect(totalFeeCents([])).toBe(0);
  });
});
