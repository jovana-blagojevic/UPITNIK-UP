/* ══════════════════════════════════════════════════════════════════════════
   UPITNIK „UMETNIČKE PREFERENCIJE NASTAVNIKA" (muzička · likovna kultura)
   Apps Script — prijem odgovora i upis u Google Sheets
   ──────────────────────────────────────────────────────────────────────────
   OVAJ FAJL JE IZVOR ISTINE ZA SERVERSKI KOD. Kod se NE izvršava iz Git-a —
   nalepi ga u Apps Script editor tabele u koju se upisuje (Code.gs).


   UKRATKO:
     1. Google tabela → Extensions → Apps Script
     2. Nalepi ovaj fajl u „Code.gs"
     3. Proveri da je TOKEN ispod IDENTIČAN sa window.UPITNIK_TOKEN u
        assets/config.js — ako nije, svaki odgovor se odbija sa greska:'token'
     4. Deploy → New deployment → Web app
          Execute as:     Me
          Who has access: Anyone     ← bez ovoga anonimni fetch dobija Google
                                       login stranu umesto JSON-a i upis pada
     5. Kopiraj „/exec" URL u window.UPITNIK_URL u assets/config.js

   ⚠️ Posle SVAKE izmene ovog koda: Deploy → Manage deployments → ✏️ →
      Version: New version → Deploy. URL ostaje isti; bez ovog koraka i dalje
      radi stara verzija.

   KAKO RADI (uparuje se sa assets/script.js):
     • Klijent POST-uje ravan JSON: sva polja forme (po „name") + token + _id.
       Telo ide BEZ Content-Type: application/json (namerno — izbegava CORS
       preflight); Apps Script svejedno čita e.postData.contents.
     • saglasnost stiže kao 'da' — sam crtež potpisa se NIKAD ne šalje.
     • _id je oznaka pokušaja slanja. Ako mreža pukne posle timeout-a, a red je
       već upisan, ponovni klik nosi ISTI _id i server ne pravi drugi red.
     • Numerička polja i Likert odgovori se upisuju kao BROJEVI (ne tekst), pa
       su AVERAGE/STDEV odmah upotrebljivi bez VALUE() omotača.
     • Zaglavlje se pri prvom odgovoru zaseje iz KOLONE — redosled kolona je
       isti kao redosled pitanja u upitniku, od prvog reda. Nepoznati ključevi
       (npr. „Dodaj još" setovi _2, _3…) se dopisuju na kraj, ništa se ne gubi.
   ══════════════════════════════════════════════════════════════════════════ */

/* Mora biti IDENTIČAN sa window.UPITNIK_TOKEN u assets/config.js.
   Nije prava tajna (vidljiv je u brauzeru) — samo minimalna prepreka. */
var TOKEN = '186a42bf4d739191bec4dd5f796e7650410b4f751cf31f6b';

/* tip_upitnika → ime taba. Ujedno i lista dozvoljenih grupa. */
var TABOVI = {
  muzika: 'Muzika',
  likovno: 'Likovna kultura'
};

/* Tehnička polja koja se NE upisuju u tabelu. */
var IZUZMI = { token: true, hp_polje: true, _id: true };

/* Zaštita tabele od „flooding"-a kolona: upis je header-driven, pa bi inače
   bilo ko POST-om sa izmišljenim ključevima mogao da pravi nove kolone bez
   ograničenja. Najveći legitiman payload ima 142 polja. */
var MAX_KLJUCEVA = 250;
var KLJUC_OBLIK = /^[A-Za-z0-9_]{1,48}$/;
var ID_OBLIK = /^[A-Za-z0-9_-]{8,64}$/;
var MAX_DUZINA_VREDNOSTI = 500;

/* Koliko dugo se pamti _id radi prepoznavanja duplikata (6 h = maksimum
   koji CacheService dozvoljava; jedno popunjavanje traje 10–15 min). */
var DEDUPE_SEK = 21600;

/* Opsezi Likert skala — provereni prema value atributima u samim upitnicima.
   Vrednost van opsega znači ručno menjanje zahteva, ne grešku učesnika. */
