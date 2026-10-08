# Prevention program — data elements vs rules (audit)

Run validation anytime:

```bash
DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='…' \
  node scripts/prevention-program-rules-validate-de.mjs
```

## Stages (localhost)

| Stage | ID | Data elements |
|-------|-----|----------------|
| Prevention Form | `mX4OjpyZw3A` | 65 |
| Risk assessment (ឧបករណ៍វាយតម្លៃកម្រិតប្រឈម) | `hqJKFmOU6s7` | 30 |

**Rule of thumb:** A program rule action must use a data element that is assigned to that **program stage** in Maintenance. Old rule exports often still reference removed or renamed fields.

## Rules that work (DE on stage)

- Assign Last Modality (TEA only — `DE modality` → `ljaGyg7JxlW` is on form as “HIV/Syphilis Test Through by”)
- Prev Assign ART Code to Attribute (`PUKzRWPVjmX` ART Code)
- Prev assign HIV confirm result (`IYQYsPz7r0D`)
- Risk result High / Medium / Low (`MBizmGFOeZg` on risk stage)
- Risk_11, Risk_1 (both), Risk_3, Risk_9, Risk_6 (mostly — see below)

## Rules with **old / missing** data elements

| Rule | Problem |
|------|---------|
| Assign New 5.Next appointment Date | `sQTg1yi0e7A` — **not on any Prevention stage** |
| Assign New 7.Next appointment Date | `MCX2Ota7rva` — **not on any Prevention stage** |
| Ulceration (Ano) uncheck | `IQdj9J1XEUz` — **not on program**; rule has 0 actions |
| Risk_6_IS Non-above… | `Mm3MCV89ukA` (7.10 Injected drug) — **removed from form**; chemsex is `FdYD7ISx2s6` |

## Variables with missing DE on form

| Variable | DE | Status |
|----------|-----|--------|
| Next appointment Date | `jLmirx3TTgI` | Not on Prevention stages |
| Risk_69injected | `Mm3MCV89ukA` | Not on stages |
| Ulceration Ano | `IQdj9J1XEUz` | Not on stages |

## Before creating new rules

1. Open **Maintenance → Program stage → Data elements** for Prevention Form or Risk stage.
2. Confirm the field exists and note its **UID**.
3. Create the **program rule variable** pointing at that DE.
4. Create the **rule** with actions only on those DEs.
5. Run `prevention-program-rules-validate-de.mjs`.

## Recommended cleanup (localhost)

1. **Delete or disable** appointment rules (no appointment DE on this program anymore).
2. **Delete** Ulceration rule shell (no field).
3. **Edit** Risk_6 rule — remove actions for `Mm3MCV89ukA` (or drop variable `Risk_69injected`).
4. Re-export spec from live stages after form is final.
