# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design skill

Always invoke the `frontend-design` skill when making any UI, layout, or styling changes to this project.

## Project overview

**Upitnik UP** ("umetničke preferencije") is a static multi-page research survey conducted jointly by the Faculty of Education in Sombor (Pedagoški fakultet u Somboru) and the Academy of Arts, University of Novi Sad. Respondents are **teachers of music (muzička kultura) and visual arts (likovna kultura)**. They pick their teaching subject, then fill in demographics, domain-specific aesthetic preferences, several teaching-related scales, SWLS, and a 70-item personality scale, then sign a canvas consent block.

The participant flow is two steps: `index.html` (pick subject) → `strane/index-{grupa}.html` (the questionnaire). There is **no intermediate level-selection screen and no `?nivo=` query param** — the level of education the respondent teaches at is just the first demographic question, because nothing in the form branches on it.

On submit (after client-side validation), the form POSTs the collected answers as JSON to a Google Apps Script endpoint read from `assets/config.js` (`window.UPITNIK_URL` / `window.UPITNIK_TOKEN`). `assets/config.js` **is committed** — the site is deployed via GitHub Pages, which serves only files tracked in Git, and the token is not a real secret (it is visible client-side anyway). The real protection is server-side in `server/apps-script.gs` (token + honeypot + range validation + CSV/formula-injection sanitization). Each submit attempt carries an `_id` the server remembers for 6 h, so a retry after a network timeout never produces a duplicate row. On success it sets a `localStorage` flag (`upitnik_up_popunjen` + `upitnik_up_popunjen_{tip}`) to block re-submission and swaps the card for a `.hvala` thank-you message; on network/error it shows an `alert()`.

The block screen carries a discreet `.hvala-ponovo` button ("Nisam ja — upitnik popunjava drugi učesnik") that clears those keys and reloads. `localStorage` is per *device*, not per person; without the escape a single shared computer in a staff room would silently turn away every teacher after the first.

No build step. No package manager. No test runner. Open any `.html` file directly in a browser to develop.

## Relationship to the MSF questionnaire

This project is a **sibling** of the MSF questionnaire (*Sport, music, folklore* — group activities and wellbeing). It reuses that project's design system and generic form engine verbatim, but it is a **separate study with its own Google Sheet, its own Apps Script deployment and its own token**. Never point `UPITNIK_URL` here at the MSF endpoint: `tip_upitnika=muzika` exists in both and would collide in the "Muzika" tab.

⚠️ **`localStorage` keys must keep the `upitnik_up_` prefix.** `localStorage` is scoped per *origin*, not per folder. If both sites are served from the same GitHub Pages account, sharing a key would make a participant who filled in the MSF survey appear as already-completed here.

Differences from MSF worth knowing when porting changes between the two:
- no `nivo-*.html` screens, no `?nivo=` param, no `.nivo-blok` machinery
- the `.vodja-grananje` / `.vodja-blok` pair is generalised here to `.grananje` / `.uslovni-blok`
- text inputs with class `.unos-linija` **are** validated here (in MSF they were all optional)
- no "Dodaj još" repeated-entry question

## File structure

```
index.html                — Landing page: pick teaching subject (stays at repo root — GitHub Pages entry point)
strane/                   — Questionnaire pages
  index-muzika.html       — Music teachers
  index-likovno.html      — Visual-arts teachers
assets/                   — Static resources
  style.css               — All styles; single source of truth for the design system
  script.js               — Form behaviour: conditional block, "Drugo" input, canvas signature, validation, autosave
  config.js               — window.UPITNIK_URL / UPITNIK_TOKEN (committed — served by GitHub Pages)
  favicon.svg             — Site icon
  fonts/                  — Self-hosted Lora + Source Sans 3 (woff2, latin + latin-ext); @font-face at the top of style.css
  logos/                  — Institutional emblems shown in index.html header (white-treated on the dark header)
  dokumenta/              — Consent + ethics PDFs (see "Pending" below)
server/                   — Google Apps Script (source of truth; NOT executed from Git — paste into the Apps Script editor)
  apps-script.gs          — Receives POSTs, validates + sanitizes, writes to Google Sheets (tab per group).
                            Holds `KOLONE` — the canonical column order per group, taken from the DOM order
                            of `<input name>` in `strane/index-*.html`. Editing questions means editing this.
  apps-script-setup.gs    — Sheet menu „Upitnik": prepare/style tabs, Legenda tab (full question text per
                            column), Pregled tab (counts), TEST tabs, and „Resetuj podatke". Reads TABOVI /
                            KOLONE / opsegZa() straight out of apps-script.gs — Apps Script shares one global
                            scope across files, so the header and the writer cannot drift apart.
```

Paths are relative: pages in `strane/` reference assets as `../assets/…`; `index.html` at the root uses `assets/…` and `strane/…`.

## Architecture