var OPSEG_SKALA = [
  [/^[ml]_pref\d+$/,   1, 5],  // Umetničke preferencije
  [/^m_sastav\d+$/,    1, 5],  // Izvođački sastavi
  [/^l_tehnika\d+$/,   1, 5],  // Likovne tehnike
  [/^trad\d+$/,        1, 5],  // Tradicionalno vs. savremeno
  [/^van\d+$/,         1, 5],  // Aktivnosti van škole
  [/^motiv\d+$/,       1, 5],  // Motivacija u nastavi
  [/^razlike\d+$/,     1, 5],  // Razlike nastavnik/učenik
  [/^pedagog\d+$/,     1, 5],  // Pedagoški pristup
  [/^izraz\d+$/,       1, 5],  // Pedagoški izraz preferencija
  [/^swls\d+$/,        1, 7],  // SWLS
  [/^lic\d+$/,         1, 5]   // Skala ličnosti
];

/* ── Kanonski redosled kolona po grupi ────────────────────────────────────
   Izvučen iz DOM redosleda <input name> u strane/index-*.html. Ako menjaš
   pitanja u upitniku, ove liste moraju da prate izmenu — inače će nova polja
   samo završiti na kraju tabele umesto na svom mestu.
   ────────────────────────────────────────────────────────────────────────── */
var KOLONE = {
  muzika: [
    "_vreme", "tip_upitnika", "nivo_zaposlenja", "pol", "godine",
    "staz", "m_obrazovanje", "mesto", "druga_institucija", "druga_institucija_tekst",
    "predmeti", "m_pref1", "m_pref2", "m_pref3", "m_pref4",
    "m_pref5", "m_pref6", "m_pref7", "m_pref8", "m_pref9",
    "m_pref10", "m_pref11", "m_pref12", "m_pref13", "m_pref14",
    "m_pref15", "m_pref16", "m_pref17", "m_pref18", "m_sastav1",
    "m_sastav2", "m_sastav3", "m_sastav4", "m_sastav5", "trad1",
    "trad2", "trad3", "van_skole", "van_skole_tekst", "van1",
    "van2", "van3", "van4", "van5", "van6",
    "van7", "motiv1", "motiv2", "motiv3", "motiv4",
    "motiv5", "motiv6", "razlike1", "razlike2", "razlike3",
    "pedagog1", "pedagog2", "pedagog3", "pedagog4", "identitet",
    "izraz1", "izraz2", "izraz3", "izraz4", "swls1",
    "swls2", "swls3", "swls4", "swls5", "lic1",
    "lic2", "lic3", "lic4", "lic5", "lic6",
    "lic7", "lic8", "lic9", "lic10", "lic11",
    "lic12", "lic13", "lic14", "lic15", "lic16",
    "lic17", "lic18", "lic19", "lic20", "lic21",
    "lic22", "lic23", "lic24", "lic25", "lic26",
    "lic27", "lic28", "lic29", "lic30", "lic31",
    "lic32", "lic33", "lic34", "lic35", "lic36",
    "lic37", "lic38", "lic39", "lic40", "lic41",
    "lic42", "lic43", "lic44", "lic45", "lic46",
    "lic47", "lic48", "lic49", "lic50", "lic51",
    "lic52", "lic53", "lic54", "lic55", "lic56",
    "lic57", "lic58", "lic59", "lic60", "lic61",
    "lic62", "lic63", "lic64", "lic65", "lic66",
    "lic67", "lic68", "lic69", "lic70", "saglasnost"
  ],
  likovno: [
    "_vreme", "tip_upitnika", "nivo_zaposlenja", "pol", "godine",
    "staz", "l_obrazovanje", "mesto", "druga_institucija", "druga_institucija_tekst",
    "predmeti", "l_pref1", "l_pref2", "l_pref3", "l_pref4",
    "l_pref5", "l_pref6", "l_pref7", "l_pref8", "l_pref9",
    "l_pref10", "l_pref11", "l_tehnika1", "l_tehnika2", "l_tehnika3",
    "l_tehnika4", "l_tehnika5", "l_tehnika6", "trad1", "trad2",
    "trad3", "van_skole", "van_skole_tekst", "van1", "van2",
    "van3", "van4", "van5", "van6", "van7",
    "motiv1", "motiv2", "motiv3", "motiv4", "motiv5",
    "motiv6", "razlike1", "razlike2", "razlike3", "pedagog1",
    "pedagog2", "pedagog3", "pedagog4", "identitet", "izraz1",
    "izraz2", "izraz3", "izraz4", "swls1", "swls2",
    "swls3", "swls4", "swls5", "lic1", "lic2",
    "lic3", "lic4", "lic5", "lic6", "lic7",
    "lic8", "lic9", "lic10", "lic11", "lic12",
    "lic13", "lic14", "lic15", "lic16", "lic17",
    "lic18", "lic19", "lic20", "lic21", "lic22",
    "lic23", "lic24", "lic25", "lic26", "lic27",
    "lic28", "lic29", "lic30", "lic31", "lic32",
    "lic33", "lic34", "lic35", "lic36", "lic37",
    "lic38", "lic39", "lic40", "lic41", "lic42",
    "lic43", "lic44", "lic45", "lic46", "lic47",
    "lic48", "lic49", "lic50", "lic51", "lic52",
    "lic53", "lic54", "lic55", "lic56", "lic57",
    "lic58", "lic59", "lic60", "lic61", "lic62",
    "lic63", "lic64", "lic65", "lic66", "lic67",
    "lic68", "lic69", "lic70", "saglasnost"
  ]
};


