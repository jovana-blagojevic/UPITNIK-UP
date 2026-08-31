// Konfiguracija — ovaj fajl SE KOMITUJE u Git (namerno).
//
// ⚠️ VAŽNO — BEZBEDNOST:
// Sajt je statičan i deli se preko GitHub Pages, koji servira samo fajlove iz
// Git-a. Zato config.js MORA biti u repou — inače forma na živom sajtu nema
// URL/TOKEN i ne šalje. To je bezbedno: kod se učitava u pretraživaču, pa su
// URL i TOKEN ionako VIDLJIVI svakome (View Source / Network tab). TOKEN NIJE
// TAJNA i ne štiti od zloupotrebe — on je samo minimalna prepreka. Pravu zaštitu
// radi Apps Script na serverskoj strani (provera tokena + honeypota, validacija
// opsega i sanitizacija). Vidi server/apps-script.gs.
//
// ⚠️ OVO JE ZASEBNO ISTRAŽIVANJE od upitnika MSF (grupne aktivnosti). Koristi
// SVOJU Google tabelu i SVOJ deployment — ne lepi ovde MSF URL, jer bi se
// tip_upitnika 'muzika' sudario sa MSF tabom „Muzika" i pomešao dva uzorka.

// 1) URL: zalepi „/exec" URL koji dobiješ posle Deploy → Web app.
//    (Mora se završavati na /exec — NE /dev.)
//    ⚠️ DOK JE OVO PRAZNO, FORMA NE ŠALJE — prikazuje poruku o konfiguraciji.
window.UPITNIK_URL   = 'https://script.google.com/macros/s/AKfycbz_WUOIlBbGhNF-j70yLNqCHpxsHxMdsJmIOGf4_oEAOAwLQWK8NT7se5qZUSgytMun/exec';

// 2) TOKEN: mora biti IDENTIČAN konstanti TOKEN u server/apps-script.gs.
//    Ovaj je već generisan za tebe — samo isti string upiši i u apps-script.gs.
window.UPITNIK_TOKEN = '186a42bf4d739191bec4dd5f796e7650410b4f751cf31f6b';
