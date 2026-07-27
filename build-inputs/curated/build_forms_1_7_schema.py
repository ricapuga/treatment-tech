import json

RE_HOURS = ["08", "10", "12", "14", "18", "20", "22", "24"]
EI_HOURS = ["06", "08", "10", "12", "14", "16", "18", "20"]
OP_HOURS = ["20", "75"]
CCP_MONTHS = ["3", "6", "12"]

def opts(values, es_prefix=""):
    return [{"value": v, "labelEn": v, "labelEs": v} for v in values]

RISKEDUC_TEXT = ("Risk education courses shall have included a minimum of 10 hours of classroom "
"instruction, divided into five sessions to be held on different days. No one of these classes is "
"to exceed 3 hours in length. Audio-visual material may be used during these sessions of "
"instruction, but they are not to exceed 25% of the total class time. CLASS CONTENT: The education "
"program shall cover the following content: Information on alcohol as a drug; Physiological and "
"pharmacological effects of alcohol and other drugs, including their residual impairment on normal "
"levels of driving performance; Other drugs, legal and illegal, and their effects on driving when "
"used separately and/or in combination with alcohol; Substance abuse/dependence and the effect on "
"individuals and families; Blood alcohol concentration (BAC) level and its effect on driving "
"performance; Information about Illinois driving under the influence laws and associated penalties; "
"Factors that influence the formation of patterns of alcohol and drug abuse; and Information about "
"referrals for services that can address any identified problem that may increase the risk for "
"future alcohol/drug related difficulty. TESTING: Each student will take a test on questions "
"relating to the class content on the first session of the cycle. That same test will be taken at "
"the completion of the last session of the cycle and each student MUST pass the test with a minimum "
"score of 75% in order to pass successfully.")

EARLYINT_TEXT = ("Early intervention services are considered sub-clinical or pre-treatment and are "
"designed to explore and address problems or risk factors that appear to be related to substance "
"use and to assist the client in recognizing the harmful consequences of inappropriate substance "
"use. Client will attend a minimum of 12 hours of early intervention provided over a minimum of "
"four weeks with no more than three hours per day in any seven consecutive days.")

OP_TEXT = ("Substance Abuse Outpatient Treatment consists of face-to-face clinical services for "
"adults only. The frequency and intensity of such treatment will depend on patient need but will be "
"a planned regimen of regularly scheduled group and individual sessions that average less than nine "
"hours per week. Substance Abuse Intensive Outpatient Treatment consists of face-to-face clinical "
"services for adults only. The frequency and intensity of such treatment will depend on patient "
"need but will be a planned regimen of scheduled sessions for a minimum of nine hours per week.")

CCP_TEXT = ("Upon completion of any and all necessary treatment, and, after discharge, active "
"on-going participation in all activities specified in the continuing care plan.")

SPECIAL_PROVISIONS_TEXT = ("If the client leaves the program, against staff advice, for more than "
"30 days, the case will be closed and the corresponding referral source will be notified. If the "
"client chooses to reopen the case, a fee of $ 25.00 will be applied.")

fields = []
page1_keys = []
page2_keys = []
page3_keys = []

def add_field(key, type_, en, es, page, required=False, options=None, body_en=None, body_es=None):
    f = {"key": key, "type": type_, "labelEn": en, "labelEs": es}
    if required:
        f["required"] = True
    if options:
        f["options"] = options
    if body_en:
        f["bodyEn"] = body_en
        f["bodyEs"] = body_es
    fields.append(f)
    if page == 1:
        page1_keys.append(key)
    elif page == 2:
        page2_keys.append(key)
    elif page == 3:
        page3_keys.append(key)

