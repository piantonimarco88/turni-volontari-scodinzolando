# Turni Volontari — Scodinzolando ODV

Piattaforma web (HTML/CSS/JS, nessun framework, nessun login) per gestire i turni di presenza/assenza dei volontari del canile. Funziona da desktop e da smartphone.

Sezioni: **Calendario** (colpo d'occhio sui giorni più/meno coperti) · **Inserisci** (nuova presenza, modifica ed elimina quelle esistenti) · **Statistiche** (presenze, copertura per giorno e turno) · **Log** (storico di tutte le operazioni). In alto a destra il pulsante **Esporta Excel** scarica un file `.xlsx` con il dettaglio di tutte le presenze registrate (usa la libreria [SheetJS](https://sheetjs.com) caricata da CDN al volo, nessuna installazione richiesta).

## 1. Provalo subito (senza configurare nulla)

Apri `index.html` con doppio click, oppure con un piccolo server locale. L'app parte in **modalità locale**: funziona subito, ma i dati restano solo nel browser di chi la apre e non sono condivisi con gli altri volontari. Serve solo per vedere grafica e funzionalità.

## 2. Attiva la condivisione tra tutti i volontari (Firebase)

Per far sì che un turno inserito da un volontario sia visibile a tutti gli altri, in tempo reale, serve un progetto Firebase gratuito (nessuna carta di credito richiesta per l'uso previsto qui).

1. Vai su [console.firebase.google.com](https://console.firebase.google.com) e accedi con un account Google.
2. **Aggiungi progetto** → dai un nome (es. "scodinzolando-turni") → puoi disattivare Google Analytics, non serve.
3. Nel menu a sinistra apri **Build → Firestore Database** → **Crea database** → scegli una località vicina (es. `eur3 (europe-west)`) → avvia in **modalità test** (poi sistemiamo le regole al punto 4).
4. Sempre in Firestore, apri la scheda **Regole** e incolla queste regole (permettono lettura/scrittura solo sulle due collezioni usate dall'app, senza aprire tutto il database):

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /entries/{entryId} {
         allow read, write: if true;
       }
       match /log/{logId} {
         allow read, write: if true;
       }
     }
   }
   ```

   ⚠️ Nota di sicurezza: senza login, chiunque conosca l'indirizzo del sito può leggere e scrivere i turni. Va bene per un piccolo gruppo di volontari fidati con un link non pubblicizzato; **non condividere il link pubblicamente** (es. sui social). Se in futuro vorrete più protezione, si può aggiungere un PIN condiviso o un vero login.

5. Torna alla panoramica del progetto (icona ingranaggio → **Impostazioni progetto**), scorri fino a **Le tue app**, clicca l'icona `</>` (Web) → dai un nome all'app → **Registra app**. Firebase mostrerà un blocco `firebaseConfig = {...}`.
6. Apri il file [firebase-config.js](firebase-config.js) di questo progetto e sostituisci i valori segnaposto con quelli copiati da Firebase:

   ```js
   export const firebaseConfig = {
     apiKey: "...",
     authDomain: "...",
     projectId: "...",
     storageBucket: "...",
     messagingSenderId: "...",
     appId: "...",
   };
   ```

7. Salva e ricarica la pagina: in alto a destra dovrebbe comparire **🟢 Sincronizzato**. Da questo momento tutti i volontari che aprono lo stesso link vedono e modificano gli stessi dati in tempo reale.

## 3. Pubblica il sito (per avere un link da condividere)

Qualsiasi hosting statico gratuito va bene, ad esempio:

- **Netlify (più semplice)**: vai su [app.netlify.com/drop](https://app.netlify.com/drop) e trascina l'intera cartella del progetto. In pochi secondi ottieni un link pubblico.
- **GitHub Pages**: carica i file in un repository GitHub, poi Impostazioni → Pages → seleziona il branch. Utile se in futuro volete versionare le modifiche.

## 4. Personalizzazioni comuni

Tutte le personalizzazioni si fanno modificando poche righe in cima a [app.js](app.js):

- **Elenco volontari** — costante `VOLONTARI` (array di nomi): aggiungi, rimuovi o rinomina liberamente.
- **Orari standard di mattina/pomeriggio** — costante `ORARI_STANDARD`.
- **Soglie colore copertura calendario** (quante presenze = "ben coperto" ecc.) — funzione `coverageLevel()`.

## 5. Foto cane felice / cane triste

Quando si registra una **presenza** compare l'immagine `assets/dog-happy.svg`, per un'**assenza** `assets/dog-sad.svg`. Sono disegni segnaposto: quando avrai le foto reali, sostituisci semplicemente i due file mantenendo lo stesso percorso (se userai `.png` o `.jpg` invece di `.svg`, aggiorna anche i due riferimenti `assets/dog-happy.svg` / `assets/dog-sad.svg` nella funzione `showDogModal` in [app.js](app.js)).

## 6. Logo

Il logo in [assets/logo.svg](assets/logo.svg) è una ricostruzione grafica del logo dell'associazione, usata come segnaposto. Per il logo ufficiale al 100% identico, sostituisci il file `assets/logo.svg` con il file originale (va bene anche `.png`: in tal caso aggiorna i due riferimenti `assets/logo.svg` in [index.html](index.html)).

## Struttura del progetto

```
index.html           struttura delle 4 sezioni
style.css             stile, tema colori del logo, layout responsive
app.js                logica: calendario, form, statistiche, log, Firebase/localStorage
firebase-config.js    chiavi del progetto Firebase (da compilare, vedi punto 2)
assets/
  logo.svg             logo associazione
  dog-happy.svg         mostrato dopo una presenza
  dog-sad.svg            mostrato dopo un'assenza
```

Nessuna build, nessuna dipendenza da installare: sono solo file statici.
