# ENG Workspace — collaudo di consegna

Data iniziale: **16 settembre 2026**. Architettura senza installazioni aggiornata il **24 settembre 2026**, versione 1.0.0.

## Esito e perimetro

L’app è utilizzabile in demo ed è predisposta per la pubblicazione su GitHub Pages senza installazioni sul PC aziendale. Sono disponibili workflow, implementazione Supabase, schema, policy, seed e istruzioni di configurazione. **Il progetto Supabase non è stato creato né collegato e GitHub Pages non è stato ancora abilitato:** login remoto, API ospitata, sincronizzazione tra dispositivi e pubblicazione richiedono il collaudo di messa in servizio descritto sotto. Il login demo non è una verifica del login Supabase.

Verifiche eseguite su macOS, Node 24.19.0, pnpm 11.19.0 e browser integrato Chromium. Installazione da una copia pulita con `pnpm install --frozen-lockfile`, controllo sintassi, test e build. L’installazione iniziale richiede accesso al registro npm; non è garantita offline.

## Criteri di accettazione

| # | Criterio | Esito verificato |
|---|---|---|
| 1 | Login condiviso | Implementato con Supabase Auth email/password. Accesso al database verificato in PGlite; login Auth remoto da collaudare. |
| 2 | Selezione membro | Verificata nel browser, inclusi cambio membro e ritorno alla scelta dopo disattivazione del proprio membro. |
| 3 | Dashboard personale | Verificata per membri diversi; il nuovo membro senza assegnazioni vede valori a zero. |
| 4 | Oggi | Test automatici: scadenza odierna, assegnatario corretto, completate escluse, scadute separate. |
| 5 | Questa settimana | Test automatici: fino alla domenica inclusa, confini di settimana e anno. |
| 6 | Clienti | Creazione e archiviazione nel browser; controlli SQL e conservazione dei collegamenti nei test. |
| 7 | Cluster | Creazione di un cluster interno nel browser; controlli su cliente, archiviazione e spostamento di cluster popolati nei test SQL. |
| 8 | Task CRUD | Creazione, apertura, modifica e rimozione di una task di prova nel browser; transazioni e conflitti verificati nei test SQL. |
| 9 | Assegnazioni multiple | Task con tre responsabili creata e riaperta nel browser; relazioni many-to-many verificate nel database. |
| 10 | Totali senza duplicati | Test su ID unici: una task condivisa conta una volta nei totali e nel carico di ogni responsabile. |
| 11 | Checklist | Aggiunta e completamento immediato nel browser, persistenza dopo refresh; CRUD e integrità nei test SQL. |
| 12 | Responsabili checklist | Assegnazione nel browser e riapertura; salvataggio delle relazioni nei test SQL. |
| 13 | Board | Spostamento con selettore e trascinamento mouse tra colonne, verificato anche dopo ricaricamento. Su touch e da tastiera usare il selettore. |
| 14 | Ricerca globale | Ricerca della task di prova nel browser; copertura di testi e relazioni nei test di dominio. |
| 15 | Filtri | Test su combinazioni di criteri, assegnatari, date e checklist; interfaccia filtri verificata nel browser. |
| 16 | KPI dai dati | Test di aggregazione e percentuali, inclusi denominatori vuoti e task condivise; calcoli comuni a UI ed Excel. |
| 17 | Excel valido | Workbook generato e riaperto automaticamente; file scaricato dal browser e riaperto con ExcelJS. |
| 18 | Quattro fogli Excel | Attività, KPI, Checklist, Scadenze: nomi, righe, date native, percentuali, filtri e prima riga congelata verificati. |
| 19 | Activity log | Creazione, modifica, stato, priorità, responsabili, scadenza e completamento verificati nei test SQL; storico visibile nel dettaglio. |
| 20 | Persistenza | Refresh della demo verificato nel browser; persistenza e atomicità SQL verificate in PGlite. Sincronizzazione Supabase tra browser da collaudare. |
| 21 | Date | Test su fuso Europe/Rome, passaggio ora legale, fine anno e scadenze senza orario. |
| 22 | Desktop/tablet | Verifica visiva desktop 1440×1000 e tablet 768×1024; menu, report e pannelli utilizzabili, senza overflow orizzontale della pagina. Controlli sidebar verificati anche con altezza 720 px. |
| 23 | Nessuna chiave segreta | Nessuna credenziale reale nel codice o nella consegna. Test della build: chiavi secret, JWT service role e variabili VITE non previste vengono rifiutati prima del bundling. |
| 24 | Console | Nessun errore o warning applicativo rilevato nei normali flussi controllati nel browser. |
| 25 | Utilizzo dal README | Il PC aziendale usa soltanto l’URL HTTPS in Edge. Installazione, test e build vengono eseguiti da GitHub Actions. Il workflow Pages e il percorso `/to-do-list/` sono verificati localmente; la prima pubblicazione e Supabase remoto richiedono il collaudo online descritto sotto. |

