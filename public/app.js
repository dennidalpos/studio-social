const $ = (id) => document.getElementById(id);
const t = (text) => window.i18n.t(text);
const locale = () => window.i18n.locale;
const language = () => window.i18n.lang;
const planForm = $('plan');
const providerSelect = planForm.elements.provider;
const editor = $('editor');
const previewDialog = $('post-preview');
const previewMedia = $('preview-media');
const previewMediaToggle = $('preview-media-checkbox');
const form = $('edit-form');
const channelLabels = { linkedin: 'LinkedIn', facebook: 'Pagina Facebook', instagram: 'Instagram', tiktok: 'TikTok' };
const acceptedFiles = { linkedin: '.jpg,.jpeg,.png,.mp4', facebook: '.jpg,.jpeg,.png,.mp4,.mov', instagram: '.jpg,.jpeg,.mp4,.mov', tiktok: '.jpg,.jpeg,.webp,.mp4,.mov,.webm' };
const mediaSelections = { plan: null, editor: null };
const statusLabels = {
  draft: 'Bozza', queued: 'In programma', failed: 'Da riprogrammare', unknown: 'Da verificare',
  published: 'Pubblicato', simulated: 'Invio simulato', generating: 'In generazione', publishing: 'In invio',
};
let state;
let revision = 0;
let busy = false;
let editing;
let previewAttachment;

// The login cookie is gone or the key changed: reload to show the login instructions.
function sessionExpired() {
  window.location.reload();
  return new Error('Session expired.');
}

async function api(path, data) {
  const headers = { 'Content-Type': 'application/json' };
  if (state) headers['X-Studio-Mode'] = String(state.demo);
  const options = data === undefined ? {} : { method: 'POST', headers, body: JSON.stringify(data) };
  const response = await fetch(`/api/${path}`, options);
  if (response.status === 401) throw sessionExpired();
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Operazione non riuscita.');
  return result;
}

const dismissals = new WeakMap();

// Errors are announced at once (alert); confirmations on the page notice fade after a few seconds.
function message(text, error = false, target = $('notice')) {
  clearTimeout(dismissals.get(target));
  target.textContent = text;
  target.hidden = !text;
  target.classList.toggle('error', error);
  target.setAttribute('role', error ? 'alert' : 'status');
  if (text && !error && target === $('notice') && !text.endsWith('…')) {
    dismissals.set(target, setTimeout(() => { if (target.textContent === text) message('', false, target); }, 8000));
  }
}

function node(tag, className, text) {
  const item = document.createElement(tag);
  item.className = className;
  if (text) item.textContent = text;
  return item;
}

function button(label, fn) {
  const item = node('button', 'secondary small', label);
  item.type = 'button';
  item.addEventListener('click', fn);
  return item;
}

function displayAccount(channel, account) {
  if (channel === 'tiktok') return;
  const select = $(`${channel}-button`);
  select.disabled = false;
  const setupNeeded = !account.configured || (channel === 'linkedin' && !state.linkedinHttps);
  select.textContent = state.demo || setupNeeded ? 'Configura' : account.ready ? 'Scollega' : 'Collega';
  const expiry = account.expires ? ` · Scade il ${new Date(account.expires).toLocaleDateString(locale())}` : '';
  $(`${channel}-name`).textContent = state.demo ? (account.configured ? 'Credenziali salvate · demo' : 'Demo') : account.ready ? `${account.name}${expiry}` : setupNeeded ? 'Configurazione da completare' : 'Pronto da collegare';
}

// Posts that are not being written or sent right now can be deleted (same list as the server).
const deletable = ['draft', 'queued', 'failed', 'published', 'unknown', 'simulated'];
const deleteQuestions = {
  queued: 'Eliminare questo post programmato? Non verrà pubblicato e non si può annullare.',
  published: 'Eliminare la copia di questo post da Studio Social? Sul social resta: va rimosso lì a mano.',
  unknown: 'Eliminare la copia di questo post da Studio Social? Sul social resta: va rimosso lì a mano.',
};

function removePost(trigger, post, target = $('notice'), done) {
  if (!window.confirm(t(deleteQuestions[post.status] ?? 'Eliminare questo post? Non si può annullare.'))) return;
  void change(trigger, async () => {
    render(await api(`posts/${post.id}`, { action: 'delete' }));
    done?.();
    message('Post eliminato.', false, $('notice'));
  }, target);
}

