# Imboni translation glossary — English ⇄ Kinyarwanda

The controlled vocabulary for the whole app. Every `rw.json` string must use the
agreed term from this table, so the same concept never appears two ways.

Terms were pulled from the strings actually used in the app (frequency in
brackets), not from a generic word list.

## How to read the confidence column

| Mark | Meaning |
|---|---|
| **OK** | Standard everyday Kinyarwanda, I'm confident. |
| **CHECK** | Plausible, but the school-register term may differ. Please confirm. |
| **DECIDE** | I cannot resolve this — it needs your call (see Notes). |

> Rwandan schools often use the English/French loanword in practice (DOS,
> matron, dormitory, prefect). Where that's true, borrowing is usually *better*
> than a literal translation nobody says. Those are marked **DECIDE** so you can
> choose per term.

---

## 1. People and roles

| English | Proposed Kinyarwanda | Plural | Conf. | Notes |
|---|---|---|---|---|
| Student (79) | umunyeshuri | abanyeshuri | OK | |
| Teacher (26) | umwarimu | abarimu | OK | |
| Parent (22) | umubyeyi | ababyeyi | OK | |
| Staff (35) | umukozi | abakozi | OK | |
| Administrator | umuyobozi | abayobozi | OK | |
| Director of Studies | Umuyobozi w'Amasomo | | DECIDE | "DOS" is widely used as-is in Rwandan schools. Keep "DOS" for the portal name? |
| Matron | umurezi | abarezi | DECIDE | "Matron" is commonly used untranslated in boarding schools. |
| Discipline officer (22) | ushinzwe imyitwarire | | CHECK | |
| Head teacher | Umuyobozi w'Ishuri | | OK | |
| Prefect / Student leader | umuyobozi w'abanyeshuri | | CHECK | |
| Dormitory captain | umukuru w'icumbi | | CHECK | |

## 2. Academic structure

| English | Proposed Kinyarwanda | Plural | Conf. | Notes |
|---|---|---|---|---|
| School (72) | ishuri | amashuri | OK | |
| Class (49 + 30) | ishuri | amashuri | **DECIDE** | ⚠️ Same word as "school". See Note A. |
| Subject (27) | isomo | amasomo | OK | |
| Lesson | isomo | amasomo | **DECIDE** | ⚠️ Same word as "subject". See Note B. |
| Term (43) | igihembwe | ibihembwe | OK | |
| Academic year (25) | umwaka w'amashuri | imyaka | OK | |
| Stream (13) | ishami | amashami | CHECK | |
| Section (15) | igice | ibice | CHECK | |
| Room (22) | icyumba | ibyumba | OK | |
| Timetable (19) | gahunda y'amasomo | | OK | |
| Schedule (21) | gahunda | | OK | |

## 3. Assessment and results

| English | Proposed Kinyarwanda | Conf. | Notes |
|---|---|---|---|
| Exam (16) | ikizamini (pl. ibizamini) | OK | |
| Assessment | isuzuma (pl. amasuzuma) | CHECK | |
| Continuous assessment | isuzuma rihoraho | CHECK | The /30 component. |
| Results (28) | amanota | **DECIDE** | ⚠️ Same word as "marks". See Note C. |
| Marks / Score | amanota | OK | |
| Grade (14) | urwego | CHECK | The letter A–F. Distinct from year-level "grade". |
| Assignment (18) | umukoro (pl. imikoro) | OK | |
| Quiz | akazamini | CHECK | |
| Performance (18) | imikorere | OK | |
| Report card | urupapuro rw'amanota | CHECK | |

## 4. Attendance

| English | Proposed Kinyarwanda | Conf. |
|---|---|---|
| Attendance (26) | ubwitabire | OK |
| Present | yaje | CHECK |
| Absent | yasibye | CHECK |
| Late | yatinze | OK |
| Excused | yemerewe gusiba | CHECK |

## 5. Discipline and boarding

| English | Proposed Kinyarwanda | Conf. | Notes |
|---|---|---|---|
| Discipline (22) | imyitwarire | OK | |
| Behaviour | imyitwarire | **DECIDE** | ⚠️ Same word as "discipline" and "conduct". See Note D. |
| Conduct (12) | imyitwarire | **DECIDE** | ⚠️ As above. |
| Incident | ikibazo cy'imyitwarire | CHECK | |
| Warning | umuburo | OK | |
| Dormitory (30) | icumbi (pl. amacumbi) | DECIDE | "Dormitory" often used as-is. |
| Boarding (20) | kuba ku ishuri | CHECK | |
| Dining (16) | kurya / refeteri | CHECK | |

## 6. Health

| English | Proposed Kinyarwanda | Conf. |
|---|---|---|
| Health | ubuzima | OK |
| Medication | imiti | OK |
| Sick bay / clinic | ivuriro | OK |
| Nurse | umuforomo(kazi) | OK |

## 7. Communication

| English | Proposed Kinyarwanda | Conf. |
|---|---|---|
| Announcement (16) | itangazo (pl. amatangazo) | OK |
| Message (12) | ubutumwa | OK |
| Notification | integuza | CHECK |
| Contact (14) | ushobora kutwandikira / aderesi | CHECK |

## 8. Common UI actions

| English | Proposed Kinyarwanda | Conf. |
|---|---|---|
| Save | Bika | OK |
| Cancel | Reka | OK |
| Delete (25) | Siba | OK |
| Edit | Hindura | OK |
| Add | Ongeraho | OK |
| Search (18) | Shakisha | OK |
| Select (29) | Hitamo | OK |
| Sign in (22) | Injira | OK |
| Sign out | Sohoka | OK |
| Password (40) | ijambo ry'ibanga | OK |
| Settings | igenamiterere | CHECK |
| Dashboard | imbonerahamwe | DECIDE |
| Profile | umwirondoro | OK |
| Loading… (94) | Biratangira… | CHECK |
| Records (19) | inyandiko | CHECK |
| Report (18) | raporo | OK |

---

## Notes — the decisions I can't make for you

**Note A — "class" and "school" are both `ishuri`.**
The app uses "class" constantly ("S3A", "my classes", "class teacher"). If both
render as *ishuri*, "Ishuri ryanjye" is ambiguous. Options: use *umutwe*
(group/stream) for class, keep *ishuri* only for the institution; or borrow
*ikilasi*. This affects ~80 strings.

**Note B — "subject" and "lesson" are both `isomo`.**
Usually harmless (context disambiguates), but the timetable shows both at once —
a cell has a *subject* within a *lesson slot*. May need *isomo* vs *igihe
cy'isomo*.

**Note C — "results" and "marks" are both `amanota`.**
"My Results" as a page title vs "marks out of 30" in a table. Suggest *amanota*
for marks and *ibyavuye mu bizamini* for the results page, but that's wordy for a
nav item.

**Note D — "discipline", "behaviour" and "conduct" all map to `imyitwarire`.**
The app treats them as three things: the Discipline *portal*, a behaviour
*report*, and a conduct *grade* (A–F). They need three distinct renderings or the
discipline portal becomes confusing. This is the most important one to settle.

---

## What I need from you

1. The **DECIDE** rows — especially Note A and Note D.
2. A pass over the **CHECK** rows.
3. Whether to borrow English/French terms where that is what schools actually
   say (DOS, matron, dormitory, prefect, dashboard).

Once this table is settled I'll draft all 1,545 strings against it, and this file
becomes the reference that keeps them consistent.