**Both questionnaires share `style.css` and `script.js`.** Changes to either file affect both.

Each questionnaire is structured as:
1. `.upitnik-header` — dark charcoal header with badge + H1
2. `<form id="forma">` — cream panel inside the dark card
   - `<input type="hidden" name="tip_upitnika">` — `muzika` or `likovno`
   - `<section class="sekcija" id="demografija">` — subject-specific demographics
   - eleven further `<section class="sekcija">` blocks (see order below)
   - `.saglasnost-blok` — canvas signature consent block
   - `.podnozje-forme` — submit button

Section order is identical in both files:

| # | Sekcija | Polja | Skala |
|---|---|---|---|
| 1 | Demografija | see below | — |
| 2 | Umetničke preferencije | `m_pref1`–`18` / `l_pref1`–`11` | 1–5 dopadanje |
| 3 | Izvođački sastavi / Likovne tehnike | `m_sastav1`–`5` / `l_tehnika1`–`6` | 1–5 dopadanje |
| 4 | Tradicionalno vs. savremeno | `trad1`–`3` | 1–5 slaganje |
| 5 | Aktivnosti van škole | `van_skole`, `van_skole_tekst`, `van1`–`7` | Da/Ne + 1–5 |
| 6 | Motivacija u nastavi | `motiv1`–`6` | 1–5 slaganje |
| 7 | Razlike nastavnik/učenik | `razlike1`–`3` | 1–5 slaganje |
| 8 | Pedagoški pristup | `pedagog1`–`4` | 1–5 slaganje |
| 9 | Profesionalni identitet | `identitet` | jednostruki izbor od 4 |
| 10 | Pedagoški izraz preferencija | `izraz1`–`4` | 1–5 slaganje |
| 11 | Zadovoljstvo životom (SWLS) | `swls1`–`5` | 1–7 (`.likert-7`) |
| 12 | Skala ličnosti | `lic1`–`lic70` | 1–5 slaganje |

Demographics: `nivo_zaposlenja` · `pol` · `godine` (18–80) · `staz` (0–60) · `m_obrazovanje` / `l_obrazovanje` · `mesto` · `druga_institucija` (+ `druga_institucija_tekst`) · `predmeti`.

**Field naming is deliberate:** items that differ between the two versions carry an `m_` / `l_` prefix; items whose wording is only lightly adapted (`trad`, `van`, `motiv`, `razlike`, `pedagog`, `izraz`, `swls`, `lic1`–`lic70`) share the **same** names in both files so the two tabs can be pooled in analysis. The Apps Script writes header-driven columns, so each group's tab gets exactly the columns it sends.

## Design system (style.css)

CSS custom properties are defined on `:root`. Key tokens:

| Token | Value | Use |
|---|---|---|
| `--bg-page` | `#D6CCBA` | Page background |
| `--bg` | `#F3F1EC` | Subtle off-white — unselected option hover, input backgrounds |
| `--povrsina` | `#FDFBF7` | Form panel, selected option backgrounds |
| `--ivica` | `#D5D0C7` | Default borders |
| `--ivica-jak` | `#B5AFA4` | Stronger borders — inputs, section dividers |
| `--tekst` | `#1E1B16` | Primary text |
| `--tekst-slab` | `#58524A` | Secondary text |
| `--tekst-slabi` | `#908880` | Placeholder / tertiary text |
| `--plava` | `oklch(0.34 0.09 250)` | Accent — selected states, focus rings, submit button |
| `--plava-sv` | `oklch(0.96 0.015 250)` | Light accent — hover backgrounds |
| `--plava-ivica` | `oklch(0.60 0.05 250)` | Focused input border |
| `--greska` | `oklch(0.45 0.15 25)` | Error state |
| `--greska-sv` | `oklch(0.96 0.03 25)` | Error background tint |
| `--font-serif` | Lora | Headings, body text, option labels |
| `--font-sans` | Source Sans 3 | UI labels, badges, buttons, Likert numbers |
| `--r-mali` | `3px` | Small border radius |
| `--r-sredi` | `5px` | Medium border radius |
| `--senka` | layered box-shadow | Card and panel shadows |

Both fonts are **self-hosted** (`@font-face` at the top of `style.css`, files in `assets/fonts/`) — no Google Fonts CDN request, for participant privacy. Weights loaded: Lora 400/500/600/700 + italic 400/500; Source Sans 3 300/400/500/600 + italic 300/400. Subset is latin + latin-ext (covers Serbian č/ć/ž/š/đ).

The `.upitnik` card uses a hard-coded `background: #4D4B47` (dark charcoal), not a token. The `.likert-zaglavlje` also uses this dark background.

**Two constraints that look like stylistic choices but are not:**

