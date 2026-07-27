# Forms 1-7 — páginas 2-5 (consentimientos / educación del paciente)

Texto curado directamente de `build-inputs/templates-r12/forms-1-7.pdf` (páginas 2, 3,
4 y 5 — renderizadas y leídas visualmente esta sesión, ver `Forms_1-7/fields.json` +
`field_scripts.json` para los nombres de campo del AcroForm original).

**Por qué NO están en `forms_1_7.schema.json`:** estas 4 páginas son
consentimientos/reconocimientos con firma de cliente y de coordinador de admisión —
contenido mayormente estático (texto legal fijo) con muy pocos campos dinámicos y una
firma, no un formulario de captura de datos como la página 1 (Demographic Data). No
encajan en el patrón `SchemaForm` (páginas con muchos campos + condiciones RN-7);
necesitan un componente de "consentimiento/reconocimiento" propio (texto fijo + un
área de firma + fecha), con `signature_pad` (ver blueprint, stack). Se documentan aquí
para no perder el texto exacto extraído del PDF real y evitar que quien construya esa
UI tenga que re-extraerlo o, peor, redactarlo de memoria.

Cada una de las 4 es un documento independiente que se firma por separado (Jorge
confirmó en su respuesta #8 que los 8 documentos del expediente se firman — ver
`PROGRESS.md`, sección "Respuestas de Jorge" punto 8). Formato de firma en las 4:
`Client's name` / `Signature` / `Date` y `DMS intake coordinator's name` / `Signature`
/ `Date`.

---

## Página 2 — DMS-IN-002 — Client's Rights Statement

**CLIENT'S RIGHTS STATEMENT**

*In seeking services from DUI Metropolitan Services, I have a right to:*

- Access to services will not be denied on the basis of race, religion, ethnicity,
  disability, sexual orientation, or HIV/AIDS status.
- Services will be provided in the least restrictive environment available.
- Confidentiality of HIV/AIDS status and testing and anonymous testing as specified in
  Section 2060.321 of the Part.
- The right to nondiscriminatory access to service as specified in the Americans with
  Disabilities Act of 1990 (42 USC 12101)
- The right to give or withhold informed consent regarding program and regarding
  confidential information about client.
- A description of the route of appeal available when a person disagrees with an
  organization's decisions or polices.
- Confidentiality of client records as specified in Section 2060.319 of the Part.
- The right to refuse treatment or any specific treatment procedure and a right to be
  informed of the consequences from such refusal.

Campos dinámicos: ninguno — solo firma. No tiene campos de texto libres además de las
líneas de firma (`Text5.0`=nombre del cliente, `Text1.0.0`=fecha, `Text3`=nombre del
coordinador de admisión, compartidos con las otras páginas de firma — ver
`field_scripts.json`).

---

## Página 3 — DMS-IN-003 — Consent for Services

**CONSENT FOR SERVICES**

I'm applying for admission to my program at DUI Metropolitan Services. I affirm that
my participation in this program is on a voluntary basis, and I affirm that the Intake
Coordinator has informed me the following:

1. The services and procedures that I will receive.
2. The name of my primary counselor.
3. Hours those services are available at the facility.
4. The ultimate success of this program effort rests in my willingness to cooperate
   with the program process whereby personal management of honesty, anger, and
   conflict are all factors that can enhance or limit the program process.

I also agree to the following facility rules:

1. I may be asked to submit to drug screening and alcoholmeter readings on a regular
   basis.
2. I accept full responsibility for paying the agreed upon fee at the designated time.
3. Any patient under the influence or in possession of alcohol or mood or mind
   changing drugs will not be seen for service. Should this happen a second time, the
   client may be considered inappropriate for services and will be referred to a more
   structured unit.
4. The following behaviors will result in immediate termination:
   - Violence or serious threat of violence
   - Selling of licit or illicit drugs or stolen goods and/or possession or illicit
     drugs or stolen goods
   - Destruction or theft of property
5. Other rule violations which could result in termination:
   - Failure to pay for treatment
   - Failure to submit for drug screening and/or alcoholmeter reading
6. I affirm that I received a copy of the **CLIENT'S RIGHTS STATEMENTS.**

I will hold the DUI Metropolitan Services, its agents and members, free from all
liability for losses through fire, theft, or personal injury while I am in or about
the premises.

Campos dinámicos: ninguno — solo firma (mismos campos compartidos de firma que página
2).

---

## Página 4 — DMS-IN-004 — Consent for Disclosure of Confidential Information (RN-6)

**CONSENT FOR DISCLOSURE OF CONFIDENTIAL INFORMATION**

I hereby authorize DUI Metropolitan Services to disclosure information concerning my
confidential records in accordance with the terms and conditions herein set forth.

1. The name, title, address and telephone number of the person or organization to
   which disclosure is to be made is: **[campo dinámico — `Text8`, texto libre]**
2. The purpose and need for this disclosure are: **To provide information about the
   services related to:** *(texto fijo, sin campo adicional — no había un segundo
   campo dinámico aquí en el AcroForm real, ver `fields.json`)*
