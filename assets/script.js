/* ══════════════════════════════════════════
   LOCAL STORAGE — blokiranje ponovnog popunjavanja
   Jedan učesnik popunjava JEDAN upitnik ukupno, bez obzira
   na grupu: globalni ključ 'upitnik_up_popunjen' + ključ po
   grupi. Skripta se učitava i na uvodnoj strani (index.html),
   pa blokada važi na celom sajtu. localStorage je u try/catch
   jer u privatnom režimu pristup može da baci izuzetak.

   ⚠️ Prefiks 'upitnik_up_' je OBAVEZAN i razlikuje ovaj upitnik
   od MSF upitnika (grupne aktivnosti). localStorage se deli po
   origin-u, ne po folderu — ako se oba sajta serviraju sa istog
   GitHub Pages naloga, isti ključ bi blokirao učesnika koji je
   već popunio onaj drugi upitnik.
   ══════════════════════════════════════════ */
function upitnikPopunjen() {
    try {
        if (localStorage.getItem('upitnik_up_popunjen') === 'da') return true;
        return ['muzika', 'likovno'].some(function(tip) {
            return localStorage.getItem('upitnik_up_popunjen_' + tip) === 'da';
        });
    } catch (e) {
        return false;
    }
}

function zabeleziPopunjen(tip) {
    try {
        localStorage.setItem('upitnik_up_popunjen', 'da');
        if (tip) localStorage.setItem('upitnik_up_popunjen_' + tip, 'da');
    } catch (e) { /* privatni režim — slanje je prošlo, samo blokada ne važi */ }
}

/* Blokada je po UREĐAJU, ne po osobi. Jedan tablet koji kruži po probi ili
   po zbornici znači da bi drugi učesnik bio tiho odbijen — zato postoji izlaz. */
function ponistiPopunjen() {
    try {
        localStorage.removeItem('upitnik_up_popunjen');
        ['muzika', 'likovno'].forEach(function(tip) {
            localStorage.removeItem('upitnik_up_popunjen_' + tip);
        });
    } catch (e) { /* privatni režim — nema šta da se briše */ }
}

(function() {
    if (!upitnikPopunjen()) return;
    const kartica = document.querySelector('.upitnik');
    if (!kartica) return;
    kartica.innerHTML =
        '<div class="hvala">' +
        '<p>Već ste popunili upitnik.</p>' +
        '<p>Vaši odgovori su zabeleženi. Hvala Vam na učešću!</p>' +
        '</div>';

    /* Diskretan izlaz za deljeni uređaj — namerno sitan i bez poziva na
       ponovno popunjavanje: služi sledećem učesniku, ne istom. */
    const dugme = document.createElement('button');
    dugme.type = 'button';
    dugme.className = 'hvala-ponovo';
    dugme.textContent = 'Nisam ja — upitnik popunjava drugi učesnik';
    dugme.addEventListener('click', function() {
        ponistiPopunjen();
        location.reload();
    });
    kartica.querySelector('.hvala').appendChild(dugme);
})();

/* ══════════════════════════════════════════
   DRUGO — aktivacija tekst polja
   Polje uz „Drugo" je zaključano dok ta opcija nije izabrana, a kad se izbor
   prebaci na drugu opciju u istoj grupi vrednost se BRIŠE. Bez brisanja bi u
   tabelu otišlo i „hor" (izabrano) i zaostali tekst iz „Drugo" — dva odgovora
   na jedno pitanje.

   readOnly, a NE disabled: disabled polja ispadaju iz FormData, pa bi kolona
   nestajala iz payload-a kad se ne koristi i zaglavlje tabele ne bi bilo
   stabilno. tabindex=-1 uz to sklanja polje iz Tab redosleda.
   ══════════════════════════════════════════ */
