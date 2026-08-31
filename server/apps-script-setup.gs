/* ══════════════════════════════════════════════════════════════════════════
   UPITNIK „UMETNIČKE PREFERENCIJE NASTAVNIKA" (muzička · likovna kultura)
   Apps Script — priprema, reset i dokumentacija Google tabele
   ──────────────────────────────────────────────────────────────────────────
   Ovo je DRUGI .gs fajl u istom Apps Script projektu, uz apps-script.gs.
   Nalepi ga kao zaseban fajl („+" → Script → nazovi ga „Setup").

   Apps Script sve fajlove jednog projekta deli u istom global scope-u, pa
   ovaj fajl koristi TABOVI, KOLONE i opsegZa() direktno iz apps-script.gs —
   zaglavlje tabele i kod koji upisuje odgovore NE MOGU da se raziđu.

   KAKO SE POKREĆE
     Sačuvaj → osveži tabelu (F5) → u meniju se pojavi „Upitnik ▸ …".
     (Prvo pokretanje traži dozvolu pristupa tabeli — odobri je.)

   ŠTA RADI
     1 · Pripremi tabele      Pravi/stilizuje tabove sa punim, tačnim
                              zaglavljem. Ako tab već ima podatke, sadržaj se
                              NE dira — osvežava se samo stil zaglavlja.
     2 · Napravi legendu      Tab „Legenda": za svaku kolonu pun tekst pitanja
                              ili stavke i opseg vrednosti. Ovo je ono što ti
                              treba za pola godine, kad se vratiš podacima.
     3 · Osveži pregled       Tab „Pregled": broj odgovora po grupi,
                              prvi i poslednji odgovor.
     ─
     Test tabele              Tabovi „… (TEST)" sa primerima odgovora — da
                              vidiš kako tabela izgleda pre nego što pustiš
                              link učesnicima. Slobodno ih obriši posle.
     ⚠️ Resetuj podatke        BRIŠE sve odgovore iz pravih tabova, zadržava
                              zaglavlje i stil. Traži potvrdu. Pokreni ovo
                              posle probnog kruga, pre pravog prikupljanja.

   Ovaj fajl NE utiče na doPost — služi samo za pripremu i održavanje tabele.
   ══════════════════════════════════════════════════════════════════════════ */

var TEST_SUFIKS = ' (TEST)';
var TAB_LEGENDA = 'Legenda';
var TAB_PREGLED = 'Pregled';

/* Boje izvedene iz dizajna upitnika (assets/style.css). */
var STIL = {
  ugljen: '#4D4B47',   // .upitnik tamna kartica
  plava:  '#073964',   // akcenat („izabrano" / dugme) — oklch(0.34 0.09 250) u sRGB
  tekst:  '#F3F1EC',   // krem tekst na tamnoj podlozi
  traka1: '#FBFAF6',   // svetlija traka reda
  traka2: '#EFEDE6',   // tamnija traka reda
  ivica:  '#D5D0C7'    // --ivica
};

/* Sekcije upitnika — redom, prvi pogodak pobeđuje. Zaglavlje smenjuje boju na
   svakoj promeni sekcije, pa se blokovi razdvajaju i bez ijedne ručne izmene. */
var SEKCIJE = [
  [/^_vreme$|^tip_upitnika$/, "Meta"],
  [/^[ml]_pref\d+$/, "Umetničke preferencije"],
  [/^m_sastav\d+$/, "Izvođački sastavi"],
  [/^l_tehnika\d+$/, "Likovne tehnike"],
  [/^trad\d+$/, "Tradicionalno vs. savremeno"],
  [/^van_skole(_tekst)?$|^van\d+$/, "Aktivnosti van škole"],
  [/^motiv\d+$/, "Motivacija u nastavi"],
  [/^razlike\d+$/, "Razlike nastavnik/učenik"],
  [/^pedagog\d+$/, "Pedagoški pristup"],
  [/^identitet$/, "Profesionalni identitet"],
  [/^izraz\d+$/, "Pedagoški izraz preferencija"],
  [/^swls\d+$/, "SWLS — zadovoljstvo životom"],
  [/^lic\d+$/, "Skala ličnosti"],
  [/^saglasnost$/, "Saglasnost"]
];

/* Kolone koje nose tekst ili oznaku i traže širinu; sve ostalo su pojedinačne
   stavke skala i staju u usku kolonu. */
var SIROKE_KOLONE = /^(_vreme|tip_upitnika|nivo_zaposlenja|pol|godine|staz|mesto|predmeti|saglasnost|identitet|van_skole|druga_institucija|[ml]_obrazovanje)/;


/* ── Meni ─────────────────────────────────────────────────────────────────── */

function onOpen() {
  try {
    SpreadsheetApp.getUi()
      .createMenu('Upitnik')
      .addItem('1 · Pripremi tabele', 'pripremiTabele')
      .addItem('2 · Napravi legendu', 'napraviLegendu')
      .addItem('3 · Osveži pregled', 'osveziPregled')
      .addSeparator()
      .addItem('Napravi TEST tabele sa primerima', 'pripremiTestTabele')
      .addItem('Obriši TEST tabele', 'obrisiTestTabele')
      .addSeparator()
      .addItem('⚠️ Resetuj podatke (obriši sve odgovore)', 'resetujPodatke')
      .addToUi();
  } catch (e) { /* bez UI konteksta (npr. trigger) — preskoči */ }
}