## Prove aggiuntive

- Aggiunta di un quinto membro con avatar PNG, salvataggio dell’immagine, selezione e disattivazione; nessun limite fisso a quattro persone.
- RLS: nessun accesso anonimo o per un account Auth non autorizzato; scritture dirette e falsificazione del log negate.
- Salvataggi atomici: un errore annulla task, assegnazioni, checklist e log. Versioni obsolete e riutilizzo di elementi checklist di un’altra task vengono rifiutati.
- Disattivazione dell’ultimo membro attivo impedita; archiviazione di anagrafiche senza cancellazioni a cascata.
- Test Excel con testo simile a una formula: conservato come testo, non eseguito come formula.
- Il controllo dipendenze del 14 settembre 2026 ha riportato zero vulnerabilità note dopo l’override UUID di ExcelJS. È una verifica puntuale, da ripetere nel tempo.
- La build con base `/to-do-list/` è stata servita dal percorso previsto per GitHub Pages: apertura demo, selezione membro e dashboard verificate nel browser senza errori di console.

Il test suite riporta **18 test superati, 0 falliti**. I test del database usano PostgreSQL in WebAssembly, con ruoli Auth simulati; non avviano l’infrastruttura Supabase completa.

La build genera un avviso dimensione per ExcelJS: il modulo export è circa 936 kB minificato, 259 kB gzip, e viene caricato solo alla richiesta di export. L’avviso non impedisce la build.

## Collaudo di messa in servizio Supabase

1. In un progetto dedicato, eseguire gli SQL nell’ordine del README, creare l’account Auth condiviso e autorizzarlo con `authorize_shared_account.sql`. Disabilitare le registrazioni pubbliche.
2. Configurare URL e chiave pubblica, con demo disabilitata. Avviare l’app e verificare il rifiuto di una password errata e il login con quella corretta.
3. Aprire due browser distinti con lo stesso account, selezionando due membri diversi. Creare una task nel primo e verificare che compaia nel secondo entro 30 secondi o tornando sulla finestra, senza un form aperto.
4. Aprire la stessa task nei due browser. Salvare prima nel primo: il secondo deve ricevere un conflitto se prova a salvare una versione precedente, senza sovrascrivere il lavoro del collega.
5. Verificare checklist, tre responsabili, avatar, archiviazione e log; ricaricare entrambi i browser e confrontare i dati. Verificare che logout e sessione scaduta riportino al login.
6. Ripetere il controllo di accesso tramite Data API: anonimo e account non autorizzato non devono leggere il workspace; l’account condiviso deve scrivere solo tramite RPC.
7. Esportare Excel e confrontare un campione di task, KPI, responsabili e date con l’app. Configurare il backup e provare un ripristino separato seguendo il README.
8. Pubblicare la build con demo disabilitata sul dominio HTTPS previsto e ripetere login, refresh, salvataggio concorrente ed export sul dominio definitivo.

Solo dopo queste prove considerare completata la messa in servizio condivisa.
