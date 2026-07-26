import { eq, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db/rls";
import { schema } from "@/lib/db/client";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { AdmissionForm } from "./admission-form";

export default async function NewCasePage() {
  const session = await requireSession();

  const { locations, counselors } = await withTenant(session.tenantId, async (tx) => {
    const locations = await tx
      .select({ id: schema.locations.id, name: schema.locations.name })
      .from(schema.locations)
      .where(eq(schema.locations.tenantId, session.tenantId));

    const counselors = await tx
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(inArray(schema.users.role, ["counselor", "supervisor"]));

    return { locations, counselors };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-lg font-semibold text-ink-900">Nueva admisión</h1>
        <p className="mt-1 text-sm text-ink-500">
          Crea el paciente y el caso en un solo paso — el número de caso (RN-1) y las
          etapas iniciales del expediente se generan automáticamente.
        </p>
      </div>

      <Card>
        <CardHeader
          title="Datos de admisión"
          description="Los campos marcados no son opcionales."
        />
        <CardBody>
          <AdmissionForm locations={locations} counselors={counselors} />
        </CardBody>
      </Card>
    </div>
  );
}