/* ── Glavne akcije ────────────────────────────────────────────────────────── */

/* Pravi/stilizuje prave tabove. Ne dira postojeće podatke. */
function pripremiTabele() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABOVI).forEach(function(tip) {
    var sh = ss.getSheetByName(TABOVI[tip]) || ss.insertSheet(TABOVI[tip]);
    var kol;
    if (sh.getLastRow() > 1) {
      /* Već ima odgovore — zadrži zaglavlje kakvo jeste, samo ga restiluj. */
      kol = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    } else {
      kol = KOLONE[tip].slice();
      obezbediSirinu(sh, kol.length);
      sh.getRange(1, 1, 1, kol.length).setValues([kol]);
    }
    stilizujTab(sh, kol, tip);
  });
  poruka('Gotovo.\n\nTabovi ' + Object.keys(TABOVI).map(function(t) { return TABOVI[t]; }).join(' / ') +
         ' su pripremljeni i stilizovani.');
}


/* BRIŠE sve odgovore iz pravih tabova. Zaglavlje i stil ostaju. */
function resetujPodatke() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var stanje = [];
  var ukupno = 0;
  Object.keys(TABOVI).forEach(function(tip) {
    var sh = ss.getSheetByName(TABOVI[tip]);
    var n = sh ? Math.max(0, sh.getLastRow() - 1) : 0;
    ukupno += n;
    stanje.push('  • ' + TABOVI[tip] + ': ' + n);
  });

  if (ukupno === 0) {
    poruka('Nema šta da se briše — svi tabovi su već prazni.');
    return;
  }
  if (!potvrdi('Brisanje odgovora\n\n' + stanje.join('\n') +
               '\n\nUkupno ' + ukupno + ' odgovora biće TRAJNO obrisano.\n' +
               'Zaglavlje i stil ostaju. Nastaviti?')) {
    poruka('Otkazano — ništa nije obrisano.');
    return;
  }

  Object.keys(TABOVI).forEach(function(tip) {
    var sh = ss.getSheetByName(TABOVI[tip]);
    if (!sh) return;
    var n = sh.getLastRow() - 1;
    if (n > 0) sh.deleteRows(2, n);
  });
  poruka('Obrisano ' + ukupno + ' odgovora. Tabela je spremna za prikupljanje.');
}


/* Tab „Legenda": ime kolone → sekcija → pun tekst pitanja → opseg vrednosti. */
function napraviLegendu() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_LEGENDA) || ss.insertSheet(TAB_LEGENDA);
  sh.getBandings().forEach(function(b) { b.remove(); });
  sh.clear();

  var redovi = [['Grupa', 'Kolona', 'Sekcija', 'Pitanje / tvrdnja', 'Vrednost']];
  Object.keys(TABOVI).forEach(function(tip) {
    KOLONE[tip].forEach(function(k) {
      redovi.push([TABOVI[tip], k, sekcijaKolone(k), opisKolone(tip, k), tipVrednosti(k)]);
    });
  });

  obezbediSirinu(sh, 5);
  if (sh.getMaxRows() < redovi.length) sh.insertRowsAfter(sh.getMaxRows(), redovi.length - sh.getMaxRows());
  sh.getRange(1, 1, redovi.length, 5).setValues(redovi);

  sh.getRange(1, 1, 1, 5)
    .setBackground(STIL.ugljen).setFontColor(STIL.tekst)
    .setFontWeight('bold').setFontSize(10).setVerticalAlignment('middle');
  sh.setRowHeight(1, 34);
  sh.setFrozenRows(1);
  [110, 150, 210, 620, 130].forEach(function(w, i) { sh.setColumnWidth(i + 1, w); });
  sh.getRange(2, 1, redovi.length - 1, 5).setVerticalAlignment('top').setFontSize(10);
  sh.getRange(2, 4, redovi.length - 1, 1).setWrap(true);
  sh.getRange(1, 1, redovi.length, 5)
    .setBorder(true, true, true, true, true, true, STIL.ivica, SpreadsheetApp.BorderStyle.SOLID);

  poruka('Legenda napravljena — ' + (redovi.length - 1) + ' kolona opisano.');
}