/* ── Ulazne tačke ─────────────────────────────────────────────────────────── */

/* Otvaranje /exec URL-a u brauzeru — da se odmah vidi da servis radi. */
function doGet() {
  return _json({ status: 'ok', poruka: 'Servis radi. Odgovori stižu POST zahtevom iz upitnika.' });
}


function doPost(e) {
  /* Lock serijalizuje upise: bez njega bi dva istovremena slanja mogla da
     pokvare zaglavlje ili da pišu u isti red. */
  var lock = LockService.getScriptLock();
  var imamLock = false;
  try {
    lock.waitLock(25000);
    imamLock = true;

    if (!e || !e.postData || !e.postData.contents) {
      return _json({ status: 'error', greska: 'prazan_zahtev' });
    }

    var p = JSON.parse(e.postData.contents);

    /* 1) Token — minimalna prepreka (nije prava tajna, vidi config.js). */
    if (p.token !== TOKEN) {
      return _json({ status: 'error', greska: 'token' });
    }

    /* 2) Honeypot — popunjeno znači bot. Tiho prihvati (da bot ne sazna da je
          otkriven), ali NE upisuj ništa. */
    if (p.hp_polje && String(p.hp_polje).trim() !== '') {
      return _json({ status: 'ok' });
    }

    /* 3) Duplikat: isti _id je već upisan (ponovni klik posle mrežnog
          timeout-a). Vrati ok — učesnik vidi zahvalnicu, tabela ostaje čista. */
    var cache = CacheService.getScriptCache();
    var kljucId = null;
    if (p._id && ID_OBLIK.test(String(p._id))) {
      kljucId = 'poslato_' + String(p._id);
      if (cache.get(kljucId)) {
        return _json({ status: 'ok', napomena: 'duplikat' });
      }
    }

    /* 4) Osnovna validacija ključnih polja. */
    var tip = String(p.tip_upitnika || '');
    if (!TABOVI[tip]) {
      return _json({ status: 'error', greska: 'tip_upitnika' });
    }

    /* Unakrsna provera koju pojedinačna polja ne mogu da uhvate:
       staž ne može da premaši radni vek (najranije zaposlenje sa 18). */
    if (Number(p.staz) > Number(p.godine) - 18) {
      return _json({ status: 'error', greska: 'staz_veci_od_radnog_veka' });
    }

    /* 5) Oblik payload-a — broj i imena ključeva (vidi MAX_KLJUCEVA gore). */
    var kljucevi = Object.keys(p);
    if (kljucevi.length > MAX_KLJUCEVA) {
      return _json({ status: 'error', greska: 'previse_polja' });
    }
    for (var i = 0; i < kljucevi.length; i++) {
      if (!KLJUC_OBLIK.test(kljucevi[i])) {
        return _json({ status: 'error', greska: 'nedozvoljeno_polje' });
      }
    }

    /* 6) Upis u tab odgovarajuće grupe (pravi ga ako ne postoji). */
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sh = ss.getSheetByName(TABOVI[tip]) || ss.insertSheet(TABOVI[tip]);
    upisiRed(sh, p, tip);

    if (kljucId) cache.put(kljucId, '1', DEDUPE_SEK);
    return _json({ status: 'ok' });

  } catch (err) {
    return _json({ status: 'error', greska: String(err && err.message ? err.message : err) });
  } finally {
    if (imamLock) lock.releaseLock();
  }
}


