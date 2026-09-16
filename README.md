# ENG Workspace

Task management per un piccolo team: Cliente → Cluster → Attività → Checklist. JavaScript nativo, Vite, Supabase ed export Excel. Interfaccia in italiano, desktop/tablet, membri aggiungibili e modificabili con avatar.

## Avvio rapido della demo

Su Mac puoi aprire **`Avvia ENG.command`** con doppio clic: usa Node disponibile, installa le dipendenze se mancanti e apre il browser all’indirizzo corretto. Al primo avvio senza configurazione prepara la demo locale. Lascia aperta la finestra Terminale durante l’utilizzo. **Non aprire direttamente `index.html`**: l’app richiede il server locale per caricare i moduli JavaScript.

Richiede Node.js **22.12 o successivo**; Node 24 è consigliato. Installa Node dal sito ufficiale, quindi apri un terminale nella cartella del progetto.

```sh
npm install
cp .env.example .env.local
```

In `.env.local` imposta `VITE_DEMO_MODE=true`, lascia vuoti URL e chiave Supabase e avvia:

```sh
npm run dev
```

Apri [http://127.0.0.1:5173](http://127.0.0.1:5173), premi **Apri demo locale**, scegli un membro. Sono inclusi 4 membri modificabili, 5 clienti fittizi, 8 cluster, 32 attività e 75 sotto-attività. La demo salva solo nel browser: non sincronizza con altri dispositivi e non simula un login Supabase. Chiudendo la scheda termina la scelta del membro; riaprendo la demo i dati locali restano.

Per installazioni riproducibili è incluso `pnpm-lock.yaml`: con pnpm 11 o successivo usare `pnpm install --frozen-lockfile` e `pnpm dev`. Le impostazioni di build e l’override della dipendenza UUID sono forniti sia per npm sia per pnpm.

## 1. Creare il progetto Supabase

1. Apri [Supabase Dashboard](https://supabase.com/dashboard) e crea un **nuovo progetto dedicato** al workspace, preferibilmente in una regione europea.
2. Conserva la password del database nel gestore password aziendale. Non serve al frontend.
3. Attendi che il database sia disponibile. Nel pannello Connect/API recupera il **Project URL** e la chiave **publishable**. È supportata anche la vecchia chiave pubblica `anon`.
4. La Data API deve esporre `public`, **mai `private`**.

## 2. Creare database, relazioni e RLS

Nel SQL Editor esegui interamente, in questo ordine:

1. [`sql/schema.sql`](sql/schema.sql): tabelle, foreign key, indici, funzioni atomiche, controlli di accesso e RLS abilitata.
2. [`sql/policies.sql`](sql/policies.sql): grant minimi e policy di lettura.
3. [`sql/members.sql`](sql/members.sql): quattro membri iniziali, che rinominerai dall’app.

Gli script schema/policies sono migrazioni iniziali da eseguire una volta su un database nuovo. Per eventuali evoluzioni usa nuove migrazioni versionate. Non eseguirli su un progetto con altre applicazioni: i grant vengono impostati per questo workspace.

Per una prova con dati fittizi esegui anche [`sql/seed.sql`](sql/seed.sql). Il seed è facoltativo e può essere rieseguito: non sovrascrive record già esistenti. Le scadenze sono relative al giorno di esecuzione. Per la produzione è preferibile partire con i soli membri.

## 3. Creare l’account condiviso

1. In **Authentication → Users**, crea manualmente un unico account email/password e conferma l’indirizzo tramite l’opzione amministrativa prevista da Supabase.
2. Usa un indirizzo controllato dal team e condividi la password tramite un gestore password. Nessuna password va nei file del progetto.
3. Disabilita le nuove registrazioni pubbliche nelle impostazioni Auth. Mantieni attivo il provider email/password. Per consentire il lavoro contemporaneo, non attivare limitazioni a una singola sessione per utente.
4. Esegui [`sql/authorize_shared_account.sql`](sql/authorize_shared_account.sql). Autorizza l’unico utente Auth presente. Se gli utenti sono più di uno, lo script si ferma senza concedere accessi: verifica la configurazione del progetto dedicato.
5. Configura l’URL dell’app nelle impostazioni URL di Auth: quello locale durante lo sviluppo e il dominio HTTPS definitivo dopo il deploy.

Solo l’UUID autorizzato in `private.workspace_access` può leggere e modificare il workspace. Un altro account autenticato non riceve dati. La scelta del membro nell’app serve per personalizzazione e storico operativo, non costituisce un secondo login e non certifica l’identità personale.

## 4. Configurare le variabili pubbliche

Nel file `.env.local` inserisci il Project URL in `VITE_SUPABASE_URL`, la chiave pubblica in `VITE_SUPABASE_PUBLISHABLE_KEY` e imposta **`VITE_DEMO_MODE=false`**. Riavvia il server dopo ogni modifica alle variabili.

Le variabili `VITE_` sono visibili nel browser. Il progetto accetta solo le tre variabili documentate; la build rifiuta chiavi `sb_secret_` e JWT con ruolo diverso da `anon`. Non inserire service role key, password, token personali o credenziali database. La sicurezza dei dati deriva da Auth, RLS e dai controlli delle RPC, non dalla segretezza della chiave pubblica.

Il file `.env.example` contiene soltanto i nomi delle variabili. `.env.local` è escluso da Git. In assenza di configurazione l’app mostra una schermata di configurazione; non passa automaticamente alla demo.

## 5. Installare, avviare e controllare

```sh
npm install
npm run check
npm test
npm run dev
```

Il test suite include PostgreSQL in WebAssembly (PGlite), senza Docker e senza un account Supabase. Esegue gli stessi SQL del progetto con ruoli e identità Auth di test, verifica RLS, transazioni, conflitti, anagrafiche e relazioni. Il test Excel genera e riapre il workbook. Questi test non sostituiscono il collaudo finale di Auth/PostgREST nel progetto Supabase remoto.

## 6. Deploy

L’app è un sito statico. Usa il servizio di hosting HTTPS aziendale o un hosting statico compatibile con Vite.

1. Imposta in ambiente di build i tre valori pubblici, con **demo disabilitata**.
2. Installa le dipendenze dal lockfile con `pnpm install --frozen-lockfile` oppure usa `npm install`.
3. Comando build: `npm run build` (oppure `pnpm build`). Cartella da pubblicare: **`dist`**.
4. Imposta Node 22.12+ sul servizio. La navigazione usa hash, quindi non richiede regole di riscrittura delle sette viste. La base relativa consente anche una sottocartella.
5. Aggiorna il Site URL di Supabase al dominio definitivo. Pubblica solo `dist`, mai il progetto completo, `.env.local`, cartelle di test o backup.
6. Prova il login da due browser distinti, il salvataggio condiviso, il cambio membro e il refresh. Esegui il collaudo riportato in [`docs/QA.md`](docs/QA.md).

Per provare localmente la build:

```sh
npm run build
npm run preview
```

La demo eventualmente attiva in `.env.local` viene inclusa nella build locale. Prima di una build destinata all’uso reale imposta `VITE_DEMO_MODE=false`; le variabili dell’hosting devono essere esplicite. Non è stato effettuato alcun deploy automatico.

## 7. Aggiungere, modificare o rimuovere membri

Apri **Gestisci team** nella parte bassa della sidebar. Usa **Aggiungi membro** per aggiungere nome, ruolo descrittivo, colore e avatar; **Modifica** per aggiornare una persona esistente. I nomi iniziali “Membro 1–4” sono volutamente provvisori e modificabili. Non esiste un limite fisso di quattro persone nel codice o nei KPI.

L’avatar accetta JPG, PNG e WebP fino a 5 MB, viene ritagliato al centro e ridimensionato localmente a 160×160. La miniatura viene conservata nella riga del membro: non richiede un bucket Storage pubblico. **Rimuovi avatar** ripristina le iniziali.

Per rimuovere una persona dall’operatività, disattiva **Membro attivo**. Assegnazioni pregresse e storico restano leggibili. Prima di disattivarla puoi riassegnare le sue attività usando il filtro responsabile. Deve rimanere almeno un membro attivo. Chi disattiva il proprio membro torna alla scelta iniziale.

## 8. Clienti e cluster

**Clienti → Nuovo cliente**: nome, descrizione, colore. Ogni scheda mostra KPI, cluster associati e accesso alle attività. **Cluster → Nuovo cluster**: scegli facoltativamente un cliente; lascialo vuoto per attività interne.

Archiviare un cliente o un cluster non elimina attività o collegamenti. Attiva **Mostra archiviati** per ritrovarli e riattivarli. I nuovi collegamenti non possono puntare a un’anagrafica archiviata; i collegamenti esistenti restano modificabili. Un cluster che contiene attività non può cambiare cliente senza prima scollegare tali attività.

## 9. Attività, filtri, board e checklist

- **Nuova attività** è sempre in alto. Titolo e almeno un responsabile sono obbligatori. Cliente e cluster sono facoltativi.
- Selezionando un cliente vengono mostrati i suoi cluster e quelli interni. Scegliendo un cluster con cliente viene allineato il cliente della task.
- La spunta accanto a una riga completa o riapre la task; il selettore cambia lo stato. La card del board si può trascinare oppure spostare col selettore, utilizzabile anche su tablet e da tastiera.
- Nel dettaglio si possono aggiungere, modificare, ordinare ed eliminare sotto-attività. Ogni sotto-attività ha più responsabili e scadenza facoltativa. La spunta su una task già salvata registra subito la checklist e gli altri valori presenti nel pannello; negli altri casi usa **Salva modifiche**.
- Ricerca globale su ID, titolo, descrizione, note, nomi di clienti/cluster/responsabili e testi checklist. `/` porta alla ricerca. I filtri sono combinabili e azzerabili.
- **Oggi** esclude le scadute, visibili in un filtro separato. **Questa settimana** va da oggi alla domenica corrente inclusa. I filtri operativi escludono le completate; **Tutte** permette di vederle.
- Un conflitto con la modifica di un collega impedisce la sovrascrittura: copia eventuali appunti, chiudi il pannello, aggiorna e riapri la task prima di salvare.

## 10. KPI ed Excel

Dashboard personale/team e Report usano gli stessi calcoli dell’Excel. Una task condivisa conta una volta nei totali e una volta nel carico di ciascun assegnatario. Percentuali e criteri temporali sono documentati in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).

**Esporta Excel** scarica `ENG_Task_Report_YYYY-MM-DD.xlsx` con **Attività**, **KPI**, **Checklist**, **Scadenze**. Include tutto il workspace, senza limitarsi ai filtri correnti. Date Excel native, timestamp in Europe/Rome, percentuali numeriche, intestazioni, filtri e prima riga congelata. Il foglio Scadenze include solo task aperte, ordinate da scadute a future, poi per data e priorità.

## 11. Branding

Colori e tipografia sono in `css/variables.css`, componenti in `css/components.css`, adattamenti in `css/responsive.css`. Il marchio grafico è in `public/assets/branding/mark.svg`; nome/claim sono in `js/ui.js`. L’identità ENG qui proposta è originale e non presume un manuale di marchio ufficiale non fornito.

## 12. Backup e ripristino

L’Excel è un report operativo, **non un backup completo**: non include tutte le relazioni in formato ripristinabile, le credenziali Auth o l’intero log.

1. Configura i backup del progetto nel pannello Supabase secondo il piano disponibile; controlla retention e disponibilità del ripristino puntuale.
2. Per un backup amministrativo completo usa la procedura ufficiale [backup e ripristino Supabase](https://supabase.com/docs/guides/platform/backups), includendo dati, schemi, funzioni, policy e utenti Auth. Conserva anche `private.workspace_access` e gli avatar contenuti in `team_members`.
3. Conserva le copie in un archivio aziendale riservato, con data e regole di retention. Non commetterle in Git e non pubblicarle nell’hosting.
4. Prova il ripristino su un progetto separato: confronta conteggi di task, assegnazioni e checklist; verifica che l’UUID dell’account Auth corrisponda all’accesso autorizzato; prova login ed export prima di sostituire l’ambiente operativo.

## 13. Struttura e collaudo

La struttura completa e le decisioni di implementazione sono in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md). I risultati verificati e le prove ancora necessarie su Supabase remoto sono in [`docs/QA.md`](docs/QA.md).

Riferimenti ufficiali: [Auth password Supabase](https://supabase.com/docs/guides/auth/passwords), [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Vite](https://vite.dev/guide/), [ExcelJS](https://github.com/exceljs/exceljs).