function postCard(post) {
  const article = node('article', 'post-item');
  const header = node('header', '');
  header.append(node('strong', '', channelLabels[post.channel]), node('span', 'pill', statusLabels[post.status]));
  article.append(header);
  if (post.content) {
    const copy = node('p', 'copy', post.content);
    copy.dataset.noI18n = '';
    article.append(copy);
  }
  if (post.due && post.status === 'queued') {
    article.append(node('p', 'meta', new Date(post.due).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' })));
  }
  if (post.media) article.append(mediaPreview(post.media, { downloadable: post.channel === 'tiktok' }));
  if (post.channel === 'tiktok' && post.content) {
    article.append(button('Copia didascalia', async () => {
      try { await navigator.clipboard.writeText(post.content); message('Didascalia copiata.'); }
      catch { message('Seleziona il testo e copialo manualmente.', true); }
    }));
  }
  if (post.error) article.append(node('p', 'meta error', post.error));
  const actions = node('div', 'actions post-actions');
  const preview = button('Anteprima', () => openPostPreview(post));
  preview.setAttribute('aria-haspopup', 'dialog');
  actions.append(preview);
  if (['draft', 'queued', 'failed'].includes(post.status)) actions.append(button('Modifica', () => openEditor(post)));
  if (deletable.includes(post.status)) {
    const remove = button('Elimina', event => removePost(event.currentTarget, post));
    remove.classList.add('danger');
    actions.append(remove);
  }
  article.append(actions);
  if (post.status === 'unknown') {
    const actions = node('div', 'actions');
    actions.append(button('L’ho trovato sul social', () => verify(post, true)), button('Assente sul social', () => verify(post, false)));
    article.append(actions);
  }
  return article;
}

function updateProviderHint() {
  const option = state?.generationProviders.find(provider => provider.id === providerSelect.value);
  const hint = $('provider-model');
  hint.hidden = !option;
  if (!option) return;
  if (state.demo) hint.textContent = 'Generazione simulata.';
  else if (!option.ready) hint.textContent = 'Configura il provider in Account → Configura i provider AI.';
  else hint.textContent = 'Modello ' + option.model;
  updateWebControls();
}

// The web toggle only works with providers that have their own web search (OpenAI, Claude, QwenCloud).
function updateWebControls() {
  const supports = (id) => Boolean(state?.generationProviders.find(provider => provider.id === id)?.web);
  const toggles = [[$('plan-web'), providerSelect.value, $('plan-web-hint')], [$('simple-web'), state?.plan.provider, null]];
  for (const [input, provider, hint] of toggles) {
    const allowed = supports(provider);
    input.disabled = !allowed;
    if (!allowed) input.checked = false;
    input.title = allowed ? '' : 'Il provider AI scelto non supporta la ricerca web.';
    if (hint) hint.textContent = allowed ? 'Inserisci i link nel materiale di riferimento. La risposta può richiedere più tempo.' : 'Il provider scelto non supporta la ricerca web.';
  }
}

function render(result, updatePlan = false) {
  const selectedProvider = updatePlan ? result.plan.provider : providerSelect.value;
  const providersChanged = JSON.stringify(state?.generationProviders) !== JSON.stringify(result.generationProviders);
  state = result;
  if (providersChanged || updatePlan) {
    const options = result.generationProviders.map(provider => {
      const item = node('option', '', provider.label + (provider.ready ? '' : ' · da configurare'));
      item.value = provider.id;
      return item;
    });
    providerSelect.replaceChildren(...options);
    providerSelect.value = selectedProvider || result.plan.provider;
    updateProviderHint();
  }
  if (updatePlan) {
    for (const key of ['channel', 'topic', 'audience', 'tone', 'facts', 'time', 'mode']) planForm.elements[key].value = result.plan[key];
    planForm.elements.enabled.checked = result.plan.enabled;
    planForm.elements.web.checked = Boolean(result.plan.web);
    mediaSelections.plan = result.plan.media;
    updateMedia('plan');
    for (const day of planForm.querySelectorAll('[name=day]')) day.checked = result.plan.days.includes(Number(day.value));
  }
  updateWebControls();
  $('clear-demo').hidden = !result.demo || !result.posts.some(post => deletable.includes(post.status));
  const environment = $('environment');
  environment.textContent = result.demo ? 'Demo · invii simulati' : 'Reale · pubblica davvero';
  environment.classList.toggle('live', !result.demo);
  environment.title = result.demo ? 'Modalità demo: nulla viene inviato ai social. Clicca per cambiarla.' : 'Modalità reale: i post vengono pubblicati sui tuoi account. Clicca per cambiarla.';
  $('plan-state').textContent = result.plan.enabled ? 'Attivo' : 'In pausa';
  $('sent-label').textContent = result.demo ? 'Invii simulati' : 'Pubblicati';
  const count = (...statuses) => result.posts.filter(post => statuses.includes(post.status)).length;
  $('draft-count').textContent = count('draft');
  $('queue-count').textContent = count('queued', 'publishing');
  $('sent-count').textContent = count('published', 'simulated');
  for (const [channel, account] of Object.entries(result.accounts)) displayAccount(channel, account);
  const posts = $('posts');
  const signature = JSON.stringify(result.posts);
  const editing = posts.contains(document.activeElement) && document.activeElement.matches('input, textarea, select');
  if (posts.dataset.rendered !== signature && !editing) {
    posts.dataset.rendered = signature;
    posts.replaceChildren(...(result.posts.length ? result.posts.map(postCard) : [$('empty').content.cloneNode(true)]));
  }
}

function mediaPreview(media, { downloadable = false, reportError = false } = {}) {
  const container = node('div', 'media-preview');
  const item = node(media.duration === null ? 'img' : 'video', 'preview-asset');
  if (media.duration === null) {
    item.alt = media.name;
    item.loading = 'lazy';
  } else {
    item.controls = true;
    item.playsInline = true;
    item.preload = 'metadata';
    item.setAttribute('aria-label', media.name);
  }
  container.append(item, node('p', 'meta', `${media.name} · ${media.width}×${media.height} · ${(media.bytes / 1_000_000).toLocaleString(locale(), { maximumFractionDigits: 2 })} MB`));
  if (reportError) {
    const notice = node('p', 'media-hint error', 'Il browser non riesce ad aprire l’allegato. Puoi scaricarlo e aprirlo sul tuo dispositivo.');
    notice.hidden = true;
    notice.setAttribute('role', 'status');
    item.addEventListener('error', () => {
      if (!item.hasAttribute('src')) return;
      item.hidden = true;
      notice.hidden = false;
    });
    container.append(notice);
  }
  item.src = `/media/${media.id}`;
  if (downloadable) {
    const link = node('a', 'download', 'Scarica il media');
    link.href = `/media/${media.id}?download`;
    link.download = media.name;
    container.append(link);
  }
  return container;
}

function clearPreviewMedia() {
  const video = previewMedia.querySelector('video');
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
  }
  previewMedia.replaceChildren();
  previewMedia.hidden = true;
}

function updatePreviewMedia() {
  clearPreviewMedia();
  if (!previewAttachment || !previewMediaToggle.checked) return;
  previewMedia.append(mediaPreview(previewAttachment, { downloadable: true, reportError: true }));
  previewMedia.hidden = false;
}

function openPostPreview({ channel, content, status, due, media, editingDraft = false }) {
  if (previewDialog.open) return;
  previewAttachment = media;
  const mark = $('preview-channel-mark');
  mark.className = `channel ${channel}`;
  mark.textContent = { linkedin: 'in', facebook: 'f', instagram: 'IG', tiktok: 'TT' }[channel];
  $('preview-channel').textContent = channelLabels[channel];
  const date = due && status === 'queued' ? new Date(due).toLocaleString(locale(), { dateStyle: 'short', timeStyle: 'short' }) : '';
  $('preview-status').textContent = [editingDraft ? 'Modifiche non salvate' : statusLabels[status], date].filter(Boolean).join(' · ');
  const copy = $('preview-copy');
  copy.textContent = content || (media ? '' : 'Aggiungi testo o un allegato per vedere l’anteprima.');
  copy.hidden = !copy.textContent;
  $('preview-media-option').hidden = !media;
  previewMediaToggle.checked = Boolean(media);
  previewDialog.showModal();
  updatePreviewMedia();
}

previewMediaToggle.addEventListener('change', updatePreviewMedia);
previewDialog.addEventListener('close', () => {
  if (previewDialog.open) return;
  clearPreviewMedia();
  previewAttachment = undefined;
});

function selectedChannel(location) {
  return location === 'plan' ? planForm.elements.channel.value : editing?.channel ?? form.elements.channel.value;
}

function updateMedia(location) {
  const channel = selectedChannel(location);
  const input = $(`${location}-file`);
  const output = $(`${location}-media`);
  const hints = state?.mediaHints?.[channel] || '';
  const instagramNote = channel === 'instagram' && state && !state.instagramPhotos ? ' Per pubblicare un JPG completa la configurazione HTTPS nella guida Instagram.' : '';
  const planNote = location === 'plan' ? ' Il piano riutilizza lo stesso file.' : '';
  $(`${location}-media-hint`).textContent = `${hints}${instagramNote}${planNote}`;
  input.accept = acceptedFiles[channel];
  if (location === 'plan') {
    const mode = planForm.elements.mode;
    mode.querySelector('[value=auto]').disabled = channel === 'tiktok';
    if (channel === 'tiktok') mode.value = 'draft';
  } else {
    form.elements.content.maxLength = ['instagram', 'tiktok'].includes(channel) ? 2200 : 3000;
  }
  const media = mediaSelections[location];
  output.replaceChildren();
  if (media) {
    output.append(mediaPreview(media, { downloadable: channel === 'tiktok' }), button('Rimuovi allegato', () => {
      mediaSelections[location] = null;
      input.value = '';
      updateMedia(location);
    }));
  }
}

function changeChannel(location) {
  const media = mediaSelections[location];
  const extension = media?.name.split('.').at(-1);
  if (extension && !acceptedFiles[selectedChannel(location)].split(',').includes(`.${extension}`)) {
    mediaSelections[location] = null;
    message('L’allegato precedente non è compatibile con il canale selezionato.', true, location === 'plan' ? $('notice') : $('editor-notice'));
  }
  $(`${location}-file`).value = '';
  updateMedia(location);
}

function uploadMedia(location, input) {
  const file = input.files[0];
  if (!file) return;
  const notice = location === 'plan' ? $('notice') : $('editor-notice');
  if (busy) { input.value = ''; return message('Attendi che termini l’operazione in corso e seleziona di nuovo il file.', true, notice); }
  const channel = selectedChannel(location);
  const postId = editing?.id;
  input.value = '';
  if (file.size > 100_000_000) return message('Il file supera 100 MB.', true, notice);
  void change(input, async () => {
    const params = new URLSearchParams({ channel, name: file.name });
    const response = await fetch(`/api/media?${params}`, { method: 'POST', body: file, headers: state ? { 'X-Studio-Mode': String(state.demo) } : {} });
    if (response.status === 401) throw sessionExpired();
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Caricamento non riuscito.');
    if (channel !== selectedChannel(location) || (location === 'editor' && (!editor.open || postId !== editing?.id))) return;
    mediaSelections[location] = result;
    updateMedia(location);
    message('Allegato pronto.', false, notice);
  }, notice);
}

function getPlanInput() {
  const data = new FormData(planForm);
  const { day, enabled, web, ...values } = Object.fromEntries(data);
  return { ...values, language: language(), days: data.getAll('day').map(Number), enabled: enabled === 'on', web: web === 'on', mediaId: mediaSelections.plan?.id ?? null };
}

async function change(trigger, action, target = $('notice')) {
  if (busy) return;
  busy = true;
  revision++;
  trigger.disabled = true;
  message('Operazione in corso…', false, target);
  try { await action(); } catch (error) { message(error.message, true, target); }
  finally {
    busy = false;
    trigger.disabled = false;
  }
}

function openEditor(post) {
  editing = post;
  form.reset();
  form.elements.channel.value = post?.channel || planForm.elements.channel.value;
  form.elements.content.value = post?.content || '';
  if (post?.due && post.status === 'queued') {
    const date = new Date(post.due);
    form.elements.due.value = new Date(post.due - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  }
  mediaSelections.editor = post?.media ?? null;
  updateMedia('editor');
  $('editor-title').textContent = post ? 'Modifica post' : 'Scrivi un post';
  $('editor-channel').hidden = Boolean(post);
  for (const id of ['editor-date', 'queue', 'send']) $(id).hidden = !post || post.channel === 'tiktok';
  $('delete-post').hidden = !post;
  message('', false, $('editor-notice'));
  editor.showModal();
}

function setPost(trigger, action) {
  if (!form.reportValidity()) return;
  const { content, channel, due } = Object.fromEntries(new FormData(form));
  if (!content.trim() && !mediaSelections.editor) return message('Aggiungi testo o un allegato.', true, $('editor-notice'));
  if (action === 'schedule' && !due) return message('Scegli data e ora per il post.', true, $('editor-notice'));
  if (action === 'now' && !state.demo && !window.confirm(t(`Pubblicare questo post su ${channelLabels[editing.channel]}?`))) return;
  const postId = editing?.id;
  const mediaId = mediaSelections.editor?.id ?? null;
  void change(trigger, async () => {
    const update = action === 'save' ? { action, content, mediaId } : { action: 'queue', content, mediaId, due: due && action === 'schedule' ? new Date(due).toISOString() : null };
    render(postId ? await api(`posts/${postId}`, update) : await api('new', { channel, content, mediaId }));
    editor.close();
    message(action === 'save' ? 'Bozza salvata.' : action === 'schedule' ? 'Post programmato.' : 'Post messo in coda.');
  }, $('editor-notice'));
}

function verify(post, found) {
  const trigger = document.activeElement;
  void change(trigger, async () => {
    render(await api(`posts/${post.id}`, { action: 'verify', found }));
    message(found ? 'Post registrato come pubblicato.' : 'Post riportato tra le bozze.');
  });
}

planForm.addEventListener('submit', event => {
  event.preventDefault();
  const input = getPlanInput();
  if (input.enabled && input.mode === 'auto' && !state?.demo && !window.confirm(t(`Attivare creazione e pubblicazione automatica su ${channelLabels[input.channel]}?`))) return;
  void change(event.submitter, async () => { render(await api('plan', input)); message('Piano salvato.'); });
});
$('generate').addEventListener('click', event => {
  void change(event.currentTarget, async () => { render(await api('generate', getPlanInput())); message('Bozza generata.'); });
});
$('improve').addEventListener('click', event => {
  const input = getPlanInput();
  void change(event.currentTarget, async () => {
    const { fields } = await api('improve', input);
    for (const key of ['topic', 'audience', 'tone', 'facts']) planForm.elements[key].value = fields[key];
    message('Campi migliorati. Controllali e salva il piano.');
  });
});
$('new-post').addEventListener('click', () => openEditor());
$('delete-post').addEventListener('click', event => {
  if (editing) removePost(event.currentTarget, editing, $('editor-notice'), () => editor.close());
});
$('clear-demo').addEventListener('click', event => {
  if (!window.confirm(t('Eliminare tutti i post di prova? Non si può annullare.'))) return;
  void change(event.currentTarget, async () => { render(await api('clear-demo', {})); message('Post di prova eliminati.'); });
});
$('close-editor').addEventListener('click', () => editor.close());
$('preview-editor').addEventListener('click', () => openPostPreview({
  channel: selectedChannel('editor'), content: form.elements.content.value.trim(),
  media: mediaSelections.editor, editingDraft: true,
}));
form.addEventListener('submit', event => { event.preventDefault(); setPost(event.submitter, 'save'); });
$('queue').addEventListener('click', event => setPost(event.currentTarget, 'schedule'));
$('send').addEventListener('click', event => setPost(event.currentTarget, 'now'));

for (const channel of ['linkedin', 'facebook', 'instagram']) {
  $(`${channel}-button`).addEventListener('click', event => {
    if (!state) return;
    if (state.demo || !state.accounts[channel].configured || (channel === 'linkedin' && !state.linkedinHttps)) {
      $(`${channel}-guide`).open = true;
      $(`${channel}-guide`).querySelector('summary').focus();
      return;
    }
    void change(event.currentTarget, async () => {
      if (state.accounts[channel].ready) {
        render(await api('disconnect', { channel }));
        message('Account scollegato.');
      } else if (channel === 'linkedin') {
        const { url } = await api('linkedin', {});
        window.location.assign(url);
      } else {
        render(await api(channel, {}));
        message(`${channelLabels[channel]} collegato.`);
      }
    });
  });
}

async function refresh(initial = false) {
  const started = revision;
  try {
    const result = await api('status');
    if (revision === started && !busy) {
      const modeChanged = state && state.demo !== result.demo;
      if (modeChanged) {
        if (previewDialog.open) previewDialog.close();
        if (editor.open) editor.close();
      }
      render(result, initial || !state || modeChanged);
      if (modeChanged) $('studio-mode').elements.mode.value = result.demo ? 'demo' : 'live';
    }
  } catch (error) {
    if (initial) message(error.message, true);
  }
}

planForm.elements.channel.addEventListener('change', () => changeChannel('plan'));
form.elements.channel.addEventListener('change', () => changeChannel('editor'));
for (const location of ['plan', 'editor']) {
  const input = $(`${location}-file`);
  input.addEventListener('change', () => uploadMedia(location, input));
}

const configurationNotice = $('config-notice');
const modeForm = $('studio-mode');
const configurationForms = [...document.querySelectorAll('form[data-configuration]')];

// Values to send for a configuration form: a saved secret is left out unless the user typed a new one.
function collectValues(target) {
  const formData = new FormData(target);
  const values = {};
  for (const input of target.querySelectorAll('input:not([type=checkbox])')) {
    if (formData.has(`remove-${input.name}`)) values[input.name] = '';
    else if (input.type !== 'password' || input.value) values[input.name] = input.value;
  }
  return values;
}

// A button that asks the provider which models the key can use, and a list to pick one from.
function modelPicker(target, input, label) {
  const row = node('div', 'model-picker');
  const button = node('button', 'secondary small', 'Elenca modelli');
  button.type = 'button';
  const list = node('select', '');
  list.setAttribute('aria-label', `Modelli disponibili · ${label}`);
  list.hidden = true;
  button.addEventListener('click', () => {
    const notice = target.querySelector('.form-notice');
    void change(button, async () => {
      const { models } = await api('models', { group: target.dataset.configuration, values: collectValues(target) });
      const prompt = node('option', '', 'Scegli un modello');
      prompt.value = '';
      list.replaceChildren(prompt, ...models.map(model => {
        const option = node('option', '', model.label);
        option.value = model.id;
        return option;
      }));
      list.value = models.some(model => model.id === input.value) ? input.value : '';
      list.hidden = false;
      message(`${models.length} modelli disponibili. Scegline uno e salva la configurazione.`, false, notice);
    }, notice);
  });
  list.addEventListener('change', () => { if (list.value) input.value = list.value; });
  row.append(button, list);
  return row;
}

function buildConfigurationForm(target, fields) {
  const controls = fields.map(field => {
    const group = node('div', field.secret ? 'secret-field' : '');
    const label = node('label', '', field.label);
    const input = node('input', '');
    input.name = field.name;
    input.type = field.secret ? 'password' : field.url ? 'url' : 'text';
    input.autocomplete = field.secret ? 'new-password' : 'off';
    input.spellcheck = false;
    input.maxLength = 4096;
    if (field.placeholder) input.placeholder = field.placeholder;
    if (field.pattern) input.pattern = field.pattern;
    if (!field.secret) input.value = field.value;
    label.append(input);
    group.append(label);
    if (field.models) group.append(modelPicker(target, input, field.label));
    if (field.secret && field.configured) {
      label.append(node('small', '', 'Già salvata. Lascia vuoto per mantenerla.'));
      const removeLabel = node('label', 'check', 'Rimuovi il valore salvato');
      const remove = node('input', '');
      remove.type = 'checkbox';
      remove.name = `remove-${field.name}`;
      remove.addEventListener('change', () => { input.disabled = remove.checked; });
      removeLabel.prepend(remove);
      group.append(removeLabel);
    }
    return group;
  });
  const submit = node('button', 'secondary small', 'Salva configurazione');
  submit.type = 'submit';
  const actions = node('div', 'actions');
  actions.append(submit);
  target.replaceChildren(...controls, actions, (() => {
    const message = node('p', 'form-notice');
    message.setAttribute('role', 'status');
    message.hidden = true;
    return message;
  })());
}

function updateHttps(data) {
  $('linkedin-callback').textContent = data.callback;
  $('copy-callback').disabled = false;
  const open = $('open-linkedin-https');
  open.href = data.httpsOrigin;
  open.hidden = !data.httpsReady;
  $('download-linkedin-cert').hidden = !data.certificateAvailable;
  $('linkedin-tls-status').textContent = data.httpsError || (data.httpsReady ? 'HTTPS attivo. Aprilo prima di collegare LinkedIn.' : 'HTTPS locale da attivare.');
}

async function loadConfiguration() {
  try {
    const data = await api('configuration');
    updateHttps(data);
    modeForm.elements.mode.value = data.demo ? 'demo' : 'live';
    modeForm.querySelector('button').disabled = false;
    for (const target of configurationForms) buildConfigurationForm(target, data.fields[target.dataset.configuration]);
  } catch (error) { message(error.message, true, configurationNotice); }
}

modeForm.addEventListener('submit', event => {
  event.preventDefault();
  const demo = modeForm.elements.mode.value === 'demo';
  if (demo === state?.demo) return message('Questa modalità è già attiva.', false, configurationNotice);
  if (!demo && !window.confirm(t('Attivare la modalità reale? Verranno ripresi il calendario e gli invii della modalità reale.'))) return;
  void change(event.submitter, async () => {
    const data = await api('configuration', { group: 'mode', demo });
    if (editor.open) editor.close();
    render(data.state, true);
    updateHttps(data);
    message(demo ? 'Ambiente demo attivo: gli invii sono simulati.' : 'Ambiente reale attivo: i post vengono pubblicati davvero.', false, configurationNotice);
  }, configurationNotice);
});

for (const target of configurationForms) {
  target.addEventListener('submit', event => {
    event.preventDefault();
    const group = target.dataset.configuration;
    const values = collectValues(target);
    void change(event.submitter, async () => {
      const result = await api('configuration', { group, values });
      buildConfigurationForm(target, result.fields[group]);
      render(result.state);
      updateProviderHint();
      updateHttps(result);
      message('Configurazione salvata.', false, target.querySelector('.form-notice'));
    }, target.querySelector('.form-notice'));
  });
}

$('copy-callback').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('linkedin-callback').textContent);
    message('URL di callback copiato.', false, $('linkedin-tls-status'));
  } catch { message('Seleziona e copia l’URL nel riquadro.', true, $('linkedin-tls-status')); }
});