/* Tab „Pregled": koliko odgovora je stiglo i kada. */
function osveziPregled() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(TAB_PREGLED) || ss.insertSheet(TAB_PREGLED);
  sh.getBandings().forEach(function(b) { b.remove(); });
  sh.clear();

  var redovi = [['Grupa', 'Odgovora', 'Prvi odgovor', 'Poslednji odgovor']];
  var ukupno = 0;

  Object.keys(TABOVI).forEach(function(tip) {
    var s = ss.getSheetByName(TABOVI[tip]);
    var n = s ? Math.max(0, s.getLastRow() - 1) : 0;
    ukupno += n;
    var prvi = '', zadnji = '';
    if (n > 0) {
      var kol = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
      var iVreme = kol.indexOf('_vreme');
      if (iVreme > -1) {
        var vremena = s.getRange(2, 1, n, s.getLastColumn()).getValues()
                       .map(function(r) { return r[iVreme]; })
                       .filter(function(v) { return v instanceof Date; });
        if (vremena.length) {
          prvi = new Date(Math.min.apply(null, vremena));
          zadnji = new Date(Math.max.apply(null, vremena));
        }
      }
    }
    redovi.push([TABOVI[tip], n, prvi, zadnji]);
  });

  redovi.push([]);
  redovi.push(['UKUPNO', ukupno]);
  redovi.push([]);
  redovi.push(['Osveženo', new Date()]);

  var sirinaRedova = Math.max.apply(null, redovi.map(function(r) { return r.length; }));
  obezbediSirinu(sh, sirinaRedova);
  redovi = redovi.map(function(r) {
    var kopija = r.slice();
    while (kopija.length < sirinaRedova) kopija.push('');
    return kopija;
  });
  sh.getRange(1, 1, redovi.length, sirinaRedova).setValues(redovi);

  sh.getRange(1, 1, 1, sirinaRedova)
    .setBackground(STIL.ugljen).setFontColor(STIL.tekst).setFontWeight('bold');
  sh.getRange(redovi.length - 3, 1, 1, 2).setFontWeight('bold').setBackground(STIL.traka2);
  for (var c = 1; c <= sirinaRedova; c++) sh.setColumnWidth(c, c === 1 ? 170 : 150);
  sh.setFrozenRows(1);

  poruka('Pregled osvežen. Ukupno odgovora: ' + ukupno + '.');
}


/* Test tabovi sa primerima — da se vidi izgled pre puštanja linka. */
function pripremiTestTabele() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(TABOVI).forEach(function(tip) {
    var ime = TABOVI[tip] + TEST_SUFIKS;
    var sh = ss.getSheetByName(ime) || ss.insertSheet(ime);
    sh.getBandings().forEach(function(b) { b.remove(); });
    sh.clear();
    var kol = KOLONE[tip].slice();
    obezbediSirinu(sh, kol.length);
    sh.getRange(1, 1, 1, kol.length).setValues([kol]);
    var redovi = uzorciZa(tip, kol);
    if (redovi.length) sh.getRange(2, 1, redovi.length, kol.length).setValues(redovi);
    stilizujTab(sh, kol, tip);
  });
  poruka('Test tabele napravljene:\n' +
         Object.keys(TABOVI).map(function(t) { return '  • ' + TABOVI[t] + TEST_SUFIKS; }).join('\n'));
}

function obrisiTestTabele() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var obrisano = 0;
  Object.keys(TABOVI).forEach(function(tip) {
    var sh = ss.getSheetByName(TABOVI[tip] + TEST_SUFIKS);
    if (sh) { ss.deleteSheet(sh); obrisano++; }
  });
  poruka('Obrisano TEST tabova: ' + obrisano + '.');
}


/* ── Stilizacija ──────────────────────────────────────────────────────────── */

function stilizujTab(sh, kol, tip) {
  var n = kol.length;
  var maxR = sh.getMaxRows();

  /* Trake za redove (od 2. reda naniže) — krem nijanse. */
  sh.getBandings().forEach(function(b) { b.remove(); });
  if (maxR > 1) {
    sh.getRange(2, 1, maxR - 1, n)
      .applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY, false, false)
      .setFirstRowColor(STIL.traka1).setSecondRowColor(STIL.traka2);
  }

  /* Zaglavlje: boja se smenjuje na svakoj promeni sekcije. */
  var pozadine = [], prethodna = null, boja = STIL.ugljen;
  kol.forEach(function(k) {
    var sek = sekcijaKolone(k);
    if (prethodna !== null && sek !== prethodna) boja = (boja === STIL.ugljen) ? STIL.plava : STIL.ugljen;
    prethodna = sek;
    pozadine.push(boja);
  });

  sh.getRange(1, 1, 1, n)
    .setBackgrounds([pozadine])
    .setFontColors([kol.map(function() { return STIL.tekst; })])
    .setFontWeight('bold').setFontSize(10)
    .setHorizontalAlignment('center').setVerticalAlignment('middle').setWrap(true)
    .setNotes([kol.map(function(k) { return beleskaKolone(tip, k); })]);
  sh.setRowHeight(1, 46);

  if (maxR > 1) sh.getRange(2, 1, maxR - 1, n).setVerticalAlignment('middle').setFontSize(10);

  sh.setFrozenRows(1);
  sh.setFrozenColumns(Math.min(2, n));

  for (var c = 1; c <= n; c++) sh.setColumnWidth(c, sirinaKolone(kol[c - 1]));

  sh.getRange(1, 1, maxR, n)
    .setBorder(true, true, true, true, true, true, STIL.ivica, SpreadsheetApp.BorderStyle.SOLID);
}

/* Novi tab ima samo 26 kolona — proširi pre upisa širokog zaglavlja. */
function obezbediSirinu(sh, n) {
  var mc = sh.getMaxColumns();
  if (mc < n) sh.insertColumnsAfter(mc, n - mc);
}

