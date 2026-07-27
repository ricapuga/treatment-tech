#!/usr/bin/env python3
"""
Genera build-inputs/curated/assessment.schema.json — Biopsychosocial Assessment
(ASAM, 6 dimensiones), curado contra build-inputs/templates-r12/assessment.pdf
(12 páginas, ~360 campos reales del AcroForm original — ver
build-inputs/extracted/Assessment/fields.json + field_scripts.json +
build-inputs/extracted/option_catalogs.json["Assessment"]).

Mismo método que forms_1_7 (ver build_forms_1_7_schema.py): páginas renderizadas +
overlay de posición/nombre de cada widget + lectura visual de las 12 páginas +
field_scripts.json para la lógica real de mostrar/ocultar + option_catalogs.json para
las listas de opciones reales (no inventadas).

Simplificaciones DELIBERADAS frente al PDF original (documentadas, no encubiertas):
1. Los 4 patrones "¿Sí/No? -> tabla de episodios O UN SOLO campo N/A" (hospitalizaciones
   médicas, hospitalizaciones psiquiátricas, arrestos, tratamiento previo) en el PDF
   real tienen 3-4 campos "N/A" vacíos separados (uno por fila) cuando la respuesta es
   "No". Aquí se colapsan a UN solo campo de texto "no aplica / notas" por sección — no
   pierde contenido clínico real (los N/A del PDF no llevan información distinguible),
   solo reduce ruido de schema. Ver comentario en cada sección.
2. Algunas preguntas de opción múltiple del PDF (ej. Dropdown40 en Dimensión 4, "¿Tus
   amigos/familia son solidarios con tu tratamiento?") NO tienen su lista de opciones
   capturada en option_catalogs.json (posible bug de la extracción original, no de esta
   curación) — se dejan como `textarea` de texto libre en vez de inventar opciones que
   el PDF real no confirma. Mismo principio que "employment_describe" en forms_1_7.
3. Los encabezados de dimensión impresos en el PDF (páginas 1-12, ej. "DIMENSION 4 -
   Substance Use Related Risks") NO siempre coinciden con el prefijo interno de nombre
   de campo del AcroForm (ej. los campos de la página 7 usan el prefijo interno
   "DIM5RL" aunque la página está impresa como "DIMENSION 4"). Se usa el título IMPRESO
   como fuente de verdad para la agrupación por dimensión — es lo que ve el consejero,
   y coincide exactamente con la sección de "ASSESSMENT CONCLUSIONS" de la página 11
   (Dimensión 1 a 6 en el orden estándar ASAM).
4. La firma real (trazo) NO se captura aquí — igual que forms_1_7, este motor
   (SchemaForm) no implementa `signature_pad` todavía; solo se capturan nombre/fecha de
   consejero y médico como texto. Firma real es tarea aparte (blueprint, stack).
5. "ASAM Placement, 4th Edition" (página 12) se captura como dato del assessment, pero
   NO se conecta automáticamente a `cases.loi` — son conceptos distintos en el PDF
   real: `cases.loi` (RN-2) es la escala de riesgo DUI específica de Illinois
   ("Minimal Risk".."High Risk", ver loi.ts), mientras que "ASAM Placement" aquí es la
   escala estándar de nivel de cuidado ASAM (Level 1/2/3/4). No hay ningún trigger en
   field_scripts.json que los conecte — no se inventa esa automatización.
6. El campo "Counselor list 01" aparece en la página 1 Y la página 12 del PDF con el
   MISMO nombre de campo AcroForm → es el mismo campo (AcroForm sincroniza valores por
   nombre en todas las páginas donde aparece). Aquí se declara una sola vez
   (`counselor_name`, página 1) y no se repite — mismo principio de "no repetir
   captura" ya aplicado en forms_1_7.

Corre: python3 build_assessment_schema.py > assessment.schema.json
"""
import json

FIELDS = []
PAGES = []
CONDITIONS = []


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


def show_if(trigger_key, eq, keys):
    CONDITIONS.append({"if": trigger_key, "eq": eq, "show": keys})


def yn(value_en):
    return [
        {"value": "Yes", "labelEn": "Yes", "labelEs": "Sí"},
        {"value": "No", "labelEn": "No", "labelEs": "No"},
    ]


YN_OPTIONS = yn(None)

YN_UNSURE_OPTIONS = [
    {"value": "Yes", "labelEn": "Yes", "labelEs": "Sí"},
    {"value": "No", "labelEn": "No", "labelEs": "No"},
    {"value": "I'm not sure", "labelEn": "I'm not sure", "labelEs": "No estoy seguro"},
]

FREQ_OPTIONS = [
    {"value": "Never", "labelEn": "Never", "labelEs": "Nunca"},
    {"value": "Sometimes", "labelEn": "Sometimes", "labelEs": "A veces"},
    {"value": "Frequently", "labelEn": "Frequently", "labelEs": "Frecuentemente"},
]

SUBSTANCE_OPTIONS = [
    {"value": s, "labelEn": s, "labelEs": s}
    for s in [
        "Alcohol",
        "Marijuana",
        "Cocaine",
        "Opioids",
        "Hallucinogens",
        "Benzodiazepine",
        "Amphetamines",
        "Inhalants",
        "Other*",
    ]
]

COUNSELOR_OPTIONS = [
    {"value": "Maria I Torres, CADC", "labelEn": "Maria I Torres, CADC", "labelEs": "Maria I Torres, CADC"},
    {"value": "George Torres, BA, CADC", "labelEn": "George Torres, BA, CADC", "labelEs": "George Torres, BA, CADC"},
]

