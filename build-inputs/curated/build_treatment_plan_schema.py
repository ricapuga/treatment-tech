#!/usr/bin/env python3
"""
Genera build-inputs/curated/treatment_plan.schema.json — Treatment Plan (Plan de
Tratamiento), curado contra build-inputs/templates-r12/treatment-plan.pdf (7 páginas,
78 campos únicos del AcroForm original / 128 instancias de widget — ver
build-inputs/extracted/TreatmentPlan/fields.json + field_scripts.json +
build-inputs/extracted/option_catalogs.json["TreatmentPlan"]).

Mismo método que forms_1_7 y assessment: páginas renderizadas + overlay de posición/
nombre de cada widget + lectura visual de las 7 páginas + field_scripts.json para la
lógica real de mostrar/ocultar + option_catalogs.json para las listas de opciones
reales (no inventadas).

A diferencia de assessment.schema.json, aquí las ~30 listas de opciones reales (varias
con 6-7 frases clínicas largas) se cargan PROGRAMÁTICAMENTE desde option_catalogs.json
en vez de re-transcribirlas a mano en este script — el volumen de texto es mucho mayor
que en assessment y transcribir a mano introduce riesgo real de error. `load_options()`
abajo hace ese trabajo, indexando por el nombre de campo AcroForm real (`example_fields`
de cada grupo en option_catalogs.json) y usando el mismo valor como value/labelEn/labelEs
(igual que en assessment — el PDF real no trae traducción, ver mismo patrón allí).

Hallazgos y simplificaciones DELIBERADAS frente al PDF original (documentadas, no
encubiertas):

1. field_scripts.json de este módulo NO tiene ninguna lógica condicional de mostrar/
   ocultar — solo 4 entradas, todas de formateo de fecha (AFDate_KeystrokeEx/FormatEx)
   para los campos "Date" y "Text2". A diferencia de assessment.schema.json (8
   condiciones RN-7), este schema no necesita ninguna condición.

2. Encabezado (Nombre del cliente / Consejero / 5 líneas de diagnóstico) es LITERALMENTE
   el mismo campo AcroForm sincronizado en las 7 páginas (mismo patrón que
   "counselor_name" en assessment) — se declara UNA sola vez en la página 1
   (`client_name`, `counselor_name`, `diagnosis_line_1..5`) y no se repite en las
   páginas 2-7, aunque el PDF real repite las cajas visualmente en cada página.

3. Dimensión 1 (página 1) tiene una estructura REAL distinta de las Dimensiones 2-6: no
   existe en el AcroForm original ningún campo de "As evidenced by / Goal / Objectives /
   Methods and frequency / Comments" para la Dimensión 1 — solo fecha objetivo
   (`dim1_target_date`, campo "Text1", nombre distinto al resto) y un campo de texto
   libre para "Problem" (`dim1_problem`, campo "Text11"). El PDF imprime las etiquetas de
   esas secciones en la página pero SIN caja de formulario debajo — confirmado por
   conteo exacto de widgets (10 en página 1 = 3 encabezado + 5 diagnóstico + fecha +
   problema). Esta ausencia se preserva fielmente — no se inventan campos que el AcroForm
   real no tiene.

4. El campo "Text11" (Dimensión 1, "Problem") tiene en el PDF real un VALOR por defecto
   visible ("Patient presents no signs of intoxication or withdrawal at this time.") —
   pero ese es un valor de relleno del PDF, no una etiqueta ni una opción; el motor
   SchemaForm (FormField, ver src/lib/rules/form-conditions.ts) no tiene mecanismo de
   "valor por defecto" todavía (ninguno de los 2 schemas previos lo usa tampoco). Se deja
   como `textarea` de texto libre sin sembrar ese valor — sembrar texto clínico
   específico de un caso ficticio como "valor inicial" de un campo real sería el mismo
   tipo de invención que este proyecto evita, y agregar soporte de "default" al motor por
   un solo caso es una decisión de arquitectura aparte (no se toma aquí).

5. TODAS las páginas 2-7 comparten el MISMO nombre de campo AcroForm "Text2" para su
   "Target date" (confirmado en positions.json — mismo rect pattern, mismo nombre, en
   cada página) — es decir, en el PDF real, escribir una fecha objetivo en cualquier
   dimensión sincroniza el mismo valor en TODAS las demás dimensiones y en la página 7
   (Educational Plan). Esto es casi con certeza un bug de nomenclatura del PDF original
   (las 6 fechas objetivo son datos clínicos genuinamente distintos por dimensión — no
   tiene sentido de negocio que compartan valor). Se decide capturar cada una con una key
   semántica DISTINTA (`dim2_target_date` .. `dim6_target_date`, `edu_plan_target_date`)
   en vez de replicar la sincronización accidental del PDF — igual decisión que ya se
   tomó con "Counselor list 01" en assessment, pero en la dirección opuesta (ahí se
   colapsó 1 campo repetido a 1 solo; aquí se separa 1 campo repetido en 6 reales
   distintos, porque a diferencia del consejero — que SÍ es la misma persona en toda la
   evaluación — la fecha objetivo de cada dimensión SÍ es un dato clínico distinto).

6. El mismo patrón aparece con el campo "Date" en la página 7: además de ser el
   encabezado compartido (mismo campo que el "Date" de las páginas 1-6, ver punto 2 —
   aquí NO se repite, se reusa `plan_date`), el AcroForm real usa el MISMO nombre "Date"
   otras dos veces en el bloque de firmas al final de la página 7 ("Patient's signature"
   y "Counselor' signature"), sincronizando los 3 valores. Igual que el punto 5, se
   capturan como keys distintas: `patient_review_date` y `counselor_signature_date` — son
   datos reales distintos (fecha en que el paciente revisó el plan vs. fecha en que el
   consejero lo firmó), no la misma fecha del encabezado del plan.

7. `continued_stay_review_criteria` (campo "Text36", sección "Discharge Criteria") tiene
   en el PDF real un párrafo FIJO (boilerplate ASAM PPC, igual para todo caso — sobre
   revisión cada 60/30 días según nivel de cuidado) sin evidencia en field_scripts.json
   de que sea editable por caso más allá de overrides manuales — se captura como `info`
   (bloque de solo lectura, mismo patrón que "Program Requirements" en forms_1_7) en vez
   de como campo de texto libre editable, porque el contenido real es boilerplate legal/
   clínico fijo, no un dato que varíe por paciente.

8. `consultations_referrals` (campo "Text39") y las opciones de Educational Plan/
   Continuing Care Plan SÍ son campos de datos reales del caso (no boilerplate) — se
   capturan como texto libre / select según corresponda, sin sembrar el valor "None" que
   aparece en el PDF (mismo razonamiento que el punto 4).

9. La tabla de medicamentos ("Meds name.FILA.COLUMNA", 3 filas × 3 columnas, columnas =
   Nombre/Razón/Dosis según el orden horizontal real de los widgets en positions.json) se
   aplana a 9 campos de texto `medication_{1,2,3}_name/_reason/_dose` — mismo patrón que
   las tablas de episodios de assessment (RN-7), pero aquí sin condición Sí/No que las
   oculte: field_scripts.json no muestra ningún trigger para "¿necesita medicamento?"
   (Dropdown36) que oculte la tabla, así que la tabla se deja siempre visible (fiel al
   PDF real, que tampoco la oculta condicionalmente pese a tener la pregunta Yes/No).

10. Firma real (trazo) NO se captura — igual que forms_1_7 y assessment, `signature_pad`
    es tarea aparte del motor. Solo se capturan fecha/nombre en texto.

Corre: python3 build_treatment_plan_schema.py > treatment_plan.schema.json
"""
import json