function sekcijaKolone(k) {
  for (var i = 0; i < SEKCIJE.length; i++) {
    if (SEKCIJE[i][0].test(k)) return SEKCIJE[i][1];
  }
  return 'Demografija';   /* sve što nije skala ni meta */
}

function sirinaKolone(k) {
  if (k === '_vreme') return 150;
  return SIROKE_KOLONE.test(k) ? 130 : 46;
}

/* Beleška (hover note) na ćeliji zaglavlja. */
function beleskaKolone(tip, k) {
  return sekcijaKolone(k) + ' · ' + tipVrednosti(k) + '\n\n' + opisKolone(tip, k);
}

function tipVrednosti(k) {
  if (k === '_vreme') return 'datum i vreme';
  var o = (typeof opsegZa === 'function') ? opsegZa(k) : null;
  return o ? ('ceo broj ' + o[0] + '–' + o[1]) : 'tekst';
}


/* ── Opisi kolona ─────────────────────────────────────────────────────────── */

/* Meta kolone koje ne postoje kao polje u formi. */
var OPISI_META = {
  "_vreme": "Vreme prijema odgovora — upisuje server automatski.",
  "tip_upitnika": "Grupa nastavnika: muzika (muzička kultura) / likovno (likovna kultura)."
};

/* Tekstovi identični u svim grupama (zajedničke skale i pitanja). */
var OPISI_ZAJEDNICKI = {
  "godine": "Godine starosti",
  "identitet": "Tvrdnja koja Vas najbolje opisuje",
  "lic1": "1. Veoma sam uporan.",
  "lic10": "10. Uživam da me se drugi plaše.",
  "lic11": "11. Nije mi problem da prevarim nekog.",
  "lic12": "12. Imam različita interesovanja.",
  "lic13": "13. Ja sam mudra osoba.",
  "lic14": "14. Može se reći da sam prgava osoba.",
  "lic15": "15. Volim ljude.",
  "lic16": "16. Mislim da sam veoma talentovan.",
  "lic17": "17. Ja baš nemam sreće.",
  "lic18": "18. Ja sam prijatna osoba.",
  "lic19": "19. Često iskorišćavam druge.",
  "lic2": "2. Često provociram druge.",
  "lic20": "20. Bavim se mnogim zanimljivim stvarima u slobodno vreme.",
  "lic21": "21. Stvoren sam za velika dela.",
  "lic22": "22. Veoma sam marljiv i vredan.",
  "lic23": "23. Često lažem.",
  "lic24": "24. Uvek ispunjavam sve svoje obaveze.",
  "lic25": "25. Ja sam \"teška\" osoba.",
  "lic26": "26. Mislim da imam neke posebne kvalitete.",
  "lic27": "27. Često se osećam ogorčeno.",
  "lic28": "28. Sve što počnem, to i završim.",
  "lic29": "29. Volim da naređujem.",
  "lic3": "3. Pratim nova zbivanja u umetnosti (muzika, film, književnost…)",
  "lic30": "30. Osećam da je život nepravedan prema meni.",
  "lic31": "31. Imam blagu narav.",
  "lic32": "32. Ja sam nesrećna osoba.",
  "lic33": "33. Veoma sam temeljan u onome što radim.",
  "lic34": "34. Često me more tužne misli.",
  "lic35": "35. Često protivrečim drugim ljudima.",
  "lic36": "36. Sklon sam da odlažem obaveze.",
  "lic37": "37. Volim svuda da zabodem nos.",
  "lic38": "38. Pričljiv sam.",
  "lic39": "39. Ja sam važna osoba",
  "lic4": "4. Družim se sa velikim brojem ljudi.",
  "lic40": "40. Nemaran sam kada su obaveze u pitanju.",
  "lic41": "41. Često pobesnim.",
  "lic42": "42. Lako se iznerviram.",
  "lic43": "43. Uglavnom sam dobro raspoložen",
  "lic44": "44. Voleo bih da isprobam što više stvari u životu.",
  "lic45": "45. Ja sam moćna osoba",
  "lic46": "46. Često sam zabrinut.",
  "lic47": "47. Često se suprotstavljam mišljenju drugih.",
  "lic48": "48. Pomalo spletkarim.",
  "lic49": "49. Osećam da mi nova saznanja obogaćuju život",
  "lic5": "5. Ja sam rođeni pobednik.",
  "lic50": "50. Lako planem.",
  "lic51": "51. Veoma sam srdačan.",
  "lic52": "52. Neka umetnička dela mogu u meni da pobude snažna osećanja.",
  "lic53": "53. Stalno se usavršavam i napredujem.",
  "lic54": "54. Ja sam uticajna osoba.",
  "lic55": "55. Ja sam vedra osoba.",
  "lic56": "56. Često me muči osećanje krivice.",
  "lic57": "57. Veoma sam društven.",
  "lic58": "58. Često tragam za informacijama o stvarima koje me zanimaju.",
  "lic59": "59. Ja sam lenja osoba.",
  "lic6": "6. Lako se obeshrabrim.",
  "lic60": "60. Žudim za uzbuđenjima i novinama.",
  "lic61": "61. Često mislim da život nema smisla.",
  "lic62": "62. Ponekad pomislim da sam jeziv čovek.",
  "lic63": "63. Ja sam kreativna osoba.",
  "lic64": "64. Lako se zbližavam s ljudima.",
  "lic65": "65. Često ogovaram druge.",
  "lic66": "66. Često smandrljam neki posao.",
  "lic67": "67. Često se posvađam sa drugima.",
  "lic68": "68. Imam veoma visoko mišljenje o sebi.",
  "lic69": "69. Često osećam teskobu.",
  "lic7": "7. Za mene važi: ono što možeš da uradiš danas, ne ostavljaj za sutra.",
  "lic70": "70. Pun sam energije.",
  "lic8": "8. Često se podsmevam drugima.",
  "lic9": "9. Ja sam šarmantna osoba.",
  "mesto": "Mesto u kom ste zaposleni (grad / opština)",
  "motiv5": "5. Osećam se kompetentno i uspešno i u umetničkom i u nastavničkom delu svoje profesionalne uloge.",
  "nivo_zaposlenja": "Obrazovna institucija u kojoj ste trenutno zaposleni",
  "pedagog2": "2. Nastavu prilagođavam individualnim potrebama, reakcijama i sposobnostima učenika, umesto da svim učenicima pristupam na isti način.",
  "pol": "Pol",
  "predmeti": "Predmet/i koji/e trenutno pretežno predajete",
  "saglasnost": "Potvrda dobrovoljne saglasnosti",
  "staz": "Ukupan broj godina radnog staža",
  "swls1": "1. U većini aspekata, moj život je blizak mom idealu.",
  "swls2": "2. Uslovi mog života su odlični.",
  "swls3": "3. Zadovoljan/na sam svojim životom.",
  "swls4": "4. Do sada sam postigao/la važne stvari koje sam želeo/la u životu.",
  "swls5": "5. Kada bih mogao/la da živim život iznova, gotovo ništa ne bih menjao/la."
};