# ---------- PAGE 1: Demographic Data (DMS-IN-001) ----------
add_field("intake_date", "date", "Date", "Fecha", 1, required=True)
add_field("referral_source", "select", "Referral source", "Fuente de referencia", 1, required=True,
    options=[
        {"value": "central_states_institute_of_addictions", "labelEn": "Central States Institute of Addictions", "labelEs": "Central States Institute of Addictions"},
        {"value": "social_service_department", "labelEn": "Social Service Department", "labelEs": "Departamento de Servicios Sociales"},
        {"value": "adult_probation_department", "labelEn": "Adult Probation Department", "labelEs": "Departamento de Libertad Condicional de Adultos"},
        {"value": "dupage_county", "labelEn": "DuPage County", "labelEs": "Condado de DuPage"},
        {"value": "kane_county", "labelEn": "Kane County", "labelEs": "Condado de Kane"},
        {"value": "will_county", "labelEn": "Will County", "labelEs": "Condado de Will"},
        {"value": "mchenry_county", "labelEn": "McHenry County", "labelEs": "Condado de McHenry"},
        {"value": "lake_county", "labelEn": "Lake County", "labelEs": "Condado de Lake"},
        {"value": "secretary_of_state", "labelEn": "Secretary of State", "labelEs": "Secretaría de Estado"},
    ])
add_field("patient_name", "text", "Name", "Nombre", 1, required=True)
add_field("address", "text", "Address", "Dirección", 1)
add_field("city", "text", "City", "Ciudad", 1)
add_field("state", "text", "State", "Estado", 1)
add_field("residence_county", "text", "County (residence)", "Condado (residencia)", 1)
add_field("zip_code", "text", "Zip code", "Código postal", 1)
add_field("phone_1", "text", "Phone", "Teléfono", 1)
add_field("phone_1_type", "select", "Phone type", "Tipo de teléfono", 1,
    options=opts(["cell", "home", "work", "other"]))
add_field("phone_2", "text", "Alternate phone", "Teléfono alterno", 1)
add_field("phone_2_type", "select", "Alternate phone type", "Tipo de teléfono alterno", 1,
    options=opts(["cell", "home", "work", "other"]))
add_field("date_of_birth", "date", "Date of birth", "Fecha de nacimiento", 1, required=True)
add_field("gender", "select", "Gender", "Género", 1,
    options=[{"value": "male", "labelEn": "Male", "labelEs": "Masculino"},
             {"value": "female", "labelEn": "Female", "labelEs": "Femenino"}])
add_field("drivers_license_number", "text", "Driver's license number", "Número de licencia de conducir", 1)
add_field("dependents_count", "number", "Number of dependents including self", "Número de dependientes incluyéndose", 1)
add_field("race_ethnicity_language", "text", "Race/ethnic origin/language preference", "Raza/origen étnico/idioma preferido", 1)
add_field("disability", "text", "Physical or mental disability", "Discapacidad física o mental", 1)
add_field("education", "select", "Education", "Educación", 1,
    options=[
        {"value": "under_7_years", "labelEn": "Under 7 years", "labelEs": "Menos de 7 años"},
        {"value": "junior_high_school", "labelEn": "Junior High School", "labelEs": "Secundaria"},
        {"value": "high_school_or_equivalency", "labelEn": "High School Graduate or equivalency", "labelEs": "Bachillerato o equivalente"},
        {"value": "associate_degree", "labelEn": "Associate Degree", "labelEs": "Título asociado"},
        {"value": "some_college", "labelEn": "Some College no degree", "labelEs": "Universidad sin título"},
        {"value": "bachelor_degree", "labelEn": "College Bachelor Degree", "labelEs": "Licenciatura"},
        {"value": "masters_or_higher", "labelEn": "Master's Degree or Higher", "labelEs": "Maestría o superior"},
        {"value": "unknown", "labelEn": "Unknown", "labelEs": "Desconocido"},
    ])
add_field("marital_status", "select", "Marital status", "Estado civil", 1,
    options=[
        {"value": "civil_union", "labelEn": "Civil Union", "labelEs": "Unión civil"},
        {"value": "divorced", "labelEn": "Divorced", "labelEs": "Divorciado"},
        {"value": "married", "labelEn": "Married", "labelEs": "Casado"},
        {"value": "never_married", "labelEn": "Never married", "labelEs": "Nunca casado"},
        {"value": "separated", "labelEn": "Separated", "labelEs": "Separado"},
        {"value": "widowed", "labelEn": "Widowed", "labelEs": "Viudo"},
        {"value": "unknown", "labelEn": "Unknown", "labelEs": "Desconocido"},
    ])
