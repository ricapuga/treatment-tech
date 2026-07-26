import { getTranslations } from "next-intl/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const t = await getTranslations("login");
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-full max-w-sm rounded border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold">{t("title")}</h1>
        <LoginForm next={next ?? "/dashboard"} />
      </div>
    </div>
  );
}