/* Tekstovi koji se razlikuju po grupi (formulacija prilagođena aktivnosti). */
var OPISI_GRUPA = {
  muzika: {
    "druga_institucija": "Da li ste, pored ustanove koju ste prethodno naveli, istovremeno zaposleni i u drugoj instituciji u kojoj se odvija nastava muzičkih predmeta?",
    "druga_institucija_tekst": "Da li ste, pored ustanove koju ste prethodno naveli, istovremeno zaposleni i u drugoj instituciji u kojoj se odvija nastava muzičkih predmeta? — uneto pod „Drugo\"",
    "izraz1": "1. Muzička dela i kompozitori koje lično volim dobijaju znatno više vremena na nastavi od onih prema kojima sam neutralan/na ili koje lično ne preferiram.",
    "izraz2": "2. Kada sam lično entuzijastičan/na u pogledu određenog dela ili kompozitora, taj entuzijazam jasno je vidljiv u načinu na koji to predajem.",
    "izraz3": "3. Kada kurikulum ne propisuje određeni primer, biram dela koja odgovaraju mojim ličnim muzičkim preferencijama.",
    "izraz4": "4. Iskustva i sadržaji iz moje lične muzičke prakse van škole direktno utiču na izbor primera, materijala i sadržaja koje koristim u nastavi.",
    "m_obrazovanje": "Nivo završenog formalnog muzičkog obrazovanja",
    "m_pref1": "1. Muzika renesanse (npr. Palestrina, Josquin des Prez, Orlando di Lasso)",
    "m_pref10": "10. Soul (npr. Aretha Franklin, Marvin Gaye, Stevie Wonder)",
    "m_pref11": "11. Džez (npr. Louis Armstrong, Miles Davis, Ella Fitzgerald, John Coltrane)",
    "m_pref12": "12. Hip-hop / rep (npr. Tupac Shakur, The Notorious B.I.G., Eminem, Jay-Z)",
    "m_pref13": "13. Elektronska muzika (npr. Kraftwerk, Daft Punk, The Chemical Brothers, Avicii)",
    "m_pref14": "14. Folk (npr. Šaban Šaulić, Lepa Brena, Halid Bešlić, Ceca)",
    "m_pref15": "15. Rok (npr. Bijelo Dugme, EKV, Azra, Riblja Čorba)",
    "m_pref16": "16. Pop (npr. Zdravko Čolić, Oliver Dragojević, Dino Merlin, Toše Proeski)",
    "m_pref17": "17. Hip-hop / rep (npr. Beogradski sindikat, Who See, Jala Brat)",
    "m_pref18": "18. Elektronska muzika (npr. Laibach, Umek, Valentino Kanzyani, Marko Nastić)",
    "m_pref2": "2. Barokna muzika (npr. J. S. Bah, Vivaldi, Hendl)",
    "m_pref3": "3. Muzika klasičnog perioda (npr. Hajdn, Mocart, Betoven)",
    "m_pref4": "4. Romantičarska muzika (npr. Šopen, Šubert, Čajkovski, Brams)",
    "m_pref5": "5. Umetnička muzika 20. veka — impresionizam, ekspresionizam, neoklasicizam, avangarda, minimalizam i dr. (npr. Debisi, Šenberg, Stravinski, Bartok, Šostakovič)",
    "m_pref6": "6. Savremena umetnička muzika posle 1970. — minimalizam, elektronska i eksperimentalna muzika (npr. Rejč, Glask, Gris)",
    "m_pref7": "7. Rok (npr. The Beatles, The Rolling Stones, Queen, Nirvana)",
    "m_pref8": "8. Pop (npr. Michael Jackson, Madonna, Adele, Taylor Swift)",
    "m_pref9": "9. Bluz (npr. B. B. King, Muddy Waters, Etta James)",
    "m_sastav1": "1. Solističko vokalno izvođenje",
    "m_sastav2": "2. Horsko ili vokalno grupno izvođenje",
    "m_sastav3": "3. Kamerno izvođenje (mali instrumentalni ansambli)",
    "m_sastav4": "4. Orkestarsko izvođenje",
    "m_sastav5": "5. Solističko instrumentalno izvođenje",
    "motiv1": "1. Poučavanje muzike mi samo po sebi pričinjava zadovoljstvo i doprinosi osećaju smisla.",
    "motiv2": "2. Osećam da moj rad ima smisao kada učenicima širim muzičke vidike i upoznajem ih sa muzikom sa kojom se inače možda ne bi susreli.",
    "motiv3": "3. Praktični i ekonomski razlozi imaju značajnu ulogu u tome što i dalje ostajem u prosveti.",
    "motiv4": "4. Osećam se slobodno da samostalno donosim odluke o izboru muzičkih sadržaja i načinu rada u nastavi.",
    "motiv6": "6. Odnosi koje gradim sa učenicima predstavljaju važan i smislen deo onoga što mom nastavničkom radu daje vrednost.",
    "pedagog1": "1. U planiranju nastave prvenstveno se oslanjam na propisani kurikulum, dok vlastite muzičke sadržaje inkorporiram uglavnom tamo gde kurikulum nije dovoljno razrađen.",
    "pedagog3": "3. Osmišljavam muzičke zadatke sa jasno postavljenim ciljem, ali učenicima ostavljam prostor za sopstvenu interpretaciju i kreativno izražavanje.",
    "pedagog4": "4. Verujem da učenici efikasnije uče kada imaju slobodu da kreativno rešavaju zadatak, nego kada je način njegovog rešavanja ili konačni ishod unapred određen.",
    "razlike1": "1. Svesno prilagođavam sadržaje koje uključujem u nastavu kako bih približio/la svoj muzički ukus onome na šta učenici pozitivno reaguju.",
    "razlike2": "2. U poređenju sa učenicima kojima sam ranije predavao/la, primećujem da današnji učenici imaju kraću pažnju za duže bavljenje složenijim muzičkim sadržajima.",
    "razlike3": "3. Primećujem da sve manji broj učenika danas pokazuje istinsku radoznalost i kreativno interesovanje za muzičke sadržaje.",
    "trad1": "1. Radije slušam istorijska dela izvedena u istorijski vernom stilu (npr. na originalnim instrumentima sa autentičnim tempom i dinamikom).",
    "trad2": "2. Generalno sam skeptičan/na prema savremenim aranžmanima klasičnih dela jer kompromituju originalne umetničke namere.",
    "trad3": "3. Kada biram primere za nastavu, ponekad se odlučim za aranžman ili savremenu verziju umesto originala jer je pristupačnija učenicima.",
    "van1": "1. Muzička praksa van škole pruža mi osećaj kreativne slobode i motivacije koji moja profesionalna uloga sama po sebi ne pruža.",
    "van2": "2. Održavanje vlastite muzičke prakse van škole/fakulteta podržava moj osećaj kompetentnosti i profesionalnog samopouzdanja kao nastavnika muzike.",
    "van3": "3. Moje vannastavne muzičke aktivnosti povezuju me s umetničkom zajednicom i značajnim profesionalnim odnosima izvan školskog konteksta.",
    "van4": "4. Kada ne mogu da posvetim vreme ličnim muzičkim aktivnostima u kojima uživam, primetim pad profesionalnog entuzijazma i angažmana u učionici.",
    "van5": "5. Lično bavljenje muzikom van obaveznog školskog/fakultetskog konteksta za mene predstavlja izvor psihološkog blagostanja i osveženja.",
    "van6": "6. Kada se duži period ne bavim lično muzikom van školskog/fakultetskog konteksta, primetim pad psihološkog blagostanja i opšteg zadovoljstva.",
    "van7": "7. Lično bavljenje muzikom doživljavam kao nešto što ima terapeutsko dejstvo na mene, nezavisno od njegovog značaja za moj profesionalni razvoj ili pripremu nastave.",
    "van_skole": "Redovno se bavim umetničkim aktivnostima van škole.",
    "van_skole_tekst": "Molimo Vas da upišete kojom muzičkom aktivnošću se bavite mimo primarnog zaposlenja u nastavi."
  },
  likovno: {
    "druga_institucija": "Da li ste, pored ustanove koju ste prethodno naveli, istovremeno zaposleni i u drugoj instituciji u kojoj se odvija nastava predmeta vizuelnih umetnosti?",
    "druga_institucija_tekst": "Da li ste, pored ustanove koju ste prethodno naveli, istovremeno zaposleni i u drugoj instituciji u kojoj se odvija nastava predmeta vizuelnih umetnosti? — uneto pod „Drugo\"",
    "izraz1": "1. Umetnička dela, umetnici i umetničke tehnike koje lično preferiram dobijaju više prostora u nastavi od onih prema kojima sam neutralan/na ili koje lično ne preferiram.",
    "izraz2": "2. Kada sam posebno zainteresovan/a za određeno umetničko delo, umetnika ili tehniku, to interesovanje se jasno vidi u načinu na koji ih predstavljam u nastavi.",
    "izraz3": "3. Kada kurikulum ne propisuje određeni primer, biram dela, umetnike ili tehnike koje odgovaraju mojim ličnim umetničkim preferencijama.",
    "izraz4": "4. Moja lična umetnička praksa van škole/fakulteta direktno utiče na izbor primera, materijala i sadržaja koje koristim u nastavi.",
    "l_obrazovanje": "Nivo završenog formalnog likovnog/umetničkog obrazovanja",
    "l_pref1": "1. Umetnost renesanse",
    "l_pref10": "10. Fotografija",
    "l_pref11": "11. Digitalna i multimedijalna umetnost",
    "l_pref2": "2. Umetnost baroka",
    "l_pref3": "3. Umetnost klasicizma",
    "l_pref4": "4. Romantizam",
    "l_pref5": "5. Umetnost 19. i početka 20. veka — realizam, impresionizam, postimpresionizam i simbolizam",
    "l_pref6": "6. Umetnost 20. veka — ekspresionizam, kubizam, nadrealizam, apstrakcija, dadaizam, pop-art i dr.",
    "l_pref7": "7. Savremena umetnost posle 1970. godine — konceptualna umetnost, instalacija, video-art, digitalna umetnost i dr.",
    "l_pref8": "8. Ilustracija i strip",
    "l_pref9": "9. Ulična umetnost i grafiti",
    "l_tehnika1": "1. Crtanje (npr. olovka, ugljen, tuš, pastel)",
    "l_tehnika2": "2. Slikanje (npr. akvarel, tempera, ulje, akril)",
    "l_tehnika3": "3. Grafika",
    "l_tehnika4": "4. Skulptura i drugi oblici trodimenzionalnog rada (npr. kamen, drvo, glina, metal)",
    "l_tehnika5": "5. Tekstilna umetnost (npr. tkanje, vez, tapiserija)",
    "l_tehnika6": "6. Fotografija i digitalna umetnost (npr. digitalna fotografija, digitalna obrada i stvaranje slike)",
    "motiv1": "1. Bavljenje nastavom i obrazovanjem u oblasti vizuelnih umetnosti samo po sebi mi pričinjava zadovoljstvo i pruža osećaj smisla.",
    "motiv2": "2. Osećam da moj rad ima smisla kada učenicima i studentima širim vidike i upoznajem ih sa različitim oblicima vizuelne umetnosti sa kojima se inače možda ne bi susreli.",
    "motiv3": "3. Praktični i ekonomski razlozi imaju značajnu ulogu u tome što se bavim obrazovanjem u oblasti vizuelnih umetnosti.",
    "motiv4": "4. Osećam se slobodno da samostalno donosim odluke o izboru umetničkih sadržaja i načinu rada u nastavi.",
    "motiv6": "6. Odnosi koje gradim sa učenicima i studentima predstavljaju važan i smislen deo onoga što mom radu u oblasti obrazovanja daje vrednost.",
    "pedagog1": "1. U planiranju nastave prvenstveno se oslanjam na propisani kurikulum, dok vlastiti sud koristim uglavnom tamo gde kurikulum nije dovoljno razrađen.",
    "pedagog3": "3. Osmišljavam likovne zadatke sa jasno postavljenim ciljem, ali učenicima ostavljam prostor za sopstvenu interpretaciju i kreativno izražavanje.",
    "pedagog4": "4. Verujem da učenici efikasnije uče kada imaju slobodu da kreativno rešavaju zadatak, nego kada su način rada ili očekivani ishod unapred određeni.",
    "razlike1": "1. Svesno prilagođavam sadržaje koje uključujem u nastavu kako bih približio/la svoje umetničke preferencije onome na šta učenici pozitivno reaguju.",
    "razlike2": "2. U poređenju sa učenicima kojima sam ranije predavao/la, primećujem da današnji učenici imaju kraću pažnju za duže bavljenje složenijim umetničkim delima.",
    "razlike3": "3. Primećujem da sve manji broj učenika danas pokazuje istinsku radoznalost i kreativno interesovanje za sadržaje iz oblasti vizuelnih umetnosti.",
    "trad1": "1. Radije posmatram istorijska umetnička dela predstavljena u skladu sa njihovim izvornim istorijskim i umetničkim kontekstom.",
    "trad2": "2. Generalno sam skeptičan/na prema savremenim reinterpretacijama klasičnih umetničkih dela jer mogu da izmene ili naruše njihove originalne umetničke namere.",
    "trad3": "3. Kada biram primere za nastavu, ponekad se odlučim za savremenu interpretaciju ili obradu umetničkog dela umesto originala jer je pristupačnija učenicima.",
    "van1": "1. Umetnička likovna praksa van škole pruža mi osećaj kreativne slobode i motivacije koji moja profesionalna uloga sama po sebi ne pruža.",
    "van2": "2. Održavanje vlastite likovne prakse van škole/fakulteta podržava moj osećaj kompetentnosti i profesionalnog samopouzdanja kao nastavnika likovne kulture.",
    "van3": "3. Moje vannastavne umetničke aktivnosti povezuju me s umetničkom zajednicom i značajnim profesionalnim odnosima izvan školskog konteksta.",
    "van4": "4. Kada ne mogu da posvetim vreme ličnim umetničkim aktivnostima u kojima uživam, primetim pad profesionalnog entuzijazma i angažmana u učionici.",
    "van5": "5. Lično bavljenje likovnom umetnošću van obaveznog školskog/fakultetskog konteksta za mene predstavlja izvor psihološkog blagostanja i osveženja.",
    "van6": "6. Kada se duži period ne bavim lično likovnom umetnošću van školskog/fakultetskog konteksta, primetim pad psihološkog blagostanja i opšteg zadovoljstva.",
    "van7": "7. Lično bavljenje likovnom umetnošću doživljavam kao nešto što ima terapeutsko dejstvo na mene, nezavisno od njegovog značaja za moj profesionalni razvoj ili pripremu nastave.",
    "van_skole": "Redovno se bavim umetničkim aktivnostima van škole.",
    "van_skole_tekst": "Molimo Vas da upišete kojom likovnom umetničkom aktivnošću se bavite mimo primarnog zaposlenja u nastavi."
  }
};

