#!/usr/bin/env python3
"""
Genera build-inputs/curated/activity_notes_12.schema.json — Activity Notes, variante
de 12 horas ("EARLY INTERVENTION PROGRAM"), curado contra
build-inputs/templates-r12/activity-notes-12.pdf (2 páginas, 102 campos del AcroForm
original — ver build-inputs/extracted/ActivityNotes12/fields.json + field_scripts.json
+ build-inputs/extracted/option_catalogs.json["ActivityNotes12"]).

Quinto módulo curado, y el primero de tres variantes de "Activity Notes" (12/20/75
horas — ver build_activity_notes_20/75_schema.py, pendientes). El PDF trae la bitácora
de sesiones de UN programa específico: aquí "EARLY INTERVENTION PROGRAM", con "Hours of
service recommended: 12" impreso como valor fijo de esta plantilla — muy probablemente
las variantes 20/75 corresponden a otros programas (Risk Education/Outpatient) con más
horas y por lo tanto más filas de sesión. Queda para cuando se curen esas variantes
confirmar cuáles programas exactos son (posible conexión con los bloques RE/EI/OP/CCP
de RN-2, `src/lib/rules/loi.ts` — NO se asume esa conexión aquí, es una hipótesis a
verificar, no algo ya evidenciado en field_scripts.json de este módulo).

Sin condiciones RN-7 (field_scripts.json solo trae 18 scripts, todos de formateo de
fecha para los 8 campos de fecha por fila — ver abajo).

ESTRUCTURA REAL (confirmada por overlay + lectura visual de las 2 páginas, NO por
convención asumida): el PDF tiene 8 "filas" de bitácora con 3 formas distintas:

1. Fila de ADMISIÓN (la primera, única en su forma): fecha/hora de/hora a/horas de
   servicio + un <select> de "resumen demográfico" (13 frases reales tipo "Client is a
   single, Caucasian, employed male." — contenido clínico real de este PDF específico,
   no inventado aquí; es el tipo de frase de apertura que estas notas de admisión usan
   en la práctica real) + un párrafo narrativo libre (con un valor de ejemplo real
   visible en el PDF, no sembrado aquí — mismo criterio que "dim1_problem" en
   treatment_plan) + consejero + iniciales.

2. 6 filas de SESIÓN (Session 01..06): fecha/hora de/hora a/horas + 4 campos tipo nota
   DAP real (Topic/D/A/P — "D:"/"A:"/"P:" son los prefijos literales de las opciones
   reales del PDF, formato de nota clínica Data/Assessment/Plan) + consejero +
   iniciales. Confirma que sesiones distintas pueden tener consejeros distintos — a
   diferencia de assessment/treatment_plan/case_review (un solo consejero para todo el
   documento), aquí el consejero se captura POR FILA.

3. Fila de SALIDA ("Exit note", la última, misma forma que la de admisión): fecha/hora
   de/hora a/horas + un párrafo narrativo libre (con valor de ejemplo real visible, no
   sembrado) + consejero + iniciales. NO tiene el <select> demográfico de la fila de
   admisión ni los campos Topic/D/A/P de las sesiones.

Simplificación DELIBERADA, documentada: cada fila tiene, junto al campo real de "horas
de servicio" (`Text5.*`, texto libre, con el valor visible en el PDF), un SEGUNDO
widget adyacente (`a.*`, un <select> con 15 valores reales de duración 0.5–12.0) que
ocupa el mismo espacio visual y no tiene ninguna etiqueta propia ni script que lo
conecte al primero — visualmente en el PDF renderizado solo se ve UN valor ("0.5",
"2.0", etc.), lo que indica que es casi con toda certeza un artefacto de autoría del
PDF (un <select> agregado o dejado a medio configurar, superpuesto al campo de texto
real). Se captura `session_N_service_hours` (texto libre, más flexible para valores no
redondos) y se OMITE el <select> `a.*` — no se inventa una sincronización entre ambos
que field_scripts.json no evidencia, y capturar dos campos para un solo dato visual
sería peor que replicar fielmente el PDF real, que solo muestra un valor.

`Text11.*` (una línea en blanco junto al <select> de consejero, sin etiqueta impresa
visible en el PDF) se interpreta como "iniciales del consejero" — es una inferencia de
UI razonable a partir de la posición (misma fila que el nombre del consejero, mismo
patrón de "línea de firma" ya visto en los otros módulos donde SÍ hay campo AcroForm
real, a diferencia de las líneas de firma sin campo de otros módulos) — no es contenido
inventado (el campo real existe y se captura), solo la ETIQUETA es una decisión de UI
razonable ante la ausencia de texto impreso, documentada aquí explícitamente.

Corre: python3 build_activity_notes_12_schema.py > activity_notes_12.schema.json
"""
import json