# 38 opciones reales, capturadas de option_catalogs.json["Assessment"] (grupo de 6
# campos "Diagnosis.*") — únicamente Alcohol/Cannabis/Cocaine/Opioid Use Disorder
# aparecen en el PDF real (no se inventan códigos DSM-5 de otras sustancias).
DSM5_DIAGNOSIS_OPTIONS = [
    {"value": v, "labelEn": v, "labelEs": v}
    for v in [
        "Z03.89 No Diagnosis",
        "F10.10 Alcohol Use Disorder, Mild",
        "F10.11 Alcohol Use Disorder, Mild in Early Remission",
        "F10.11 Alcohol Use Disorder, Mild in Sustained Remission",
        "F10.20 Alcohol Use Disorder, Moderate",
        "F10.21 Alcohol Use Disorder, Moderate in Early Remission",
        "F10.21 Alcohol Use Disorder, Moderate in Sustained Remission",
        "F10.20 Alcohol Use Disorder, Severe",
        "F10.21 Alcohol Use Disorder, Severe in Early Remission",
        "F10.21 Alcohol Use Disorder, Severe in Sustained Remission",
        "F12.10 Cannabis Use Disorder, Mild",
        "F12.11 Cannabis Use Disorder, Mild in Early Remission",
        "F12.11 Cannabis Use Disorder, Mild in Sustained Remission",
        "F12.20 Cannabis Use Disorder, Moderate",
        "F12.21 Cannabis Use Disorder, Moderate in Early Remission",
        "F12.21 Cannabis Use Disorder, Moderate in Sustained Remission",
        "F12.20 Cannabis Use Disorder, Severe",
        "F12.21 Cannabis Use Disorder, Severe in Early Remission",
        "F12.21 Cannabis Use Disorder, Severe in Sustained Remission",
        "F14.10 Cocaine Use Disorder, Mild",
        "F14.11 Cocaine Use Disorder, Mild in Early Remission",
        "F14.11 Cocaine Use Disorder, in Mild Sustained Remission",
        "F14.20 Cocaine Use Disorder, Moderate",
        "F14.21 Cocaine Use Disorder, Moderate in Early Remission",
        "F14.21 Cocaine Use Disorder, Moderate in Sustained Remission",
        "F14.20 Cocaine Use Disorder, Severe",
        "F14.21 Cocaine Use Disorder, Severe in Early Remission",
        "F14.21 Cocaine Use Disorder, Severe in Sustained Remission",
        "F11.10 Opioid Use Disorder, Mild",
        "F11.11 Opioid Use Disorder, Mild in Early Remission",
        "F11.11 Opioid Use Disorder, Mild in Sustained Remission",
        "F11.20 Opioid Use Disorder, Moderate",
        "F11.21 Opioid Use Disorder, Moderate in Early Remission",
        "F11.21 Opioid Use Disorder, Moderate in Sustained Remission",
        "F11.20 Opioid Use Disorder, Severe",
        "F11.21 Opioid Use Disorder, Severe in Early Remission",
        "F11.21 Opioid Use Disorder, Severe in Sustained Remission",
    ]
]

ASAM_PLACEMENT_OPTIONS = [
    {"value": v, "labelEn": v, "labelEs": v}
    for v in [
        "Recovery Residence - RR Recovery Residence",
        "Level 1- Outpatient Services",
        "Level 1- Outpatient Services / 1.0- Long-Term Remission Monitoring",
        "Level 1- Outpatient Services / 1.5- Outpatient Therapy",
        "Level 1- Outpatient Services / 1.7- Medically Managed Outpatient",
        "Level 2- IOP/HIOP",
        "Level 2- IOP/HIOP / Level 2.1- Intensive Outpatient (IOP)",
        "Level 2- IOP/HIOP / Level 2.5- High-Intensive Outpatient (HIOP)",
        "Level 2- IOP/HIOP / Level 2.7- Medically Managed Intensive Outpatient",
        "Level 3- Residential",
        "Level 3- Residential / 3.1- Clinically Managed Low-Intensity Residential",
        "Level 3- Residential / 3.5- Clinically Managed High-Intensity Residential",
        "Level 3- Residential / 3.7- Medically Managed Residential",
        "Level 4-Inpatient",
        "Level 4-Inpatient / 4-Medically Managed Inpatient",
    ]
]

# ============================================================================
# PÁGINA 1 — Encabezado + Dimensión 1a: Historial de sustancias
# ============================================================================
p1 = []
p1.append(add_field("client_name", "text", "Client's name", "Nombre del cliente"))
p1.append(add_field("assessment_date", "date", "Date", "Fecha"))
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
            f"dim1_substance_{i}_name",
            "select",
            f"Substance {i}",
            f"Sustancia {i}",
            SUBSTANCE_OPTIONS,
        )
    )
    p1.append(add_field(f"dim1_substance_{i}_first_use", "text", "First use (date & amount)", "Primer uso (fecha y cantidad)"))
    p1.append(add_field(f"dim1_substance_{i}_last_use", "text", "Last use (date & amount)", "Último uso (fecha y cantidad)"))
    p1.append(add_field(f"dim1_substance_{i}_frequency", "text", "Frequency and quantity (last 12 months)", "Frecuencia y cantidad (últimos 12 meses)"))
    p1.append(add_field(f"dim1_substance_{i}_route", "text", "Route of administration", "Vía de administración"))

p1.append(add_field("dim1_describe_other", "text", "*Describe other", "*Describa otra sustancia"))

page(
    "Dimension 1 — Substance Use History",
    "Dimensión 1 — Historial de sustancias",
    p1,
)

# ============================================================================
# PÁGINA 2 — Dimensión 1b: Criterios DSM-5
# ============================================================================
p2 = []
for col in range(1, 5):
    p2.append(
        add_field(
            f"dim1_dsm5_column_{col}_substance",
            "select",
            f"Substance column {col}",
            f"Columna de sustancia {col}",
            SUBSTANCE_OPTIONS,
        )
    )