(function() {
    function zakljucaj(input) {
        if (!input) return;
        input.value = '';
        input.readOnly = true;
        input.setAttribute('tabindex', '-1');
    }

    function otkljucaj(input, fokus) {
        if (!input) return;
        input.readOnly = false;
        input.removeAttribute('tabindex');
        /* Fokus samo na pravi klik — programski change (vraćanje radne
           verzije) ne sme da otme fokus i skroluje stranu */
        if (fokus) input.focus();
    }

    /* Početno stanje: zaključaj sva polja čiji radio nije izabran.
       Radi se iz JS-a, pa bez JS-a polje ostaje običan tekst unos. */
    document.querySelectorAll('.opcija-drugo').forEach(function(opcija) {
        const radio = opcija.querySelector('input[type="radio"]');
        const input = opcija.querySelector('.unos-drugo');
        if (!radio || !input || radio.checked) return;
        input.readOnly = true;
        input.setAttribute('tabindex', '-1');
    });

    document.querySelectorAll('.opcija-drugo input[type="radio"]').forEach(function(radio) {
        radio.addEventListener('change', function(e) {
            if (!this.checked) return;
            otkljucaj(this.closest('.opcija-drugo').querySelector('.unos-drugo'), e.isTrusted);
        });
    });

    document.querySelectorAll('.opcije-red').forEach(function(red) {
        red.addEventListener('change', function(e) {
            if (e.target.type !== 'radio') return;
            const svoja = e.target.closest('.opcija-drugo');
            red.querySelectorAll('.opcija-drugo').forEach(function(opcija) {
                if (opcija === svoja) return;
                zakljucaj(opcija.querySelector('.unos-drugo'));
            });
        });
    });
})();

/* ══════════════════════════════════════════
   PRISTUPAČNOST — semantičko grupisanje radio polja
   role=radiogroup + aria-labelledby povezuje tekst pitanja
   sa opcijama, a Likert dugmićima daje smisleno ime
   (npr. „3 — Više od polovine"). Radi za sve upitnike bez
   ručnog menjanja svake stavke.
   ══════════════════════════════════════════ */
(function() {
    let brojac = 0;
    function obezbediId(el) {
        if (!el.id) el.id = 'a11y-' + (++brojac);
        return el.id;
    }

    /* Standardne pill grupe: .opcije-red ↔ .pitanje-tekst */
    document.querySelectorAll('.opcije-red').forEach(function(grupa) {
        grupa.setAttribute('role', 'radiogroup');
        const pitanje = grupa.closest('.pitanje');
        const naslov = pitanje && pitanje.querySelector('.pitanje-tekst');
        if (naslov) grupa.setAttribute('aria-labelledby', obezbediId(naslov));
    });

    /* Likert redovi: .likert-opcije ↔ .likert-stavka */
    document.querySelectorAll('.likert-red').forEach(function(red) {
        const grupa = red.querySelector('.likert-opcije');
        if (!grupa) return;
        grupa.setAttribute('role', 'radiogroup');
        const stavka = red.querySelector('.likert-stavka');
        if (stavka) grupa.setAttribute('aria-labelledby', obezbediId(stavka));
    });

    /* Obogati Likert opcije imenom kolone iz zaglavlja bloka */
    document.querySelectorAll('.likert-blok').forEach(function(blok) {
        const kolone = blok.querySelectorAll('.likert-zaglavlje .likert-brojevi span');
        const opisi = Array.prototype.map.call(kolone, function(s) {
            const b = s.querySelector('b');
            const sm = s.querySelector('small');
            const broj = b ? b.textContent.trim() : '';
            const tekst = sm ? sm.textContent.trim() : '';
            return tekst ? (broj + ' — ' + tekst) : broj;
        });
        if (!opisi.length) return;
        blok.querySelectorAll('.likert-red .likert-opcije').forEach(function(grupa) {
            grupa.querySelectorAll('.likert-opcija').forEach(function(op, i) {
                const inp = op.querySelector('input[type="radio"]');
                if (inp && opisi[i]) inp.setAttribute('aria-label', opisi[i]);
            });
        });
    });
})();

/* ══════════════════════════════════════════
   DODAJ JOŠ — više prethodnih aktivnosti
   Dugme „.dodaj-jos" klonira prvu „.prethodna-stavka" u
   svojoj listi, čisti vrednosti i dodaje sufiks na name/id
   (_2, _3…) tako da je svaki set nezavisna radio grupa i
   zauzme posebne kolone u rezultatima. Radi za sva tri
   upitnika; opcioni prazni setovi se ne validiraju.
   ══════════════════════════════════════════ */
