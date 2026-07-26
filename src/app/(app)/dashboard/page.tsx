import { getTranslations } from "next-intl/server";
import { RulesDemo } from "./rules-demo";

export default async function DashboardPage() {
  const t = await getTranslations("dashboard");

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded border border-dashed border-neutral-300 p-8 text-neutral-500">
        {t("placeholder")}
      </div>
      <RulesDemo />
    </div>
  );
}
