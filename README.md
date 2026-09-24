# ENG Workspace

Task management per un piccolo team: Cliente → Cluster → Attività → Checklist. JavaScript nativo, Vite, Supabase ed export Excel. Interfaccia in italiano, desktop/tablet, membri aggiungibili e modificabili con avatar.

## Uso quotidiano sul PC aziendale

Sul PC aziendale non devi installare o scaricare nulla. Non servono Node.js, npm, PowerShell, Prompt dei comandi, estensioni del browser o diritti di amministratore. L’app viene costruita sui server GitHub e pubblicata come normale sito HTTPS.

1. Apri Microsoft Edge.
2. Vai a [https://ulisse07.github.io/to-do-list/](https://ulisse07.github.io/to-do-list/). L’indirizzo funziona dopo la prima pubblicazione descritta nel capitolo 5.
3. Accedi con l’email e la password condivise, quindi scegli il membro che sta lavorando.
4. In Edge premi la stella nella barra degli indirizzi e salva la pagina nei Preferiti.
5. Le volte successive apri soltanto quel Preferito. Puoi chiudere Edge normalmente a fine lavoro.

Non aprire `index.html`, non scaricare il repository e non usare i launcher locali sul PC aziendale. La modalità condivisa salva su Supabase e permette di lavorare da più PC. La demo salva invece soltanto nel profilo Edge corrente e serve per una prova iniziale.

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
5. Configura nelle impostazioni URL di Auth il Site URL `https://ulisse07.github.io/to-do-list/`.

Solo l’UUID autorizzato in `private.workspace_access` può leggere e modificare il workspace. Un altro account autenticato non riceve dati. La scelta del membro nell’app serve per personalizzazione e storico operativo, non costituisce un secondo login e non certifica l’identità personale.

## 4. Configurare l’app da GitHub

Tutta la configurazione si esegue dal browser. Apri il repository `Ulisse07/to-do-list`, quindi **Settings → Secrets and variables → Actions**.

Nella scheda **Variables** crea:

- `VITE_SUPABASE_URL` con il Project URL di Supabase;
- `VITE_DEMO_MODE` con valore `false`.

Nella scheda **Secrets** crea `VITE_SUPABASE_PUBLISHABLE_KEY` e inserisci la chiave pubblica publishable. La chiave è destinata al frontend, ma viene conservata qui per evitare modifiche manuali ai file.

Non inserire password, service role key, token personali o credenziali database. La build accetta solo le tre variabili documentate e rifiuta chiavi `sb_secret_`, JWT con ruolo diverso da `anon` e altre variabili frontend. La sicurezza dei dati deriva da Auth, RLS e RPC, non dalla segretezza della chiave pubblica.

## 5. Prima pubblicazione online

1. Nel repository apri **Settings → Pages**.
2. In **Build and deployment → Source** scegli **GitHub Actions**. Questa è un’impostazione da fare una sola volta.
3. Apri la scheda **Actions** del repository.
4. Seleziona **Pubblica sito senza installazioni**.
5. Premi **Run workflow**, lascia selezionato `main` e conferma con **Run workflow**.
6. Attendi il segno di spunta verde. La procedura installa, controlla, testa e costruisce l’app sui server GitHub.
7. Apri [https://ulisse07.github.io/to-do-list/](https://ulisse07.github.io/to-do-list/) in Microsoft Edge.
8. In Supabase imposta questo stesso indirizzo come **Site URL** nelle impostazioni Auth, quindi esegui il collaudo in [`docs/QA.md`](docs/QA.md).

Se le variabili Supabase non sono ancora configurate, il workflow pubblica la demo. Dopo aver completato il capitolo 4, esegui di nuovo il workflow per passare alla modalità condivisa.

GitHub Pages pubblica il frontend su Internet anche quando il repository è privato. Il sito non contiene password o dati aziendali e Supabase protegge i dati con login e RLS. Verifica comunque che GitHub Pages sia consentito dalla policy aziendale. Se l’opzione Pages non è disponibile per il piano GitHub o il dominio `github.io` è bloccato, consegna la cartella `dist` all’IT per un hosting HTTPS aziendale o Azure Static Web Apps; l’architettura dell’app non cambia.

## 6. Aggiornamenti e controlli

Dopo ogni aggiornamento del codice, apri **Actions → Pubblica sito senza installazioni → Run workflow**. La nuova versione sostituisce quella precedente senza operazioni sul PC aziendale.

Il workflow esegue controllo sintassi, verifica credenziali, 18 test automatici e build. I test includono PostgreSQL in WebAssembly, RLS, transazioni, conflitti, anagrafiche, relazioni ed Excel. Non sostituiscono il collaudo finale di Auth e sincronizzazione sul progetto Supabase remoto.

Node 24 e pnpm vengono usati soltanto dal runner temporaneo GitHub. Per manutenzione tecnica su un computer autorizzato restano disponibili `Avvia ENG.command`, `Avvia ENG su Windows.bat` e i comandi `pnpm install --frozen-lockfile`, `pnpm test` e `pnpm build`; non servono agli utilizzatori aziendali.

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
