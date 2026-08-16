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
| Director of Studies | Umuyobozi w'Amasomo | | ok | "DOS" is widely used as-is in Rwandan schools. Keep "DOS" for the portal name? |
| Matron | umurezi | abarezi | ok | "Matron" is commonly used untranslated in boarding schools. |
| Discipline officer (22) | ushinzwe imyitwarire | | OK |
| Head teacher | Umuyobozi w'Ishuri | | OK | |
| Prefect / Student leader | umuyobozi w'abanyeshuri | | OK | |
| Dormitory captain | umukuru w'icumbi | | ok | |

## 2. Academic structure

| English | Proposed Kinyarwanda | Plural | Conf. | Notes |
|---|---|---|---|---|
| School (72) | ikigo | ibigo | OK | |
| Class (49 + 30) | ishuri | amashuri | Ok | ⚠️ Same word as "school". See Note A. |
| Subject (27) | isomo | amasomo | OK | |
| Lesson | isomo | amasomo | ok | ⚠️ Same word as "subject". See Note B. |
| Term (43) | igihembwe | ibihembwe | OK | |
| Academic year (25) | umwaka w'amashuri | imyaka | OK | |
| Stream (13) | ishami | amashami | ok | |
| Section (15) | igice | ibice | ok | |
| Room (22) | icyumba | ibyumba | OK | |
| Timetable (19) | gahunda y'amasomo | | OK | |
| Schedule (21) | gahunda | | OK | |

## 3. Assessment and results

| English | Proposed Kinyarwanda | Conf. | Notes |
|---|---|---|---|
| Exam (16) | ikizamini (pl. ibizamini) | OK | |
| Assessment | isuzuma (pl. amasuzuma) | ok | |
| Continuous assessment | isuzuma rihoraho | ok | The /30 component. |
| Results (28) | amanota | **ok** | ⚠️ Same word as "marks". See Note C. |
| Marks / Score | amanota | OK | |
| Grade (14) | urwego | ok | The letter A–F. Distinct from year-level "grade". |
| Assignment (18) | umukoro (pl. imikoro) | OK | |
| Quiz | isuzumabumenyi | ok | |
| Performance (18) | imikorere | OK | |
| Report card | indangamanota | ok | |

## 4. Attendance

| English | Proposed Kinyarwanda | Conf. |
|---|---|---|
| Attendance (26) | ubwitabire | OK |
| Present | yaje | ok |
| Absent | yasibye | ok |
| Late | yatinze | OK |
| Excused | yemerewe gusiba | ok |

## 5. Discipline and boarding

| English | Proposed Kinyarwanda | Conf. | Notes |
|---|---|---|---|
| Discipline (22) | imyitwarire | OK | |
| Behaviour | imyitwarire | **ok** | ⚠️ Same word as "discipline" and "conduct". See Note D. |
| Conduct (12) | imyitwarire | **ok** | ⚠️ As above. |
| Incident | ikibazo cy'imyitwarire | ok | |
| Warning | umuburo | OK | |
| Dormitory (30) | icumbi (pl. amacumbi) | ok | "Dormitory" often used as-is. |
| Boarding (20) | kuba ku ishuri | ok | |
| Dining (16) | kurya / refetegitwari | ok | |

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
| Notification | integuza | ok |
| Contact (14) | ushobora kutwandikira / aderesi | ok |

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
| Settings | igenamiterere | ok |
| Dashboard | imbonerahamwe | ok |
| Profile | umwirondoro | OK |
| Loading… (94) | Biratangira… | ok |
| Records (19) | inyandiko | ok |
| Report (18) | raporo | OK |


## 9. Weekdays (timetable / attendance columns)

Kinyarwanda names days by ordinal, so three-letter abbreviations collide:
*gatatu* (3rd) and *gatanu* (5th) both shorten to "Gat". The full short form is
used instead — unambiguous and still short enough for a table header.

| English | Kinyarwanda |
|---|---|
| Mon | Mbere |
| Tue | Kabiri |
| Wed | Gatatu |
| Thu | Kane |
| Fri | Gatanu |

## 10. One English word, two acts

"Review" means two different things in this app and must not share a key:

| Context | Key | Kinyarwanda |
|---|---|---|
| Re-read your own submitted quiz | `common.revise` | Subiramo |
| Assess someone else's work to approve or reject | `dos.results.review` | Suzuma |

---

## Notes — RESOLVED (reviewed 2026-08-15)

**Note A — RESOLVED by splitting the words.**
School is now **`ikigo`** (the institution); **`ishuri`** is reserved for a
*class*. "Ishuri ryanjye" therefore reads unambiguously as "my class". This is
the reason `School` in section 2 is `ikigo` and not `ishuri`.

**Note B — ACCEPTED as-is.** Subject and lesson both stay `isomo`; context
carries it. Where the timetable shows both at once, use `isomo` for the subject
and `igihe cy'isomo` for the slot.

**Note C — ACCEPTED as-is.** Results and marks both stay `amanota`.
Disambiguate by the surrounding words, not by changing the term:
"My Results" → *Amanota yanjye*, "marks out of 30" → *amanota kuri 30*.

**Note D — ACCEPTED as-is.** Discipline, behaviour and conduct all stay
`imyitwarire`. Keep them apart with the **head noun**, never by swapping the
term:

| English | Kinyarwanda |
|---|---|
| Discipline (the portal) | Imyitwarire |
| Behaviour report | Raporo y'imyitwarire |
| Conduct grade | Urwego rw'imyitwarire |
| Discipline marks | Amanota y'imyitwarire |

---

## Status

**Reviewed and fully confirmed (2026-08-15). No rows outstanding.**

This file is now the reference. Any new string must reuse a term from the tables
above rather than inventing a synonym. If a term genuinely needs to change, change
it here first, then sweep `rw.json` — never edit `rw.json` alone.