(function() {
    document.querySelectorAll('.dodaj-jos').forEach(function(dugme) {
        const pitanje = dugme.closest('.pitanje');
        const lista = pitanje && pitanje.querySelector('.prethodna-lista');
        if (!lista) return;

        const naslov = pitanje.querySelector('.pitanje-tekst');
        let brojac = 1;   /* prva stavka koristi osnovna imena (bez sufiksa) */

        dugme.addEventListener('click', function(e) {
            brojac += 1;
            const osnovna = lista.querySelector('.prethodna-stavka');
            if (!osnovna) return;
            const nova = osnovna.cloneNode(true);

            /* Jedinstvena imena/ID-jevi + čišćenje vrednosti */
            nova.querySelectorAll('input').forEach(function(inp) {
                if (inp.name) inp.name = inp.name + '_' + brojac;
                if (inp.id)   inp.id   = inp.id + '_' + brojac;
                if (inp.type === 'radio') inp.checked = false;
                else inp.value = '';
            });

            /* Ukloni zaostala vizuelna stanja iz klona */
            ['ima-izbor', 'neizabrana', 'greska'].forEach(function(kl) {
                nova.querySelectorAll('.' + kl).forEach(function(el) { el.classList.remove(kl); });
            });
            nova.querySelectorAll('.greska-tekst').forEach(function(el) { el.remove(); });

            /* Pristupačnost: poveži kloniranu radio grupu sa naslovom pitanja */
            const red = nova.querySelector('.opcije-red');
            if (red) {
                red.setAttribute('role', 'radiogroup');
                if (naslov) {
                    if (!naslov.id) naslov.id = 'prethodna-naslov-' + Math.random().toString(36).slice(2, 8);
                    red.setAttribute('aria-labelledby', naslov.id);
                }
            }

            /* Dugme za uklanjanje dodate stavke */
            const ukloni = document.createElement('button');
            ukloni.type = 'button';
            ukloni.className = 'ukloni-stavka';
            ukloni.textContent = 'Ukloni';
            ukloni.addEventListener('click', function() { nova.remove(); });
            nova.appendChild(ukloni);

            lista.appendChild(nova);
            const prviUnos = nova.querySelector('input');
            /* Fokus samo na pravi klik (vidi „Drugo" iznad) */
            if (prviUnos && e.isTrusted) prviUnos.focus();
        });
    });
})();

/* ══════════════════════════════════════════
   USLOVNI BLOK (Da/Ne grananje)
   Pitanje sa klasom .grananje otkriva susedni
   .uslovni-blok kada je izabran odgovor „da". Na „ne"
   blok se sakriva I resetuje — inače bi odgovori uneti
   pre predomišljanja ostali u formi i bili poslati.
   Validacija i traka napretka preskaču skrivena pitanja
   preko offsetParent, pa ovde nema šta da se dodaje.
   ══════════════════════════════════════════ */
(function() {
    const forma = document.getElementById('forma');
    if (!forma) return;

    /* Poništava odgovore u bloku koji se sakriva da se ne bi poslali */
    function resetBlok(blok) {
        if (!blok) return;
        blok.querySelectorAll('input[type="radio"]').forEach(function(r) { r.checked = false; });
        blok.querySelectorAll('input[type="text"]').forEach(function(t) { t.value = ''; });
        blok.querySelectorAll('.ima-izbor').forEach(function(el) { el.classList.remove('ima-izbor'); });
        blok.querySelectorAll('.neizabrana').forEach(function(el) { el.classList.remove('neizabrana'); });
        blok.querySelectorAll('.greska').forEach(function(el) { el.classList.remove('greska'); });
        blok.querySelectorAll('.greska-tekst').forEach(function(el) { el.remove(); });
    }

    forma.querySelectorAll('.grananje').forEach(function(grananje) {
        const blok = grananje.nextElementSibling;
        if (!blok || !blok.classList.contains('uslovni-blok')) return;

        grananje.querySelectorAll('input[type="radio"]').forEach(function(radio) {
            radio.addEventListener('change', function() {
                if (!this.checked) return;
                if (this.value === 'da') {
                    blok.classList.remove('skriveno');
                } else if (!blok.classList.contains('skriveno')) {
                    blok.classList.add('skriveno');
                    resetBlok(blok);
                }
            });
        });
    });
})();

/* ══════════════════════════════════════════
   CANVAS POTPIS
   ══════════════════════════════════════════ */