3. The extent, type and nature of the information to be disclosed to the purpose or
   need described in paragraph 2 is: **Admission, progress and completion of** *(texto
   fijo, sin campo adicional)*
4. The date, event, or condition upon which this consent will expire without my
   express revocation shall be: **[campo dinámico — `Text9`, texto libre]**, which is
   of duration no longer than that reasonably necessary to effectuate the purpose for
   which this consent is given.

*I understand that I may revoke this consent at any time except to the extent the
action has been taken in reliance thereon. I further understand that such disclosure
shall be limited to information necessary in light of the need of the purpose for the
disclosure. I further understand that the title 21 U.S.C 1175 and CFR part 2, requires
that the information release pursuant to this consent remains subject to the
restriction that it not be further disclosed or used for any purpose other than that
stated herein without my specific consent, or as otherwise permitted by Federal Law.*

Campos dinámicos: `Text8` (recipient — nombre/título/dirección/teléfono de a quién se
divulga) y `Text9` (fecha/evento de expiración del consentimiento), además de firma.
Esta es la página que corresponde a RN-6 (`consents` table, 42 CFR Part 2) — cuando se
construya la UI de esta página, `Text8` mapea a `consents.recipient_org` y `Text9` a
algo parecido a `consents.expires_at` (revisar el tipo exacto contra el schema de
`consents` en `drizzle/`, puede necesitar guardarse como texto libre en vez de fecha
estricta porque el PDF permite "evento o condición", no solo una fecha).

---

## Página 5 — DMS-IN-005 — Patient Education on Communicable Diseases

**PATIENT EDUCATION ON COMMUNICABLE DISEASES**

**Tuberculosis (TB)**
This is a contagious disease caused by breathing tiny germs into your lungs. The germs
get into the air when someone sneezes, cough, laughs, sings, or speaks. You are
unlikely to get this disease unless you spend a lot of time indoors with someone who
has TB disease. TB germs are not spread on dishes, drinking glasses or other objects.
You can take a simple skin test to determine if you have TB germs in your body. A
health care professional injects a harmless substance under the skin on your arm.
Then they check to see if there has been any swelling two or three days later. TB is a
curable disease.

**HIV and AIDS**
AIDS is caused by a virus called HIV. Anyone with the virus can pass it to you during
sex, when sharing needles to shoot drugs, pierce ears, make tattoos, or for any other
reason. There is not cure for AIDS. Don't be fooled. Many people with the AIDS virus
(HIV) look healthy, feel fine, and swear they don't have the virus or don't even know
they have it. But they can still pass the virus to you.

Sex is fun – but dying from AIDS isn't. If your have sex; always use a latex condom
(rubber). There's no sure way to avoid passing the virus during sex. But using a
condom properly helps protect you and your partner. If you shoot drugs never share or
reuse your works. Even babies get AIDS. A woman with the virus can give it to her baby
before birth, during birth, or while breast-feeding her baby.

You cannot get the AIDS virus through the air or by sitting near someone, shaking
hands, hugging, using a bathroom, eating, sharing food, plates, cups or forks,
swimming in a pool, being bitten by insects or giving blood.

**Hepatitis A**
It is one of several forms of viral hepatitis. It is one of the most widely reported
diseases that is preventable by receiving a vaccine. People usually become infected
after eating in a restaurant. This usually happens when an employee with the virus
does not wash his or her hands well after using the bathroom and then prepares food.

**Hepatitis B**
It is spread by direct contact with an infected person or with his or her body fluids
such as through cuts and scrapes or needle sticks, through eyes, mouth or nose by
exposure to blood or other body fluids or through sexual contact. It can be spread
indirectly by contact with a surface contaminated with infected blood or body fluids,
sharing toothbrushes, razors or earrings, getting a tattoo or ear or body piercing.

**Hepatitis C**
It is found in the blood of persons who have this disease and is spread by contact
with the blood of an infected person. This type of hepatitis is found more commonly in
blood transfusion or solid organ transplant from an infected door, long-term kidney
dialysis, unprotected sex with a person infected with C, or if you ever injected
street drugs, even if you experimented a few times many years ago.

If you have any questions, please contact your healthcare provider or Local County
Health.

Campos dinámicos: ninguno — solo firma del cliente (esta página, a diferencia de las
otras 3, NO tiene línea de firma del coordinador de admisión en el PDF original —
confirmar si eso es intencional antes de construir la UI, podría ser solo un defecto
de diseño del PDF original).

---

## Pendiente para cuando se construya esta UI

- Definir el componente de "consentimiento/reconocimiento" (texto fijo + firma +
  fecha, con los 1-2 campos dinámicos de la página 4) — no es `SchemaForm`, es un
  patrón nuevo.
- Confirmar con Jorge quién firma cada uno de estos 4 (cliente / coordinador / ambos)
  — dato abierto desde su respuesta #8 (ver `PROGRESS.md`).
- Página 4 (RN-6): decidir cómo mapean `Text8`/`Text9` a las columnas reales de
  `consents` (ver `drizzle/` schema) antes de construir el guardado.
- Confirmar si la ausencia de firma del coordinador en página 5 es intencional.