function applyHttps(trigger, payload, imported) {
  void change(trigger, async () => {
    const result = await api('linkedin-https', payload);
    updateHttps(result);
    render(result.state);
    if (imported) $('import-tls').reset();
  }, $('linkedin-tls-status'));
}

$('generate-tls').addEventListener('click', event => applyHttps(event.currentTarget, { action: 'generate' }, false));
$('import-tls').addEventListener('submit', event => {
  event.preventDefault();
  applyHttps(event.submitter, { action: 'import', ...Object.fromEntries(new FormData(event.currentTarget)) }, true);
});

// Navigation: sticky bar height for scroll offsets, current section, back-to-top, always start at the top.
const bar = document.querySelector('.bar');
const toTop = $('to-top');
const sections = ['piano', 'post', 'account'].map(id => ({ id, element: $(id), link: document.querySelector(`nav a[href="#${id}"]`) }));
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const scrollBehavior = () => (reducedMotion.matches ? 'auto' : 'smooth');

function syncBar() { document.documentElement.style.setProperty('--bar-h', `${bar.offsetHeight}px`); }
new ResizeObserver(syncBar).observe(bar);
syncBar();

let chosenSection = null;
function syncScroll() {
  toTop.hidden = window.scrollY < 600;
  const line = bar.offsetHeight + window.innerHeight * .25;
  const nearBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
  let current = null;
  for (const section of sections) if (section.element.getBoundingClientRect().top <= line) current = section;
  if (nearBottom) current = sections[sections.length - 1];
  // Sections side by side (wide layout) are in view together but the menu marks one place only:
  // the one the person chose from the menu, otherwise the first of the pair.
  const alongside = (section) => current && Math.abs(section.element.getBoundingClientRect().top - current.element.getBoundingClientRect().top) < 8;
  const group = current ? sections.filter(alongside) : [];
  if (group.length === 1) chosenSection = null;
  const marked = group.find(section => section.id === chosenSection) ?? group[0];
  for (const section of sections) {
    if (section === marked) section.link.setAttribute('aria-current', 'location');
    else section.link.removeAttribute('aria-current');
  }
}
window.addEventListener('scroll', syncScroll, { passive: true });
window.addEventListener('resize', syncScroll);