FIELDS = []
PAGES = []
CONDITIONS = []

with open("../extracted/option_catalogs.json", "r", encoding="utf-8") as fh:
    _CATALOG = json.load(fh)["TreatmentPlan"]["lists"]

# lookup: nombre de campo AcroForm real (ej. "Dropdown5", "Dropdown8.0") -> lista de
# opciones reales (sin blancos), ya en forma {value, labelEn, labelEs} (el PDF real no
# trae traducción — mismo patrón que assessment: value == labelEn == labelEs).
_LOOKUP = {}
for group in _CATALOG:
    opts = [
        {"value": v.strip(), "labelEn": v.strip(), "labelEs": v.strip()}
        for v in group.get("options", [])
        if v and v.strip()
    ]
    for field_name in group.get("example_fields", []):
        _LOOKUP[field_name] = opts


def opts(acroform_field_name):
    """Devuelve la lista de opciones reales para un campo AcroForm dado, o lanza si no
    existe en option_catalogs.json — preferible a devolver [] en silencio (que
    produciría un <select> vacío sin que se note en la curación)."""
    if acroform_field_name not in _LOOKUP:
        raise KeyError(
            f"'{acroform_field_name}' no está en option_catalogs.json['TreatmentPlan'] "
            "— revisar example_fields, no inventar opciones."
        )
    return _LOOKUP[acroform_field_name]