FIELDS = []
PAGES = []
CONDITIONS = []

with open("../extracted/option_catalogs.json", "r", encoding="utf-8") as fh:
    _CATALOG = json.load(fh)["ActivityNotes12"]["lists"]


def _group_options(sample_field_name):
    """Busca el grupo de option_catalogs.json cuyo example_fields incluya
    sample_field_name, y devuelve su lista de opciones reales (limpias). A diferencia
    de treatment_plan/case_review (donde cada campo se busca por su nombre EXACTO),
    aquí varias filas comparten un mismo catálogo pero option_catalogs.json solo lista
    2-3 "example_fields" de muestra por grupo (no los ~6-16 campos reales completos) —
    se busca por UNA muestra conocida del grupo y esa misma lista de opciones se aplica
    a todos los campos reales de esa familia (confirmado por lectura visual + fields_count
    de cada grupo, ver docstring del módulo)."""
    for group in _CATALOG:
        if sample_field_name in group.get("example_fields", []):
            return [
                {"value": v.strip(), "labelEn": v.strip(), "labelEs": v.strip()}
                for v in group.get("options", [])
                if v and v.strip()
            ]
    raise KeyError(f"Ningún grupo de option_catalogs.json incluye '{sample_field_name}'")


PERIOD_OPTIONS = _group_options("Dropdown4.0.1.0")  # am/pm — 16 campos, mismo catálogo
COUNSELOR_OPTIONS = _group_options("Dropdown10.0")  # 8 campos, mismo catálogo
DEMOGRAPHIC_OPTIONS = _group_options("Dropdown7")  # 13 frases reales, 1 solo campo
TOPIC_OPTIONS = _group_options("Dropdown5.0.0")  # 6 campos, mismo catálogo
DATA_OPTIONS = _group_options("Dropdown6.0.0")  # "D:" — 6 campos
ASSESSMENT_OPTIONS = _group_options("Dropdown9.0.0")  # "A:" — 6 campos
PLAN_OPTIONS = _group_options("Dropdown3.0.0")  # "P:" — 6 campos


def add_field(key, ftype, en, es, options=None):
    f = {"key": key, "type": ftype, "labelEn": en, "labelEs": es}
    if options:
        f["options"] = options
    FIELDS.append(f)
    return key


def page(title_en, title_es, keys):
    PAGES.append({"title": {"en": title_en, "es": title_es}, "fields": keys})


def add_time_block(prefix, label_en, label_es, acro_date, acro_from, acro_from_period, acro_to, acro_to_period, acro_hours):
    """`prefix` es la key (snake_case, ej. "session_01"); `label_en`/`label_es` es el
    texto legible para el humano (ej. "Session 01" / "Sesión 01") — se mantienen
    separados a propósito para no filtrar keys internas a las etiquetas de la UI."""
    keys = []
    keys.append(add_field(f"{prefix}_date", "date", f"{label_en} — date", f"{label_es} — fecha"))
    keys.append(add_field(f"{prefix}_from_time", "text", f"{label_en} — from", f"{label_es} — desde"))
    keys.append(
        add_field(f"{prefix}_from_period", "select", f"{label_en} — from (am/pm)", f"{label_es} — desde (am/pm)", PERIOD_OPTIONS)
    )
    keys.append(add_field(f"{prefix}_to_time", "text", f"{label_en} — to", f"{label_es} — hasta"))
    keys.append(
        add_field(f"{prefix}_to_period", "select", f"{label_en} — to (am/pm)", f"{label_es} — hasta (am/pm)", PERIOD_OPTIONS)
    )
    keys.append(add_field(f"{prefix}_service_hours", "text", f"{label_en} — service time (hours)", f"{label_es} — tiempo de servicio (horas)"))
    return keys


