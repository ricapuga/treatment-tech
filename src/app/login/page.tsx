import { getTranslations } from "next-intl/server";

/**
 * Placeholder de M1 paso 5. El formulario real (Server Action contra
 * auth.api.signInEmail, redirect a /dashboard, manejo de error) se completa junto
 * con el seed de usuarios — no tiene sentido construir el form antes de tener un
 * usuario sembrado contra el cual probarlo.
 */
export default async function LoginPage() {
  const t = await getTranslations("login");

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm rounded border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-neutral-500">
          Formulario pendiente de conectar a Better Auth — requiere DATABASE_URL y
          BETTER_AUTH_SECRET configurados (ver .env.example).
        </p>
      </div>
    </div>
  );
}
