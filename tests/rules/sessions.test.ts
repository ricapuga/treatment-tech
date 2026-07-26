import { describe, it, expect } from "vitest";
import {
  sessionsForOutpatient,
  sessionsForRiskEducation,
  sessionsForEarlyIntervention,
} from "@/lib/rules/sessions";

describe("RN-3: horas -> sesiones", () => {
  it("OP 75h -> 25 sesiones (>= 50, divide entre 3)", () => {
    expect(sessionsForOutpatient(75)).toBe(25);
  });

  it("OP 20h -> 10 sesiones (< 50, divide entre 2)", () => {
    expect(sessionsForOutpatient(20)).toBe(10);
  });

  it("RE 10h -> 5 sesiones", () => {
    expect(sessionsForRiskEducation(10)).toBe(5);
  });

  it("regresión del bug real: OP con 7 horas NO cae en la división de >= 50", () => {
    // El PDF original comparaba "7" >= "50" como texto: '7' > '5' lexicográficamente,
    // así que el bug clasificaba esto como >= 50 y dividía entre 3 (7/3 = 2.33...).
    // La regla correcta es numérica: 7 < 50, así que divide entre 2.
    const result = sessionsForOutpatient(7);
    expect(result).toBe(3.5);
    expect(result).not.toBeCloseTo(7 / 3);
  });

  it("frontera exacta: OP con exactamente 50 horas SÍ divide entre 3 (>=, no >)", () => {
    expect(sessionsForOutpatient(50)).toBeCloseTo(50 / 3);
  });

  it("frontera exacta: OP con 49.9 horas divide entre 2", () => {
    expect(sessionsForOutpatient(49.9)).toBeCloseTo(49.9 / 2);
  });

  it("EI 12h -> 6 sesiones", () => {
    expect(sessionsForEarlyIntervention(12)).toBe(6);
  });
});