const goTop = () => { window.scrollTo({ top: 0, behavior: scrollBehavior() }); };
toTop.addEventListener('click', goTop);
$('home').addEventListener('click', event => { event.preventDefault(); goTop(); });
// Menu links scroll without adding a history entry per click, so Back leaves the page instead of replaying the clicks.
for (const link of document.querySelectorAll('nav a, a.mode-pill')) {
  link.addEventListener('click', event => {
    event.preventDefault();
    const id = link.getAttribute('href').slice(1);
    chosenSection = id;
    syncScroll();
    $(id).scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  });
}
// A reload or Back does not restore a scroll position in the middle of the page; only an explicit #section does.
window.history.scrollRestoration = 'manual';
function startPosition() {
  const target = window.location.hash && $(window.location.hash.slice(1));
  if (target) target.scrollIntoView();
  else window.scrollTo(0, 0);
  syncScroll();
}

// Simple view: write, preview, copy and open the social's own composer. No accounts or API keys involved:
// the post is published by the person, with the login they already use in the browser.
const socials = {
  linkedin: {
    name: 'LinkedIn', mark: 'in', limit: 3000, site: 'https://www.linkedin.com/feed/',
    compose: (text) => `https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(text)}`,
    steps: ['Il testo viene copiato negli appunti.', 'Si apre LinkedIn con il post già scritto. Se il testo non compare, incollalo con Ctrl+V.', 'Aggiungi foto o video, se vuoi, e premi Pubblica.'],
  },
  facebook: {
    name: 'Facebook', mark: 'f', limit: 5000, site: 'https://www.facebook.com/',
    steps: ['Il testo viene copiato negli appunti.', 'Si apre Facebook: clicca su «A cosa stai pensando?» e incolla con Ctrl+V.', 'Aggiungi foto o video, se vuoi, e premi Pubblica.'],
  },
  instagram: {
    name: 'Instagram', mark: 'IG', limit: 2200, site: 'https://www.instagram.com/',
    steps: ['Il testo viene copiato come didascalia.', 'Si apre Instagram: usa «Crea», scegli foto o video e incolla la didascalia. Da telefono, apri l’app e incolla lì.', 'Controlla l’anteprima e premi Condividi.'],
  },
  tiktok: {
    name: 'TikTok', mark: 'TT', limit: 2200, site: 'https://www.tiktok.com/upload',
    steps: ['Il testo viene copiato come didascalia.', 'Si apre la pagina di caricamento di TikTok: scegli il video e incolla la didascalia.', 'Controlla l’anteprima e pubblica.'],
  },
};
const simpleForm = $('simple-form');
const simpleText = $('simple-text');
const simpleNotice = $('simple-notice');
const draftKey = 'studio-simple-draft';
const selectedSocial = () => simpleForm.elements['simple-channel'].value;

