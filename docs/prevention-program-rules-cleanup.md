# Prevention program — rules & variables cleanup

Program: **១.កម្មវិធីបង្ការសហគមន៍** (`gmO3xUubvMb`)

## Problem

DHIS2 Maintenance has **185 program rules** and **181 rule variables** linked to Prevention, but most belong to **PrEP**, **STI**, **Kit**, and **GIS** workflows copied onto the same program.

Capture only needs **~15 rules** and **~23–30 variables** for:

| Stage | ID | Purpose |
|-------|-----|---------|
| Prevention Form | `mX4OjpyZw3A` | F1/F2 education, referral, GBV, PrEP offer |
| Risk assessment | `hqJKFmOU6s7` | Risk behaviour, risk level (High/Medium/Low) |

## What Capture does now (app filter)

For program `gmO3xUubvMb` only, metadata loading **drops**:

- Rules whose names start with `PrEP`, `STI`, `Kit_`, `GIS `
- Variables whose names start with `PrEP `, `STI_`, `Kit_`, `GIS ` (plus unused DE variables)

Implementation: `src/lib/preventionProgramRulesManifest.js` → `metadataService.js`

This makes the form behave correctly **without** deleting DHIS2 data yet.

## Rules to **keep** (15)

| Rule | Purpose |
|------|---------|
| Assign Last Modality | Copy test modality to profile |
| Assign New 5.Next appointment Date | F1 appointment |
| Assign New 7.Next appointment Date | F7 appointment |
| Prev Assign ART Code to Attribute | ART code → TEI |
| Prev assign HIV confirm result | HIV confirm positive |
| Risk_1_IS Feamle hide 2Male TG | Sex at birth = female |
| Risk_1_IS Male hide 6.6abortion 2Female | Sex at birth = male |
| Risk_3_Is No Skip 4 5 7 | No sex in 6m → hide sections |
| Risk_6_IS Non-above is clear all section 6 | “None of above” clears section 6 |
| Risk_9_Is Yes Skip 10 | On PrEP → skip HIV test block |
| Risk_11_Is Never Test Skip 12 | Never tested → hide result |
| Risk result is High Risk | Assign High Risk + warning |
| Risk result is Medium Risk | Assign Medium Risk + warning |
| Risk result is Low Risk | Assign Low Risk + warning |
| Ulceration (Ano) uncheck | Hide related field when empty |

## Variables to **keep** (23 used by rules above)

`Risk_1sex at birth`, `Risk_3sex6m`, `Risk_5partner`, `Risk_6.10-non above`, `Risk_61Receive money` … `Risk_11HIVresult`, `Risk_9PrEP`, `Risk_10HIV tested`, plus:

- `DE modality`, `Next appointment Date`, `ART DE`, `Pre confirm hiv result-F2 form`, `Ulceration Ano`
- TEI variables used for assigns (e.g. last modality, HIV status on profile)

Run the audit script for the full list on your server.

## Clean DHIS2 (recommended)

### 1. Audit

```bash
cd capture
DHIS2_URL=http://localhost:8080 DHIS2_USER=sovandara DHIS2_PASS='your-password' \
  node scripts/prevention-program-rules-audit.mjs --json /tmp/prevention-audit.json
```

### 2. Delete orphan rules in Maintenance

1. Open **Maintenance → Program rules**
2. Filter program: **1.Prevention Program**
3. Delete (or move to correct program) all rules starting with **PrEP**, **STI**, **Kit_**, **GIS**
4. Keep the 15 rules in the table above

Or use **Capture → Programs → Program rules** (superuser) to review before delete.

### 3. Delete orphan variables

1. **Maintenance → Program rule variables**
2. Program: **1.Prevention Program**
3. Remove variables with prefixes `PrEP `, `STI_`, `Kit_`, `GIS `
4. Remove unused DE variables not in the keep list (audit script lists `orphanVariableNames`)

### 4. Verify each keep rule

- **programStage** on the rule should be **Risk assessment** (`hqJKFmOU6s7`) for `Risk_*` rules, or empty / correct stage for F1/F2 assigns
- Actions must reference **current** data element UIDs (re-link if stages were rebuilt)
- Conditions use **Khmer + English** option labels where needed (`ទេ`, `បាទ/ចាស`, `ស្រី`, `ប្រុស`)

### 5. Test in Capture

1. Select Prevention program + org unit
2. Register / open profile → **Risk assessment** tab
3. Confirm section gates, sex skip, risk level assign
4. **Prevention Form** tab → modality / appointment assigns

## Creating new rules

Use **Capture → Programs → Program rules** (superuser):

1. Condition: use variable names exactly as in **Program rule variables** (`#{Risk_3sex6m}`)
2. Actions: `HIDEFIELD`, `HIDESECTION`, `HIDEOPTION`, `ASSIGN`, `SHOWWARNING` (supported in Capture)
3. Avoid `DISPLAYTEXT`, `SCHEDULEEVENT` (limited support — see Program rules reference panel)

Prefer **one rule per behaviour** (easier to debug than huge combined conditions).

## Related code

| File | Role |
|------|------|
| `src/lib/preventionProgramRulesManifest.js` | Filter definitions |
| `src/services/metadataService.js` | Applies filter on load |
| `src/services/ruleEngine.js` | Evaluates filtered rules |
| `scripts/prevention-program-rules-audit.mjs` | Server audit CLI |
