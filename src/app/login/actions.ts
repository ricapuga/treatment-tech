"use server";

import { auth } from "@/lib/auth";
import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export type LoginState = { error: string | null };

export async function loginAction(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/dashboard");

  try {
    // La cookie de sesión la escribe el plugin nextCookies() (ver src/lib/auth.ts) —
    // no hay que leer un Set-Cookie a mano aquí, siempre que esto corra dentro de una
    // Server Action (que es exactamente el caso).
    await auth.api.signInEmail({
      body: { email, password },
      headers: await headers(),
    });
  } catch (err) {
    if (err instanceof APIError) {
      return { error: "invalid" };
    }
    throw err;
  }

  redirect(next);
}
