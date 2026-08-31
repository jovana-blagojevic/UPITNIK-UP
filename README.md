# Upitnik — Umetničke preferencije nastavnika

Anonimni onlajn upitnik za istraživanje koje sprovode **Pedagoški fakultet u Somboru** i
**Akademija umetnosti Univerziteta u Novom Sadu**. Namenjen je nastavnicima muzičke i
likovne kulture.

Statičan sajt: nema build koraka, nema zavisnosti, nema servera. Dovoljno je otvoriti
`index.html` u pretraživaču.

## Tok za učesnika

```
index.html  →  strane/index-muzika.html      (nastavnici muzičke kulture)
            →  strane/index-likovno.html     (nastavnici likovne kulture)
```

Upitnik ima 12 sekcija: demografija, umetničke preferencije, izvođački sastavi (odn.
likovne tehnike), tradicionalno nasuprot savremenom, aktivnosti van škole, motivacija u
nastavi, razlike u preferencijama nastavnika i učenika, pedagoški pristup, profesionalni
identitet, pedagoški izraz preferencija, zadovoljstvo životom (SWLS) i skala ličnosti
(70 stavki). Popunjavanje se završava potpisom saglasnosti na kanvasu.

Odgovori se šalju kao JSON na Google Apps Script, koji ih upisuje u Google tabelu — po
jedan tab za svaku grupu (**Muzika**, **Likovna kultura**).

## Puštanje u rad

### 1. Google tabela i Apps Script

Nova tabela (zasebna od MSF upitnika) → `Extensions → Apps Script` →
`server/apps-script.gs` u `Code.gs` i `server/apps-script-setup.gs` kao drugi
fajl → `Deploy → New deployment → Web app` (*Execute as: Me*, *Who has access:
Anyone*) → kopiraj `/exec` URL.

Konstanta `TOKEN` u `apps-script.gs` **već je popunjena** i mora ostati identična
onoj u `assets/config.js`.

> ⚠️ Posle **svake** izmene `.gs` koda: `Manage deployments → uredi → New
> version`. URL ostaje isti; bez toga i dalje radi stara verzija.

### 2. Konfiguracija

Nalepi taj URL u `assets/config.js`:

```js
window.UPITNIK_URL = 'https://script.google.com/macros/s/…/exec';
```

⚠️ Dok je ovo polje prazno, forma radi i validira, ali **ne šalje** — prikazuje poruku o
nedostajućoj konfiguraciji.

### 2b. Meni „Upitnik" u tabeli

Posle nalepljivanja `server/apps-script-setup.gs` i osvežavanja tabele:

- **1 · Pripremi tabele** — tabovi *Muzika* i *Likovna kultura* sa svim kolonama
  pravim redom, zamrznutim i stilizovanim zaglavljem i beleškom sa punim tekstom
  pitanja na svakoj koloni. Postojeći odgovori se ne diraju.
- **2 · Napravi legendu** — tab „Legenda": sekcija, pun tekst pitanja i opseg
  vrednosti za svaku od 274 kolone. Nezamenjivo pri analizi (`lic47` sam za sebe
  ne govori ništa).
- **3 · Osveži pregled** — tab „Pregled": broj odgovora po grupi, prvi i poslednji.
- **Napravi / Obriši TEST tabele** — `(TEST)` tabovi sa izmišljenim odgovorima.
- **⚠️ Resetuj podatke** — briše sve odgovore, zadržava zaglavlje i stil, uz
  potvrdu. Pokreni posle probnog kruga, pre pravog prikupljanja.

### 3. Dokumenta — ⚠️ još nedostaju

Ubaci u `assets/dokumenta/`:

- `potvrda-eticke-komisije.pdf`
- `informisani-pristanak-muzika.pdf`
- `informisani-pristanak-likovno.pdf`

Linkovi na njih već postoje u uvodu i u bloku saglasnosti.

### 4. GitHub Pages

Push na `main` i uključi Pages (`Settings → Pages → Deploy from a branch → main /`).
`index.html` mora ostati u korenu repozitorijuma.

## Bezbednost i privatnost

- **Anonimno.** Ne prikupljaju se ime, e-adresa ni IP.
- **Potpis se ne šalje.** Crtež sa kanvasa ostaje u pretraživaču; server dobija samo
  `saglasnost: 'da'`.
- **Bez CDN-a.** Fontovi (Lora, Source Sans 3) su lokalni — pretraživač učesnika ne šalje
  zahtev nijednom trećem serveru.
- **`config.js` je namerno u Git-u.** GitHub Pages servira samo verzionisane fajlove, a
  URL i token su ionako vidljivi u pretraživaču. Token nije tajna — on je minimalna
  prepreka. Pravu zaštitu radi Apps Script: provera tokena, honeypot polje, validacija
  opsega za godine i staž, ograničenje broja i oblika polja, i sanitizacija protiv
  CSV/formula injectiona.
- **Jedno popunjavanje po uređaju.** Posle uspešnog slanja `localStorage` dobija ključ
  `upitnik_up_popunjen`; ponovni ulazak prikazuje poruku zahvalnosti. Blokada je po
  **uređaju**, ne po osobi, pa taj ekran ima diskretno dugme *„Nisam ja — upitnik
  popunjava drugi učesnik"* — bez njega bi jedan računar u zbornici tiho odbijao
  sve nastavnike posle prvog.
- **Bez duplikata pri ponovnom slanju.** Svaki pokušaj nosi oznaku `_id` koju server
  pamti 6 sati; ponovni klik posle mrežnog prekida ne pravi drugi red.

## Odnos prema MSF upitniku

Ovo je zaseban projekat od upitnika *Grupne aktivnosti i blagostanje: muzika, sport i
folklor*. Deli dizajn-sistem i mehaniku forme, ali koristi **svoju tabelu, svoj deployment
i svoj token**. Ključevi u `localStorage` nose prefiks `upitnik_up_` upravo zato da učesnik
koji je popunio onaj upitnik ne bi bio blokiran na ovom (`localStorage` se deli po
origin-u, a ne po folderu).

## Razvoj

Nema alata za build. Za lokalni rad je dovoljno:

```bash
python3 -m http.server 8000
```

Uređivanje sadržaja: tekst stavki je direktno u `strane/index-*.html`. `assets/style.css` i
`assets/script.js` dele obe strane — izmena utiče na oba upitnika.

Detaljna arhitektura, imena polja i konvencije: vidi [CLAUDE.md](CLAUDE.md).
