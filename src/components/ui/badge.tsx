import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Badge semántico — usado para nivel de riesgo (LOI), estado de programa y estado de
 * documento. Los colores son parte del sistema de diseño (globals.css), no valores
 * sueltos, para que "rojo" signifique lo mismo en todas las pantallas.
 */
const BADGE_TONES = {
  neutral: "bg-ink-100 text-ink-700 ring-ink-200",
  brand: "bg-brand-50 text-brand-700 ring-brand-100",
  success: "bg-success-50 text-success-700 ring-success-100",
  warning: "bg-warning-50 text-warning-700 ring-warning-100",
  danger: "bg-danger-50 text-danger-700 ring-danger-100",
  info: "bg-info-50 text-info-700 ring-info-100",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        BADGE_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
