import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { getLocale } from "next-intl/server";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { db, schema } from "@/lib/db/client";
import { canAccessClinicalDocuments } from "@/lib/rbac";
import type { FormSchema } from "@/lib/rules/form-conditions";
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

  const document = await withTenant(session.tenantId, async (tx) => {
    const rows = await tx
      .select()
      .from(schema.documents)
      .where(and(eq(schema.documents.caseId, id), eq(schema.documents.schemaKey, key)))
      .limit(1);
    return rows[0] ?? null;
  });

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
            initialData={(document?.data as Record<string, string | number | boolean>) ?? {}}
            initialStatus={
              (document?.status as "draft" | "completed" | "signed" | "voided") ?? "draft"
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