DSM5_FREQ_CRITERIA = [
    ("larger_amounts", "Substance is often taken in larger amounts or over a longer period than was intended.", "La sustancia se toma frecuentemente en mayores cantidades o por más tiempo del que se pretendía."),
    ("persistent_desire", "There is a persistent desire or unsuccessful efforts to cut down or control substance use.", "Hay un deseo persistente o esfuerzos fallidos por reducir o controlar el uso de la sustancia."),
    ("time_spent", "A great deal of time is spent in activities necessary to obtain the substance, use the substance, or recover from its effects.", "Se dedica mucho tiempo a actividades necesarias para obtener la sustancia, usarla o recuperarse de sus efectos."),
    ("craving", "Craving, or a strong desire or urge to use the substance.", "Ansias, o un fuerte deseo o urgencia de usar la sustancia."),
    ("failure_role", "Recurrent substance use resulting in a failure to fulfill major role obligations at work, school, or home.", "Uso recurrente de la sustancia que resulta en el incumplimiento de obligaciones importantes en el trabajo, la escuela o el hogar."),
    ("continued_social", "Continued substance use despite having persistent or recurrent social or interpersonal problems caused or exacerbated by the effects of substance.", "Uso continuo de la sustancia a pesar de tener problemas sociales o interpersonales persistentes o recurrentes causados o agravados por sus efectos."),
    ("activities_given_up", "Important social, occupational, or recreational activities are given up or reduced because of the substance use.", "Se abandonan o reducen actividades sociales, laborales o recreativas importantes debido al uso de la sustancia."),
    ("hazardous_use", "Recurrent substance use in situations in which it is physically hazardous.", "Uso recurrente de la sustancia en situaciones donde es físicamente peligroso."),
    ("continued_physical", "Substance use is continued despite knowledge of having a persistent or recurrent physical or psychological problem that is likely to have been caused or exacerbated by the substance.", "Se continúa usando la sustancia a pesar de saber que se tiene un problema físico o psicológico persistente o recurrente probablemente causado o agravado por ella."),
]
for key, en, es in DSM5_FREQ_CRITERIA:
    for col in range(1, 5):
        p2.append(
            add_field(
                f"dim1_dsm5_{key}_{col}",
                "select",
                en,
                es,
                FREQ_OPTIONS,
            )
        )

DSM5_YN_CRITERIA = [
    ("tolerance", "Tolerance: Individual requires increasingly higher doses of the substance to achieve the desired effect, or the usual dose has a reduced effect.", "Tolerancia: la persona requiere dosis cada vez más altas de la sustancia para lograr el efecto deseado, o la dosis habitual tiene un efecto reducido."),
    ("withdrawal", "Withdrawal: A collection of signs and symptoms that occurs when blood and tissue levels of the substance decrease. Individuals are likely to seek the substance to relieve symptoms.", "Abstinencia: conjunto de signos y síntomas que ocurre cuando disminuyen los niveles de la sustancia en sangre y tejidos. La persona tiende a buscar la sustancia para aliviar los síntomas."),
]
for key, en, es in DSM5_YN_CRITERIA:
    for col in range(1, 5):
        p2.append(
            add_field(
                f"dim1_dsm5_{key}_{col}",
                "select",
                en,
                es,
                YN_UNSURE_OPTIONS,
            )
        )

