# Studio Social

App web locale per una persona. Genera post di testo in italiano da un brief, salva bozze modificabili e pubblica su un profilo LinkedIn, una Pagina Facebook o un account Instagram professionale. Per TikTok prepara ed esporta i post. Il piano ricorrente usa il fuso `Europe/Rome`. Le date dei singoli post usano il fuso mostrato dal dispositivo.

## Modalità semplice e avanzata

All’apertura Studio Social è in **modalità semplice**, pensata per chi ha solo il login personale dei social: nessun account da collegare, nessuna chiave, nessuna programmazione. Scegli dove pubblichi, scrivi il testo e controlla l’anteprima con il conteggio dei caratteri per quel social. **Copia e apri** copia il testo e apre il social nella tua sessione già autenticata: su LinkedIn il post arriva già scritto, su Facebook, Instagram e TikTok incolli con Ctrl+V. Aggiungi foto o video direttamente sul social e premi Pubblica: la pubblicazione resta un tuo gesto. La bozza e la scelta del social restano salvate in questo browser.

Il pulsante in alto a destra passa alla **modalità avanzata**, per profili e Pagine business con API: piano ricorrente, programmazione, pubblicazione automatica e collegamento degli account. La scelta resta salvata nel browser.

## Avvio in modalità prova (avanzata)

