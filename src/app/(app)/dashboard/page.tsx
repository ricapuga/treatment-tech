import { getTranslations } from "next-intl/server";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="rounded border border-dashed border-neutral-300 p-8 text-neutral-500">
      {t("placeholder")}
    </div>
  );
}