p2.append(
    add_field(
        "dim1_summary_flag",
        "select",
        "Dimension 1 summary",
        "Resumen Dimensión 1",
        [
            {
                "value": "The Patient presents no signs of intoxication or withdrawals",
                "labelEn": "The Patient presents no signs of intoxication or withdrawals",
                "labelEs": "El paciente no presenta signos de intoxicación o abstinencia",
            }
        ],
    )
)
p2.append(add_field("dim1_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 1 — DSM-5 Criteria", "Dimensión 1 — Criterios DSM-5", p2)

# ============================================================================
# PÁGINA 3 — Dimensión 2a: Condiciones biomédicas (hospitalizaciones)
# ============================================================================
p3 = []
p3.append(
    add_field(
        "dim2_hospitalizations_yn",
        "select",
        "Medical hospitalizations or significant medical encounters",
        "Hospitalizaciones médicas o encuentros médicos significativos",
        YN_OPTIONS,
    )
)
# Simplificación #1 (ver encabezado del archivo): un solo campo "no aplica" en vez de
# 3 casillas N/A vacías separadas.
na1 = add_field("dim2_hospitalizations_na", "text", "N/A — no significant medical encounters", "No aplica — sin encuentros médicos significativos")
p3.append(na1)
show_if("dim2_hospitalizations_yn", "No", [na1])

episode_keys = []
for i in range(1, 4):
    d = add_field(f"dim2_episode_{i}_date", "text", f"Episode {i} date", f"Episodio {i} — fecha")
    fac = add_field(f"dim2_episode_{i}_facility", "text", "Facility", "Institución")
    cond = add_field(f"dim2_episode_{i}_condition", "text", "Condition(s) treated", "Condición(es) tratada(s)")
    med = add_field(f"dim2_episode_{i}_medications", "text", "Medications and dose", "Medicamentos y dosis")
    stat = add_field(f"dim2_episode_{i}_status", "text", "Status", "Estado")
    episode_keys += [d, fac, cond, med, stat]
p3 += episode_keys
show_if("dim2_hospitalizations_yn", "Yes", episode_keys)

p3.append(add_field("dim2_under_medical_care", "textarea", "Are you currently under the care of a medical doctor?", "¿Actualmente está bajo el cuidado de un médico?"))
p3.append(add_field("dim2_referral_requested", "textarea", "Would you like to be referred to a physician?", "¿Le gustaría que lo refieran a un médico?"))
p3.append(add_field("dim2_taking_medications", "textarea", "Are you taking medications?", "¿Está tomando medicamentos?"))

MEDICAL_CONDITIONS = [
    ("disabilities", "Disabilities", "Discapacidades"),
    ("pregnant", "Pregnant", "Embarazo"),
    ("high_blood_pressure", "High blood pressure", "Presión arterial alta"),
    ("liver_disease", "Liver disease", "Enfermedad hepática"),
    ("allergies", "Allergies", "Alergias"),
    ("diabetes", "Diabetes", "Diabetes"),
    ("ulcers", "Ulcers", "Úlceras"),
    ("chest_pain", "Chest pain", "Dolor en el pecho"),
    ("heart_disease", "Heart disease", "Enfermedad cardíaca"),
    ("other_condition", "Other", "Otra condición"),
]
for key, en, es in MEDICAL_CONDITIONS:
    yn_key = add_field(f"dim2_condition_{key}_yn", "select", en, es, YN_OPTIONS)
    explain_key = add_field(f"dim2_condition_{key}_explain", "text", "If yes, explain", "Si es sí, explique")
    p3 += [yn_key, explain_key]

page("Dimension 2 — Biomedical Conditions (Hospitalizations)", "Dimensión 2 — Condiciones biomédicas (hospitalizaciones)", p3)

# ============================================================================
# PÁGINA 4 — Dimensión 2b: ETS y tuberculosis
# ============================================================================
p4 = []
p4.append(add_field("dim2_last_physical_exam_date", "text", "Date of the last physical exam?", "¿Fecha del último examen físico?"))
p4.append(add_field("dim2_last_physical_exam_reasons", "text", "Reasons or conditions treated", "Motivos o condiciones tratadas"))
p4.append(add_field("dim2_provider_clinic_name", "text", "Provider/Clinic name", "Nombre del proveedor/clínica"))

STD_QUESTIONS = [
    ("unprotected_sex", "Have you ever had sex without protection?", "¿Alguna vez ha tenido relaciones sexuales sin protección?"),
    ("blood_transfusion", "Have you ever had a blood transfusion?", "¿Alguna vez ha recibido una transfusión de sangre?"),
    ("current_std", "Do you currently have any STD?", "¿Actualmente tiene alguna ETS?"),
    ("hepatitis_jaundice", "Have you ever had yellow jaundice/hepatitis?", "¿Alguna vez ha tenido ictericia/hepatitis?"),
    ("share_needles", "Do you ever share needles/works?", "¿Alguna vez comparte agujas/equipo de inyección?"),
    ("std_history", "Do you have history of any STD?", "¿Tiene historial de alguna ETS?"),
]
for key, en, es in STD_QUESTIONS:
    yn_key = add_field(f"dim2_{key}_yn", "select", en, es, YN_OPTIONS)
    explain_key = add_field(f"dim2_{key}_explain", "text", "If yes, explain", "Si es sí, explique")
    p4 += [yn_key, explain_key]

TB_QUESTIONS = [
    ("tb_positive", "Have you ever been tested positive for TB?", "¿Alguna vez ha dado positivo en una prueba de tuberculosis?"),
    ("cough_blood", "Do you have cough up blood?", "¿Ha tosido con sangre?"),
    ("last_tb_test_date", "Date of the last TB test?", "¿Fecha de la última prueba de tuberculosis?"),
    ("previous_infectious_treatment", "Previous treatments for infectious diseases?", "¿Tratamientos previos por enfermedades infecciosas?"),
    ("recent_medical_complications", "In the last 12 months have you experienced any serious medical complications?", "¿En los últimos 12 meses ha tenido alguna complicación médica seria?"),
]
for key, en, es in TB_QUESTIONS:
    yn_key = add_field(f"dim2_{key}_yn", "select", en, es, YN_OPTIONS)
    explain_key = add_field(f"dim2_{key}_explain", "text", "If yes, explain", "Si es sí, explique")
    p4 += [yn_key, explain_key]

p4.append(
    add_field(
        "dim2_summary_flag",
        "select",
        "Dimension 2 summary",
        "Resumen Dimensión 2",
        [
            {
                "value": "The Patient reported no biomedical issues or conditions.",
                "labelEn": "The Patient reported no biomedical issues or conditions.",
                "labelEs": "El paciente no reportó problemas o condiciones biomédicas.",
            }
        ],
    )
)
p4.append(add_field("dim2_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 2 — STDs and Tuberculosis", "Dimensión 2 — ETS y tuberculosis", p4)

# ============================================================================
# PÁGINA 5 — Dimensión 3a: Condiciones psiquiátricas y cognitivas
# ============================================================================
p5 = []
for key, en, es in [
    ("sexual_assault", "Have you ever been sexually assaulted?", "¿Alguna vez ha sido agredido sexualmente?"),
    ("physical_abuse", "Have you ever been physically abused?", "¿Alguna vez ha sido abusado físicamente?"),
]:
    yn_key = add_field(f"dim3_{key}_yn", "select", en, es, YN_OPTIONS)
    explain_key = add_field(f"dim3_{key}_explain", "text", "If yes, explain", "Si es sí, explique")
    p5 += [yn_key, explain_key]

CLINICAL_DISORDERS = [
    ("depression", "Depression", "Depresión"),
    ("sleep_disturbance", "Sleep disturbance", "Alteración del sueño"),
    ("isolation", "Isolation", "Aislamiento"),
    ("anhedonia", "Anhedonia", "Anhedonia"),
    ("hallucinations", "Hallucinations", "Alucinaciones"),
    ("mood_swings", "Mood swings", "Cambios de humor"),
    ("anxiety", "Anxiety", "Ansiedad"),
    ("paranoia", "Paranoia", "Paranoia"),
    ("violent_thoughts", "Violent thoughts", "Pensamientos violentos"),
    ("mental_confusion", "Mental confusion", "Confusión mental"),
    ("sexual_activity_changes", "Changes in sexual activity", "Cambios en la actividad sexual"),
    ("suicidal_homicidal_thoughts", "Suicidal or Homicidal thoughts", "Pensamientos suicidas u homicidas"),
]
for key, en, es in CLINICAL_DISORDERS:
    presence = add_field(f"dim3_disorder_{key}_yn", "select", en, es, YN_OPTIONS)
    history = add_field(f"dim3_disorder_{key}_history_explain", "text", "History of (explain)", "Historial (explique)")
    current = add_field(f"dim3_disorder_{key}_current_explain", "text", "Currently present (explain)", "Actualmente presente (explique)")
    during = add_field(f"dim3_disorder_{key}_during_use", "select", "During use", "Durante el uso", YN_OPTIONS)
    after = add_field(f"dim3_disorder_{key}_after_use", "select", "After use", "Después del uso", YN_OPTIONS)
    p5 += [presence, history, current, during, after]

page("Dimension 3 — Psychiatric and Cognitive Conditions", "Dimensión 3 — Condiciones psiquiátricas y cognitivas", p5)

# ============================================================================
# PÁGINA 6 — Dimensión 3b: continuación (hospitalizaciones psiquiátricas, arrestos)
# ============================================================================
p6 = []
p6.append(add_field("dim3_use_affects_conditions_yn", "select", "Does the use of alcohol or drugs improve or worsen any of the above conditions?", "¿El uso de alcohol o drogas mejora o empeora alguna de las condiciones anteriores?", YN_OPTIONS))
p6.append(add_field("dim3_use_affects_conditions_explain", "text", "Explain", "Explique"))

p6.append(add_field("dim3_psychiatric_treatment_yn", "select", "Psychiatric hospitalizations or Outpatient Treatment?", "¿Hospitalizaciones psiquiátricas o tratamiento ambulatorio?", YN_OPTIONS))
p6.append(add_field("dim3_psychiatric_treatment_explain", "text", "Explain", "Explique"))

na2 = add_field("dim3_psychiatric_na", "text", "N/A — no psychiatric hospitalizations", "No aplica — sin hospitalizaciones psiquiátricas")
p6.append(na2)
show_if("dim3_psychiatric_treatment_yn", "No", [na2])

psych_episode_keys = []
for i in range(1, 5):
    d = add_field(f"dim3_psych_episode_{i}_date", "text", f"Episode {i} date", f"Episodio {i} — fecha")
    fac = add_field(f"dim3_psych_episode_{i}_facility", "text", "Facility", "Institución")
    cond = add_field(f"dim3_psych_episode_{i}_condition", "text", "Condition(s) treated", "Condición(es) tratada(s)")
    med = add_field(f"dim3_psych_episode_{i}_medications", "text", "Medications and dose", "Medicamentos y dosis")
    stat = add_field(f"dim3_psych_episode_{i}_status", "text", "Status", "Estado")
    psych_episode_keys += [d, fac, cond, med, stat]
p6 += psych_episode_keys
show_if("dim3_psychiatric_treatment_yn", "Yes", psych_episode_keys)

p6.append(add_field("dim3_arrests_yn", "select", "Alcohol/drug-related arrests, including felonies, misdemeanors, petty offenses, and local ordinances", "Arrestos relacionados con alcohol/drogas, incluyendo delitos graves, menores, infracciones y ordenanzas locales", YN_OPTIONS))

na3 = add_field("dim3_arrests_na", "text", "N/A — no alcohol/drug-related arrests", "No aplica — sin arrestos relacionados con alcohol/drogas")
p6.append(na3)
show_if("dim3_arrests_yn", "No", [na3])

arrest_keys = []
for i in range(1, 5):
    d = add_field(f"dim3_arrest_case_{i}_date", "text", f"Case {i} date", f"Caso {i} — fecha")
    off = add_field(f"dim3_arrest_case_{i}_offense_type", "text", "Type of offense", "Tipo de delito")
    disp = add_field(f"dim3_arrest_case_{i}_court_disposition", "text", "Court disposition", "Disposición judicial")
    pending = add_field(f"dim3_arrest_case_{i}_court_pending", "text", "Court pending?", "¿Caso pendiente en corte?")
    stat = add_field(f"dim3_arrest_case_{i}_status", "text", "Status", "Estado")
    arrest_keys += [d, off, disp, pending, stat]
p6 += arrest_keys
show_if("dim3_arrests_yn", "Yes", arrest_keys)

p6.append(
    add_field(
        "dim3_summary_flag",
        "select",
        "Dimension 3 summary",
        "Resumen Dimensión 3",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "He appears emotionally and behaviorally stable.",
                "The Patient has a history of a violent temper that has created difficulties in life.",
                "The Patient struggles with self-forgiveness because his relationship with his son was affected by his substance use.",
                "The Patient developed an abusive drinking/using pattern, which resulted in a DUI arrest.",
            ]
        ],
    )
)
p6.append(add_field("dim3_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 3 — Psychiatric Hospitalizations and Legal History", "Dimensión 3 — Hospitalizaciones psiquiátricas e historial legal", p6)

# ============================================================================
# PÁGINA 7 — Dimensión 4: Riesgos relacionados al uso de sustancias
# ============================================================================
p7 = []
p7.append(add_field("dim4_prior_treatment_yn", "select", "Have you had treatment for an alcohol or drug problem?", "¿Ha recibido tratamiento por un problema de alcohol o drogas?", YN_OPTIONS))
p7.append(add_field("dim4_prior_treatment_explain", "text", "Explain", "Explique"))

na4 = add_field("dim4_treatment_na", "text", "N/A — no prior treatment", "No aplica — sin tratamiento previo")
p7.append(na4)
show_if("dim4_prior_treatment_yn", "No", [na4])

treatment_episode_keys = []
for i in range(1, 5):
    d = add_field(f"dim4_treatment_episode_{i}_date", "text", f"Episode {i} date", f"Episodio {i} — fecha")
    fac = add_field(f"dim4_treatment_episode_{i}_facility", "text", "Facility", "Institución")
    loc = add_field(f"dim4_treatment_episode_{i}_level_of_care", "text", "Level of Care", "Nivel de cuidado")
    out = add_field(f"dim4_treatment_episode_{i}_outcome", "text", "Treatment outcome", "Resultado del tratamiento")
    stat = add_field(f"dim4_treatment_episode_{i}_status", "text", "Status", "Estado")
    treatment_episode_keys += [d, fac, loc, out, stat]
p7 += treatment_episode_keys
show_if("dim4_prior_treatment_yn", "Yes", treatment_episode_keys)

p7.append(
    add_field(
        "dim4_relapse_environment_risk",
        "select",
        "Can you live in your current environment without risk of relapse/continued use potential?",
        "¿Puede vivir en su entorno actual sin riesgo de recaída o uso continuado?",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "Yes, I can.",
                "My co-workers have substance abuse problems.",
                "No, my social environment is drug-infested and very harmful.",
                "My family members abuse alcohol/drugs.",
            ]
        ],
    )
)
p7.append(
    add_field(
        "dim4_cravings",
        "select",
        "Are you experiencing strong desires or cravings to drink or use?",
        "¿Está experimentando fuertes deseos o ansias de beber o usar?",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "No",
                "No, I am not.",
                "Yes, I am experiencing desires or cravings to drink or use.",
            ]
        ],
    )
)
p7.append(
    add_field(
        "dim4_resist_urges",
        "select",
        "What do you do to resist urges to drink or to use?",
        "¿Qué hace para resistir las ganas de beber o usar?",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "I do not know.",
                "I have no cravings.",
                "I talk to my sponsor.",
                "I talk to my spouse.",
                "I pray and attend church.",
                "I attend the close support meeting",
                "I go to places to distract myself.",
            ]
        ],
    )
)
p7.append(
    add_field(
        "dim4_relapse_trigger",
        "select",
        "What could be a reason for you to drink or use again?",
        "¿Qué podría ser una razón para volver a beber o usar?",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "If I go back to my old drinking/using friends.",
                "If I got too angry, lonely, tired, and hungry.",
                "If I visit bars or drinking establishments.",
                "If I stop paying attention to my emotions.",
                "If I stop attending my support group.",
            ]
        ],
    )
)
# Simplificación #2 (ver encabezado del archivo): sin lista de opciones confirmada en
# option_catalogs.json para este campo (Dropdown40) — texto libre en vez de inventar.
p7.append(add_field("dim4_support_network", "textarea", "Are your friends, family, work or schoolmates supportive of your treatment and/or recovery?", "¿Sus amigos, familia, trabajo o compañeros de escuela apoyan su tratamiento y/o recuperación?"))
p7.append(add_field("dim4_longest_abstinence", "text", "What has been your longest period of abstinence within the last year?", "¿Cuál ha sido su período más largo de abstinencia en el último año?"))