Con [Node.js](https://nodejs.org/) 24 o successivo, apri il terminale nella cartella estratta ed esegui:

```sh
npm start
```

Al primo accesso da ogni browser apri l’indirizzo con la chiave stampato nel terminale (`http://localhost:3000/?key=…`): imposta un cookie di sessione e poi basta <http://localhost:3000>. La chiave sta in `.data/access.key`; per cambiarla elimina il file e riavvia. La modalità prova funziona senza dipendenze esterne, chiavi o account e usa un database distinto. Il testo è di esempio e gli invii sono simulati. Per provare il flusso, inserisci un tema, scegli **Genera una bozza**, apri **Modifica** e scegli **Programma** o **Pubblica ora**.

## Configurazione in Studio Social

Apri **Account** nella dashboard. Ogni scheda social include la guida, i link ai portali ufficiali e, quando disponibili, i campi per salvare le credenziali. Il pulsante **Applica modalità** passa dalla prova alla modalità reale e torna indietro. Le due modalità conservano bozze, allegati e calendari distinti. Quando attivi la modalità reale, riprende l’eventuale calendario già impostato per quella modalità.

- **LinkedIn.** Registra il callback mostrato nella guida del profilo, salva Client ID e Client Secret e attiva l’HTTPS locale. Puoi generare un certificato direttamente dall’app se OpenSSL è disponibile o incollare un certificato e una chiave PEM già ottenuti. Il browser o il sistema deve accettare il certificato di `localhost` per completare il ritorno OAuth. L’HTTPS gestito dall’app usa di norma la porta successiva a quella principale. La guida mostra sempre l’indirizzo effettivo.
- **Facebook.** Usa l’ID e il token di una Pagina che puoi gestire. La guida indica dove ottenere il token e i permessi da richiedere. La verifica del collegamento identifica la Pagina. Meta verifica i permessi di scrittura quando invii il primo post.
- **Instagram.** Collega l’account professionale a una Pagina Facebook. Puoi riutilizzare la stessa Pagina e lo stesso token quando hanno i permessi Instagram oppure fornire credenziali dedicate. I Reel si caricano direttamente. Per le foto JPG, Meta deve raggiungere un URL pubblico. Indica nella guida la cartella locale già servita da un hosting HTTPS e il relativo URL. Configura l’hosting senza indice pubblico e con cache disattivata. L’app rimuove la copia temporanea quando termina il tentativo. Dopo un arresto improvviso, controlla la cartella pubblica.
- **TikTok.** La guida spiega come esportare il media e copiare la didascalia per pubblicare nell’app TikTok. Le [regole Direct Post](https://developers.tiktok.com/docs/en/content-sharing-guidelines) escludono gli strumenti riservati agli account propri o del proprio team.

### Provider per generare i post

Apri **Account → Configura i provider AI**, scegli il servizio e salva la chiave API. Per la generazione live, passa alla modalità reale e scegli il provider in **Piano editoriale → Provider AI**. **Genera una bozza** usa la scelta corrente. **Salva piano** la memorizza per le generazioni ricorrenti. Puoi scrivere e programmare manualmente anche senza configurare un provider AI.

| Servizio | Impostazioni |
| --- | --- |
| [OpenAI](https://developers.openai.com/api/reference/resources/responses/methods/create) | Chiave OpenAI ed eventuale modello. |
| [Claude](https://platform.claude.com/docs/en/api/messages/create) | Chiave Anthropic ed eventuale modello. |
| [QwenCloud](https://docs.qwencloud.com/api-reference/chat/openai-chat) | Chiave della regione corrispondente all’endpoint. L’endpoint predefinito è Singapore. |
| [Gemini](https://ai.google.dev/gemini-api/docs/openai) e [Antigravity](https://ai.google.dev/gemini-api/docs/antigravity-agent) | Chiave Gemini API. Antigravity usa l’agente gestito in anteprima. |
| API compatibile | Chiave, modello e URL HTTPS che supporti Chat Completions e autenticazione Bearer. |

Il servizio AI selezionato riceve il brief e brevi estratti dei post recenti. La generazione può comportare costi API. Le chiavi e i token restano nei dati locali dell’app e il browser non li mostra dopo il salvataggio.

## Foto e video

Per caricare nuovi media installa [FFmpeg](https://ffmpeg.org/download.html) e verifica `ffprobe -version`. Puoi aggiungere un allegato per post, vederne l’anteprima e rimuoverlo o sostituirlo nell’editor. Usa **Anteprima** nella scheda di un post o nell’editor per rivedere il testo, anche prima di salvare. La finestra permette di mostrare o nascondere l’allegato e riprodurre i video supportati dal browser. Puoi scaricare il file anche se il browser non lo riproduce. Il piano ricorrente riutilizza l’allegato selezionato. Per pubblicare automaticamente su Instagram il piano deve averne uno.

| Canale | Foto in Studio Social | Video in Studio Social |
| --- | --- | --- |
| LinkedIn | JPG/PNG fino a 8 MB con meno di 36.152.320 pixel | MP4 H.264 tra 75 KB e 100 MB, da 3 s a 30 min. Verifica che la tua app abbia accesso alle API Videos e Posts. |
| Facebook | JPG/PNG fino a 10 MB. Meta consiglia PNG fino a 1 MB per la qualità. | MP4/MOV H.264 o H.265 fino a 100 MB. |
| Instagram | JPG fino a 8 MB, da 4:5 a 1,91:1. Meta ridimensiona la larghezza all’intervallo 320–1440 px. | Reel MP4/MOV H.264 o H.265 fino a 100 MB, 3 s–15 min, 23–60 fps, larghezza fino a 1920 px. Consigliato 9:16. |
| TikTok | JPG/WebP fino a 20 MB con lato corto fino a 1080 px per l’esportazione. | MP4/MOV H.264 o H.265 o WebM VP8/VP9 fino a 100 MB e 10 min, 23–60 fps e lati 360–4096 px. Nell’app TikTok la durata disponibile dipende dall’account. |

Per i Reel esporta con Fast Start (atom `moov` prima di `mdat`) e disattiva le edit list. Usa video progressivo 4:2:0 con GOP chiuso e bitrate variabile fino a 25 Mbps. Se presente, usa audio AAC a 128 kbps, fino a 48 kHz, mono o stereo. L’app controlla la struttura del contenitore e i metadati disponibili. GOP e bitrate di picco sono soggetti alla verifica di Meta.

I limiti della tabella si riferiscono all’app. La [Videos API LinkedIn](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/videos-api?view=li-lms-2026-10) indica fino a 500 MB, la [scheda IG User Media v27.0](https://developers.facebook.com/documentation/instagram-platform/instagram-graph-api/reference/ig-user/media) indica fino a 300 MB per i Reel e il [TikTok Media Transfer Guide](https://developers.tiktok.com/docs/en/content-posting-api-media-transfer-guide) documenta fino a 4 GB per video. La [Page Photos API](https://developers.facebook.com/docs/graph-api/reference/page/photos/) accetta anche BMP, GIF e TIFF.

## Aggiornare una copia esistente

Ferma l’app. Estrai questo ZIP in una nuova cartella e trasferisci la cartella `.data/` dalla vecchia copia per mantenere bozze, allegati e calendario. Se usavi già un `.env`, puoi copiarlo per mantenere le impostazioni precedenti. Le modifiche salvate dalla dashboard hanno la precedenza. Avvia l’app con `npm start`.

## Uso del calendario

- Compila temi, pubblico, tono e materiale di riferimento. Con **Genera una bozza** puoi provare il brief prima di attivare il piano.
- Il piano prevede al massimo un post ricorrente per data. Se il servizio parte dopo l'orario configurato, recupera l'eventuale ricorrenza del giorno corrente. I giorni precedenti vengono saltati.
- La modalità **Crea e pubblica automaticamente** genera e mette in coda il post all'orario previsto. **Crea bozze da rivedere** lascia il risultato nell'elenco dei post. La pausa ferma le nuove ricorrenze. I post già in coda si gestiscono singolarmente con **Modifica** → **Salva bozza**.
- Tieni `npm start` in esecuzione quando vuoi che il calendario lavori. Il browser può essere chiuso. I post programmati rimasti in coda partono alla riapertura del servizio. Se l'esito di un invio è incerto, verifica sul social e registra l'esito nell'app prima di riprogrammare: l'invio incerto non viene ripetuto in automatico.
- L'app ascolta solo sulla macchina locale ed è pensata per un unico processo e utente. La cartella `.data/` e l’eventuale `.env` precedente contengono credenziali o dati privati. Tienili fuori da Git, dagli archivi condivisi e dai backup pubblici. Per funzionamento 24/7 serve un ambiente sempre acceso.
