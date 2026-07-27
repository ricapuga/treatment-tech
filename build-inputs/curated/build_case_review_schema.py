#!/usr/bin/env python3
"""
Genera build-inputs/curated/case_review.schema.json — Case Review ("Continued Service
Review" / "Outpatient Treatment"), curado contra
build-inputs/templates-r12/case-review.pdf (2 páginas, 28 campos únicos del AcroForm
original / 33 instancias de widget — ver build-inputs/extracted/CaseReview/fields.json
+ field_scripts.json + build-inputs/extracted/option_catalogs.json["CaseReview"]).

Cuarto módulo curado con el mismo método (páginas renderizadas + overlay de posición/
nombre de widget + lectura visual + field_scripts.json + option_catalogs.json). Al
igual que Treatment Plan, field_scripts.json de este módulo NO tiene ninguna lógica
condicional de mostrar/ocultar (solo 2 entradas, de formateo de fecha para "Text2") —
este schema no necesita ningún `condition` RN-7.

Mismo enfoque de carga programática de opciones que Treatment Plan (`opts()` lee
option_catalogs.json en vez de transcribir a mano) — reutilizado sin cambios.

Estructura REAL confirmada por lectura visual + conteo exacto de widgets (no una
réplica mecánica de Treatment Plan, aunque comparte las 6 dimensiones ASAM):

1. Página 1 ("Continued Service Review"): encabezado (nombre del paciente, fecha de
   revisión, tipo de revisión, nivel de intervención) + una sección por dimensión. A
   diferencia de Treatment Plan (que tiene Problem/Evidenced by/Goal/Objectives/
   Methods), aquí cada dimensión es una lista de notas de progreso de sesión: la
   Dimensión 1 tiene UN solo campo (`Dropdown3`, y en el PDF real esa lista de opciones
   solo tiene UNA frase real: "Patient presents no signs of intoxication or
   withdrawals at this time." — no se inventan más opciones aunque parezca poco para
   un <select>), mientras que las Dimensiones 2-6 tienen TRES campos cada una
   (`dimN_notes_1/_2/_3`) con listas reales de 6 frases de progreso por dimensión.

2. Página 2 ("Treatment Plan Progress, ASAM Placement & Signatures"): progreso en
   porcentaje (10%-100%, reales) de las Metas y Objetivos del Treatment Plan, sección
   "ASAM PLACEMENT" que en el PDF real agrupa visualmente: grilla de 3 líneas de
   diagnóstico DSM-5 (mismo catálogo de 36 códigos que Treatment Plan), un campo
   "Recommendations" que pese a la etiqueta impresa es en realidad un <select> con las
   15 opciones reales de nivel de cuidado ASAM (idéntico option_catalogs.json a
   `asam_placement`/`Dropdown11.1` en Assessment/Treatment Plan — se preserva el
   nombre real "recomendación" en vez de renombrarlo a "asam_placement" porque en ESTE
   PDF así está etiquetado, aunque el contenido de la lista sea el mismo catálogo ASAM)
   + un campo de texto libre para notas de recomendación, y una sección "Comments" de
   2 líneas <select>. NO existe ningún campo bajo el encabezado "ASAM PLACEMENT" en sí
   — es solo un título de agrupación visual, no se inventa un campo para él.

3. Firma: igual patrón de bug de sincronización ya visto en Treatment Plan — el campo
   AcroForm "Text2" es LITERALMENTE el mismo nombre compartido entre "Review date"
   (encabezado página 1), "Date" de firma del paciente y "Date" de firma del consejero
   (ambos en página 2) — 3 instancias del mismo campo sincronizado. Se resuelve igual
   que en Treatment Plan: keys distintas (`review_date`, `patient_review_date`,
   `counselor_signature_date`) en vez de replicar la sincronización accidental.
   "Patient name" (`Text1.0`) sí se reusa sin separar (mismo dato real en encabezado y
   en el bloque de firma) — mismo criterio que `client_name` en Treatment Plan.

4. Firma real (trazo) no se captura — mismo motivo que los 3 módulos anteriores.

Corre: python3 build_case_review_schema.py > case_review.schema.json
"""
import json

FIELDS = []
PAGES = []
CONDITIONS = []

with open("../extracted/option_catalogs.json", "r", encoding="utf-8") as fh:
    _CATALOG = json.load(fh)["CaseReview"]["lists"]

_LOOKUP = {}
for group in _CATALOG:
    catalog_opts = [
        {"value": v.strip(), "labelEn": v.strip(), "labelEs": v.strip()}
        for v in group.get("options", [])
        if v and v.strip()
    ]
    for field_name in group.get("example_fields", []):
        _LOOKUP[field_name] = catalog_opts


