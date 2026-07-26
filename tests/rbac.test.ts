import { describe, it, expect } from "vitest";
import { canAccessClinicalDocuments } from "@/lib/rbac";

/**
 * Gate M2: "front_desk NO puede abrir el documento de intake clínico... ni sus datos
 * (403)". Hasta ahora esto solo se había verificado a mano con Playwright, contra una
 * cuenta front_desk sembrada de prueba (Cindy Torres). El roster real que confirmó
 * Jorge (PROGRESS.md, sección "Roster — respuesta de Jorge") ya no tiene a nadie en
 * front_desk por defecto — así que esta regla, que es de seguridad/cumplimiento, no
 * puede depender de que alguien recuerde sembrar una cuenta de prueba para probarla.
 */
describe("canAccessClinicalDocuments (RBAC clínico, Gate M2)", () => {
  it.each(["owner", "admin", "supervisor", "counselor"])(
    "%s SÍ tiene acceso a documentos clínicos",
    (role) => {
      expect(canAccessClinicalDocuments(role)).toBe(true);
    }
  );

  it.each(["front_desk", "billing"])(
    "%s NO tiene acceso a documentos clínicos",
    (role) => {
      expect(canAccessClinicalDocuments(role)).toBe(false);
    }
  );

  it("un rol desconocido no tiene acceso (falla cerrado, no abierto)", () => {
    expect(canAccessClinicalDocuments("rol-que-no-existe")).toBe(false);
  });
});
