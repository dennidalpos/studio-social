import { createGeneration } from './generation.mjs';
import { mediaPublishing } from './publishing.mjs';

export class ProviderError extends Error {
  constructor(message, uncertain = false) {
    super(message);
    this.uncertain = uncertain;
  }
}

export const postLimit = 3000;
export const channelLimit = (channel) => ['instagram', 'tiktok'].includes(channel) ? 2200 : postLimit;

export function providers(env, fetcher = fetch) {
  const demo = env.DEMO !== 'false';
  const openai = Boolean(env.OPENAI_API_KEY);
  const linkedin = Boolean(env.LINKEDIN_CLIENT_ID && env.LINKEDIN_CLIENT_SECRET);
  const facebook = /^\d+$/.test(env.FACEBOOK_PAGE_ID ?? '') && Boolean(env.FACEBOOK_PAGE_TOKEN);
  const graph = `https://graph.facebook.com/${env.FACEBOOK_GRAPH_VERSION || 'v27.0'}`;
  if (!/^https:\/\/graph\.facebook\.com\/v\d+\.\d+$/.test(graph)) {
    throw new Error('FACEBOOK_GRAPH_VERSION deve avere il formato v27.0.');
  }

  async function request(service, url, options, publishing = false, timeout = publishing ? 20000 : 60000) {
    let result;
    try {
      result = await fetcher(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(timeout) });
    } catch {
      throw new ProviderError(`${service} non ha risposto. Controlla la connessione a internet e riprova.`, publishing);
    }
    if (!result.ok) {
      const data = await result.json().catch(() => null);
      const expired = ['Facebook', 'Instagram'].includes(service) && data?.error?.code === 190;
      const message = expired || result.status === 401
        ? `${service} ha rifiutato il token. Ricollega l’account.`
        : `${service} ha rifiutato la richiesta (codice ${result.status}). Controlla i permessi dell’app e le credenziali salvate.`;
      throw new ProviderError(message, publishing && result.status >= 500);
    }
    return result;
  }

  const bearer = (token) => ({ Authorization: `Bearer ${token}` });
  const json = (token) => ({ ...bearer(token), 'Content-Type': 'application/json' });

  const mediaService = mediaPublishing(env, { request, bearer, json, ProviderError });

  const generation = createGeneration(env, { demo, limit: channelLimit, ErrorType: ProviderError, fetcher });

  function authorizeLinkedin(redirectUri, state) {
    const url = new URL('https://www.linkedin.com/oauth/v2/authorization');
    url.search = new URLSearchParams({ response_type: 'code', client_id: env.LINKEDIN_CLIENT_ID, redirect_uri: redirectUri, state, scope: 'openid profile w_member_social' });
    return url.href;
  }

  async function connectLinkedin(redirectUri, code) {
    const response = await request('LinkedIn', 'https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({
        grant_type: 'authorization_code', code, client_id: env.LINKEDIN_CLIENT_ID,
        client_secret: env.LINKEDIN_CLIENT_SECRET, redirect_uri: redirectUri,
      }),
    });
    const token = await response.json();
    if (!token.access_token || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
      throw new ProviderError('LinkedIn non ha restituito un token valido.');
    }
    const profile = await request('LinkedIn', 'https://api.linkedin.com/v2/userinfo', { headers: bearer(token.access_token) });
    const { sub, name } = await profile.json();
    if (typeof sub !== 'string' || !sub) throw new ProviderError('Identificativo del profilo LinkedIn assente.');
    return { id: sub, name: name || 'Profilo LinkedIn', token: token.access_token, expires: Date.now() + token.expires_in * 1000 };
  }

  async function connectFacebook() {
    const response = await request('Facebook', `${graph}/me?fields=id,name`, { headers: bearer(env.FACEBOOK_PAGE_TOKEN) });
    const { id, name } = await response.json();
    if (id !== env.FACEBOOK_PAGE_ID) throw new ProviderError('L’ID configurato e quello del token Pagina non coincidono.');
    return { id, name: name || 'Pagina Facebook' };
  }

  async function publish(post, account, media) {
    if (post.channel === 'tiktok') throw new ProviderError('Esporta il post e pubblicalo nell’app TikTok.');
    if (demo) return `demo-${post.id}`;
    if (post.channel === 'instagram') return mediaService.publishInstagram(post, account, media);
    if (media && post.channel === 'linkedin') return mediaService.publishLinkedin(post, account, media);
    if (media && post.channel === 'facebook') return mediaService.publishFacebook(post, account, media);
    if (post.channel === 'linkedin') {
      const response = await request('LinkedIn', 'https://api.linkedin.com/v2/ugcPosts', {
        method: 'POST', headers: { ...json(account.token), 'X-Restli-Protocol-Version': '2.0.0' }, body: JSON.stringify({
          author: `urn:li:person:${account.id}`,
          lifecycleState: 'PUBLISHED',
          specificContent: { 'com.linkedin.ugc.ShareContent': { shareCommentary: { text: post.content }, shareMediaCategory: 'NONE' } },
          visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
        }),
      }, true);
      return mediaService.linkedinId(response);
    }
    const response = await request('Facebook', `${graph}/${account.id}/feed`, {
      method: 'POST', headers: { ...bearer(env.FACEBOOK_PAGE_TOKEN), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ message: post.content }),
    }, true);
    return (await response.json().catch(() => ({}))).id || '';
  }

  return { demo, openai, linkedin, facebook, generation, generate: generation.generate, authorizeLinkedin, connectLinkedin, connectFacebook, publish, ...mediaService };
}
