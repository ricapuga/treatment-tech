/**
 * RBAC compartido — deliberadamente FUERA de cualquier archivo "use server".
 *
 * Bug real encontrado corriendo el motor de formularios: `canAccessClinicalDocuments`
 * vivía en `lib/actions/documents.ts`, que empieza con "use server" — Next.js exige
 * que TODO export de un archivo así sea una función async de Server Action (no una
 * función pura síncrona), y falla el build entero ("Server Actions must be async
 * functions") en cuanto un Server Component (la página del formulario) importa esta
 * función solo para un chequeo de rol, no para invocarla como acción. Se movió aquí
 * — un módulo plano, sin "use server" — para poder importarla tanto desde acciones
 * como desde Server Components sin pisar esa regla.
 */
export const CLINICAL_ROLES = ["owner", "admin", "supervisor", "counselor"] as const;

export function canAccessClinicalDocuments(role: string): boolean {
  return (CLINICAL_ROLES as readonly string[]).includes(role);
}
