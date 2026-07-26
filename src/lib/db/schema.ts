/**
 * Drizzle schema — núcleo de Treatment Tech.
 * Fuente de verdad: treatment-tech-blueprint.md, Sección 7 (Modelo de datos).
 * Better Auth genera sus propias tablas de sesión/cuenta por separado (ver src/lib/auth.ts).
 *
 * IMPORTANTE: los roles, FORCE ROW LEVEL SECURITY, las políticas de tenant_isolation
 * y la vista case_balances NO se expresan aquí — viven en SQL crudo bajo
 * drizzle/sql/0001_rls_and_roles.sql porque son mecánica de seguridad explícita,
 * no generación automática. Ver ADR-008 y la sección "RLS — MECÁNICA OBLIGATORIA"
 * del blueprint. NUNCA remuevas ese archivo del pipeline de migración.
 */
import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  date,
  numeric,
  integer,
  boolean,
  bigint,
  unique,
  check,
  inet,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// drizzle-orm/pg-core no exporta un helper "timestamptz" — timestamptz de Postgres
// se define con timestamp(nombre, { withTimezone: true }). Normalizamos aquí.
const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  licenseNumber: text("license_number"),
  settings: jsonb("settings").default({}),
  createdAt: timestamptz("created_at").defaultNow(),
  updatedAt: timestamptz("updated_at").defaultNow(),
});

export const locations = pgTable("locations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  fax: text("fax"),
  licenseNumber: text("license_number"),
});

// users: staff. Better Auth maneja credenciales/sesión aparte; esta tabla es el
// perfil de negocio (role, credentials, locale, tenant_id) referenciado por Better Auth.
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    credentials: text("credentials"),
    role: text("role").notNull(),
    locale: text("locale").default("en"),
    active: boolean("active").default(true),
    createdAt: timestamptz("created_at").defaultNow(),
  },
  (t) => [
    check(
      "users_role_check",
      sql`${t.role} IN ('owner','admin','supervisor','counselor','front_desk','billing')`
    ),
  ]
);

export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  dob: date("dob").notNull(),
  driversLicense: text("drivers_license"),
  language: text("language"),
  emergencyContact: jsonb("emergency_contact"),
  demographics: jsonb("demographics").default({}),
  createdAt: timestamptz("created_at").defaultNow(),
  updatedAt: timestamptz("updated_at").defaultNow(),
});

export const cases = pgTable(
  "cases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    locationId: uuid("location_id").notNull().references(() => locations.id),
    patientId: uuid("patient_id").notNull().references(() => patients.id),
    caseNumber: text("case_number").notNull(),
    admissionDate: date("admission_date").notNull(),
    referralSource: text("referral_source"),
    county: text("county"),
    loi: text("loi"),
    requiredHours: numeric("required_hours"),
    requiredCcMonths: integer("required_cc_months"),
    feeTotalCents: integer("fee_total_cents").default(0),
    status: text("status").notNull().default("active"),
    counselorId: uuid("counselor_id").references(() => users.id),
    createdAt: timestamptz("created_at").defaultNow(),
    updatedAt: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    unique("cases_tenant_case_number_unique").on(t.tenantId, t.caseNumber),
    check(
      "cases_status_check",
      sql`${t.status} IN ('active','completed','closed','suspended')`
    ),
  ]
);

// RN-1: secuencia mensual de case_number por tenant. PK compuesta = anti-colisión.
export const caseNumberSeq = pgTable(
  "case_number_seq",
  {
    tenantId: uuid("tenant_id").notNull(),
    period: text("period").notNull(), // 'JAN26'
    nextVal: integer("next_val").notNull().default(1),
  },
  (t) => [unique("case_number_seq_pk").on(t.tenantId, t.period)]
);

export const caseStages = pgTable(
  "case_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    stage: text("stage").notNull(),
    status: text("status").notNull().default("pending"),
    stageDate: date("stage_date"),
    comments: text("comments"),
    updatedAt: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    unique("case_stages_case_stage_unique").on(t.caseId, t.stage),
    check(
      "case_stages_status_check",
      sql`${t.status} IN ('pending','in_progress','completed','suspended')`
    ),
  ]
);

export const formSchemas = pgTable(
  "form_schemas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    version: integer("version").notNull().default(1),
    titleEn: text("title_en"),
    titleEs: text("title_es"),
    schema: jsonb("schema").notNull(),
    pdfTemplate: text("pdf_template"),
  },
  (t) => [unique("form_schemas_key_version_unique").on(t.key, t.version)]
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    schemaKey: text("schema_key").notNull(),
    schemaVersion: integer("schema_version").notNull(),
    seq: integer("seq").default(1),
    data: jsonb("data").notNull().default({}),
    status: text("status").notNull().default("draft"),
    amendsDocumentId: uuid("amends_document_id"),
    createdBy: uuid("created_by").references(() => users.id),
    completedBy: uuid("completed_by").references(() => users.id),
    completedAt: timestamptz("completed_at"),
    createdAt: timestamptz("created_at").defaultNow(),
    updatedAt: timestamptz("updated_at").defaultNow(),
  },
  (t) => [
    unique("documents_case_schema_seq_unique").on(t.caseId, t.schemaKey, t.seq),
    check(
      "documents_status_check",
      sql`${t.status} IN ('draft','completed','signed','voided')`
    ),
  ]
);