add_field("religion", "select", "Religion", "Religión", 1,
    options=[
        {"value": "atheist", "labelEn": "Atheist", "labelEs": "Ateo"},
        {"value": "buddhism", "labelEn": "Buddhism", "labelEs": "Budismo"},
        {"value": "christian", "labelEn": "Christian", "labelEs": "Cristiano"},
        {"value": "hinduism", "labelEn": "Hinduism", "labelEs": "Hinduismo"},
        {"value": "islam", "labelEn": "Islam", "labelEs": "Islam"},
        {"value": "judaism", "labelEn": "Judaism", "labelEs": "Judaísmo"},
        {"value": "nonreligious", "labelEn": "Nonreligious", "labelEs": "No religioso"},
        {"value": "other", "labelEn": "Other", "labelEs": "Otro"},
        {"value": "unknown", "labelEn": "Unknown", "labelEs": "Desconocido"},
    ])
add_field("military_service_history", "text", "Military service history", "Historial de servicio militar", 1)
add_field("employment_type", "select", "Type of employment", "Tipo de empleo", 1,
    options=[
        {"value": "disabled", "labelEn": "Disabled", "labelEs": "Discapacitado"},
        {"value": "employed_full_time", "labelEn": "Employed full time", "labelEs": "Empleado tiempo completo"},
        {"value": "employed_part_time", "labelEn": "Employed part time", "labelEs": "Empleado medio tiempo"},
        {"value": "retired", "labelEn": "Retired", "labelEs": "Jubilado"},
        {"value": "student", "labelEn": "Student", "labelEs": "Estudiante"},
        {"value": "unemployed", "labelEn": "Unemployed", "labelEs": "Desempleado"},
        {"value": "unknown", "labelEn": "Unknown", "labelEs": "Desconocido"},
    ])
add_field("employment_describe", "text", "Describe", "Describa", 1)
add_field("date_of_last_arrest", "date", "Date of last arrest", "Fecha del último arresto", 1)
add_field("legal_status", "text", "Legal status", "Estatus legal", 1)
add_field("reason_last_arrest", "text", "Reason of last arrest", "Motivo del último arresto", 1)
add_field("county_of_last_arrest", "select", "County of last arrest", "Condado del último arresto", 1,
    options=[{"value": v.lower(), "labelEn": v, "labelEs": v} for v in
             ["Cook", "DuPage", "Will", "Kane", "Lake", "McHenry"]])
add_field("chemical_test_description", "text", "If DUI, describe chemical test", "Si es DUI, describa la prueba química", 1)
add_field("prior_arrests", "text", "Prior arrests", "Arrestos previos", 1)
add_field("emergency_contact_name", "text", "Emergency contact name", "Nombre de contacto de emergencia", 1)
add_field("emergency_contact_phone", "text", "Emergency contact phone", "Teléfono de contacto de emergencia", 1)
add_field("emergency_contact_relationship", "text", "Emergency contact relationship", "Relación del contacto de emergencia", 1)
add_field("comments", "textarea", "Comments", "Comentarios", 1)
add_field("intake_coordinator_name", "text", "Intake coordinator's name", "Nombre del coordinador de admisión", 1, required=True)

# Synthetic program-membership flags (RN-2, vía getRequiredPrograms(case.loi)) -- NO
# se listan en ninguna página (no se renderizan como input), solo existen para que
# las condiciones RN-7 de las páginas 2 y 3 sepan qué bloques mostrar. Ver
# src/app/(app)/cases/[id]/forms/[key]/page.tsx, que las calcula e inyecta en
# initialData -- este schema nunca las escribe ni las pide al usuario.
add_field("program_re", "checkbox", "Risk Education aplica", "Risk Education aplica", None)
add_field("program_ei", "checkbox", "Early Intervention aplica", "Early Intervention aplica", None)
add_field("program_op", "checkbox", "Outpatient aplica", "Outpatient aplica", None)
add_field("program_ccp", "checkbox", "Continuing Care aplica", "Continuing Care aplica", None)