def add_counselor_block(prefix, label_en, label_es):
    keys = []
    keys.append(
        add_field(f"{prefix}_counselor_name", "select", f"{label_en} — counselor", f"{label_es} — consejero", COUNSELOR_OPTIONS)
    )
    keys.append(add_field(f"{prefix}_counselor_initials", "text", f"{label_en} — counselor initials", f"{label_es} — iniciales del consejero"))
    return keys


# ============================================================================
# PÁGINA 1 — Encabezado + Admisión + Sesiones 01-04
# ============================================================================
p1 = []
p1.append(add_field("client_name", "text", "Client's name", "Nombre del cliente"))
p1.append(add_field("admission_date", "date", "Admission date", "Fecha de admisión"))
p1.append(add_field("hours_recommended", "text", "Hours of service recommended", "Horas de servicio recomendadas"))

# --- Fila de admisión ---
# Prefijo "admission_note" (no "admission") a propósito: el campo de encabezado
# "admission_date" (Text1.2.1, fecha en que el caso fue admitido al programa) y la
# fecha de ESTA fila (Text1.3.1.0, fecha en que se escribió la nota de admisión) son
# datos reales DISTINTOS del PDF — comparten prefijo casual pero no son el mismo dato,
# así que se evita la colisión de key con un prefijo más específico.
p1 += add_time_block(
    "admission_note", "Admission note", "Nota de admisión",
    "Text1.3.1.0", "b.0", "Dropdown4.0.0", "c.0", "Dropdown4.1.0", "Text5.0",
)
p1.append(
    add_field(
        "admission_demographic_summary",
        "select",
        "Admission note — demographic summary",
        "Nota de admisión — resumen demográfico",
        DEMOGRAPHIC_OPTIONS,
    )
)
p1.append(add_field("admission_note_text", "textarea", "Admission note", "Nota de admisión"))
p1 += add_counselor_block("admission_note", "Admission note", "Nota de admisión")

# --- Sesiones 01-04 (página 1) ---
SESSIONS_PAGE1 = [
    (1, "Text1.3.1.1.0", "b.1.0", "Dropdown4.0.1.0", "c.1.0", "Dropdown4.1.1.0", "Text5.1.0",
     "Dropdown5.0.0", "Dropdown6.0.0", "Dropdown9.0.0", "Dropdown3.0.0", "Dropdown10.1.0.0", "Text11.1.0.0"),
    (2, "Text1.3.1.1.1", "b.1.1", "Dropdown4.0.1.1", "c.1.1", "Dropdown4.1.1.1", "Text5.1.1",
     "Dropdown5.0.1", "Dropdown6.0.1", "Dropdown9.0.1", "Dropdown3.0.1", "Dropdown10.1.0.1", "Text11.1.0.1"),
    (3, "Text1.3.1.1.2", "b.1.2", "Dropdown4.0.1.2", "c.1.2", "Dropdown4.1.1.2", "Text5.1.2",
     "Dropdown5.0.2", "Dropdown6.0.2", "Dropdown9.0.2", "Dropdown3.0.2", "Dropdown10.1.0.2", "Text11.1.0.2"),
    (4, "Text1.3.1.1.3.0.0", "b.1.3.0.0", "Dropdown4.0.1.3.0.0", "c.1.3.0.0", "Dropdown4.1.1.3.0.0", "Text5.1.3.0.0",
     "Dropdown5.0.3.0", "Dropdown6.0.3.0", "Dropdown9.0.3.0", "Dropdown3.0.3.0", "Dropdown10.1.0.3.0.0", "Text11.1.0.3.0"),
]