function simpleMessage(text, error = false, link) {
  simpleNotice.hidden = !text;
  simpleNotice.classList.toggle('error', error);
  simpleNotice.setAttribute('role', error ? 'alert' : 'status');
  simpleNotice.replaceChildren(text);
  if (link) {
    const anchor = node('a', '', link.label);
    anchor.href = link.href;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    simpleNotice.append(' ', anchor);
  }
}

function renderSimple() {
  const social = socials[selectedSocial()];
  const text = simpleText.value.trim();
  const length = [...text].length;
  const over = length - social.limit;
  const mark = $('simple-mark');
  mark.className = `channel ${selectedSocial()}`;
  mark.textContent = social.mark;
  $('simple-name').textContent = social.name;
  $('simple-preview').textContent = text || 'L’anteprima compare qui mentre scrivi.';
  $('simple-preview').classList.toggle('empty-copy', !text);
  const count = $('simple-count');
  count.textContent = over > 0 ? `${over} caratteri in più: accorcia il testo per ${social.name} (massimo ${social.limit}).` : `${length} / ${social.limit} caratteri`;
  count.classList.toggle('error', over > 0);
  $('simple-open').textContent = `Copia e apri ${social.name}`;
  $('simple-steps').replaceChildren(...social.steps.map(step => node('li', '', step)));
  const unusable = !text || over > 0;
  $('simple-open').disabled = unusable;
  $('simple-copy').disabled = unusable;
  $('simple-clear').disabled = !simpleText.value;
  try { localStorage.setItem(draftKey, JSON.stringify({ channel: selectedSocial(), text: simpleText.value })); } catch { /* storage unavailable: the text just is not remembered */ }
}