def add_field(key, ftype, en, es, options=None, body_en=None, body_es=None):
    f = {"key": key, "type": ftype, "labelEn": en, "labelEs": es}
    if options:
        f["options"] = options
    if body_en:
        f["bodyEn"] = body_en
    if body_es:
        f["bodyEs"] = body_es
    FIELDS.append(f)
    return key


def page(title_en, title_es, keys):
    PAGES.append({"title": {"en": title_en, "es": title_es}, "fields": keys})


YN_OPTIONS = [
    {"value": "Yes", "labelEn": "Yes", "labelEs": "Sí"},
    {"value": "No", "labelEn": "No", "labelEs": "No"},
]

COUNSELOR_OPTIONS = opts("Counselor list")

# 36 códigos reales (idéntico al catálogo de 37 de assessment, MENOS "Z03.89 No
# Diagnosis" — confirmado por diferencia de conjuntos entre ambos option_catalogs.json:
# TP only: set(), AS only: {"Z03.89 No Diagnosis"}. Ver PROGRESS.md para el detalle).
DIAGNOSIS_OPTIONS = opts("Diagnosis 1 2024.0")

# ============================================================================
# PÁGINA 1 — Encabezado (declarado UNA vez) + Dimensión 1: Intoxication, Withdrawal,
# and Addictions Medications
# ============================================================================
p1 = []
p1.append(add_field("client_name", "text", "Client's name", "Nombre del cliente"))
p1.append(add_field("plan_date", "date", "Date", "Fecha"))
p1.append(
    add_field(
        "counselor_name",
        "select",
        "Counselor's name",
        "Nombre del consejero",
        COUNSELOR_OPTIONS,
    )
)
for i in range(1, 6):
    p1.append(
        add_field(
            f"diagnosis_line_{i}",
            "select",
            f"Diagnosis (line {i})",
            f"Diagnóstico (línea {i})",
            DIAGNOSIS_OPTIONS,
        )
    )
p1.append(add_field("dim1_target_date", "date", "Dimension 1 — Target date", "Dimensión 1 — Fecha objetivo"))
p1.append(
    add_field(
        "dim1_problem",
        "textarea",
        "Dimension 1 — Intoxication, Withdrawal, and Addictions Medications — Problem",
        "Dimensión 1 — Intoxicación, abstinencia y medicamentos de adicción — Problema",
    )
)
page(
    "Dimension 1 — Intoxication, Withdrawal, and Addictions Medications",
    "Dimensión 1 — Intoxicación, abstinencia y medicamentos de adicción",
    p1,
)


# ============================================================================
# Helper para las Dimensiones 2-6 (patrón uniforme: Problem/Evidenced by/Goal/
# Objectives x3/Methods x3/Comments) — cada una con sus propios campos AcroForm de
# opciones reales (ver acroform_* abajo, tomados de positions.json).
# ============================================================================
def build_dimension_page(
    dim_num,
    title_en,
    title_es,
    acroform_problem,
    acroform_evidenced,
    acroform_goal,
    acroform_objectives,  # lista de 3 nombres AcroForm
    acroform_methods,  # lista de 3 nombres AcroForm
):
    keys = []
    prefix = f"dim{dim_num}"
    keys.append(
        add_field(f"{prefix}_target_date", "date", f"Dimension {dim_num} — Target date", f"Dimensión {dim_num} — Fecha objetivo")
    )
    keys.append(
        add_field(f"{prefix}_problem", "select", f"Dimension {dim_num} — Problem", f"Dimensión {dim_num} — Problema", opts(acroform_problem))
    )
    keys.append(
        add_field(
            f"{prefix}_evidenced_by",
            "select",
            f"Dimension {dim_num} — As evidenced by",
            f"Dimensión {dim_num} — Evidenciado por",
            opts(acroform_evidenced),
        )
    )
    keys.append(
        add_field(f"{prefix}_goal", "select", f"Dimension {dim_num} — Goal", f"Dimensión {dim_num} — Meta", opts(acroform_goal))
    )
    for i, acro in enumerate(acroform_objectives, start=1):
        keys.append(
            add_field(
                f"{prefix}_objective_{i}",
                "select",
                f"Dimension {dim_num} — Objective {i}",
                f"Dimensión {dim_num} — Objetivo {i}",
                opts(acro),
            )
        )
    for i, acro in enumerate(acroform_methods, start=1):
        keys.append(
            add_field(
                f"{prefix}_methods_{i}",
                "select",
                f"Dimension {dim_num} — Methods and frequency {i}",
                f"Dimensión {dim_num} — Métodos y frecuencia {i}",
                opts(acro),
            )
        )
    keys.append(
        add_field(f"{prefix}_comments", "textarea", f"Dimension {dim_num} — Comments", f"Dimensión {dim_num} — Comentarios")
    )
    page(title_en, title_es, keys)