- `.upitnik` must use `overflow: clip`, **never `overflow: hidden`**. `hidden` makes `.upitnik` the nearest scroll container for `position: sticky`, and since it does not itself scroll, the sticky `.likert-zaglavlje` never pins — on a 70-item personality scale participants lose the "1 = Uopšte se ne slažem … 5 = …" legend within seconds. `.likert-zaglavlje` sits at `top: 4px` to clear the fixed `.napredak-traka`.
- Every `oklch()` value carries an sRGB fallback: a plain hex declaration on the line above for normal properties, and an `@supports (color: oklch(...))` block for the `:root` custom properties (custom properties accept any syntactically valid value, so the cascade does not fall back on its own). Without this, Safari < 15.4 and Chrome < 111 drop `--plava` and the `.likert-opcija input:checked + span` background, and **a selected answer becomes visually indistinguishable from an unselected one**.

`.aktivnosti` on the landing page is a **2-column** grid — the column count is tied to the number of subject cards. Adding a third group means changing that number too, or a blank cell appears.

**Radio option variants:**
- `.opcije-red` / `.opcija` — standard vertical radio list (demographics)
- `.opcije-tvrdnje` — modifier for lists whose options are full 2–4-line statements: the indicator aligns to the *first line* instead of the vertical centre, and options get more breathing room. Used by `#identitet`.
- `.likert-blok` / `.likert-red` / `.likert-opcija` — Likert scale rows
- `.likert-7` modifier — narrows buttons for the 7-point SWLS scale

**Conditional block:**
- `.grananje` — a Da/Ne question in a blue-tinted, left-ruled box. Its `.pitanje-tekst` deliberately overrides the uppercase label treatment: it carries a whole sentence, not a field label.
- `.uslovni-blok` — the block revealed when "Da" is chosen; starts with `.skriveno`. **Must be the immediate next sibling of its `.grananje`.**

**Other:**
- `.dimenzija-naslov` — subheading between Likert blocks within one section (e.g. "Klasična muzika")
- `.pitanje-napomena` — quiet footnote under a question; the "Napomena" label comes from CSS (`::before`), so the markup carries only the sentence

## Form behaviour (script.js)

Independent features:

1. **Conditional block** — a radio inside `.grananje` with `value="da"` reveals the adjacent `.uslovni-blok`; `value="ne"` hides it **and resets it** (radios cleared, text cleared, error/selection classes removed) so hidden answers are never submitted.

2. **"Drugo" activation** — a `.unos-drugo` input is `readOnly` + `tabindex="-1"` until its `.opcija-drugo` radio is selected. Picking a *different* option in the same `.opcije-red` re-locks it **and clears its value** — otherwise the sheet would receive both `druga_institucija=ne` and leftover `druga_institucija_tekst`. `readOnly` rather than `disabled` on purpose: disabled inputs drop out of `FormData`, which would make the payload shape (and therefore the sheet header) vary.

3. **Canvas signature** — `#saglasnost-canvas` captures a freehand signature. On first stroke, the hidden `#saglasnost` input is set to `'potpis'`; on `mouseup`/`touchend` it is updated to the full `canvas.toDataURL()`. The server receives only `'da'`. `potpis_obrisi(canvasId)` clears it.

4. **Submit validation** — blocks submission if any *visible* radio group has no selection, any `type="number"` input is empty / non-integer / out of range, `staz > godine - 18`, any visible `.unos-linija` text input outside `.opciono` is blank, or the canvas is unsigned. Errors are injected as `.greska-tekst` spans; the page scrolls to the first error and a running count sits next to the submit button.

5. **Progress bar / autosave** — a top bar shows the share of visible required questions answered; answers are mirrored to `sessionStorage` and restored after an accidental refresh (signature is not saved).

Hidden questions are skipped everywhere via `pitanje.offsetParent === null`, so the conditional block needs no special-casing in validation or the progress bar.

Note: `.unos-drugo` inputs (e.g. `druga_institucija_tekst`) are **not** validated — they are only relevant when their radio is picked. `van_skole_tekst` is marked `.opciono` and is likewise optional.

## Content conventions

- All text is Serbian, Latin script, sentence case.
- Formal address throughout ("Vi", "Vas", "Vaš").
- Sections have no visible title heading; each section opens directly with its `.skala-uputstvo` instruction. For every Likert scale that instruction ends with a `Skala: <min> = …; <max> = …` legend matching that scale's own endpoints.
- The `.badge` in each header shows the full institutional affiliation.

## Open question

The site is live at <https://jovana-blagojevic.github.io/UPITNIK-UP/> and `assets/config.js` carries a working `/exec` URL, so the form submits. One cosmetic point is still open:

- The empty `(npr. )` parentheses on 12 visual-arts preference items have been removed, so the items read cleanly. The music version still carries composer examples (`m_pref9` → "Bluz (npr. B. B. King, Muddy Waters, Etta James)"); if parity matters, artist examples can be added back to `l_pref1`–`l_pref11` and `l_tehnika*`.