function opisKolone(tip, k) {
  if (OPISI_META[k]) return OPISI_META[k];
  var grupa = OPISI_GRUPA[tip];
  if (grupa && grupa[k]) return grupa[k];
  if (OPISI_ZAJEDNICKI[k]) return OPISI_ZAJEDNICKI[k];

  /* „Dodaj još" setovi (_2, _3…) nose isti tekst kao osnovni set. */
  var m = k.match(/^(.+)_(\d+)$/);
  if (m) {
    var osnovni = opisKolone(tip, m[1]);
    if (osnovni !== m[1]) return osnovni + ' — dodatni unos #' + m[2];
  }
  return k;
}


/* ── Primeri odgovora za TEST tabove ──────────────────────────────────────── */

/* Vrednosti za polja koja nisu Likert skala (opseg im se ne može izvesti). */
var PRIMERI = {
  "pol": ["zenski", "muski", "zenski"],
  "nivo_zaposlenja": ["osnovna", "srednja", "fakultet"],
  "m_obrazovanje": ["visoko_master", "srednja_muzicka", "visoko_doktorske"],
  "l_obrazovanje": ["visoko_master", "srednja_umetnicka", "visoko_doktorske"],
  "mesto": ["Sombor", "Novi Sad", "Apatin"],
  "predmeti": ["Muzička kultura", "Likovna kultura", "Muzička kultura, Hor"],
  "druga_institucija": ["ne", "da", "ne"],
  "druga_institucija_tekst": ["", "Muzička škola „Petar Konjović\"", ""],
  "van_skole": ["da", "ne", "da"],
  "van_skole_tekst": ["Kamerni ansambl", "", "Slikarska radionica"],
  "identitet": ["oboje", "pedagog", "umetnik"],
  "saglasnost": ["da", "da", "da"]
};

function uzorciZa(tip, kol) {
  var uzorci = [];
  for (var s = 0; s < 3; s++) {
    uzorci.push(kol.map(function(k) {
      if (k === '_vreme') return new Date(Date.now() - s * 3600000);
      if (k === 'tip_upitnika') return tip;
      if (PRIMERI[k]) return PRIMERI[k][s];
      var o = (typeof opsegZa === 'function') ? opsegZa(k) : null;
      if (o) return o[0] + ((s * 2 + k.length) % (o[1] - o[0] + 1));
      return '';
    }));
  }
  return uzorci;
}


/* ── Pomoćnici za dijaloge ────────────────────────────────────────────────── */

function poruka(t) {
  try { SpreadsheetApp.getUi().alert(t); }
  catch (e) { Logger.log(t); }
}

function potvrdi(t) {
  try {
    var ui = SpreadsheetApp.getUi();
    return ui.alert('Potvrda', t, ui.ButtonSet.YES_NO) === ui.Button.YES;
  } catch (e) {
    /* Bez UI konteksta (pokretanje iz editora) — ne briši ništa bez potvrde. */
    Logger.log('Nema UI konteksta — reset preskočen. Pokreni iz menija u tabeli.');
    return false;
  }
}