p7.append(
    add_field(
        "dim4_summary_flag",
        "select",
        "Dimension 4 summary",
        "Resumen Dimensión 4",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "The Patient seems to have the skills and a social and family environment to maintain abstinence.",
                "The Patient has been unable to interrupt alcohol and drug use, and attempts to control have been unsuccessful.",
                "The Patient is currently at high risk for relapsing due to poor coping skills and a limited support system.",
                "The Patient is currently at high risk for relapsing due to euphoric/romantic associations with alcohol and drugs.",
                "The Patient's previous attempt at recovery was partial and unsuccessful.",
                "The Patient was unable to interrupt alcohol and drug use.",
                "The Patient is exposed to triggers and situations that risk sobriety.",
                "The Patient is currently at high risk for relapsing because of a lack of awareness of the consequences.",
                "The Patient has a history of multiple treatment attempts and relapse.",
                "Interpersonal conflicts place the Patient at high risk for relapsing.",
            ]
        ],
    )
)
p7.append(add_field("dim4_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 4 — Substance Use Related Risks", "Dimensión 4 — Riesgos relacionados al uso de sustancias", p7)

# ============================================================================
# PÁGINAS 8-9 — Dimensión 5: Interacciones con el entorno de recuperación
# ============================================================================
p8 = []
DIM5_QUESTIONS_A = [
    ("marital_status", "Marital status?", "¿Estado civil?"),
    ("household_members", "Whom do you currently reside with?", "¿Con quién reside actualmente?"),
    ("divorced", "Have you ever been divorced?", "¿Alguna vez se ha divorciado?"),
    ("employed", "Are you currently employed?", "¿Está actualmente empleado?"),
    ("intimate_relationship", "Are you currently involved in an intimate relationship?", "¿Está actualmente en una relación de pareja?"),
    ("family_problems", "Are you having problems with your immediate or extended family?", "¿Tiene problemas con su familia inmediata o extendida?"),
    ("family_substance_history", "Is there history of alcohol or drugs use/abuse in your family?", "¿Hay historial de uso/abuso de alcohol o drogas en su familia?"),
    ("spouse_supportive", "Will your spouse/partner be supportive of treatment?", "¿Su cónyuge/pareja apoyará el tratamiento?"),
    ("spouse_family_sessions", "Will spouse/partner be willing to participate in family sessions?", "¿Su cónyuge/pareja estará dispuesto a participar en sesiones familiares?"),
    ("parents_supportive", "Will your parents be supportive of treatment?", "¿Sus padres apoyarán el tratamiento?"),
    ("dcfs_involvement", "Are you or your partner involved with DCFS?", "¿Usted o su pareja tienen algún caso con DCFS?"),
]
for key, en, es in DIM5_QUESTIONS_A:
    p8.append(add_field(f"dim5_{key}", "textarea", en, es))

page("Dimension 5 — Recovery Environment Interactions (I)", "Dimensión 5 — Interacciones con el entorno de recuperación (I)", p8)

p9 = []
DIM5_QUESTIONS_B = [
    ("friends_substance_problems", "Do your friends/coworkers have substance abuse problems?", "¿Sus amigos/compañeros de trabajo tienen problemas de abuso de sustancias?"),
    ("environment_supportive", "Is your current environment supporting your efforts to abstain from substances or to reduce the risk of abusing substances?", "¿Su entorno actual apoya sus esfuerzos por abstenerse de sustancias o reducir el riesgo de abuso?"),
    ("military_service", "Military service history?", "¿Historial de servicio militar?"),
    ("childcare_needs", "Childcare needs?", "¿Necesidades de cuidado infantil?"),
    ("parents_living", "Are your parents living?", "¿Sus padres viven?"),
    ("live_without_relapse_risk", "Can you live in your current environment without risk of continued/use potential?", "¿Puede vivir en su entorno actual sin riesgo de uso continuado?"),
    ("spiritual_beliefs", "Explain your spiritual beliefs and practices", "Explique sus creencias y prácticas espirituales"),
    ("fun_activities", "What do you do for fun?", "¿Qué hace para divertirse?"),
    ("financial_situation", "Describe your financial situation:", "Describa su situación financiera:"),
    ("social_peer_group", "Describe your current social or peer group:", "Describa su grupo social o de pares actual:"),
]
for key, en, es in DIM5_QUESTIONS_B:
    p9.append(add_field(f"dim5_{key}", "textarea", en, es))

p9.append(
    add_field(
        "dim5_summary_flag",
        "select",
        "Dimension 5 summary",
        "Resumen Dimensión 5",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "Patient is married and lives with his family. He is unemployed and does not have adequate social support system.",
                "Patient is married and lives with her family. She is unemployed and does not have adequate social support system.",
                "Patient lives in an environment in which there is a high risk for relapse.",
                "Patient lives with his father. He lacks a structured support system, and his social environment interferes with treatment.",
            ]
        ],
    )
)
p9.append(add_field("dim5_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 5 — Recovery Environment Interactions (II)", "Dimensión 5 — Interacciones con el entorno de recuperación (II)", p9)

# ============================================================================
# PÁGINA 10 — Dimensión 6: Consideraciones centradas en la persona
# ============================================================================
p10 = []
p10.append(add_field("dim6_why_here", "select", "Why are you here?", "¿Por qué está aquí?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "Court orders", "By myself", "Because I need it",
        "My lawyer recommended I participate in a Substance Abuse Program.",
    ]
]))
p10.append(add_field("dim6_need_treatment", "select", "Do you feel you need treatment or intervention?", "¿Siente que necesita tratamiento o intervención?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "Yes, I need treatment to help me to improve my life.", "No, I do not think so.",
        "Yes, I need help.", "I want to follow the court orders.", "I am still determining.",
    ]
]))
p10.append(add_field("dim6_use_affected_life", "select", "Do you think your alcohol or drug use has affected your life?", "¿Cree que su consumo de alcohol o drogas ha afectado su vida?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "Yes, because I have had problems due to my drinking/using.",
        "No. I never had an alcohol/drug-related problem.",
        "Yes, that's why I am here.",
        "Yes. I have had family and legal problems as a result of my drinking/using.",
    ]
]))
p10.append(add_field("dim6_harmed_self_others", "select", "In what ways do you think your alcohol or drug use has harmed you or other people?", "¿De qué manera cree que su consumo de alcohol o drogas lo ha dañado a usted o a otras personas?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "My parents are worried and complain because of my alcohol and drug use.",
        "My wife is concerned and complains because of my alcohol and drug use.",
        "This whole thing is affecting me and my family financially and emotionally.",
        "No, neither myself nor my family has been affected in any way.",
        "I have had financial problems, and my family complains.",
        "I and my family have not been affected in any way.",
    ]
]))
p10.append(add_field("dim6_problem_for_you", "select", "In what ways has this been a problem for you?", "¿De qué manera esto ha sido un problema para usted?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I have had financial and job problems.",
        "I do not like to see my family hurting.",
        "It has not been a problem.",
        "My relationship with my wife has been affected.",
        "My life has been affected in many ways: legally, financially, job, family, etc.",
        "I am dealing with a lot of stress and anxiety.",
    ]
]))
p10.append(add_field("dim6_use_stopped_goals", "select", "How has your alcohol or drug use stopped you from doing what you want to do?", "¿Cómo le ha impedido su consumo de alcohol o drogas hacer lo que quiere hacer?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I do not think my drinking/using has stopped me from what I wanted to do.",
        "I lost job opportunities.",
        "Vocationally, financially, loss of job opportunities, etc.",
        "I could have improved my education.",
        "I lost my driving privileges; I lost job opportunities.",
    ]
]))
p10.append(add_field("dim6_need_to_change", "select", "What makes you think that you need to make a change?", "¿Qué le hace pensar que necesita hacer un cambio?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I do not think I need to make a change.",
        "If I do not change, I will have more problems.",
        "I need to change because my family deserves it.",
        "If I change, I can solve many problems.",
        "I need to change to improve the quality of my family life.",
        "Change is not just for me, but for the well-being of my family.",
        "My family deserves a better life, and I am ready to make the necessary changes.",
        "The ultimate goal of change is to enhance the quality of life for my family.",
    ]
]))
p10.append(add_field("dim6_changed_habits_before", "select", "Have you ever changed your drinking/using habits in the past (either cut down or quit)?", "¿Alguna vez ha cambiado sus hábitos de consumo en el pasado (ya sea reducir o dejar de usar)?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "Yes, I stopped drinking/using. I am been abstinent from alcohol and drugs.",
        "Yes, I cut down on my drinking/using.",
        "No, I haven't.",
        "I quit several times in the past.",
    ]
]))
p10.append(add_field("dim6_what_to_modify", "select", "What do you need to modify to change your drinking or using habits?", "¿Qué necesita modificar para cambiar sus hábitos de consumo?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I need to stop visiting places where alcohol or drugs are available.",
        "I need to stop hanging around with my drinking and using peers.",
        "I do not need to make any changes.",
        "I need to set safe limits on my drinking and using.",
        "I need to change my social environment.",
        "I need to learn how to use alcohol responsibly.",
    ]
]))
p10.append(add_field("dim6_consequences_no_change", "select", "What do you think will happen if you don't make a change?", "¿Qué cree que pasará si no hace un cambio?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I will not have problems.", "I may have more problems.",
        "I could have legal and family problems.", "I see no possible consequences.",
    ]
]))
p10.append(add_field("dim6_benefits_of_change", "select", "What could be the benefits of stopping drinking or using?", "¿Cuáles podrían ser los beneficios de dejar de beber o usar?", [
    {"value": v, "labelEn": v, "labelEs": v} for v in [
        "I will save problems.", "I see no benefits.", "My family will be happier.",
    ]
]))

