import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { db, schema } from "@/lib/db/client";
import { canAccessClinicalDocuments } from "@/lib/rbac";
import type { FormSchema, FormData as SchemaFormData } from "@/lib/rules/form-conditions";
import { getRequiredPrograms, UnresolvedLOIError, type ProgramBlock } from "@/lib/rules/loi";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SchemaForm } from "@/components/form-engine/schema-form";

export default async function CaseFormPage({
  params,
}: {
  params: Promise<{ id: string; key: string }>;
}) {
  const session = await requireSession();
  const { id, key } = await params;
  const locale = (await getLocale()) as "es" | "en";

  // Gate M2: "front_desk NO puede abrir el documento de intake clínico... ni sus
  // datos (403)". El check vive ANTES de tocar la base — ni siquiera se hace la
  // query del documento para un rol sin acceso. La acción de guardar (documents.ts)
  // repite el mismo check por su cuenta: la UI nunca es la única línea de defensa.
  if (!canAccessClinicalDocuments(session.role)) {
    return (
      <Card>
        <CardBody className="flex flex-col items-center gap-3 py-12 text-center">
          <ShieldAlert className="h-8 w-8 text-danger-600" />
          <div>
            <div className="font-medium text-ink-900">Acceso restringido</div>
            <p className="mt-1 text-sm text-ink-500">
              Tu rol ({session.role}) no tiene acceso a documentos clínicos del
              expediente. Esta pantalla y la acción de guardado aplican la misma
              regla por separado (Gate M2).
            </p>
          </div>
        </CardBody>
      </Card>
    );
  }

  // form_schemas es contenido GLOBAL (sin tenant_id, sin RLS — ver schema.ts) así
  // que se lee con el cliente sin tenant, nunca con withTenant().
  const [schemaRow] = await db
    .select()
    .from(schema.formSchemas)
    .where(eq(schema.formSchemas.key, key))
    .orderBy(desc(schema.formSchemas.version))
    .limit(1);

  if (!schemaRow) {
    return (
      <Card>
        <CardBody className="py-12 text-center text-sm text-ink-400">
          No existe (todavía) un schema curado para &quot;{key}&quot; — la curación de
          contenido clínico real es un paso aparte con Jorge (M2/M3), no algo que este
          motor invente.
        </CardBody>
      </Card>
    );
  }

  const formSchema = schemaRow.schema as FormSchema;

  const { document, caseContext } = await withTenant(session.tenantId, async (tx) => {
    const docRows = await tx
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.caseId, id), eq(schema.documents.schemaKey, key)))
      .limit(1);

    // Prellenar con lo que ya se capturó en la admisión (RN: no repetir captura de
    // datos que el sistema ya tiene) + las banderas de programa de RN-2 (program_re/
    // ei/op/ccp), que las páginas "Program Requirements" y "Fees" de forms_1_7 usan
    // como disparador de sus condiciones RN-7 — ver build-inputs/curated/
    // forms_1_7.schema.json. Específico a "forms_1_7" a propósito: cada schema
    // tendría su propio mapeo de qué campos vienen del caso, no hay uno genérico
    // todavía (generalizarlo es trabajo aparte si aparece un segundo caso de uso).
    let caseContext: SchemaFormData = {};
    if (key === "assessment") {
      // Assessment (Dimensión 1-6, RN-7 build-inputs/curated/assessment.schema.json)
      // solo prellena el nombre del paciente — a diferencia de forms_1_7, el
      // "counselor_name" aquí es un <select> de dos valores fijos reales del PDF
      // ("Maria I Torres, CADC" / "George Torres, BA, CADC") que no coinciden
      // byte-a-byte con `session.name` ("Maria I. Torres", "George (Jorge) Torres")
      // — adivinar cuál corresponde es exactamente el tipo de invención que este
      // proyecto evita (ver disciplina de "no inventar" en loi.ts/forms_1_7); se deja
      // que el consejero lo seleccione a mano. Tampoco se prellena "assessment_date"
      // (mismo criterio que forms_1_7: la fecha la pone quien llena el formulario, no
      // la fecha de admisión del caso).
      const caseRows = await tx
        .select({
          firstName: schema.patients.firstName,
          lastName: schema.patients.lastName,
        })
        .from(schema.cases)
        .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
        .where(eq(schema.cases.id, id))
        .limit(1);
      const caseRow = caseRows[0];
      if (caseRow) {
        caseContext = { client_name: `${caseRow.firstName} ${caseRow.lastName}` };
      }
    }
    if (key === "forms_1_7") {
      const caseRows = await tx
        .select({
          loi: schema.cases.loi,
          referralSource: schema.cases.referralSource,
          firstName: schema.patients.firstName,
          lastName: schema.patients.lastName,
          dob: schema.patients.dob,
          driversLicense: schema.patients.driversLicense,
        })
        .from(schema.cases)
        .innerJoin(schema.patients, eq(schema.cases.patientId, schema.patients.id))
        .where(eq(schema.cases.id, id))
        .limit(1);
      const caseRow = caseRows[0];
      if (caseRow) {
        let programs: ProgramBlock[] = [];
        if (caseRow.loi) {
          try {
            programs = getRequiredPrograms(caseRow.loi);
          } catch (err) {
            if (!(err instanceof UnresolvedLOIError)) throw err;
            // Sin mapeo resuelto (RN-2): no se asume ningún programa — la página de
            // Program Requirements/Fees simplemente no muestra ningún bloque hasta
            // que se resuelva, en vez de adivinar.
          }
        }
        caseContext = {
          patient_name: `${caseRow.firstName} ${caseRow.lastName}`,
          date_of_birth: caseRow.dob,
          drivers_license_number: caseRow.driversLicense ?? "",
          intake_coordinator_name: session.name,
          program_re: programs.includes("RE"),
          program_ei: programs.includes("EI"),
          program_op: programs.includes("OP"),
          program_ccp: programs.includes("CCP"),
        };
      }
    }

    return { document: docRows[0] ?? null, caseContext };
  });

  // El documento guardado siempre gana sobre el prellenado del caso — si el
  // consejero ya editó "patient_name" a mano, no lo pisamos en cada carga.
  const initialData: SchemaFormData = {
    ...caseContext,
    ...((document?.data as SchemaFormData) ?? {}),
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={`/cases/${id}`}
        className="flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver al expediente
      </Link>

      <Card>
        <CardHeader
          title={locale === "es" ? formSchema.titleEs : formSchema.titleEn}
          description={`schema "${formSchema.key}" v${formSchema.version} — motor genérico, ver src/components/form-engine/`}
        />
        <CardBody>
          <SchemaForm
            schema={formSchema}
            caseId={id}
            locale={locale}
            initialData={initialData}
            initialStatus={
              (document?.status as "draft" | "completed" | "signed" | "voided") ?? "draft"
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