def opts(acroform_field_name):
    if acroform_field_name not in _LOOKUP:
        raise KeyError(
            f"'{acroform_field_name}' no está en option_catalogs.json['CaseReview'] "
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


# ============================================================================
# PÁGINA 1 — Encabezado + Dimensiones 1-6 (notas de progreso de sesión)
# ============================================================================
p1 = []
p1.append(add_field("patient_name", "text", "Patient name", "Nombre del paciente"))
p1.append(add_field("review_date", "date", "Review date", "Fecha de revisión"))
p1.append(
    add_field("review_type", "select", "Type of review", "Tipo de revisión", opts("Dropdown4"))
)
p1.append(
    add_field(
        "level_of_intervention",
        "select",
        "Level of intervention",
        "Nivel de intervención",
        opts("Dropdown5"),
    )
)
p1.append(
    add_field(
        "dim1_status",
        "select",
        "Dimension 1 — Intoxication, Withdrawal, and Addiction Medications",
        "Dimensión 1 — Intoxicación, abstinencia y medicamentos de adicción",
        opts("Dropdown3"),
    )
)


def build_dimension_notes(dim_num, title_en, title_es, acroform_notes):
    keys = []
    for i, acro in enumerate(acroform_notes, start=1):
        keys.append(
            add_field(
                f"dim{dim_num}_notes_{i}",
                "select",
                f"Dimension {dim_num} — {title_en} — progress note {i}",
                f"Dimensión {dim_num} — {title_es} — nota de progreso {i}",
                opts(acro),
            )
        )
    return keys


p1 += build_dimension_notes(
    2, "Biomedical Conditions", "Condiciones biomédicas",
    ["Dropdown6.0.0.0", "Dropdown6.0.0.1", "Dropdown6.0.0.2"],
)
p1 += build_dimension_notes(
    3, "Psychiatric and Cognitive Conditions", "Condiciones psiquiátricas y cognitivas",
    ["Dropdown8.0.0", "Dropdown8.0.1", "Dropdown8.0.2"],
)
p1 += build_dimension_notes(
    4, "Substance Use-Related Risks", "Riesgos relacionados con el uso de sustancias",
    ["Dropdown2.0.0", "Dropdown2.0.1", "Dropdown2.0.2"],
)
p1 += build_dimension_notes(
    5, "Recovery Environment Interactions", "Interacciones con el entorno de recuperación",
    ["Dropdown7.0.0.0", "Dropdown7.0.0.1", "Dropdown7.0.0.2"],
)
p1 += build_dimension_notes(
    6, "Person-Centered Considerations", "Consideraciones centradas en la persona",
    ["Dropdown1.0.0.0", "Dropdown1.0.0.1", "Dropdown1.0.0.2"],
)

page("Continued Service Review", "Revisión de servicio continuado", p1)


# ============================================================================
# PÁGINA 2 — Progreso del Treatment Plan + ASAM Placement + Firmas
# ============================================================================
p2 = []
p2.append(
    add_field(
        "treatment_goals_progress",
        "select",
        "Treatment Plan Goals — patient has reached a progress of",
        "Metas del Plan de Tratamiento — el paciente ha alcanzado un progreso de",
        opts("Dropdown9.0.0"),
    )
)
p2.append(
    add_field(
        "treatment_objectives_progress",
        "select",
        "Treatment Plan Objectives — patient has reached a progress of",
        "Objetivos del Plan de Tratamiento — el paciente ha alcanzado un progreso de",
        opts("Dropdown9.0.1"),
    )
)
for i in range(1, 4):
    p2.append(
        add_field(
            f"diagnosis_line_{i}",
            "select",
            f"DSM-5 Diagnosis (line {i})",
            f"Diagnóstico DSM-5 (línea {i})",
            opts(f"Diagnosis.0.0.0.{i - 1}"),
        )
    )
p2.append(
    add_field(
        "asam_recommendation",
        "select",
        "Recommendations — ASAM level of care",
        "Recomendaciones — nivel de cuidado ASAM",
        opts("Dropdown11.1"),
    )
)
p2.append(
    add_field(
        "recommendations_notes",
        "textarea",
        "Recommendations — notes",
        "Recomendaciones — notas",
    )
)
p2.append(
    add_field("comments_1", "select", "Comments (line 1)", "Comentarios (línea 1)", opts("Dropdown12.0"))
)
p2.append(
    add_field("comments_2", "select", "Comments (line 2)", "Comentarios (línea 2)", opts("Dropdown12.1"))
)
p2.append(
    add_field(
        "counselor_name",
        "select",
        "Counselor name and credentials",
        "Nombre y credenciales del consejero",
        opts("Dropdown10.0.0.0"),
    )
)
p2.append(
    add_field("patient_review_date", "date", "Patient's signature — date", "Firma del paciente — fecha")
)
p2.append(
    add_field(
        "counselor_signature_date",
        "date",
        "Counselor's signature — date",
        "Firma del consejero — fecha",
    )
)
# patient_name se REUSA (declarado en página 1) para el bloque de firmas.
p2_with_header_reuse = ["patient_name"] + p2
page(
    "Treatment Plan Progress, ASAM Placement & Signatures",
    "Progreso del Plan de Tratamiento, colocación ASAM y firmas",
    p2_with_header_reuse,
)


schema = {
    "key": "case_review",
    "version": 1,
    "titleEn": "Case Review",
    "titleEs": "Revisión de Caso",
    "fields": FIELDS,
    "pages": PAGES,
}
if CONDITIONS:
    schema["conditions"] = CONDITIONS

print(json.dumps(schema, indent=2, ensure_ascii=False))