p10.append(
    add_field(
        "dim6_summary_flag",
        "select",
        "Dimension 6 summary",
        "Resumen Dimensión 6",
        [
            {"value": v, "labelEn": v, "labelEs": v}
            for v in [
                "The Patient seems to be in the pre-contemplation stage.",
                "The Patient seems to be in the contemplation stage.",
                "The Patient seems to be in the preparation stage.",
                "The Patient seems to be in the action stage.",
                "The Patient seems to be in the maintenance stage.",
            ]
        ],
    )
)
p10.append(add_field("dim6_summary_notes", "textarea", "Summary notes", "Notas de resumen"))

page("Dimension 6 — Person-Centered Considerations", "Dimensión 6 — Consideraciones centradas en la persona", p10)

# ============================================================================
# PÁGINA 11 — Conclusiones de la evaluación
# ============================================================================
p11 = []
CONCLUSION_DIMS = [
    ("dim1", "Dimension 1 — Intoxication, Withdrawal, and Addiction Medications", "Dimensión 1 — Intoxicación, abstinencia y medicamentos de adicción"),
    ("dim2", "Dimension 2 — Biomedical Conditions", "Dimensión 2 — Condiciones biomédicas"),
    ("dim3", "Dimension 3 — Psychiatric and Cognitive Conditions", "Dimensión 3 — Condiciones psiquiátricas y cognitivas"),
    ("dim4", "Dimension 4 — Substance Use-Related Risks", "Dimensión 4 — Riesgos relacionados al uso de sustancias"),
    ("dim5", "Dimension 5 — Recovery Environment Interactions", "Dimensión 5 — Interacciones con el entorno de recuperación"),
    ("dim6", "Dimension 6 — Person-Centered Considerations", "Dimensión 6 — Consideraciones centradas en la persona"),
]
for key, en, es in CONCLUSION_DIMS:
    yn_key = add_field(f"conclusion_{key}_problem_identified", "select", f"{en} — Problem identified?", f"{es} — ¿Problema identificado?", YN_OPTIONS)
    notes_key = add_field(f"conclusion_{key}_summary", "textarea", "Summarize any problems identified, if applies", "Resuma los problemas identificados, si aplica")
    p11 += [yn_key, notes_key]

