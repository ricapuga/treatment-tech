"use server";

import { cookies } from "next/headers";
import { SUPPORTED_LOCALES } from "./request";

/**
 * Server Action que respalda el toggle es/en del shell (blueprint M1 paso 7 / Gate M1
 * "Toggle es/en cambia la UI del shell"). No requiere sesión: el idioma de la UI de
 * login también debe poder cambiarse.
 */
export async function setLocale(locale: string) {
  if (!SUPPORTED_LOCALES.includes(locale as never)) return;
  const cookieStore = await cookies();
  cookieStore.set("NEXT_LOCALE", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
}