/* ── Upis ─────────────────────────────────────────────────────────────────── */

/* Upisuje jedan red. Prazan tab dobija kompletno kanonsko zaglavlje odjednom;
   kasnije se dopisuju samo ključevi koje zaglavlje još nema. */
function upisiRed(sh, p, tip) {
  var lastCol = sh.getLastColumn();
  var header = lastCol > 0 ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
  var prazno = !header.length || header.every(function(h) { return String(h).trim() === ''; });

  if (prazno) {
    header = (KOLONE[tip] || ['_vreme']).slice();
    var maxKol = sh.getMaxColumns();
    if (maxKol < header.length) sh.insertColumnsAfter(maxKol, header.length - maxKol);
    sh.getRange(1, 1, 1, header.length).setValues([header]);
  }

  /* Mapa: ime kolone → indeks. */
  var idx = {};
  header.forEach(function(h, i) { idx[h] = i; });

  /* Dopiši kolone za ključeve koje zaglavlje još nema (npr. „Dodaj još"
     setovi _2, _3… ili polje dodato u upitnik posle prvog odgovora). */
  var novi = [];
  Object.keys(p).forEach(function(k) {
    if (IZUZMI[k]) return;
    if (!(k in idx)) {
      idx[k] = header.length + novi.length;
      novi.push(k);
    }
  });
  if (novi.length) {
    var maxK = sh.getMaxColumns();
    if (maxK < header.length + novi.length) sh.insertColumnsAfter(maxK, header.length + novi.length - maxK);
    sh.getRange(1, header.length + 1, 1, novi.length).setValues([novi]);
    header = header.concat(novi);
  }

  /* Sastavi ceo red PRE upisa — ako neka vrednost ispadne iz opsega,
     vrednostZaUpis baca izuzetak i tabela ostaje netaknuta. */
  var red = new Array(header.length).fill('');
  if ('_vreme' in idx) red[idx['_vreme']] = new Date();
  Object.keys(p).forEach(function(k) {
    if (!IZUZMI[k]) red[idx[k]] = vrednostZaUpis(k, p[k]);
  });
  sh.appendRow(red);
}


/* ── Vrednosti ────────────────────────────────────────────────────────────── */

/* Opseg za polje koje mora da bude ceo broj, ili null za tekstualna polja. */
function opsegZa(k) {
  if (k === 'godine') return [18, 80];  // godine starosti
  if (k === 'staz') return [0, 60];     // godine staža
  for (var i = 0; i < OPSEG_SKALA.length; i++) {
    if (OPSEG_SKALA[i][0].test(k)) return [OPSEG_SKALA[i][1], OPSEG_SKALA[i][2]];
  }
  return null;
}

/* Brojna polja se upisuju kao BROJEVI (ne tekst) — inače AVERAGE/STDEV u
   tabeli ne rade bez VALUE(). Prazna opciona polja ostaju prazna ćelija. */
function vrednostZaUpis(k, v) {
  var opseg = opsegZa(k);
  if (!opseg) return bezbednaVrednost(v);

  if (v === '' || v === null || v === undefined) return '';
  var n = Number(v);
  if (!isFinite(n) || Math.floor(n) !== n || n < opseg[0] || n > opseg[1]) {
    throw new Error('opseg_polja:' + k);
  }
  return n;
}

/* Zaštita od CSV/formula injection: vrednost koju Sheets može protumačiti kao
   formulu (počinje sa = + - @, ili vodeći tab/CR) tretiraj kao čist tekst —
   dodaj vodeći apostrof. Stringovi se i skraćuju (legitimna polja su kratka;
   saglasnost stiže kao 'da'). */
function bezbednaVrednost(v) {
  if (typeof v !== 'string') return v;
  v = v.slice(0, MAX_DUZINA_VREDNOSTI);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}


/* Pomoćnik: JSON odgovor sa ispravnim MIME tipom. */
function _json(o) {
  return ContentService
    .createTextOutput(JSON.stringify(o))
    .setMimeType(ContentService.MimeType.JSON);
}