# ---------- PAGE 2: Program Requirements (DMS-IN-006) ----------
add_field("risk_education_info", "info", "Risk Education Program", "Programa de Educación sobre Riesgos", 2,
    body_en=RISKEDUC_TEXT, body_es=RISKEDUC_TEXT)
add_field("early_intervention_info", "info", "Early Intervention Program", "Programa de Intervención Temprana", 2,
    body_en=EARLYINT_TEXT, body_es=EARLYINT_TEXT)
add_field("outpatient_info", "info", "Outpatient Treatment Program", "Programa de Tratamiento Ambulatorio", 2,
    body_en=OP_TEXT, body_es=OP_TEXT)
add_field("continuing_care_info", "info", "Continuing Care Program", "Programa de Cuidado Continuo", 2,
    body_en=CCP_TEXT, body_es=CCP_TEXT)

# ---------- PAGE 3: Service Fee and Financial Responsibility (DMS-IN-007) ----------
# Los únicos valores que el consejero realmente elige son las horas/meses (de ahí se
# derivan sesiones vía RN-3 y costo vía fees.ts, calculados -- nunca guardados, mismo
# principio que RN-5 en el ledger) y la cuota por sesión (editable, con default $50).
add_field("re_hours", "select", "Risk Education hours (minimum)", "Horas de Risk Education (mínimo)", 3,
    options=opts(RE_HOURS))
add_field("re_fee_per_class", "number", "Fee per class ($)", "Cuota por clase ($)", 3)
add_field("ei_hours", "select", "Early Intervention hours (minimum)", "Horas de Early Intervention (mínimo)", 3,
    options=opts(EI_HOURS))
add_field("ei_fee_per_class", "number", "Fee per class ($)", "Cuota por clase ($)", 3)
add_field("op_hours", "select", "Outpatient hours (minimum)", "Horas de Outpatient (mínimo)", 3,
    options=opts(OP_HOURS))
add_field("op_fee_per_session", "number", "Fee per session ($)", "Cuota por sesión ($)", 3)
add_field("ccp_months", "select", "Continuing Care months", "Meses de Continuing Care", 3,
    options=opts(CCP_MONTHS))
add_field("ccp_fee_per_session", "number", "Fee per session ($)", "Cuota por sesión ($)", 3)
add_field("special_provisions_info", "info", "Special provisions", "Provisiones especiales", 3,
    body_en=SPECIAL_PROVISIONS_TEXT, body_es=SPECIAL_PROVISIONS_TEXT)

conditions = [
    {"if": "program_re", "eq": True, "show": ["re_hours", "re_fee_per_class", "risk_education_info"]},
    {"if": "program_ei", "eq": True, "show": ["ei_hours", "ei_fee_per_class", "early_intervention_info"]},
    {"if": "program_op", "eq": True, "show": ["op_hours", "op_fee_per_session", "outpatient_info"]},
    {"if": "program_ccp", "eq": True, "show": ["ccp_months", "ccp_fee_per_session", "continuing_care_info"]},
    # NOTA: no se encontró en field_scripts.json ningún trigger que oculte/muestre
    # "employment_describe" según "employment_type" -- se deja SIEMPRE visible, sin
    # inventar una condición que el PDF real no tiene.
]

schema = {
    "key": "forms_1_7",
    "version": 1,
    "titleEn": "Forms 1-7 — Intake",
    "titleEs": "Forms 1-7 — Admisión",
    "fields": fields,
    "pages": [
        {"title": {"en": "Demographic Data", "es": "Datos demográficos"}, "fields": page1_keys},
        {"title": {"en": "Program Requirements", "es": "Requisitos del programa"}, "fields": page2_keys},
        {"title": {"en": "Fees & Financial Responsibility", "es": "Cuotas y responsabilidad financiera"}, "fields": page3_keys},
    ],
    "conditions": conditions,
}

with open("/tmp/forms17/forms_1_7.schema.json", "w") as f:
    json.dump(schema, f, indent=2, ensure_ascii=False)

print("fields:", len(fields))
print("page1:", len(page1_keys), "page2:", len(page2_keys), "page3:", len(page3_keys))
print("conditions:", len(conditions))