async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = node('textarea', '');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.append(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand('copy'); } catch { /* not allowed */ }
    area.remove();
    return copied;
  }
}

async function copyAndOpen(open) {
  const key = selectedSocial();
  const social = socials[key];
  const text = simpleText.value.trim();
  const copied = await copyToClipboard(text);
  let address = social.site;
  let prefilled = false;
  if (open && social.compose) {
    const composer = social.compose(text);
    if (composer.length <= 1900) { address = composer; prefilled = true; }
  }
  const link = open ? { label: `Apri ${social.name}`, href: address } : undefined;
  if (open) window.open(address, '_blank', 'noopener,noreferrer');
  if (!copied) return simpleMessage('Non riesco a copiare in automatico. Seleziona il testo nel riquadro e copialo con Ctrl+C.', true, link);
  if (!open) return simpleMessage('Testo copiato. Incollalo dove vuoi con Ctrl+V.');
  simpleMessage(prefilled ? `Testo copiato. ${social.name} si apre con il post già scritto: se non lo vedi, incolla con Ctrl+V.` : `Testo copiato. Incollalo su ${social.name} con Ctrl+V. Se la scheda non si è aperta,`, false, link);
}

simpleForm.addEventListener('submit', event => { event.preventDefault(); void copyAndOpen(true); });
$('simple-copy').addEventListener('click', () => void copyAndOpen(false));
$('simple-clear').addEventListener('click', () => { simpleText.value = ''; simpleMessage(''); renderSimple(); simpleText.focus(); });
simpleText.addEventListener('input', () => { simpleMessage(''); renderSimple(); });
$('simple-ai').addEventListener('click', async event => {
  const prompt = $('simple-prompt').value.trim();
  if (!prompt) return simpleMessage('Scrivi cosa vuoi dire all’AI.', true);
  if (simpleText.value.trim() && !window.confirm(t('Sostituire il testo attuale con quello scritto dall’AI?'))) return;
  const button = event.currentTarget;
  button.disabled = true;
  simpleMessage('L’AI sta scrivendo…');
  try {
    const { text } = await api('compose', { channel: selectedSocial(), prompt, web: $('simple-web').checked && !$('simple-web').disabled, language: language() });
    simpleText.value = text;
    renderSimple();
    simpleMessage('Testo scritto dall’AI. Controllalo e modificalo prima di pubblicare.');
  } catch (error) { simpleMessage(error.message, true); }
  finally { button.disabled = false; }
});
simpleForm.addEventListener('change', event => { if (event.target.name === 'simple-channel') { simpleMessage(''); renderSimple(); } });
try {
  const saved = JSON.parse(localStorage.getItem(draftKey) ?? 'null');
  if (saved && typeof saved.text === 'string' && Object.hasOwn(socials, saved.channel)) {
    simpleText.value = saved.text.slice(0, 6000);
    simpleForm.elements['simple-channel'].value = saved.channel;
  }
} catch { /* nothing saved or storage unavailable */ }
renderSimple();