p11.append(add_field("physician_review_needed", "select", "Is there a need for a Physician review?", "¿Se necesita revisión de un médico?", YN_OPTIONS))
p11.append(add_field("physician_review_reason", "textarea", "Reason for review", "Motivo de la revisión"))

page("Assessment Conclusions", "Conclusiones de la evaluación", p11)

# ============================================================================
# PÁGINA 12 — Diagnóstico DSM-5, colocación ASAM y firma
# ============================================================================
p12 = []
for i in range(1, 7):
    p12.append(
        add_field(
            f"diagnosis_line_{i}",
            "select",
            f"Diagnosis (DSM-5) — line {i}",
            f"Diagnóstico (DSM-5) — línea {i}",
            DSM5_DIAGNOSIS_OPTIONS,
        )
    )

p12.append(
    add_field(
        "asam_placement",
        "select",
        "ASAM Placement, 4th Edition",
        "Colocación ASAM, 4ta Edición",
        ASAM_PLACEMENT_OPTIONS,
    )
)
p12.append(
    add_field(
        "assessment_comments",
        "textarea",
        "Comments",
        "Comentarios",
    )
)
p12.append(add_field("counselor_signature_date", "date", "Counselor signature date", "Fecha de firma del consejero"))
p12.append(add_field("physician_name", "text", "Physician name", "Nombre del médico"))
p12.append(add_field("physician_signature_date", "date", "Physician signature date", "Fecha de firma del médico"))

page("DSM-5 Diagnosis, ASAM Placement & Signatures", "Diagnóstico DSM-5, colocación ASAM y firmas", p12)

# ============================================================================
schema = {
    "key": "assessment",
    "version": 1,
    "titleEn": "Biopsychosocial Assessment for Client Placement",
    "titleEs": "Evaluación Biopsicosocial para Colocación del Cliente",
    "fields": FIELDS,
    "pages": PAGES,
    "conditions": CONDITIONS,
}

print(json.dumps(schema, indent=2, ensure_ascii=False))
