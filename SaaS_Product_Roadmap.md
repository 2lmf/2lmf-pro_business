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

## 4. Sljedeći Tehnički Koraci
- [ ] Implementirati `localStorage` logiku za `GAS_URL` u `app.js`.
- [ ] Dodati funkciju u `final_gas_script.gs` koja generira Setup QR kod.
- [ ] Kreirati "Onboarding" ekran u PWA.

---
*Pripremljeno od strane: Antigravity (Shark Team)* 🦈🚀