def add_session_row(n, acro_date, acro_from, acro_from_p, acro_to, acro_to_p, acro_hours,
                     acro_topic, acro_data, acro_assessment, acro_plan, acro_counselor, acro_initials):
    prefix = f"session_{n:02d}"
    label_en, label_es = f"Session {n:02d}", f"Sesión {n:02d}"
    keys = add_time_block(prefix, label_en, label_es, acro_date, acro_from, acro_from_p, acro_to, acro_to_p, acro_hours)
    keys.append(add_field(f"{prefix}_topic", "select", f"{label_en} — Topic", f"{label_es} — Tema", TOPIC_OPTIONS))
    keys.append(add_field(f"{prefix}_data", "select", f"{label_en} — Data (D)", f"{label_es} — Datos (D)", DATA_OPTIONS))
    keys.append(
        add_field(f"{prefix}_assessment", "select", f"{label_en} — Assessment (A)", f"{label_es} — Evaluación (A)", ASSESSMENT_OPTIONS)
    )
    keys.append(add_field(f"{prefix}_plan", "select", f"{label_en} — Plan (P)", f"{label_es} — Plan (P)", PLAN_OPTIONS))
    keys += add_counselor_block(prefix, label_en, label_es)
    return keys


for row in SESSIONS_PAGE1:
    p1 += add_session_row(*row)

page("Early Intervention Program — Activity Notes (12 hrs) — page 1", "Programa de Intervención Temprana — Notas de actividad (12 hrs) — página 1", p1)


# ============================================================================
# PÁGINA 2 — Sesiones 05-06 + Nota de salida
# ============================================================================
p2 = []
SESSIONS_PAGE2 = [
    (5, "Text1.3.1.1.3.1.0", "b.1.3.1.0", "Dropdown4.0.1.3.1.0", "c.1.3.1.0", "Dropdown4.1.1.3.1.0", "Text5.1.3.1.0",
     "Dropdown5.0.3.1.0", "Dropdown6.0.3.1.0", "Dropdown9.0.3.1.0", "Dropdown3.0.3.1.0", "Dropdown10.1.0.3.0.1.0", "Text11.1.0.3.1.0"),
    (6, "Text1.3.1.1.3.1.1", "b.1.3.1.1", "Dropdown4.0.1.3.1.1", "c.1.3.1.1", "Dropdown4.1.1.3.1.1", "Text5.1.3.1.1",
     "Dropdown5.0.3.1.1", "Dropdown6.0.3.1.1", "Dropdown9.0.3.1.1", "Dropdown3.0.3.1.1", "Dropdown10.1.0.3.0.1.1", "Text11.1.0.3.1.1"),
]
for row in SESSIONS_PAGE2:
    p2 += add_session_row(*row)

# --- Fila de salida (Exit note) — misma forma que admisión ---
p2 += add_time_block(
    "exit", "Exit note", "Nota de salida",
    "Text1.3.1.1.3.0.1", "b.1.3.0.1", "Dropdown4.0.1.3.0.1", "c.1.3.0.1", "Dropdown4.1.1.3.0.1", "Text5.1.3.0.1",
)
p2.append(add_field("exit_note_text", "textarea", "Exit note", "Nota de salida"))
p2 += add_counselor_block("exit", "Exit note", "Nota de salida")

page("Early Intervention Program — Activity Notes (12 hrs) — page 2", "Programa de Intervención Temprana — Notas de actividad (12 hrs) — página 2", p2)


schema = {
    "key": "activity_notes_12",
    "version": 1,
    "titleEn": "Activity Notes — Early Intervention Program (12 hrs)",
    "titleEs": "Notas de Actividad — Programa de Intervención Temprana (12 hrs)",
    "fields": FIELDS,
    "pages": PAGES,
}
if CONDITIONS:
    schema["conditions"] = CONDITIONS

print(json.dumps(schema, indent=2, ensure_ascii=False))
