import { openAsBlob } from 'node:fs';
import { chmod, copyFile, rm } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export function mediaPublishing(env, { request, bearer, json, ProviderError }) {
  const version = env.FACEBOOK_GRAPH_VERSION || 'v27.0';
  const graph = `https://graph.facebook.com/${version}`;
  const graphVideo = `https://graph-video.facebook.com/${version}`;
  const instagramPage = env.INSTAGRAM_PAGE_ID || env.FACEBOOK_PAGE_ID;
  const instagramToken = env.INSTAGRAM_PAGE_TOKEN || env.FACEBOOK_PAGE_TOKEN;
  const instagram = /^\d+$/.test(instagramPage ?? '') && Boolean(instagramToken);
  const linkedinBase = 'https://api.linkedin.com/rest';
  const protocol = { 'X-Restli-Protocol-Version': '2.0.0' };
  const linkedinVersion = env.LINKEDIN_VERSION || '202610';
  const imageDir = env.INSTAGRAM_PUBLIC_DIR;
  const imageBase = env.INSTAGRAM_PUBLIC_BASE_URL;
  let imageUrl;
  if (imageBase && imageDir) {
    const url = new URL(imageBase.endsWith('/') ? imageBase : `${imageBase}/`);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Error('INSTAGRAM_PUBLIC_BASE_URL richiede una base HTTPS senza credenziali.');
    imageUrl = url;
  }

  async function poll(service, fetchState, ready, waiting) {
    for (let attempt = 0; attempt < 24; attempt++) {
      const state = await fetchState();
      if (ready.includes(state)) return;
      if (!waiting.includes(state)) throw new ProviderError(`${service} non ha accettato il media (${state || 'stato assente'}).`);
      await delay(5000);
    }
    throw new ProviderError(`${service} sta ancora elaborando il media. Puoi riprogrammare il post.`);
  }

  function uploadUrl(value, domain) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port || !(url.hostname === domain || url.hostname.endsWith(`.${domain}`))) {
      throw new ProviderError('Il provider ha restituito un indirizzo di caricamento inatteso.');
    }
    return url.href;
  }

  function linkedinId(result) {
    if (result.status !== 201) throw new ProviderError('Risposta di pubblicazione LinkedIn inattesa.', true);
    return result.headers.get('x-restli-id') || '';
  }

  async function linkedinPhoto(post, owner, token, media, source) {
    const headers = { ...json(token), ...protocol };
    const response = await request('LinkedIn', 'https://api.linkedin.com/v2/assets?action=registerUpload', {
      method: 'POST', headers,
      body: JSON.stringify({ registerUploadRequest: { recipes: ['urn:li:digitalmediaRecipe:feedshare-image'], owner, serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }] } }),
    });
    const { value } = await response.json();
    const upload = value?.uploadMechanism?.['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest']?.uploadUrl;
    if (!upload || !value.asset) throw new ProviderError('LinkedIn non ha preparato il caricamento della foto.');
    await request('LinkedIn', uploadUrl(upload, 'linkedin.com'), { method: 'PUT', headers: { ...bearer(token), 'Content-Type': media.type }, body: source });
    const result = await request('LinkedIn', 'https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST', headers,
      body: JSON.stringify({ author: owner, lifecycleState: 'PUBLISHED', specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: post.content }, shareMediaCategory: 'IMAGE', media: [{ status: 'READY', media: value.asset }] } }, visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' } }),
    }, true);
    return linkedinId(result);
  }

  async function publishLinkedin(post, account, media) {
    const owner = `urn:li:person:${account.id}`;
    const source = await openAsBlob(media.path, { type: media.type });
    if (media.duration === null) return linkedinPhoto(post, owner, account.token, media, source);
    const headers = { ...json(account.token), ...protocol, 'Linkedin-Version': linkedinVersion };
    const send = (path, body, publishing = false) => request('LinkedIn', `${linkedinBase}/${path}`, { method: 'POST', headers, body: JSON.stringify(body) }, publishing);
    const initialized = await send('videos?action=initializeUpload', { initializeUploadRequest: { owner, fileSizeBytes: media.bytes, uploadCaptions: false, uploadThumbnail: false } });
    const { value } = await initialized.json();
    const { video, uploadToken = '', uploadInstructions } = value ?? {};
    if (!video || !Array.isArray(uploadInstructions) || !uploadInstructions.length) throw new ProviderError('LinkedIn non ha preparato il caricamento del video.');
    const uploadedPartIds = [];
    for (const part of uploadInstructions) {
      const chunk = source.slice(part.firstByte, part.lastByte + 1, 'application/octet-stream');
      const result = await request('LinkedIn', uploadUrl(part.uploadUrl, 'linkedin.com'), { method: 'PUT', body: chunk });
      const id = result.headers.get('etag');
      if (!id) throw new ProviderError('LinkedIn non ha confermato una parte del video.');
      uploadedPartIds.push(id);
    }
    await send('videos?action=finalizeUpload', { finalizeUploadRequest: { video, uploadToken, uploadedPartIds } });
    await poll('LinkedIn', async () => {
      const result = await request('LinkedIn', `${linkedinBase}/videos/${encodeURIComponent(video)}`, { headers });
      return (await result.json()).status;
    }, ['AVAILABLE'], ['WAITING_UPLOAD', 'PROCESSING']);
    return linkedinId(await send('posts', { author: owner, commentary: post.content, visibility: 'PUBLIC', distribution: { feedDistribution: 'MAIN_FEED', targetEntities: [], thirdPartyDistributionChannels: [] }, content: { media: { id: video } }, lifecycleState: 'PUBLISHED', isReshareDisabledByAuthor: false }, true));
  }

  async function publishFacebook(post, account, media) {
    const photo = media.duration === null;
    const body = new FormData();
    body.set(photo ? 'caption' : 'description', post.content);
    body.set('published', 'true');
    body.set('source', await openAsBlob(media.path, { type: media.type }), media.name);
    const headers = bearer(env.FACEBOOK_PAGE_TOKEN);
    const result = await request('Facebook', `${photo ? graph : graphVideo}/${account.id}/${photo ? 'photos' : 'videos'}`, { method: 'POST', headers, body }, true, 180000);
    const outcome = await result.json().catch(() => ({}));
    const id = outcome.post_id || outcome.id;
    if (!id) throw new ProviderError('Facebook non ha confermato l’identificativo del post.', true);
    if (!photo) {
      try {
        await poll('Facebook', async () => {
          const response = await request('Facebook', `${graph}/${encodeURIComponent(id)}?fields=status,published`, { headers });
          const { status, published } = await response.json();
          if (published && status?.video_status === 'ready') return 'published';
          return status?.publishing_phase?.publish_status || status?.video_status;
        }, ['published'], ['ready', 'processing', 'uploading', 'not_published', 'in_progress', 'complete']);
      } catch { throw new ProviderError('Facebook ha ricevuto il video ma la pubblicazione è da verificare.', true); }
    }
    return id;
  }

  async function connectInstagram() {
    const response = await request('Instagram', `${graph}/${instagramPage}?fields=instagram_business_account{id,username}`, { headers: bearer(instagramToken) });
    const { instagram_business_account: profile } = await response.json();
    if (!/^\d+$/.test(profile?.id ?? '')) throw new ProviderError('Collega un account Instagram professionale alla Pagina Meta configurata.');
    return { id: profile.id, name: profile.username ? `@${profile.username}` : 'Account Instagram professionale' };
  }

  async function publishInstagram(post, account, media) {
    const photo = media.duration === null;
    const payload = { caption: post.content };
    let publicPath;
    const headers = { ...bearer(instagramToken), 'Content-Type': 'application/x-www-form-urlencoded' };
    const send = (path, body, publishing = false) => request('Instagram', `${graph}/${account.id}/${path}`, { method: 'POST', headers, body: new URLSearchParams(body) }, publishing);
    if (photo && !imageUrl) throw new ProviderError('Per le foto Instagram imposta la cartella e l’URL pubblico nella guida Instagram in Account.');
    try {
      if (photo) {
        const file = `${randomUUID()}.jpg`;
        publicPath = join(imageDir, file);
        try {
          await copyFile(media.path, publicPath);
          await chmod(publicPath, 0o644);
        } catch { throw new ProviderError('Impossibile scrivere la copia della foto nella cartella HTTPS di Instagram. Controlla la configurazione.'); }
        payload.image_url = new URL(file, imageUrl).href;
      } else Object.assign(payload, { media_type: 'REELS', upload_type: 'resumable', share_to_feed: 'true' });
      const response = await send('media', payload);
      const { id, uri } = await response.json();
      if (!/^\d+$/.test(id ?? '')) throw new ProviderError('Instagram non ha creato il contenitore del post.');
      if (!photo) {
        const endpoint = uri || `https://rupload.facebook.com/ig-api-upload/${version}/${id}`;
        const result = await request('Instagram', uploadUrl(endpoint, 'rupload.facebook.com'), {
          method: 'POST', headers: { Authorization: `OAuth ${instagramToken}`, offset: '0', file_size: String(media.bytes), 'Content-Type': 'application/octet-stream' }, body: await openAsBlob(media.path),
        }, false, 180000);
        if (!(await result.json()).success) throw new ProviderError('Instagram non ha confermato il caricamento del Reel.');
      }
      await poll('Instagram', async () => {
        const state = await request('Instagram', `${graph}/${id}?fields=status_code`, { headers: bearer(instagramToken) });
        return (await state.json()).status_code;
      }, ['FINISHED'], ['IN_PROGRESS']);
      const published = await send('media_publish', { creation_id: id }, true);
      const outcome = await published.json().catch(() => ({}));
      if (!outcome.id) throw new ProviderError('Instagram non ha confermato l’identificativo del post.', true);
      return outcome.id;
    } finally {
      if (publicPath) await rm(publicPath, { force: true }).catch(() => console.error('Controlla la cartella pubblica Instagram: rimozione di una copia temporanea non riuscita.'));
    }
  }

  return { instagram, instagramPhotos: Boolean(imageUrl), connectInstagram, publishInstagram, publishFacebook, publishLinkedin, linkedinId };
}
