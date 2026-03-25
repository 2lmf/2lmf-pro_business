# 🦈 Shark Business SaaS Roadmap - "Minimax u džepu"

Ovaj dokument služi kao arhitektura za pretvaranje tvoje interne aplikacije u proizvod koji možeš ponuditi drugima.

## 1. Koncept: "Dumb Free" Instalacija
Cilj je da novi korisnik može pokrenuti sustav u 60 sekundi bez pisanja ijedne linije kôda.

### Master Sheet Strategija
- **Ti (Vlasnik):** Kreiraš "Master Spreadsheet" koji sadrži:
    - Tablice sa željenom strukturom (`Proizvodi`, `Upiti`, `Postavke`).
    - Već instaliran Google Apps Script.
- **Korisnik:** 
    1. Klikne na tvoj link (koji automatski otvara "Make a copy").
    2. U svom novom Sheetu ide na `Extensions > Apps Script`.
    3. Klikne `Deploy > New Deployment` i kopira URL.

### Foto dokumentacija (Dokaz o radu)
- **Problem:** Klijenti često traže dokaz o izvedenim radovima ili stanju prije/poslije.
- **Rješenje:** Svaka ponuda u bazi ima polje za linkove na slike.
    - *Pro:* Ručno dodavanje linkova.
    - *Partner (v5.0):* Gumb "Slikaj" u aplikaciji koji šalje sliku na skriveni folder na tvom Driveu i automatski lijepi link u redak ponude.

### Knjigovodstvo (Bookkeeping-Ready)
- **Problem:** Ručno prepisivanje ponuda u tablice za knjigovođe.
- **Rješenje:** Poseban tab u Sheetu koji povlači samo potrebne podatke (Datum, Kupac, Iznos, PDV) u formatu koji svaki knjigovođa voli.
    - *Partner:* Gumb "Pošalji knjigovođi" koji generira PDF/Excel i šalje ga na mail.

---

## 2. Fiskalizacija - Strategija za Hrvatsku
Budući da je fiskalizacija komplicirana za male igrače, predlažem "slojeviti" pristup:

### Faza 1: Transakcijski Fokus (0% Troškova)
- Aplikacija izdaje **Ponude** s IBAN-om i Barkodom za plaćanje.
- Plaća se **isključivo transakcijski** (putem mobilnog bankarstva).
- **Prednost:** Nema potrebe za fiskalizacijom, klijent je 100% legalan.

### Faza 2: Solo.hr Integracija (SaaS model)
- Ako korisnik želi "pravi" fiskalizirani račun uz gotovinu:
- Povezujemo tvoj Google Script sa **Solo.hr API-jem**.
- Korisnik mora imati Solo.hr pretplatu. Tvoj sustav šalje podatke njima, oni odrađuju fiskalizaciju i vraćaju PDF.

---

## 3. Monetizacija (Kako zaraditi?)
- **Model "Kuharica":** Prodaješ samo upute i predložak Sheeta (jednokratno).
- **Model "Full Service":** Postavljaš sve za njih, personaliziraš logo i boje (High-ticket).
- **Model "Održavanje":** Ako koristiš tvoj centralni hosting za frontend, možeš naplaćivati sitnu godišnju pretplatu za "Update & Cloud".
### 🤖 AI Shark Modul (Budućnost v6.0)
- **Voice-to-Offer:** Snimi glasovnu bilješku na terenu -> AI je pretvara u popunjenu tablicu (stavke, količine).
- **AI Analiza Slike:** Slikaj krov ili ogradu -> AI procjenjuje dimenzije ili vrstu materijala.
- **Auto-Follow-up:** AI prati status ponude i sam piše podsjetnik kupcu nakon 3 dana.

### 🗺️ Google Maps & GPS Modul (v5.0 - RADIMO SAD)
- **Problem:** Vlasnici ne znaju točno gdje su ponude napravljene niti imaju pregled terena.
- **Rješenje:** Svaka ponuda automatski bilježi GPS koordinate (Lat/Lng).
    - *Značajka 1:* Vizualizacija svih ponuda na Google karti unutar aplikacije.
    - *Značajka 2:* "Dokaz dolaska" — vrijeme i lokacija su geolocirani.
    - *Značajka 3:* Pametne rute — AI poredak upita za najmanju potrošnju goriva.

---
## 🌅 PLAN ZA DANAS (v5.0)
1. **Frontend GPS:** Hvatanje koordinata pri svakom spremanju upita.
2. **Backend Sync:** Proširenje Google Sheeta za Lat/Lng stupce.
3. **Map Dashboard:** Tipka za prikaz svih lokacija na interaktivnoj mapi.

---

## 4. Sljedeći Tehnički Koraci
- [ ] Implementirati `localStorage` logiku za `GAS_URL` u `app.js`.
- [ ] Dodati funkciju u `final_gas_script.gs` koja generira Setup QR kod.
- [ ] Kreirati "Onboarding" ekran u PWA.

---
*Pripremljeno od strane: Antigravity (Shark Team)* 🦈🚀
