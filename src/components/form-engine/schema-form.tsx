"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import {
  computeVisibleFieldKeys,
  type FormData as SchemaFormData,
  type FormSchema,
} from "@/lib/rules/form-conditions";
import { saveDraftDocument, completeDocument, type DocumentState } from "@/lib/actions/documents";
import { cn } from "@/lib/utils";

/**
 * <SchemaForm/> (blueprint M2 paso 7) — renderiza cualquier `form_schemas.schema`:
 * tipos de campo, condicionales RN-7 declarativas, multipágina, autosave de borrador.
 * No sabe nada de un documento clínico específico — el contenido real (Forms 1-7,
 * Assessment, etc.) se curará con Jorge en M2/M3; esto es el motor reutilizable.
 */
const inputClass =
  "w-full rounded-lg border border-ink-200 bg-surface px-3 py-2 text-sm text-ink-900 outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-ink-50 disabled:text-ink-400";

const completeInitial: DocumentState = { error: null };

export function SchemaForm({
  schema,
  caseId,
  locale,
  initialData,
  initialStatus,
}: {
  schema: FormSchema;
  caseId: string;
  locale: "es" | "en";
  initialData: SchemaFormData;
  initialStatus: "draft" | "completed" | "signed" | "voided";
}) {
  const router = useRouter();
  const [data, setData] = useState<SchemaFormData>(initialData);
  const [pageIndex, setPageIndex] = useState(0);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [, startTransition] = useTransition();
  const isLocked = initialStatus === "completed" || initialStatus === "signed";
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(() => computeVisibleFieldKeys(schema, data), [schema, data]);
  const fieldsByKey = useMemo(
    () => new Map(schema.fields.map((f) => [f.key, f])),
    [schema.fields]
  );
  const page = schema.pages[pageIndex];
  const isLastPage = pageIndex === schema.pages.length - 1;

  function setField(key: string, value: string | number | boolean) {
    if (isLocked) return;
    setData((prev) => ({ ...prev, [key]: value }));
  }

  // Autosave con debounce — no se guarda en cada tecleo, se espera una pausa. Evita
  // saturar la base y da tiempo a que el usuario termine de escribir un párrafo.
  useEffect(() => {
    if (isLocked) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaveState("saving");
      startTransition(async () => {
        const fd = new FormData();
        fd.set("caseId", caseId);
        fd.set("schemaKey", schema.key);
        fd.set("schemaVersion", String(schema.version));
        fd.set("data", JSON.stringify(data));
        const result = await saveDraftDocument(completeInitial, fd);
        setSaveState(result.error ? "error" : "saved");
      });
    }, 800);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const [completeState, completeAction, isCompleting] = useActionState(
    completeDocument,
    completeInitial
  );

  useEffect(() => {
    if (!isCompleting && completeState.error === null && completeState !== completeInitial) {
      router.refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCompleting, completeState]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          {schema.pages.map((p, i) => (
            <button
              key={p.title.en}
              type="button"
              onClick={() => setPageIndex(i)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                i === pageIndex
                  ? "bg-brand-600 text-white"
                  : "bg-ink-100 text-ink-500 hover:bg-ink-200"
              )}
            >
              {i + 1}. {locale === "es" ? p.title.es : p.title.en}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 text-xs text-ink-400">
          {isLocked ? (
            <span className="flex items-center gap-1 text-success-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> {initialStatus}
            </span>
          ) : saveState === "saving" ? (
            <span className="flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> guardando…
            </span>
          ) : saveState === "saved" ? (
            <span className="flex items-center gap-1 text-success-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> borrador guardado
            </span>
          ) : saveState === "error" ? (
            <span className="text-danger-700">error al guardar</span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {page.fields.map((key) => {
          if (!visible.has(key)) return null;
          const field = fieldsByKey.get(key);
          if (!field) return null;
          const label = locale === "es" ? field.labelEs : field.labelEn;
          const value = data[key] ?? "";

          return (
            <label key={key} className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium text-ink-700">
                {label}
                {field.required && <span className="text-danger-600"> *</span>}
              </span>

              {field.type === "textarea" ? (
                <textarea
                  disabled={isLocked}
                  value={String(value)}
                  onChange={(e) => setField(key, e.target.value)}
                  rows={3}
                  className={inputClass}
                />
              ) : field.type === "select" ? (
                <select
                  disabled={isLocked}
                  value={String(value)}
                  onChange={(e) => setField(key, e.target.value)}
                  className={inputClass}
                >
                  <option value="">—</option>
                  {field.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {locale === "es" ? o.labelEs : o.labelEn}
                    </option>
                  ))}
                </select>
              ) : field.type === "radio" ? (
                <div className="flex gap-4">
                  {field.options?.map((o) => (
                    <label key={o.value} className="flex items-center gap-1.5 text-sm text-ink-700">
                      <input
                        type="radio"
                        disabled={isLocked}
                        name={key}
                        checked={value === o.value}
                        onChange={() => setField(key, o.value)}
                      />
                      {locale === "es" ? o.labelEs : o.labelEn}
                    </label>
                  ))}
                </div>
              ) : field.type === "checkbox" ? (
                <input
                  type="checkbox"
                  disabled={isLocked}
                  checked={Boolean(value)}
                  onChange={(e) => setField(key, e.target.checked)}
                  className="h-4 w-4"
                />
              ) : (
                <input
                  type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                  disabled={isLocked}
                  value={String(value)}
                  onChange={(e) => setField(key, e.target.value)}
                  className={inputClass}
                />
              )}
            </label>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-border-subtle pt-4">
        <button
          type="button"
          disabled={pageIndex === 0}
          onClick={() => setPageIndex((i) => Math.max(0, i - 1))}
          className="rounded-lg border border-ink-200 px-4 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100 disabled:opacity-40"
        >
          Anterior
        </button>

        {isLastPage ? (
          !isLocked && (
            <form action={completeAction}>
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="schemaKey" value={schema.key} />
              <button
                type="submit"
                disabled={isCompleting}
                className={cn(
                  "rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-brand-700",
                  isCompleting && "opacity-60"
                )}
              >
                {isCompleting ? "…" : "Finalizar"}
              </button>
            </form>
          )
        ) : (
          <button
            type="button"
            onClick={() => setPageIndex((i) => Math.min(schema.pages.length - 1, i + 1))}
            className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white shadow-[var(--shadow-sm)] hover:bg-brand-700"
          >
            Siguiente
          </button>
        )}
      </div>
      {completeState.error && (
        <p className="text-xs font-medium text-danger-700">{completeState.error}</p>
      )}
    </div>
  );
}
