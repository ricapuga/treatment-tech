import { describe, it, expect } from "vitest";
import {
  getRequiredPrograms,
  isValidHoursForProgram,
  isValidCcMonths,
  UnresolvedLOIError,
} from "@/lib/rules/loi";

describe("RN-2: LOI -> programas", () => {
  it.each([
    ["Minimal Risk", ["RE"]],
    ["Moderate Risk", ["RE", "EI"]],
    ["Significant Risk", ["RE", "OP", "CCP"]],
    ["High Risk", ["OP", "CCP"]],
    ["Risk Education", ["RE"]],
    ["Early Intervention", ["EI"]],
    ["Outpatient", ["OP", "CCP"]],
    ["Intensive Outpatient", ["OP", "CCP"]],
  ] as const)("%s -> %j", (loi, expected) => {
    expect(getRequiredPrograms(loi)).toEqual(expected);
  });

  it("LOI sin mapeo resuelto lanza UnresolvedLOIError en vez de adivinar (ej. un valor futuro no confirmado con Jorge)", () => {
    expect(() => getRequiredPrograms("Un LOI que no existe")).toThrow(UnresolvedLOIError);
  });

  it("rangos de horas válidos por programa", () => {
    expect(isValidHoursForProgram("RE", 8)).toBe(true);
    expect(isValidHoursForProgram("RE", 24)).toBe(true);
    expect(isValidHoursForProgram("RE", 25)).toBe(false);
    expect(isValidHoursForProgram("OP", 20)).toBe(true);
    expect(isValidHoursForProgram("OP", 75)).toBe(true);
    expect(isValidHoursForProgram("OP", 19)).toBe(false);
  });

  it("meses válidos de Continuing Care", () => {
    expect(isValidCcMonths(3)).toBe(true);
    expect(isValidCcMonths(6)).toBe(true);
    expect(isValidCcMonths(12)).toBe(true);
    expect(isValidCcMonths(4)).toBe(false);
  });
});