export const signatures = pgTable(
  "signatures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").notNull().references(() => documents.id),
    signerType: text("signer_type").notNull(),
    signerName: text("signer_name").notNull(),
    userId: uuid("user_id").references(() => users.id),
    imageS3Key: text("image_s3_key").notNull(),
    docSha256: text("doc_sha256").notNull(),
    signedAt: timestamptz("signed_at").defaultNow(),
    ip: inet("ip"),
  },
  (t) => [
    check("signatures_signer_type_check", sql`${t.signerType} IN ('patient','staff')`),
  ]
);

// RN-4: horas fluyen solas — SUM(hours) por caso alimenta ledger y status reports.
export const attendanceSessions = pgTable(
  "attendance_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    sessionDate: date("session_date").notNull(),
    hours: numeric("hours").notNull(),
    kind: text("kind").notNull(),
    topic: text("topic"),
    counselorId: uuid("counselor_id").references(() => users.id),
    activityDocumentId: uuid("activity_document_id").references(() => documents.id),
    createdAt: timestamptz("created_at").defaultNow(),
  },
  (t) => [
    check(
      "attendance_sessions_kind_check",
      sql`${t.kind} IN ('group','individual','education')`
    ),
  ]
);

// Idempotencia de webhooks Stripe.
export const stripeEvents = pgTable("stripe_events", {
  eventId: text("event_id").primaryKey(),
  receivedAt: timestamptz("received_at").defaultNow(),
});

// RN-5: el saldo NUNCA se almacena. case_balances (vista, en SQL crudo) lo calcula.
export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    entryDate: date("entry_date").notNull(),
    service: text("service"),
    kind: text("kind").notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: text("method"),
    stripePaymentIntentId: text("stripe_payment_intent_id"),
    recordedBy: uuid("recorded_by").references(() => users.id),
    voided: boolean("voided").default(false),
    createdAt: timestamptz("created_at").defaultNow(),
  },
  (t) => [
    check("ledger_entries_kind_check", sql`${t.kind} IN ('charge','payment','adjustment')`),
    check(
      "ledger_entries_method_check",
      sql`${t.method} IN ('cash','check','card_terminal','stripe')`
    ),
  ]
);

// RN-6: gate de divulgación 42 CFR Part 2.
export const consents = pgTable("consents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  caseId: uuid("case_id").notNull().references(() => cases.id),
  recipientOrg: text("recipient_org").notNull(),
  recipientName: text("recipient_name"),
  purpose: text("purpose"),
  scope: text("scope"),
  signedAt: timestamptz("signed_at").notNull(),
  expiresAt: date("expires_at"),
  revokedAt: timestamptz("revoked_at"),
  documentId: uuid("document_id").references(() => documents.id),
});

export const urineScreens = pgTable(
  "urine_screens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").notNull().references(() => cases.id),
    testDate: date("test_date").notNull(),
    panel: integer("panel").notNull(),
    results: jsonb("results").notNull(),
    documentId: uuid("document_id").references(() => documents.id),
  },
  (t) => [check("urine_screens_panel_check", sql`${t.panel} IN (5,13)`)]
);

export const files = pgTable(
  "files",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
    caseId: uuid("case_id").references(() => cases.id),
    kind: text("kind").notNull(),
    s3Key: text("s3_key").notNull(),
    filename: text("filename").notNull(),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: timestamptz("created_at").defaultNow(),
  },
  (t) => [
    check(
      "files_kind_check",
      sql`${t.kind} IN ('uniform_report','general','signature','historical_archive','other')`
    ),
  ]
);

// audit_log: INSERT-only. REVOKE UPDATE/DELETE se aplica en SQL crudo (0001_rls_and_roles.sql).
export const auditLog = pgTable("audit_log", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  tenantId: uuid("tenant_id"),
  userId: uuid("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  details: jsonb("details"),
  ip: inet("ip"),
  createdAt: timestamptz("created_at").defaultNow(),
});

export const catalogs = pgTable("catalogs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id), // NULL = global
  key: text("key").notNull(),
  locale: text("locale").notNull().default("en"),
  items: jsonb("items").notNull(),
});

export const contentLibrary = pgTable("content_library", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  context: text("context").notNull(),
  locale: text("locale").notNull().default("en"),
  phrases: jsonb("phrases").notNull(),
});
