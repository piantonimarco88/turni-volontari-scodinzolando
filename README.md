# Turni Volontari — Scodinzolando ODV

Piattaforma web (HTML/CSS/JS, nessun framework, nessun login) per gestire i turni di presenza/assenza dei volontari del canile. Funziona da desktop e da smartphone.

Sezioni: **Calendario** (colpo d'occhio sui giorni più/meno coperti) · **Inserisci** (nuova presenza, modifica ed elimina quelle esistenti) · **Statistiche** (presenze, copertura per giorno e turno) · **Log** (storico di tutte le operazioni). In alto a destra il pulsante **Esporta Excel** scarica un file `.xlsx` con il dettaglio di tutte le presenze registrate (usa la libreria [SheetJS](https://sheetjs.com) caricata da CDN al volo, nessuna installazione richiesta).

## 1. Provalo subito (senza configurare nulla)

Apri `index.html` con doppio click, oppure con un piccolo server locale. L'app parte in **modalità locale**: funziona subito, ma i dati restano solo nel browser di chi la apre e non sono condivisi con gli altri volontari. Serve solo per vedere grafica e funzionalità.

## 2. Condivisione tra tutti i volontari (Firebase) — già attiva

Il progetto Firebase è già configurato e collegato (`firebase-config.js` contiene le chiavi reali): un turno inserito da un volontario è visibile a tutti gli altri in tempo reale, senza bisogno di rifare questi passaggi. Restano qui come riferimento nel caso in futuro serva ricreare il progetto da zero.

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

Il sito è pubblicato su **GitHub Pages**: 🔗 **https://piantonimarco88.github.io/turni-volontari-scodinzolando/**

Repository: [github.com/piantonimarco88/turni-volontari-scodinzolando](https://github.com/piantonimarco88/turni-volontari-scodinzolando). Ogni `git push` sul branch `main` aggiorna il sito pubblicato in 1-2 minuti.

## 4. Personalizzazioni comuni

Tutte le personalizzazioni si fanno modificando poche righe in cima a [app.js](app.js):

- **Elenco volontari** — costante `VOLONTARI` (array di nomi): aggiungi, rimuovi o rinomina liberamente.
- **Orari standard di mattina/pomeriggio** — costante `ORARI_STANDARD`.
- **Soglie colore copertura calendario** (quante presenze = "ben coperto" ecc.) — funzione `coverageLevel()`.

## 5. Foto cane felice

Quando si registra una presenza compare una foto vera del canile (scelta a caso tra `assets/dog-happy-1.jpeg`, `dog-happy-2.jpeg`, `dog-happy-3.jpeg`) insieme a un messaggio simpatico scelto a caso tra quelli nella costante `DOG_MESSAGES` in cima a [app.js](app.js). Per aggiungere altre foto: metti il file in `assets/` e aggiungi il percorso all'array `DOG_PHOTOS` in [app.js](app.js). Per aggiungere altri messaggi, aggiungili all'array `DOG_MESSAGES`.

## 6. Logo

Il logo ufficiale dell'associazione è in [assets/logo.jpg](assets/logo.jpg), usato sia nell'header sia come icona del sito.

## Struttura del progetto

```
index.html           struttura delle 4 sezioni
style.css             stile, tema colori del logo, layout responsive
app.js                logica: calendario, form, statistiche, log, Firebase/localStorage, export Excel
firebase-config.js    chiavi del progetto Firebase (già configurate)
assets/
  logo.jpg             logo associazione
  dog-happy-1/2/3.jpeg  foto mostrate a rotazione dopo una presenza
```

Nessuna build, nessuna dipendenza da installare: sono solo file statici.
