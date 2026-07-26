import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-surface shadow-[var(--shadow-sm)]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-900">{title}</h2>
        {description && (
          <p className="mt-0.5 text-xs text-ink-500">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("px-6 py-5", className)}>{children}</div>;
}