// Simple (default) or advanced view; the choice is remembered in this browser.
const viewToggle = $('view-toggle');
function setView(view, remember = true) {
  document.body.dataset.view = view;
  $('view-name').textContent = view === 'simple' ? 'avanzata' : 'semplice';
  viewToggle.setAttribute('aria-label', view === 'simple' ? 'Passa alla modalità avanzata' : 'Passa alla modalità semplice');
  if (remember) { try { localStorage.setItem('studio-view', view); } catch { /* not remembered */ } }
  syncBar();
  syncScroll();
}
viewToggle.addEventListener('click', () => { setView(document.body.dataset.view === 'simple' ? 'advanced' : 'simple'); window.scrollTo(0, 0); });
let storedView = null;
try { storedView = localStorage.getItem('studio-view'); } catch { /* default view */ }
setView(storedView === 'advanced' ? 'advanced' : 'simple', false);
startPosition(); // after the view is set, so an explicit #section is visible when it is scrolled to

// A refresh skipped while a field had focus is applied as soon as the field loses it.
$('posts').addEventListener('focusout', () => setTimeout(() => { if (state) render(state); }, 0));
void loadConfiguration();
providerSelect.addEventListener('change', updateProviderHint);
void refresh(true);
setInterval(() => void refresh(), 5000);
const connection = new URLSearchParams(window.location.search).get('linkedin');
const connectionMessages = { connected: 'Profilo LinkedIn collegato.', cancelled: 'Collegamento annullato.', failed: 'Collegamento non riuscito. Verifica credenziali, permessi e URL di callback.', state: 'Sessione di collegamento scaduta. Riparti dal pulsante Collega.' };
if (connection && Object.hasOwn(connectionMessages, connection)) {
  message(connectionMessages[connection], connection !== 'connected');
  window.history.replaceState(null, '', '/#account');
}
