// Interface language: Italian or English. The page and the server messages are written in Italian;
// this file translates them in the browser. Text inside [data-no-i18n] (user content) is never touched,
// and [data-i18n-exact] elements only translate when the whole text matches (user text next to a placeholder).
(() => {
  const storageKey = 'studio-lang';
  const exact = {
    Lu: 'Mo', Ma: 'Tu', Me: 'We', Gi: 'Th', Ve: 'Fr', Sa: 'Sa', Do: 'Su',
    Piano: 'Plan', Post: 'Posts', Account: 'Account', Bozze: 'Drafts', Anteprima: 'Preview', Modifica: 'Edit', Chiudi: 'Close',
    Pubblico: 'Audience', Tono: 'Tone', Canale: 'Channel', Temi: 'Topics', Giorni: 'Days', Testo: 'Text', Svuota: 'Clear',
    Attivo: 'On', 'In pausa': 'Paused', Collega: 'Connect', Scollega: 'Disconnect', Configura: 'Set up', Lingua: 'Language',
    'Caricamento': 'Loading', 'Caricamento…': 'Loading…', Bozza: 'Draft', Pubblicato: 'Published', Pubblicati: 'Published',
    Programma: 'Schedule', 'Pubblica ora': 'Publish now', Richiesta: 'Request', Prova: 'Practice',
  };
  // Longest phrases first so that a full sentence wins over the words it contains.
  const phrases = [
    // Header and views
    ['Studio Social, torna all’inizio', 'Studio Social, back to the top'],
    ['Calendario editoriale', 'Editorial calendar'], ['Navigazione', 'Navigation'],
    ['Modalità ', 'Mode '], ['Vista ', 'View '], ['avanzata', 'advanced'], ['semplice', 'simple'],
    ['Passa alla modalità avanzata', 'Switch to advanced mode'], ['Passa alla modalità semplice', 'Switch to simple mode'],
    ['Torna su', 'Back to top'],
    // Simple view
    ['Scrivi, controlla', 'Write, check'], ['e pubblica', 'and publish'],
    ['Nessun account da collegare: scrivi il post, guarda l’anteprima e aprilo sul social già compilato, con il tuo login di sempre.', 'No account to connect: write the post, check the preview and open it on the social already filled in, with the login you always use.'],
    ['Il tuo post', 'Your post'], ['Dove lo pubblichi?', 'Where do you publish it?'], ['Testo del post', 'Post text'],
    ['Scrivi qui il tuo post', 'Write your post here'], ['Copia solo il testo', 'Copy the text only'],
    ['Così apparirà il testo', 'This is how the text will look'], ['Come si pubblica', 'How to publish'],
    ['L’anteprima compare qui mentre scrivi.', 'The preview appears here as you write.'],
    ['Il testo viene copiato negli appunti.', 'The text is copied to the clipboard.'],
    ['Si apre LinkedIn con il post già scritto. Se il testo non compare, incollalo con Ctrl+V.', 'LinkedIn opens with the post already written. If the text does not appear, paste it with Ctrl+V.'],
    ['Aggiungi foto o video, se vuoi, e premi Pubblica.', 'Add a photo or video if you like, then press Post.'],
    ['Si apre Facebook: clicca su «A cosa stai pensando?» e incolla con Ctrl+V.', 'Facebook opens: click “What’s on your mind?” and paste with Ctrl+V.'],
    ['Il testo viene copiato come didascalia.', 'The text is copied as the caption.'],
    ['Si apre Instagram: usa «Crea», scegli foto o video e incolla la didascalia. Da telefono, apri l’app e incolla lì.', 'Instagram opens: use “Create”, pick a photo or video and paste the caption. On a phone, open the app and paste there.'],
    ['Controlla l’anteprima e premi Condividi.', 'Check the preview and press Share.'],
    ['Si apre la pagina di caricamento di TikTok: scegli il video e incolla la didascalia.', 'The TikTok upload page opens: pick the video and paste the caption.'],
    ['Controlla l’anteprima e pubblica.', 'Check the preview and publish.'],
    ['Non riesco a copiare in automatico. Seleziona il testo nel riquadro e copialo con Ctrl+C.', 'Automatic copy did not work. Select the text in the box and copy it with Ctrl+C.'],
    ['Testo copiato. Incollalo dove vuoi con Ctrl+V.', 'Text copied. Paste it wherever you like with Ctrl+V.'],
    ['si apre con il post già scritto: se non lo vedi, incolla con Ctrl+V.', 'opens with the post already written: if you do not see it, paste with Ctrl+V.'],
    ['Se la scheda non si è aperta,', 'If the tab did not open,'],
    ['con Ctrl+V.', 'with Ctrl+V.'], ['Testo copiato. Incollalo su ', 'Text copied. Paste it on '],
    // Advanced: overview and plan
    ['Calendario', 'Editorial'], ['editoriale', 'calendar'],
    ['Scrivi, programma e pubblica su LinkedIn, Facebook e Instagram. Prepara i post per TikTok.', 'Write, schedule and publish on LinkedIn, Facebook and Instagram. Prepare posts for TikTok.'],
    ['Riepilogo', 'Summary'], ['In programma', 'Scheduled'], ['Pubblicati in prova', 'Published in practice'],
    ['Piano editoriale', 'Editorial plan'], ['LinkedIn · profilo personale', 'LinkedIn · personal profile'],
    ['Facebook · Pagina', 'Facebook · Page'], ['Instagram · professionale', 'Instagram · professional'], ['TikTok · esportazione', 'TikTok · export'],
    ['Provider AI', 'AI provider'], ['Es. innovazione e gestione dei progetti', 'E.g. innovation and project management'],
    ['Es. professionisti del settore', 'E.g. industry professionals'], ['Es. professionale', 'E.g. professional'],
    ['Materiale di riferimento', 'Reference material'], ['Note, esempi ed esperienze da cui partire', 'Notes, examples and experiences to start from'],
    ['Allegato del piano', 'Plan attachment'], ['Lunedì', 'Monday'], ['Martedì', 'Tuesday'], ['Mercoledì', 'Wednesday'], ['Giovedì', 'Thursday'],
    ['Venerdì', 'Friday'], ['Sabato', 'Saturday'], ['Domenica', 'Sunday'], ['Ora italiana', 'Italian time'], ['Pubblicazione', 'Publishing'],
    ['Crea bozze da rivedere', 'Create drafts to review'], ['Crea e pubblica automaticamente', 'Create and publish automatically'],
    ['Attiva il piano ricorrente', 'Turn on the recurring plan'], ['Salva piano', 'Save plan'], ['Genera una bozza', 'Generate a draft'],
    ['Scrivi un post', 'Write a post'], ['Il tuo primo post parte da qui', 'Your first post starts here'],
    ['Scegli un tema e genera una bozza, oppure scrivi il post direttamente.', 'Pick a topic and generate a draft, or write the post directly.'],
    ['Generazione di prova.', 'Practice generation.'], ['Configura il provider in Account → Configura i provider AI.', 'Set up the provider in Account → Set up AI providers.'],
    ['Modello ', 'Model '], [' · da configurare', ' · to be set up'],
    // Account
    ['Come vuoi usare Studio Social?', 'How do you want to use Studio Social?'], ['Prova: nulla viene pubblicato', 'Practice: nothing is published'],
    ['Pubblicazione: sui tuoi account', 'Publishing: on your accounts'], ['Salva scelta', 'Save choice'],
    ['Prova · non pubblica nulla', 'Practice · nothing is published'], ['Pubblicazione attiva', 'Publishing on'],
    ['In prova nessun post esce dall’app. Clicca per cambiare.', 'In practice no post leaves the app. Click to change.'],
    ['La pubblicazione è attiva: i post escono sui tuoi account. Clicca per cambiare.', 'Publishing is on: posts go out on your accounts. Click to change.'],
    [': puoi esercitarti, nulla arriva ai social. ', ': you can practice, nothing reaches your socials. '],
    [': i post escono sui tuoi account.', ': posts go out on your accounts.'],
    ['Profilo personale', 'Personal profile'], ['Pagina Facebook', 'Facebook Page'], ['Account professionale', 'Professional account'],
    ['Credenziali salvate · demo', 'Credentials saved · demo'], ['Configurazione da completare', 'Setup to complete'], ['Pronto da collegare', 'Ready to connect'],
    [' · Scade il ', ' · Expires on '],
    ['Configura LinkedIn', 'Set up LinkedIn'], ['Configura Facebook', 'Set up Facebook'], ['Configura Instagram', 'Set up Instagram'],
    ['Crea o apri l’app nel ', 'Create or open the app in the '], ['portale LinkedIn Developers', 'LinkedIn Developers portal'],
    ['. In ', '. Under '], [' abilita ', ' enable '], [' e ', ' and '],
    ['In ', 'In '], [', copia ', ', copy '], [' nei campi qui sotto. Aggiungi alla lista delle URL di reindirizzamento il callback mostrato qui.', ' into the fields below. Add the callback shown here to the redirect URL list.'],
    ['Copia URL', 'Copy URL'], ['HTTPS locale', 'Local HTTPS'],
    ['Attiva HTTPS per ricevere il ritorno da LinkedIn. Se generi un certificato locale, apri il collegamento HTTPS e autorizza il certificato di ', 'Turn on HTTPS to receive the return from LinkedIn. If you generate a local certificate, open the HTTPS link and trust the certificate for '],
    [' nel browser o nel sistema. In alternativa, usa un certificato attendibile per ', ' in the browser or the system. Alternatively, use a trusted certificate for '],
    ['Genera certificato locale', 'Generate local certificate'], ['Apri HTTPS locale', 'Open local HTTPS'], ['Scarica certificato pubblico', 'Download public certificate'],
    ['Usa un certificato esistente', 'Use an existing certificate'], ['Certificato PEM', 'PEM certificate'], ['Chiave privata PEM', 'PEM private key'], ['Salva certificato', 'Save certificate'],
    ['Scegli «Pubblicazione» qui sopra e premi ', 'Choose “Publishing” above and press '], ['. Controlla che compaia il tuo profilo. Per il video, verifica anche l’accesso alle API LinkedIn ', '. Check that your profile appears. For video, also check access to the LinkedIn APIs '],
    ['. Se il token scade, collega di nuovo il profilo.', '. If the token expires, connect the profile again.'],
    ['Guida ufficiale OAuth di LinkedIn', 'Official LinkedIn OAuth guide'],
    ['Apri la tua app in ', 'Open your app in '], ['. Per la Pagina che vuoi usare, il tuo account deve poter creare contenuti (', '. For the Page you want to use, your account must be able to create content ('],
    ['Nel ', 'In the '], [', seleziona la tua app e richiedi ', ', select your app and request '],
    ['Con il token utente, esegui ', 'With the user token, run '], ['. Dalla riga della Pagina copia ', '. From the Page row, copy '],
    ['. Verifica il nome della Pagina. Se la Pagina manca da ', '. Check the Page name. If the Page is missing from '], [', controlla il ruolo sulla Pagina e che l’app Meta abbia accesso ai permessi richiesti.', ', check your role on the Page and that the Meta app has access to the required permissions.'],
    ['Guida ufficiale al feed della Pagina', 'Official Page feed guide'],
    ['Collega il profilo Instagram ', 'Link the Instagram '], ['Business o Creator', 'Business or Creator profile'], [' a una Pagina Facebook. Nell’app Meta usa ', ' to a Facebook Page. In the Meta app use '],
    ['Ottieni un token della Pagina con ', 'Get a Page token with '], ['. Se usi il token del collegamento Facebook, abilita questi permessi in Meta e rigenera il token.', '. If you use the token from the Facebook connection, enable these permissions in Meta and regenerate the token.'],
    ['Inserisci l’ID e il token della ', 'Enter the ID and token of the '], ['Pagina Facebook collegata', 'linked Facebook Page'], ['. Puoi lasciare entrambi i campi vuoti per usare le credenziali salvate in Facebook.', '. You can leave both fields empty to use the credentials saved in Facebook.'],
    ['Reel:', 'Reels:'], [' carica un file locale. ', ' upload a local file. '], ['Foto JPG:', 'JPG photos:'], [' indica una cartella locale già servita dal tuo hosting e il corrispondente URL HTTPS pubblico. Meta usa quell’URL per scaricare la foto.', ' give a local folder already served by your hosting and its public HTTPS URL. Meta uses that URL to download the photo.'],
    ['. Verifica il nome utente Instagram. Se il profilo non appare, controlla il collegamento alla Pagina e i permessi del token.', '. Check the Instagram username. If the profile does not appear, check the Page link and the token permissions.'],
    ['Guida ufficiale alla pubblicazione Instagram', 'Official Instagram publishing guide'],
    ['Esportazione per la pubblicazione manuale', 'Export for manual publishing'], ['Come pubblicare su TikTok', 'How to publish on TikTok'],
    ['Le regole di TikTok riservano Direct Post alle app destinate a un pubblico ampio. In Studio Social questo canale funziona tramite esportazione, senza credenziali API.', 'TikTok’s rules reserve Direct Post for apps aimed at a wide audience. In Studio Social this channel works through export, without API credentials.'],
    ['Scegli ', 'Choose '], [' nel piano editoriale e crea una bozza.', ' in the editorial plan and create a draft.'],
    ['Allega un file compatibile. Nella scheda del post usa ', 'Attach a compatible file. On the post card use '], ['Scarica il media', 'Download media'], ['Copia didascalia', 'Copy caption'],
    ['Apri TikTok, carica il contenuto e incolla la didascalia. Controlla l’anteprima e pubblica.', 'Open TikTok, upload the content and paste the caption. Check the preview and publish.'],
    ['Regole ufficiali per Direct Post', 'Official Direct Post rules'],
    ['Configura i provider AI', 'Set up AI providers'], ['Salva la chiave API del provider scelto e selezionalo nel piano editoriale. La chiave resta nella copia locale di Studio Social.', 'Save the API key of the chosen provider and select it in the editorial plan. The key stays in the local copy of Studio Social.'],
    ['Il collegamento predefinito usa Singapore. Usa una chiave della stessa regione.', 'The default endpoint uses Singapore. Use a key from the same region.'],
    ['Google Gemini e Antigravity', 'Google Gemini and Antigravity'], ['API compatibile con Chat Completions', 'Chat Completions-compatible API'], ['API compatibile OpenAI', 'OpenAI-compatible API'],
    ['Google Antigravity · anteprima', 'Google Antigravity · preview'],
    // Dialogs
    ['Modifica post', 'Edit post'], ['Pagina Facebook', 'Facebook Page'], ['Allegato del post', 'Post attachment'], ['Data e ora (fuso del dispositivo)', 'Date and time (device time zone)'],
    ['Salva bozza', 'Save draft'], ['Anteprima post', 'Post preview'], ['Mostra allegato', 'Show attachment'],
    // Post cards and statuses
    ['Da riprogrammare', 'To reschedule'], ['Da verificare', 'To verify'], ['In generazione', 'Generating'], ['In invio', 'Sending'], ['Pubblicato in prova', 'Published in practice'],
    ['L’ho trovato sul social', 'I found it on the social'], ['Assente sul social', 'Not on the social'],
    ['Didascalia copiata.', 'Caption copied.'], ['Seleziona il testo e copialo manualmente.', 'Select the text and copy it manually.'],
    ['Modifiche non salvate', 'Unsaved changes'], ['Aggiungi testo o un allegato per vedere l’anteprima.', 'Add text or an attachment to see the preview.'],
    // Media and notices
    ['Il browser non riesce ad aprire l’allegato. Puoi scaricarlo e aprirlo sul tuo dispositivo.', 'The browser cannot open the attachment. You can download it and open it on your device.'],
    ['Scarica il media', 'Download media'], ['Rimuovi allegato', 'Remove attachment'],
    [' Per pubblicare un JPG completa la configurazione HTTPS nella guida Instagram.', ' To publish a JPG, complete the HTTPS setup in the Instagram guide.'],
    [' Il piano riutilizza lo stesso file.', ' The plan reuses the same file.'],
    ['L’allegato precedente non è compatibile con il canale selezionato.', 'The previous attachment is not compatible with the selected channel.'],
    ['Attendi che termini l’operazione in corso e seleziona di nuovo il file.', 'Wait for the current operation to finish and select the file again.'],
    ['Il file supera 100 MB.', 'The file exceeds 100 MB.'], ['Caricamento non riuscito.', 'Upload failed.'], ['Allegato pronto.', 'Attachment ready.'],
    ['Operazione in corso…', 'Working…'], ['Operazione non riuscita.', 'Operation failed.'],
    ['Aggiungi testo o un allegato.', 'Add text or an attachment.'], ['Scegli data e ora per il post.', 'Pick a date and time for the post.'],
    ['Bozza salvata.', 'Draft saved.'], ['Post programmato.', 'Post scheduled.'], ['Post messo in coda.', 'Post queued.'],
    ['Post registrato come pubblicato.', 'Post recorded as published.'], ['Post riportato tra le bozze.', 'Post moved back to drafts.'],
    ['Piano salvato.', 'Plan saved.'], ['Bozza generata.', 'Draft generated.'], ['Account scollegato.', 'Account disconnected.'], [' collegato.', ' connected.'],
    ['Elenca modelli', 'List models'], ['Modelli disponibili · ', 'Available models · '], ['Scegli un modello', 'Pick a model'],
    ['Già salvata. Lascia vuoto per mantenerla.', 'Already saved. Leave empty to keep it.'], ['Rimuovi il valore salvato', 'Remove the saved value'],
    ['Salva configurazione', 'Save configuration'], ['Configurazione salvata.', 'Configuration saved.'],
    ['HTTPS attivo. Aprilo prima di collegare LinkedIn.', 'HTTPS is on. Open it before connecting LinkedIn.'], ['HTTPS locale da attivare.', 'Local HTTPS to be turned on.'],
    ['Questa modalità è già attiva.', 'This mode is already active.'],
    ['Prova attiva: nulla viene pubblicato.', 'Practice on: nothing is published.'], ['Pubblicazione attiva: i post escono sui tuoi account.', 'Publishing on: posts go out on your accounts.'],
    ['URL di callback copiato.', 'Callback URL copied.'], ['Seleziona e copia l’URL nel riquadro.', 'Select and copy the URL in the box.'],
    ['Profilo LinkedIn collegato.', 'LinkedIn profile connected.'], ['Collegamento annullato.', 'Connection cancelled.'],
    ['Collegamento non riuscito. Verifica credenziali, permessi e URL di callback.', 'Connection failed. Check credentials, permissions and the callback URL.'],
    ['Sessione di collegamento scaduta. Riparti dal pulsante Collega.', 'The connection session expired. Start again from the Connect button.'],
    // Server messages
    ['Porta locale non valida.', 'Invalid local port.'], ['Imposta entrambi i file TLS.', 'Set both TLS files.'],
    ['Invio interrotto. Controlla il social prima di riprovare.', 'Sending was interrupted. Check the social before trying again.'],
    ['Generazione interrotta. Puoi completare la bozza.', 'Generation was interrupted. You can complete the draft.'],
    ['Seleziona un canale valido.', 'Select a valid channel.'], ['Allegato non trovato. Carica di nuovo il file.', 'Attachment not found. Upload the file again.'],
    ['Per pubblicare foto su Instagram imposta la cartella e l’URL pubblico nella guida Instagram in Account.', 'To publish photos on Instagram, set the folder and the public URL in the Instagram guide under Account.'],
    ['Scegli giorni validi.', 'Choose valid days.'], ['Controlla orario e modalità del piano.', 'Check the plan’s time and mode.'], ['Scegli almeno un giorno.', 'Choose at least one day.'],
    ['Per TikTok scegli la modalità bozze ed esporta i post.', 'For TikTok choose drafts mode and export the posts.'],
    ['Collega un account per attivare la pubblicazione automatica.', 'Connect an account to turn on automatic publishing.'],
    ['Collega lo stesso account e riprogramma il post.', 'Connect the same account and reschedule the post.'],
    ['La risposta del social non è stata verificata.', 'The social’s response could not be verified.'],
    ['Formato richiesta non valido.', 'Invalid request format.'], ['Richiesta troppo lunga.', 'Request too long.'], ['Richiesta non valida.', 'Invalid request.'],
    ['Post non trovato.', 'Post not found.'], ['Questo post non è modificabile in questo stato.', 'This post cannot be edited in this state.'], ['Azione non valida.', 'Invalid action.'],
    ['Collega l’account prima di programmare la pubblicazione.', 'Connect the account before scheduling publication.'], ['Scegli una data futura.', 'Choose a future date.'],
    ['Media non trovato.', 'Media not found.'], ['Pagina non trovata.', 'Page not found.'], ['Origine della richiesta non valida.', 'Invalid request origin.'],
    ['La modalità è cambiata. Aggiorna la pagina e riprova.', 'The mode has changed. Refresh the page and try again.'],
    ['Per collegare LinkedIn scegli «Pubblicazione» in Account e completa credenziali e HTTPS nella guida.', 'To connect LinkedIn, choose “Publishing” in Account and complete the credentials and HTTPS in the guide.'],
    ['Inserisci ID e token nella guida Facebook in Account.', 'Enter the ID and token in the Facebook guide under Account.'],
    ['Inserisci il token della Pagina nella guida Instagram in Account.', 'Enter the Page token in the Instagram guide under Account.'],
    ['Operazione non riuscita. Controlla la configurazione locale.', 'Operation failed. Check the local configuration.'],
    ['Attendi che termini l’operazione in corso e riprova.', 'Wait for the current operation to finish and try again.'], ['Attendi che termini l’altra operazione e riprova.', 'Wait for the other operation to finish and try again.'],
    ['Seleziona una modalità valida.', 'Select a valid mode.'],
    ['Per le foto compila sia la cartella sia l’URL HTTPS. Lascia vuoti entrambi per pubblicare solo Reel.', 'For photos fill in both the folder and the HTTPS URL. Leave both empty to publish Reels only.'],
    ['Scegli una cartella esistente in cui Studio Social possa scrivere.', 'Choose an existing folder that Studio Social can write to.'],
    ['HTTPS è già attivo sul server principale.', 'HTTPS is already on for the main server.'], ['Azione HTTPS non valida.', 'Invalid HTTPS action.'],
    ['Configurazione non riconosciuta.', 'Unrecognized configuration.'], ['Campo di configurazione non valido.', 'Invalid configuration field.'],
    ['Inserisci un certificato PEM valido per localhost e la chiave privata corrispondente.', 'Enter a valid PEM certificate for localhost and the matching private key.'],
    ['Generazione del certificato non riuscita. Verifica che OpenSSL sia disponibile oppure incolla certificato e chiave PEM nell’interfaccia.', 'Certificate generation failed. Check that OpenSSL is available or paste the PEM certificate and key in the interface.'],
    ['Usa un URL base HTTPS senza credenziali, query o frammento.', 'Use an HTTPS base URL without credentials, query or fragment.'],
    ['LLM_PROVIDER non valido nel file .env.', 'Invalid LLM_PROVIDER in the .env file.'], ['Seleziona un provider AI valido.', 'Select a valid AI provider.'],
    [' Controlla che l’URL base sia HTTPS e privo di credenziali, query e frammenti.', ' Check that the base URL is HTTPS and has no credentials, query or fragment.'],
    ['Controlla che l’URL base sia HTTPS e privo di credenziali, query e frammenti.', 'Check that the base URL is HTTPS and has no credentials, query or fragment.'],
    ['Controlla il modello e i parametri.', 'Check the model and parameters.'], ['Controlla la chiave API e la regione associata.', 'Check the API key and its region.'],
    ['Controlla i permessi della chiave e l’accesso al modello.', 'Check the key’s permissions and access to the model.'], ['Controlla endpoint e identificativo del modello.', 'Check the endpoint and model identifier.'],
    ['Controlla quota e limiti del provider.', 'Check the provider’s quota and limits.'], ['Seleziona un servizio valido.', 'Select a valid service.'],
    [' non ha risposto entro il tempo di attesa impostato. Aumenta il tempo di attesa', ' did not respond within the configured wait time. Increase the wait time'],
    ['Tempo di attesa dei modelli', 'Model wait time'], ['Attesa massima della risposta (minuti)', 'Maximum wait for the answer (minutes)'],
    ['Per i modelli lenti: quanti minuti attendere la risposta prima di rinunciare (da 0,1 a 60). Vuoto: 1 minuto per i testi, 15 secondi per l’elenco dei modelli.', 'For slow models: how many minutes to wait for the answer before giving up (0.1 to 60). Empty: 1 minute for texts, 15 seconds for the model list.'],
    [' non ha risposto. Verifica connessione ed endpoint.', ' did not respond. Check the connection and endpoint.'], [' non ha elencato modelli utilizzabili.', ' did not list any usable models.'],
    ['Configura ', 'Set up '], [' per ', ' for '], [' in Account → Configura i provider AI.', ' in Account → Set up AI providers.'],
    [' non ha restituito un post completo entro il limite di ', ' did not return a complete post within the limit of '], [' caratteri.', ' characters.'],
    ['Facoltativo · JPG/PNG fino a 8 MB oppure MP4 fino a 100 MB', 'Optional · JPG/PNG up to 8 MB or MP4 up to 100 MB'],
    ['Facoltativo · JPG/PNG fino a 10 MB oppure MP4/MOV fino a 100 MB', 'Optional · JPG/PNG up to 10 MB or MP4/MOV up to 100 MB'],
    ['Richiesto per pubblicare · JPG fino a 8 MB oppure Reel MP4/MOV fino a 100 MB', 'Required to publish · JPG up to 8 MB or MP4/MOV Reel up to 100 MB'],
    ['Per esportare · JPG/WebP fino a 20 MB oppure MP4/MOV/WebM fino a 100 MB', 'For export · JPG/WebP up to 20 MB or MP4/MOV/WebM up to 100 MB'],
    ['Per esportare su TikTok usa JPG/WebP fino a 20 MB con lato corto fino a 1080 px.', 'To export to TikTok use JPG/WebP up to 20 MB with the short side up to 1080 px.'],
    ['Per Instagram usa JPG fino a 8 MB con rapporto da 4:5 a 1,91:1.', 'For Instagram use JPG up to 8 MB with an aspect ratio from 4:5 to 1.91:1.'],
    ['Per LinkedIn usa un’immagine con meno di 36.152.320 pixel.', 'For LinkedIn use an image with fewer than 36,152,320 pixels.'],
    ['Per LinkedIn usa MP4 H.264, almeno 75 KB, da 3 secondi a 30 minuti.', 'For LinkedIn use H.264 MP4, at least 75 KB, from 3 seconds to 30 minutes.'],
    ['Per Facebook usa MP4 o MOV in H.264 o H.265.', 'For Facebook use MP4 or MOV in H.264 or H.265.'],
    ['Per i Reel usa MP4/MOV H.264 o H.265, da 3 s a 15 min, 23–60 fps, larghezza fino a 1920 px e rapporto da 0,01:1 a 10:1. Esporta il video già orientato.', 'For Reels use H.264 or H.265 MP4/MOV, 3 s to 15 min, 23–60 fps, width up to 1920 px and aspect ratio from 0.01:1 to 10:1. Export the video already oriented.'],
    ['Per l’audio dei Reel usa AAC fino a 48 kHz, mono o stereo. Meta indica 128 kbps.', 'For Reel audio use AAC up to 48 kHz, mono or stereo. Meta recommends 128 kbps.'],
    ['Per i Reel esporta con Fast Start (moov prima di mdat) e senza edit list.', 'For Reels export with Fast Start (moov before mdat) and without edit lists.'],
    ['Per i Reel usa video progressivo 4:2:0, GOP chiuso e bitrate video fino a 25 Mbps.', 'For Reels use progressive 4:2:0 video, closed GOP and video bitrate up to 25 Mbps.'],
    ['Per TikTok usa MP4/MOV H.264 o H.265, oppure WebM VP8/VP9, fino a 10 min, 23–60 fps e lati tra 360 e 4096 px.', 'For TikTok use H.264 or H.265 MP4/MOV, or VP8/VP9 WebM, up to 10 min, 23–60 fps and sides between 360 and 4096 px.'],
    ['Il contenitore video ha troppi elementi.', 'The video container has too many elements.'], ['Struttura del contenitore video non valida.', 'Invalid video container structure.'],
    ['Per caricare media installa FFmpeg e rendi ffprobe disponibile nel PATH.', 'To upload media, install FFmpeg and make ffprobe available on the PATH.'],
    ['File illeggibile o formato non supportato. Usa JPG, PNG, WebP, MP4, MOV o WebM.', 'Unreadable file or unsupported format. Use JPG, PNG, WebP, MP4, MOV or WebM.'],
    ['Il file non contiene un video valido.', 'The file does not contain a valid video.'], ['Il file non contiene una foto o un video valido.', 'The file does not contain a valid photo or video.'],
    ['Formato del file non compatibile.', 'Incompatible file format.'], ['Durata o frequenza dei fotogrammi non valida.', 'Invalid duration or frame rate.'],
    ['LinkedIn non ha restituito un token valido.', 'LinkedIn did not return a valid token.'], ['L’ID configurato e quello del token Pagina non coincidono.', 'The configured ID does not match the one in the Page token.'],
    ['Il provider ha restituito un indirizzo di caricamento inatteso.', 'The provider returned an unexpected upload address.'],
    ['LinkedIn non ha preparato il caricamento della foto.', 'LinkedIn did not prepare the photo upload.'], ['LinkedIn non ha preparato il caricamento del video.', 'LinkedIn did not prepare the video upload.'],
    ['LinkedIn non ha confermato una parte del video.', 'LinkedIn did not confirm a part of the video.'], ['Facebook non ha confermato l’identificativo del post.', 'Facebook did not confirm the post identifier.'],
    ['Facebook ha ricevuto il video ma la pubblicazione è da verificare.', 'Facebook received the video but publication needs to be checked.'],
    ['Collega un account Instagram professionale alla Pagina Meta configurata.', 'Link a professional Instagram account to the configured Meta Page.'],
    ['Per le foto Instagram imposta la cartella e l’URL pubblico nella guida Instagram in Account.', 'For Instagram photos, set the folder and the public URL in the Instagram guide under Account.'],
    ['Impossibile scrivere la copia della foto nella cartella HTTPS di Instagram. Controlla la configurazione.', 'Cannot write the photo copy into the Instagram HTTPS folder. Check the configuration.'],
    ['Instagram non ha creato il contenitore del post.', 'Instagram did not create the post container.'], ['Instagram non ha confermato il caricamento del Reel.', 'Instagram did not confirm the Reel upload.'],
    ['Instagram non ha confermato l’identificativo del post.', 'Instagram did not confirm the post identifier.'],
    // Configuration form fields
    ['Versione API video', 'Video API version'], ['ID Pagina Facebook', 'Facebook Page ID'], ['Token della Pagina collegata', 'Linked Page token'], ['Token della Pagina', 'Page token'],
    ['Versione Graph API di Meta', 'Meta Graph API version'], ['ID della Pagina collegata', 'Linked Page ID'], ['Cartella già servita via HTTPS', 'Folder already served over HTTPS'],
    ['URL pubblico della cartella', 'Public folder URL'], ['Chiave API OpenAI', 'OpenAI API key'], ['Modello OpenAI', 'OpenAI model'], ['Chiave API Anthropic', 'Anthropic API key'],
    ['Modello Claude', 'Claude model'], ['Chiave API QwenCloud', 'QwenCloud API key'], ['Modello QwenCloud', 'QwenCloud model'], ['URL base QwenCloud', 'QwenCloud base URL'],
    ['Chiave Gemini API', 'Gemini API key'], ['Modello Gemini', 'Gemini model'], ['ID dell’agente Antigravity', 'Antigravity agent ID'], ['Modello Antigravity', 'Antigravity model'],
    ['Chiave API del servizio', 'Service API key'], ['URL base Chat Completions', 'Chat Completions base URL'], ['Identificativo del modello', 'Model identifier'],
    ['Professionale e concreto', 'Professional and practical'],
    // AI writing, field improvement and web search
    ['Chiedi all’AI', 'Ask the AI'], ['Scrivi con l’AI', 'Write with AI'], ['Abilita web', 'Enable web'],
    ['Es. un post per annunciare il nuovo corso di fotografia, tono amichevole', 'E.g. a post announcing the new photography course, friendly tone'],
    ['L’AI scrive il post nei limiti del social scelto. Con «Abilita web» legge i link che inserisci nella richiesta.', 'The AI writes the post within the limit of the chosen social. With “Enable web” it reads the links you put in the request.'],
    ['Migliora i campi con l’AI', 'Improve the fields with AI'], ['Abilita web: l’AI legge i link inseriti e cerca fonti', 'Enable web: the AI reads the links you entered and looks for sources'],
    ['Inserisci i link nel materiale di riferimento. La risposta può richiedere più tempo.', 'Put the links in the reference material. The answer may take longer.'],
    ['Il provider scelto non supporta la ricerca web.', 'The chosen provider does not support web search.'], ['Il provider AI scelto non supporta la ricerca web.', 'The chosen AI provider does not support web search.'],
    [' non supporta la ricerca web.', ' does not support web search.'],
    ['Questo servizio AI non supporta la ricerca web. Scegline un altro in «Configura l’AI».', 'This AI service does not support web search. Pick another in “Set up the AI”.'],
    ['Configura l’AI', 'Set up the AI'], ['Servizio AI', 'AI service'], ['Il modello è lento?', 'Is the model slow?'],
    ['Scegli il servizio AI e inserisci la tua chiave. La chiave resta nella copia locale di Studio Social.', 'Choose the AI service and enter your key. The key stays in your local copy of Studio Social.'],
    ['Indica quanti minuti attendere la risposta prima di rinunciare.', 'Set how many minutes to wait for the answer before giving up.'],
    ['Prima configura il servizio AI: scegli il servizio e inserisci la chiave.', 'Set up the AI service first: choose the service and enter the key.'],
    ['Servizio AI salvato.', 'AI service saved.'], ['Prova: il testo scritto dall’AI è di esempio.', 'Practice: the text written by the AI is a sample.'],
    ['Servizio AI: ', 'AI service: '], ['Scrivi cosa vuoi dire all’AI.', 'Write what you want to tell the AI.'],
    ['Sostituire il testo attuale con quello scritto dall’AI?', 'Replace the current text with the one written by the AI?'], ['L’AI sta scrivendo…', 'The AI is writing…'],
    ['Testo scritto dall’AI. Controllalo e modificalo prima di pubblicare.', 'Text written by the AI. Check and edit it before publishing.'],
    ['Campi migliorati. Controllali e salva il piano.', 'Fields improved. Check them and save the plan.'], ['Scrivi almeno una parola in uno dei campi.', 'Write at least one word in one of the fields.'],
    [' non ha restituito campi utilizzabili. Riprova.', ' did not return usable fields. Try again.'],
    // Media in the simple view
    ['Foto o video', 'Photo or video'], ['Copia immagine', 'Copy image'],
    ['Immagine copiata. Incollala nel post del social con Ctrl+V.', 'Image copied. Paste it into the social’s post with Ctrl+V.'],
    ['Non riesco a copiare l’immagine. Scaricala e caricala sul social.', 'I cannot copy the image. Download it and upload it on the social.'],
    // Deleting posts
    ['Elimina', 'Delete'], ['Svuota i post di prova', 'Clear the test posts'], ['Post eliminato.', 'Post deleted.'], ['Post di prova eliminati.', 'Test posts deleted.'],
    ['Eliminare questo post? Non si può annullare.', 'Delete this post? This cannot be undone.'],
    ['Eliminare questo post programmato? Non verrà pubblicato e non si può annullare.', 'Delete this scheduled post? It will not be published and this cannot be undone.'],
    ['Eliminare la copia di questo post da Studio Social? Sul social resta: va rimosso lì a mano.', 'Delete the copy of this post from Studio Social? It stays on the social: remove it there by hand.'],
    ['Eliminare tutti i post di prova? Non si può annullare.', 'Delete all the test posts? This cannot be undone.'],
    ['Questo post è in lavorazione: riprova tra poco.', 'This post is being processed: try again shortly.'], ['I post si eliminano in blocco solo in prova.', 'Posts can only be deleted in bulk in practice.'],
    // Fallbacks
    ['Collegamento ', 'Connection '],
  ].filter(([it, en]) => it !== en).sort((a, b) => b[0].length - a[0].length);

  // Whole-text patterns with variables.
  const patterns = [
    [/^(\d+) caratteri in più: accorcia il testo per (.+) \(massimo (\d+)\)\.$/, '$1 characters too many: shorten the text for $2 (maximum $3).'],
    [/^(\d+) \/ (\d+) caratteri$/, '$1 / $2 characters'],
    [/^Copia e apri (.+)$/, 'Copy and open $1'], [/^Apri (.+)$/, 'Open $1'],
    [/^Testo copiato\. (.+) si apre con il post già scritto: se non lo vedi, incolla con Ctrl\+V\.$/, 'Text copied. $1 opens with the post already written: if you do not see it, paste with Ctrl+V.'],
    [/^Pubblicare questo post su (.+)\?$/, 'Publish this post on $1?'],
    [/^Attivare creazione e pubblicazione automatica su (.+)\?$/, 'Turn on automatic creation and publishing on $1?'],
    [/^(\d+) modelli disponibili\. Scegline uno e salva la configurazione\.$/, '$1 models available. Pick one and save the configuration.'],
    [/^(.+) non ha restituito un post completo entro il limite di (\d+) caratteri\.$/, '$1 did not return a complete post within the limit of $2 characters.'],
    [/^(.+): inserisci (da 1 a|fino a) (\d+) caratteri\.$/, (m, label, range, n) => `${translate(label)}: enter ${range === 'da 1 a' ? '1 to' : 'up to'} ${n} characters.`],
    [/^Attivare la pubblicazione sui tuoi account\? Riprenderanno calendario e pubblicazioni programmate\.$/, 'Turn on publishing to your accounts? The calendar and scheduled posts will resume.'],
  ];

  const supported = ['it', 'en'];
  let lang = 'en';
  try {
    const saved = localStorage.getItem(storageKey);
    lang = supported.includes(saved) ? saved : (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en';
  } catch { lang = (navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en'; }

  function translate(text, exactOnly = false) {
    if (lang !== 'en' || !text || !/\S/.test(text)) return text;
    const lead = text.match(/^\s*/)[0];
    const tail = text.match(/\s*$/)[0];
    const core = text.trim();
    if (Object.hasOwn(exact, core)) return lead + exact[core] + tail;
    const whole = phrases.find(([it]) => it.trim() === core);
    if (whole) return lead + whole[1].trim() + tail;
    if (exactOnly) return text;
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(core)) return lead + translateParts(core.replace(pattern, replacement)) + tail;
    }
    return translateParts(text);
  }

  function translateParts(text) {
    let out = text;
    for (const [it, en] of phrases) if (it.length > 3 && out.includes(it)) out = out.split(it).join(en);
    return out;
  }

  const skip = new Set(['SCRIPT', 'STYLE', 'TEXTAREA']);
  const attributes = ['placeholder', 'aria-label', 'title', 'alt'];
  const shownText = new WeakMap();
  const shownAttr = new WeakMap();

  function excluded(element) {
    return !element || Boolean(element.closest?.('[data-no-i18n]'));
  }

  function textNode(node) {
    const element = node.parentElement;
    if (excluded(element) || skip.has(element?.tagName)) return;
    const record = shownText.get(node);
    if (record && record.shown === node.data) {
      const next = translate(record.orig, element.hasAttribute('data-i18n-exact'));
      if (next !== node.data) { node.data = next; record.shown = next; }
      return;
    }
    const orig = node.data;
    const next = translate(orig, element.hasAttribute('data-i18n-exact'));
    shownText.set(node, { orig, shown: next });
    if (next !== orig) node.data = next;
  }

  function attributesOf(element) {
    if (excluded(element)) return;
    for (const name of attributes) {
      if (!element.hasAttribute(name)) continue;
      const key = `${name}`;
      const records = shownAttr.get(element) ?? {};
      const record = records[key];
      const current = element.getAttribute(name);
      let orig = current;
      if (record && record.shown === current) orig = record.orig;
      const next = translate(orig);
      records[key] = { orig, shown: next };
      shownAttr.set(element, records);
      if (next !== current) element.setAttribute(name, next);
    }
  }

  function walk(root) {
    if (root.nodeType === Node.TEXT_NODE) return textNode(root);
    if (root.nodeType !== Node.ELEMENT_NODE) return;
    attributesOf(root);
    const iterator = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
    for (let current = iterator.nextNode(); current; current = iterator.nextNode()) {
      if (current.nodeType === Node.TEXT_NODE) textNode(current);
      else attributesOf(current);
    }
  }

  let applying = false;
  const observer = new MutationObserver(records => {
    if (applying) return;
    applying = true;
    try {
      for (const record of records) {
        if (record.type === 'childList') for (const added of record.addedNodes) walk(added);
        else if (record.type === 'characterData') textNode(record.target);
        else if (record.type === 'attributes') attributesOf(record.target);
      }
    } finally { applying = false; }
  });

  function apply() {
    applying = true;
    try {
      document.documentElement.lang = lang;
      walk(document.documentElement);
    } finally { applying = false; }
  }

  function setLanguage(next) {
    if (!supported.includes(next)) return;
    lang = next;
    try { localStorage.setItem(storageKey, next); } catch { /* not remembered */ }
    apply();
    const select = document.getElementById('language');
    if (select) select.value = lang;
    window.dispatchEvent(new CustomEvent('studio-language', { detail: lang }));
  }

  window.i18n = {
    t: (text) => translate(text),
    get lang() { return lang; },
    get locale() { return lang === 'it' ? 'it-IT' : 'en-GB'; },
    setLanguage,
  };

  document.addEventListener('DOMContentLoaded', () => {
    const select = document.getElementById('language');
    if (select) {
      select.value = lang;
      select.addEventListener('change', () => setLanguage(select.value));
    }
    apply();
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: attributes });
  });
})();