# ---------------------------------------------------------------------------
# PÁGINA 2 — Dimensión 2: Biomedical Conditions
# ---------------------------------------------------------------------------
build_dimension_page(
    2,
    "Dimension 2 — Biomedical Conditions",
    "Dimensión 2 — Condiciones biomédicas",
    "Dropdown5",
    "Dropdown6",
    "Dropdown7",
    ["Dropdown8.0", "Dropdown8.1", "Dropdown8.2"],
    ["Dropdown12.0.0", "Dropdown12.0.1", "Dropdown12.0.2"],
)

# ---------------------------------------------------------------------------
# PÁGINA 3 — Dimensión 3: Psychiatric and Cognitive Conditions
# ---------------------------------------------------------------------------
build_dimension_page(
    3,
    "Dimension 3 — Psychiatric and Cognitive Conditions",
    "Dimensión 3 — Condiciones psiquiátricas y cognitivas",
    "Dropdown4",
    "Dropdown11",
    "Dropdown13",
    ["Dropdown14.0", "Dropdown14.1", "Dropdown14.2"],
    ["Dropdown3.0.0.0.0", "Dropdown3.0.0.0.1", "Dropdown3.0.0.0.2"],
)

# ---------------------------------------------------------------------------
# PÁGINA 4 — Dimensión 4: Substance Use Related Risks
# ---------------------------------------------------------------------------
build_dimension_page(
    4,
    "Dimension 4 — Substance Use Related Risks",
    "Dimensión 4 — Riesgos relacionados con el uso de sustancias",
    "Dropdown22",
    "Dropdown23",
    "Dropdown24",
    ["Dropdown25.0.0", "Dropdown25.0.1", "Dropdown25.0.2"],
    ["Dropdown26.0.0", "Dropdown26.0.1", "Dropdown26.0.2"],
)

# ---------------------------------------------------------------------------
# PÁGINA 5 — Dimensión 5: Recovery Environment Interactions
# ---------------------------------------------------------------------------
build_dimension_page(
    5,
    "Dimension 5 — Recovery Environment Interactions",
    "Dimensión 5 — Interacciones con el entorno de recuperación",
    "Dropdown27",
    "Dropdown28",
    "Dropdown29",
    ["Dropdown30.0.0", "Dropdown30.0.1", "Dropdown30.0.2"],
    ["Dropdown31.0.0", "Dropdown31.0.1", "Dropdown31.0.2"],
)

# ---------------------------------------------------------------------------
# PÁGINA 6 — Dimensión 6: Person-Centered Considerations
# (el PDF imprime el título como "Person-Centered- Considerations" con un guion extra
#  — se corrige aquí a "Person-Centered Considerations", igual que el resto del
#  proyecto usa el título correctamente formado, no el typo tipográfico del PDF)
# ---------------------------------------------------------------------------
build_dimension_page(
    6,
    "Dimension 6 — Person-Centered Considerations",
    "Dimensión 6 — Consideraciones centradas en la persona",
    "Dropdown15",
    "Dropdown16",
    "Dropdown17",
    ["Dropdown18.0", "Dropdown18.1", "Dropdown18.2"],
    ["Dropdown21.0.0.0", "Dropdown21.0.0.1", "Dropdown21.0.0.2"],
)