(function() {
    const canvas = document.getElementById('saglasnost-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let crta = false;
    let imaTracka = false;

    ctx.strokeStyle = '#111118';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function getPos(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const src = e.touches ? e.touches[0] : e;
        return {
            x: (src.clientX - rect.left) * scaleX,
            y: (src.clientY - rect.top) * scaleY
        };
    }

    function start(e) {
        e.preventDefault();
        crta = true;
        const pos = getPos(e);
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        canvas.classList.add('aktivan');
    }

    function draw(e) {
        if (!crta) return;
        e.preventDefault();
        const pos = getPos(e);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        if (!imaTracka) {
            imaTracka = true;
            canvas.classList.remove('prazno');
            const hidden = document.getElementById('saglasnost');
            if (hidden) hidden.value = 'potpis';
        }
    }

    function stop(e) {
        if (!crta) return;
        crta = false;
        ctx.closePath();
        canvas.classList.remove('aktivan');
        const hidden = document.getElementById('saglasnost');
        if (hidden && imaTracka) {
            hidden.value = canvas.toDataURL();
            /* Potpis ne emituje change — skini grešku validacije odmah */
            ukloniGresku(canvas.closest('.saglasnost-blok'));
            canvas.style.borderColor = '';
        }
    }

    canvas.addEventListener('mousedown',  start);
    canvas.addEventListener('mousemove',  draw);
    canvas.addEventListener('mouseup',    stop);
    canvas.addEventListener('mouseleave', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove',  draw,  { passive: false });
    canvas.addEventListener('touchend',   stop);
})();

function potpis_obrisi(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.add('prazno');
    const hidden = document.getElementById('saglasnost');
    if (hidden) hidden.value = '';
}

/* Na uvodnoj strani (index.html) i posle blokade forma ne postoji —
   svi listeneri ispod se kače samo ako je ima. */
const forma = document.getElementById('forma');

/* ── Pronalazi wrapper pitanja (radi i za .pitanje i za .likert-red) ── */
function getPitanjeWrapper(el) {
    return el.closest('.likert-red') || el.closest('.pitanje');
}

function prikaziGresku(pitanje, poruka) {
    /* Skidanje pa vraćanje klase restartuje shake animaciju i pri ponovnom submitu */
    pitanje.classList.remove('greska');
    void pitanje.offsetWidth;
    pitanje.classList.add('greska');
    let span = pitanje.querySelector('.greska-tekst');
    if (!span) {
        span = document.createElement('span');
        span.className = 'greska-tekst';
        pitanje.appendChild(span);
    }
    span.textContent = poruka;
}

function ukloniGresku(pitanje) {
    if (!pitanje) return;
    pitanje.classList.remove('greska');
    const span = pitanje.querySelector('.greska-tekst');
    if (span) span.remove();
}

/* ── Zasivljavanje opcija pri promeni ── */
if (forma) forma.addEventListener('change', (e) => {
    const pitanje = getPitanjeWrapper(e.target);
    if (pitanje) ukloniGresku(pitanje);

    if (e.target.type === 'radio') {
        /* Standardne pill opcije */
        const red = e.target.closest('.opcije-red');
        if (red && !red.classList.contains('likert-opcije')) {
            red.classList.add('ima-izbor');
            red.querySelectorAll('.opcija').forEach(opcija => {
                const radio = opcija.querySelector('input[type="radio"]');
                opcija.classList.toggle('neizabrana', !radio.checked);
            });
        }

        /* Likert kružići */
        const likertOpcije = e.target.closest('.likert-opcije');
        if (likertOpcije) {
            likertOpcije.classList.add('ima-izbor');
            likertOpcije.querySelectorAll('.likert-opcija').forEach(opcija => {
                const radio = opcija.querySelector('input[type="radio"]');
                opcija.classList.toggle('neizabrana', !radio.checked);
            });
        }
    }
});

if (forma) forma.addEventListener('input', (e) => {
    const pitanje = getPitanjeWrapper(e.target);
    if (pitanje) ukloniGresku(pitanje);
});

/* ══════════════════════════════════════════
   OZNAKA POKUŠAJA SLANJA (zaštita od duplikata)
   Ako mreža pukne posle 15 s timeout-a, a server je red već upisao,
   učesnik će kliknuti „Pošalji" ponovo. Isti _id putuje sa oba zahteva,
   pa server prepoznaje ponovljeni pokušaj i ne upisuje drugi red.
   ══════════════════════════════════════════ */
const idSlanja = (function() {
    try {
        if (window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
    } catch (e) { /* stariji brauzeri — rezerva ispod */ }
    return 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 12);
})();

if (forma) forma.addEventListener('submit', (e) => {
    e.preventDefault();

    /* ── Honeypot: ako je skriveno polje popunjeno — verovatno bot, ne šalji ── */
    const hp = forma.querySelector('input[name="hp_polje"]');
    if (hp && hp.value.trim() !== '') return;

    let brojGresaka = 0;

    /* ── Validacija svih radio grupa ── */
    const radioGrupe = [...new Set(
        [...forma.querySelectorAll('input[type="radio"]')].map(r => r.name)
    )];

    radioGrupe.forEach(ime => {
        const prviRadio = forma.querySelector(`input[name="${ime}"]`);
        const pitanje = getPitanjeWrapper(prviRadio);
        /* Preskoči skrivena (uslovni blokovi) i opciona pitanja */
        if (!pitanje || pitanje.offsetParent === null) return;
        if (prviRadio.closest('.opciono')) return;
        const izabrano = forma.querySelector(`input[name="${ime}"]:checked`);
        if (!izabrano) {
            prikaziGresku(pitanje, 'Ovo polje je obavezno.');
            brojGresaka += 1;
        }
    });

    /* ── Validacija number inputa (numeričko poređenje, ne string) ── */
    forma.querySelectorAll('input[type="number"]').forEach(input => {
        const pitanje = getPitanjeWrapper(input);
        if (pitanje && pitanje.offsetParent === null) return;   /* skriveno */

        const opciono = !!input.closest('.opciono');
        const prazno = !input.value.trim();
        if (opciono && prazno) return;                          /* opciono i prazno — u redu */

        const broj = Number(input.value);
        const min = input.min !== '' ? Number(input.min) : -Infinity;
        const max = input.max !== '' ? Number(input.max) :  Infinity;
        /* step="1" znači cele godine — bez ove provere prolaze „28,5" i „1e3",
           jer type=number prihvata i decimale i eksponentni zapis. */
        const celBroj = input.step !== '1' || Number.isInteger(broj);
        if (prazno || Number.isNaN(broj) || !celBroj || broj < min || broj > max) {
            prikaziGresku(pitanje, `Unesite ceo broj između ${input.min} i ${input.max}.`);
            brojGresaka += 1;
        }
    });

    /* ── Validacija obaveznih tekstualnih polja ──
       Za razliku od MSF upitnika (gde su sva tekst polja bila namerno
       opciona), ovde su „Mesto zaposlenja" i „Predmet/i koje predajete"
       pravi demografski podaci. Validiraju se sva .unos-linija polja osim
       onih u .opciono bloku (npr. opis aktivnosti van škole). Polja klase
       .unos-drugo se NE validiraju — ona su aktivna samo uz svoj radio. */
    forma.querySelectorAll('input[type="text"].unos-linija').forEach(input => {
        const pitanje = getPitanjeWrapper(input);
        if (!pitanje || pitanje.offsetParent === null) return;   /* skriveno */
        if (input.closest('.opciono')) return;
        if (!input.value.trim()) {
            prikaziGresku(pitanje, 'Ovo polje je obavezno.');
            brojGresaka += 1;
        }
    });

    /* ── Unakrsna provera: staž ne može da premaši radni vek ──
       Bez ovoga prolazi „28 godina starosti, 40 godina staža" — greška u
       kucanju koju ni jedno pojedinačno polje ne može da uhvati. */
    const poljeGodine = forma.querySelector('input[name="godine"]');
    const poljeStaz   = forma.querySelector('input[name="staz"]');
    if (poljeGodine && poljeStaz && poljeGodine.value.trim() && poljeStaz.value.trim()) {
        const maxStaz = Number(poljeGodine.value) - 18;
        if (Number(poljeStaz.value) > maxStaz) {
            prikaziGresku(getPitanjeWrapper(poljeStaz),
                'Staž ne može biti duži od ' + Math.max(0, maxStaz) + ' god. uz unetu starost.');
            brojGresaka += 1;
        }
    }

    /* ── Validacija canvas potpisa ── */
    const canvasPotpis = forma.querySelector('#saglasnost-canvas');
    if (canvasPotpis) {
        const hidden = forma.querySelector('#saglasnost');
        const pitanje = getPitanjeWrapper(canvasPotpis) || canvasPotpis.closest('.pitanje') || canvasPotpis.closest('.saglasnost-blok');
        if (!hidden || !hidden.value) {
            if (pitanje) prikaziGresku(pitanje, 'Molimo Vas da nacrtate znak saglasnosti.');
            canvasPotpis.style.borderColor = 'var(--greska)';
            brojGresaka += 1;
        }
    }

    if (brojGresaka > 0) {
        prikaziBrojacGresaka(brojGresaka);
        const prvaGreska = forma.querySelector('.greska');
        if (prvaGreska) prvaGreska.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
    }

    /* ── Slanje podataka na Google Sheets ── */
    const podaci = {};
    const fd = new FormData(forma);
    fd.forEach((vrednost, kljuc) => {
        podaci[kljuc] = kljuc === 'saglasnost' ? 'da' : vrednost;
    });
    podaci.token = window.UPITNIK_TOKEN;
    podaci._id = idSlanja;

    const dugme = forma.querySelector('[type="submit"]');

    /* Bez konfiguracije nema slanja (config.js nije učitan / URL nije postavljen) */
    if (!window.UPITNIK_URL) {
        alert('Slanje trenutno nije moguće (nedostaje konfiguracija). Molimo obavestite organizatore.');
        return;
    }

    const dugmeHTML = dugme.innerHTML;
    dugme.disabled = true;
    dugme.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>Šalje se…</span>';

    /* Prekid ako mreža predugo ne odgovara (15 s) */
    const kontroler = new AbortController();
    const istek = setTimeout(function() { kontroler.abort(); }, 15000);

    fetch(window.UPITNIK_URL, {
        method: 'POST',
        body: JSON.stringify(podaci),
        signal: kontroler.signal
    })
    .then(function(res) { return res.json(); })
    .then(function(odgovor) {
        if (odgovor.status === 'ok') {
            zabeleziPopunjen(podaci.tip_upitnika);
            upitnikPoslat = true;
            obrisiRadnuVerziju();
            forma.closest('.upitnik').innerHTML =
                '<div class="hvala">' +
                '<p>Hvala na popunjenom upitniku!</p>' +
                '<p>Vaši odgovori su uspešno zabeleženi.</p>' +
                '</div>';
        } else {
            throw new Error(odgovor.greska || 'Nepoznata greška');
        }
    })
    .catch(function() {
        dugme.disabled = false;
        dugme.innerHTML = dugmeHTML;
        alert('Došlo je do greške pri slanju. Molimo pokušajte ponovo.');
    })
    .finally(function() { clearTimeout(istek); });
});

/* ══════════════════════════════════════════
   TRAKA NAPRETKA
   Tanka fiksirana traka na vrhu ekrana: procenat
   odgovorenih od vidljivih OBAVEZNIH pitanja (ista logika
   preskakanja kao u validaciji — skrivena i .opciono se ne
   računaju, pa Da/Ne grananje samo prilagodi zbir).
   ══════════════════════════════════════════ */
(function() {
    if (!forma) return;

    const traka = document.createElement('div');
    traka.className = 'napredak-traka';
    traka.setAttribute('role', 'progressbar');
    traka.setAttribute('aria-label', 'Napredak popunjavanja upitnika');
    traka.setAttribute('aria-valuemin', '0');
    traka.setAttribute('aria-valuemax', '100');
    const puni = document.createElement('div');
    puni.className = 'napredak-puni';
    traka.appendChild(puni);
    document.body.appendChild(traka);

    function izracunaj() {
        let ukupno = 0;
        let odgovoreno = 0;

        const radioGrupe = [...new Set(
            [...forma.querySelectorAll('input[type="radio"]')].map(r => r.name)
        )];
        radioGrupe.forEach(function(ime) {
            const prviRadio = forma.querySelector('input[name="' + ime + '"]');
            const pitanje = getPitanjeWrapper(prviRadio);
            if (!pitanje || pitanje.offsetParent === null) return;
            if (prviRadio.closest('.opciono')) return;
            ukupno += 1;
            if (forma.querySelector('input[name="' + ime + '"]:checked')) odgovoreno += 1;
        });

        forma.querySelectorAll('input[type="number"]').forEach(function(input) {
            const pitanje = getPitanjeWrapper(input);
            if (pitanje && pitanje.offsetParent === null) return;
            if (input.closest('.opciono')) return;
            ukupno += 1;
            if (input.value.trim() !== '') odgovoreno += 1;
        });

        forma.querySelectorAll('input[type="text"].unos-linija').forEach(function(input) {
            const pitanje = getPitanjeWrapper(input);
            if (!pitanje || pitanje.offsetParent === null) return;
            if (input.closest('.opciono')) return;
            ukupno += 1;
            if (input.value.trim() !== '') odgovoreno += 1;
        });

        const potpis = forma.querySelector('#saglasnost');
        if (potpis) {
            ukupno += 1;
            if (potpis.value) odgovoreno += 1;
        }

        const procenat = ukupno ? Math.round(odgovoreno / ukupno * 100) : 0;
        puni.style.width = procenat + '%';
        traka.setAttribute('aria-valuenow', String(procenat));
    }

    forma.addEventListener('change', izracunaj);
    forma.addEventListener('input', izracunaj);
    /* Potpis i „Obriši" ne emituju change — preračunaj po otpuštanju prsta/miša.
       Slušamo i pointerup i mouseup: pointer događaji pokrivaju sve savremene
       brauzere, ali mouseup je jeftina rezerva za okruženja koja emituju samo
       klasične mouse događaje (inače traka ostane na staroj vrednosti). */
    document.addEventListener('pointerup', izracunaj);
    document.addEventListener('mouseup', izracunaj);
    document.addEventListener('touchend', izracunaj);
    izracunaj();
})();

/* ══════════════════════════════════════════
   ANIMACIJA SEKCIJA pri skrolovanju
   Sekcije se blago pojave kad uđu u ekran (jednom).
   Klasa anim-sekcije se dodaje tek kad observer postoji,
   pa bez JS-a (ili uz prefers-reduced-motion) sve ostaje
   normalno vidljivo. Krajnje stanje nema transform — sticky
   likert zaglavlje nastavlja da radi.
   ══════════════════════════════════════════ */
(function() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const sekcije = document.querySelectorAll('.sekcija, .napomena, .saglasnost-blok');
    if (!sekcije.length) return;

    const posmatrac = new IntersectionObserver(function(unosi) {
        unosi.forEach(function(unos) {
            if (!unos.isIntersecting) return;
            unos.target.classList.add('sekcija-vidljiva');
            posmatrac.unobserve(unos.target);
        });
    }, { rootMargin: '0px 0px -8% 0px' });

    document.body.classList.add('anim-sekcije');
    sekcije.forEach(function(s) { posmatrac.observe(s); });
})();

/* ══════════════════════════════════════════
   BROJAČ PREOSTALIH ODGOVORA
   Posle neuspelog slanja, kraj dugmeta „Pošalji" stoji
   koliko odgovora još nedostaje. Kako učesnik odgovara
   (postojeći listeneri skidaju .greska), broj se smanjuje
   i poruka nestaje na nuli. Pre prvog pokušaja slanja
   poruka se ne prikazuje.
   ══════════════════════════════════════════ */
function porukaNedostaje(n) {
    /* Srpski oblici: 1/21/31… odgovor; 2–4/22–24… odgovora (nedostaju);
       ostalo odgovora (nedostaje); 11–14 uvek odgovora (nedostaje) */
    const j = n % 10, d = n % 100;
    if (j === 1 && d !== 11) return 'Nedostaje još ' + n + ' odgovor — pitanje je označeno crvenom bojom.';
    if (j >= 2 && j <= 4 && (d < 12 || d > 14)) return 'Nedostaju još ' + n + ' odgovora — pitanja su označena crvenom bojom.';
    return 'Nedostaje još ' + n + ' odgovora — pitanja su označena crvenom bojom.';
}

function prikaziBrojacGresaka(n) {
    const podnozje = forma && forma.querySelector('.podnozje-forme');
    if (!podnozje) return;
    let poruka = podnozje.querySelector('.podnozje-greska');
    if (!poruka) {
        poruka = document.createElement('p');
        poruka.className = 'podnozje-greska';
        poruka.setAttribute('role', 'status');
        podnozje.insertBefore(poruka, podnozje.firstChild);
    }
    poruka.textContent = porukaNedostaje(n);
}

(function() {
    if (!forma) return;

    function azuriraj() {
        const poruka = forma.querySelector('.podnozje-greska');
        if (!poruka) return;   /* pre prvog pokušaja slanja nema poruke */
        const n = forma.querySelectorAll('.greska').length;
        if (n === 0) poruka.remove();
        else poruka.textContent = porukaNedostaje(n);
    }

    forma.addEventListener('change', azuriraj);
    forma.addEventListener('input', azuriraj);
    /* Potpis ne emituje change — kao i kod trake napretka */
    document.addEventListener('pointerup', azuriraj);
    document.addEventListener('mouseup', azuriraj);
    document.addEventListener('touchend', azuriraj);
})();

/* ══════════════════════════════════════════
   RADNA VERZIJA (autosave) + UPOZORENJE PRE IZLASKA
   Odgovori se usput čuvaju u sessionStorage (po tabu —
   novi tab na deljenom uređaju kreće od prazne forme) i
   vraćaju posle slučajnog osvežavanja strane. Potpis se ne
   čuva — crta se ponovo. Pre napuštanja strane sa unetim
   odgovorima brauzer traži potvrdu; posle uspešnog slanja
   snimak se briše i upozorenja nema.
   ══════════════════════════════════════════ */
let upitnikPoslat = false;

const radnaVerzijaKljuc = (function() {
    if (!forma) return null;
    const tip = (forma.querySelector('input[name="tip_upitnika"]') || {}).value;
    return tip ? 'upitnik_up_radna_verzija_' + tip : null;
})();

function obrisiRadnuVerziju() {
    if (!radnaVerzijaKljuc) return;
    try { sessionStorage.removeItem(radnaVerzijaKljuc); } catch (e) { /* privatni režim */ }
}

(function() {
    if (!radnaVerzijaKljuc) return;

    function snimi() {
        const podaci = {};
        forma.querySelectorAll('input[name]').forEach(function(inp) {
            /* hidden (tip, saglasnost-canvas) i honeypot se ne čuvaju */
            if (inp.type === 'hidden' || inp.name === 'hp_polje') return;
            if (inp.type === 'radio') {
                if (inp.checked) podaci[inp.name] = inp.value;
            } else if (inp.value.trim() !== '') {
                podaci[inp.name] = inp.value;
            }
        });
        try {
            if (Object.keys(podaci).length) sessionStorage.setItem(radnaVerzijaKljuc, JSON.stringify(podaci));
            else sessionStorage.removeItem(radnaVerzijaKljuc);
        } catch (e) { /* privatni režim — bez čuvanja */ }
    }

    function vrati() {
        let snimak = null;
        try { snimak = JSON.parse(sessionStorage.getItem(radnaVerzijaKljuc) || 'null'); } catch (e) {}
        if (!snimak) return;

        /* Rekreiraj „Dodaj još" setove (_2, _3…) pre upisa vrednosti —
           postojeći handler sam generiše iste sufikse */
        document.querySelectorAll('.dodaj-jos').forEach(function(dugme) {
            const pitanje = dugme.closest('.pitanje');
            const lista = pitanje && pitanje.querySelector('.prethodna-lista');
            if (!lista) return;
            const osnovna = [];
            lista.querySelectorAll('.prethodna-stavka input[name]').forEach(function(inp) { osnovna.push(inp.name); });
            let najveci = 1;
            Object.keys(snimak).forEach(function(kljuc) {
                const m = kljuc.match(/^(.+)_(\d+)$/);
                if (m && osnovna.indexOf(m[1]) !== -1) najveci = Math.max(najveci, Number(m[2]));
            });
            for (let i = 2; i <= najveci; i++) dugme.click();
        });

        Object.keys(snimak).forEach(function(ime) {
            const polja = forma.querySelectorAll('input[name="' + ime + '"]');
            if (!polja.length) return;
            let promenjen = null;
            if (polja[0].type === 'radio') {
                polja.forEach(function(r) {
                    r.checked = (r.value === snimak[ime]);
                    if (r.checked) promenjen = r;
                });
            } else {
                polja[0].value = snimak[ime];
                promenjen = polja[0];
            }
            /* change kroz postojeće listenere sređuje zasivljavanje
               opcija, otkrivanje uslovnog bloka i traku napretka */
            if (promenjen) promenjen.dispatchEvent(new Event('change', { bubbles: true }));
        });
    }

    vrati();
    forma.addEventListener('change', snimi);
    forma.addEventListener('input', snimi);
    /* „Ukloni" dugme ne emituje change — uhvati i klikove */
    document.addEventListener('pointerup', snimi);
    document.addEventListener('mouseup', snimi);

    window.addEventListener('beforeunload', function(e) {
        if (upitnikPoslat) return;
        let ima = false;
        try { ima = sessionStorage.getItem(radnaVerzijaKljuc) !== null; } catch (err) {}
        /* Rezerva ako je sessionStorage nedostupan */
        if (!ima) ima = !!forma.querySelector('input[type="radio"]:checked');
        if (!ima) return;
        e.preventDefault();
        e.returnValue = '';
    });
})();
