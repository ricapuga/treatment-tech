# Desviaciones del blueprint

Formato por entrada: qué decía el blueprint, qué se hizo, por qué, impacto en milestones
posteriores. Ver protocolo de desviación en CLAUDE.md.

## 2026-07-26 — shadcn/ui: init manual en vez de CLI
- **Blueprint decía:** `pnpm dlx shadcn@latest init`.
- **Qué se hizo:** el comando falla en este sandbox (sin acceso de red a `ui.shadcn.com`).
  Se creó `components.json` a mano con la configuración estándar (style default, baseColor
  neutral, alias @/components, @/lib/utils, @/components/ui) y `src/lib/utils.ts` con el
  helper `cn()` estándar (clsx + tailwind-merge). Se instalaron las dependencias que el CLI
  habría instalado (`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
  `tailwindcss-animate`).
- **Por qué:** no bloquear M1 por una restricción de red de este entorno específico, que
  probablemente no existe en tu máquina o en CI.
- **Impacto:** ninguno esperado — `pnpm dlx shadcn@latest add <componente>` debería funcionar
  normal en un entorno con red completa, usando exactamente este `components.json`. Si falla
  ahí también, es una desviación real a investigar, no repetir este workaround sin más.

## 2026-07-26 — `middleware.ts` → `proxy.ts` (Next.js 16 renombró el archivo)
- **Blueprint decía:** middleware de protección de rutas en `middleware.ts` (convención
  estándar de Next.js en el momento en que se escribió el blueprint).
- **Qué se hizo:** Next.js 16.2 deprecó `middleware.ts` a favor de `proxy.ts`, con la
  función exportada como `proxy` (o default) en vez de `middleware`. `pnpm build` lo
  advierte explícitamente. Se renombró el archivo y la función; misma lógica.
- **Por qué:** exactamente el tipo de cambio que `AGENTS.md` (generado por
  create-next-app) advierte al inicio del repo — "This is NOT the Next.js you know".
  Ignorar la advertencia habría dejado el proxy funcionando hoy pero roto en la
  próxima versión que remueva el fallback de compatibilidad.
- **Impacto:** ninguno — incluir esta nota para que nadie "corrija" de vuelta a
  `middleware.ts` pensando que es más estándar.

## 2026-07-26 — RLS: driver de Pool (`drizzle-orm/neon-serverless`) en vez de HTTP para
withTenant()
- **Blueprint decía:** SET LOCAL app.tenant_id dentro de una transacción; no especificaba
  el driver exacto de Neon a usar para `lib/db/rls.ts`.
- **Qué se hizo:** `src/lib/db/rls.ts` usa `@neondatabase/serverless` `Pool` (WebSocket, con
  estado) + `drizzle-orm/neon-serverless`, en vez del cliente HTTP sin estado
  (`drizzle-orm/neon-http`) que sí se usa en `src/lib/db/client.ts` para lecturas que no
  necesitan RLS con tenant (si las hay).
- **Por qué:** el cliente HTTP de Neon no sostiene estado de sesión entre statements — no
  puede ejecutar `SET LOCAL` y luego una query en la MISMA transacción física, que es
  exactamente el requisito de la mecánica RLS bajo pooling. El driver de Pool sí lo permite
  vía `db.transaction()`.
- **Impacto:** ninguno negativo esperado. Si en producción el uso de WebSockets desde
  funciones serverless de Vercel da problemas de cold-start o límites de conexión, es un
  ítem a vigilar en M5 (hardening) — no bloquea M1-M4.
