import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";

/**
 * Bilingüe desde el día uno (ADR-012). Toggle es/en en el shell, NO URLs por locale
 * (/en/, /es/) — el idioma es una preferencia de sesión/usuario, igual que en la
 * operación real de la clínica hoy. La cookie NEXT_LOCALE la escribe el toggle
 * (Server Action) y por defecto refleja `users.locale` al hacer login.
 */
export const SUPPORTED_LOCALES = ["en", "es"] as const;
export const DEFAULT_LOCALE = "en" as const;

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = SUPPORTED_LOCALES.includes(cookieLocale as never)
    ? (cookieLocale as (typeof SUPPORTED_LOCALES)[number])
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