# ============================================================================
# PÁGINA 7 — Educational Plan + Medications + Discharge Criteria + Signatures
# ============================================================================
p7 = []
p7.append(add_field("edu_plan_need", "select", "Educational Plan — Need", "Plan educativo — Necesidad", opts("Dropdown32")))
p7.append(add_field("edu_plan_goal", "select", "Educational Plan — Goal", "Plan educativo — Meta", opts("Dropdown33")))
p7.append(
    add_field(
        "edu_plan_objective_1",
        "select",
        "Educational Plan — Objective 1",
        "Plan educativo — Objetivo 1",
        opts("Dropdown34.0.0"),
    )
)
p7.append(
    add_field(
        "edu_plan_objective_2",
        "select",
        "Educational Plan — Objective 2",
        "Plan educativo — Objetivo 2",
        opts("Dropdown34.0.1"),
    )
)
p7.append(
    add_field("edu_plan_target_date", "date", "Educational Plan — Target date", "Plan educativo — Fecha objetivo")
)
p7.append(
    add_field(
        "medication_needed_yn",
        "select",
        "Does patient need to use prescribed medication(s)?",
        "¿El paciente necesita usar medicamento(s) recetado(s)?",
        YN_OPTIONS,
    )
)
for row in (1, 2, 3):
    p7.append(add_field(f"medication_{row}_name", "text", f"Medication {row} — Name", f"Medicamento {row} — Nombre"))
    p7.append(add_field(f"medication_{row}_reason", "text", f"Medication {row} — Reason", f"Medicamento {row} — Razón"))
    p7.append(add_field(f"medication_{row}_dose", "text", f"Medication {row} — Dose", f"Medicamento {row} — Dosis"))
p7.append(
    add_field(
        "consultations_referrals",
        "textarea",
        "Consultations or Referrals",
        "Consultas o referencias",
    )
)
p7.append(
    add_field(
        "continued_stay_review_criteria",
        "info",
        "Continued Stay Review Criteria",
        "Criterios de revisión de estadía continuada",
        body_en=(
            "Upon movement to any other level of care based on any change in the level "
            "of patient functioning; or every 60 calendar days or after every 10 hours "
            "of treatment for patients receiving Level I, or every 30 calendar days or "
            "after every 27 hours of treatment for patients receiving Level II care; or "
            "prior to planned discharge."
        ),
        body_es=(
            "Al pasar a cualquier otro nivel de cuidado por un cambio en el nivel de "
            "funcionamiento del paciente; o cada 60 días calendario o después de cada 10 "
            "horas de tratamiento para pacientes en Nivel I, o cada 30 días calendario o "
            "después de cada 27 horas de tratamiento para pacientes en Nivel II; o antes "
            "del alta planeada."
        ),
    )
)
p7.append(
    add_field(
        "continuing_care_plan",
        "select",
        "Continuing Care Plan",
        "Plan de cuidado continuo",
        opts("Dropdown38"),
    )
)
p7.append(
    add_field(
        "patient_review_date",
        "date",
        "Patient's signature — date",
        "Firma del paciente — fecha",
    )
)
p7.append(
    add_field(
        "counselor_signature_date",
        "date",
        "Counselor's signature — date",
        "Firma del consejero — fecha",
    )
)
# client_name y counselor_name se REUSAN (declarados en página 1) para la frase de
# revisión ("I, ___, have reviewed this treatment plan...") y la línea "Counselor'
# name" — mismo campo AcroForm sincronizado, no se repiten en FIELDS ni se listan de
# nuevo aquí como keys nuevas; SchemaForm ya los muestra en cualquier página que los
# incluya en su lista de `fields`.
p7_with_header_reuse = ["client_name", "counselor_name"] + p7
page(
    "Educational Plan, Medications, Discharge Criteria & Signatures",
    "Plan educativo, medicamentos, criterios de alta y firmas",
    p7_with_header_reuse,
)


schema = {
    "key": "treatment_plan",
    "version": 1,
    "titleEn": "Treatment Plan",
    "titleEs": "Plan de Tratamiento",
    "fields": FIELDS,
    "pages": PAGES,
}
if CONDITIONS:
    schema["conditions"] = CONDITIONS

print(json.dumps(schema, indent=2, ensure_ascii=False))
