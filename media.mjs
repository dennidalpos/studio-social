import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream, readdirSync, rmSync, statSync } from 'node:fs';
import { open, rename, rm } from 'node:fs/promises';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { findExecutable } from './hardening.mjs';

export class MediaError extends Error {}
export const maxUpload = 100_000_000;
const MB = 1_000_000;
const formats = {
  jpeg: ['image/jpeg', 'jpg'], png: ['image/png', 'png'], webp: ['image/webp', 'webp'],
  mp4: ['video/mp4', 'mp4'], mov: ['video/quicktime', 'mov'], webm: ['video/webm', 'webm'],
};
export const channelNames = { linkedin: 'LinkedIn', facebook: 'Pagina Facebook', instagram: 'Instagram', tiktok: 'TikTok' };
export const mediaHints = {
  linkedin: 'Facoltativo · JPG/PNG fino a 8 MB oppure MP4 fino a 100 MB',
  facebook: 'Facoltativo · JPG/PNG fino a 10 MB oppure MP4/MOV fino a 100 MB',
  instagram: 'Richiesto per pubblicare · JPG fino a 8 MB oppure Reel MP4/MOV fino a 100 MB',
  tiktok: 'Per esportare · JPG/WebP fino a 20 MB oppure MP4/MOV/WebM fino a 100 MB',
};

export function checkMedia(channel, media, required = false) {
  if (!media) {
    if (required && ['instagram', 'tiktok'].includes(channel)) throw new MediaError(`Aggiungi una foto o un video per ${channelNames[channel]}.`);
    return;
  }
  const { format, bytes, width, height, duration, fps, codec, audio, rotation, reel } = media;
  if (duration === null) {
    if (channel === 'tiktok') {
      if (!['jpeg', 'webp'].includes(format) || Math.min(width, height) > 1080 || bytes > 20 * MB) throw new MediaError('Per esportare su TikTok usa JPG/WebP fino a 20 MB con lato corto fino a 1080 px.');
      return;
    }
    const max = channel === 'facebook' ? 10 : 8;
    if (channel === 'instagram' && (format !== 'jpeg' || bytes > 8 * MB || width / height < 0.8 || width / height > 1.91)) throw new MediaError('Per Instagram usa JPG fino a 8 MB con rapporto da 4:5 a 1,91:1.');
    if (!['jpeg', 'png'].includes(format) || bytes > max * MB) throw new MediaError(`Usa JPG o PNG fino a ${max} MB.`);
    if (channel === 'linkedin' && width * height >= 36_152_320) throw new MediaError('Per LinkedIn usa un’immagine con meno di 36.152.320 pixel.');
    return;
  }
  if (channel === 'linkedin' && (format !== 'mp4' || codec !== 'h264' || duration < 3 || duration > 1800 || bytes < 75_000)) {
    throw new MediaError('Per LinkedIn usa MP4 H.264, almeno 75 KB, da 3 secondi a 30 minuti.');
  }
  if (channel === 'facebook' && (!['mp4', 'mov'].includes(format) || !['h264', 'hevc'].includes(codec))) throw new MediaError('Per Facebook usa MP4 o MOV in H.264 o H.265.');
  if (channel === 'instagram') {
    if (!['mp4', 'mov'].includes(format) || !['h264', 'hevc'].includes(codec) || duration < 3 || duration > 900 || fps < 23 || fps > 60 || width > 1920 || width / height < 0.01 || width / height > 10 || rotation !== 0) {
      throw new MediaError('Per i Reel usa MP4/MOV H.264 o H.265, da 3 s a 15 min, 23–60 fps, larghezza fino a 1920 px e rapporto da 0,01:1 a 10:1. Esporta il video già orientato.');
    }
    if (audio && (audio !== 'aac' || reel?.audioRate > 48_000 || reel?.audioChannels > 2)) throw new MediaError('Per l’audio dei Reel usa AAC fino a 48 kHz, mono o stereo. Meta indica 128 kbps.');
    if (reel && (!reel.fastStart || reel.editLists)) throw new MediaError('Per i Reel esporta con Fast Start (moov prima di mdat) e senza edit list.');
    if (reel && (!['yuv420p', 'yuvj420p', 'yuv420p10le', 'yuv420p10be', 'yuv420p12le', 'yuv420p12be'].includes(reel.pixelFormat) || (reel.fieldOrder && !['unknown', 'progressive'].includes(reel.fieldOrder)) || reel.videoBitrate > 25_000_000)) {
      throw new MediaError('Per i Reel usa video progressivo 4:2:0, GOP chiuso e bitrate video fino a 25 Mbps.');
    }
  }
  if (channel === 'tiktok') {
    const supported = format === 'webm' ? ['vp8', 'vp9'] : ['h264', 'hevc'];
    if (!supported.includes(codec) || duration > 600 || fps < 23 || fps > 60 || Math.min(width, height) < 360 || Math.max(width, height) > 4096) {
      throw new MediaError('Per TikTok usa MP4/MOV H.264 o H.265, oppure WebM VP8/VP9, fino a 10 min, 23–60 fps e lati tra 360 e 4096 px.');
    }
  }
}

async function reelContainer(path, bytes) {
  const file = await open(path, 'r');
  const header = Buffer.alloc(16);
  let count = 0;
  async function* boxes(start, end) {
    for (let pos = start; pos + 8 <= end;) {
      if (++count > 8192) throw new MediaError('Il contenitore video ha troppi elementi.');
      const { bytesRead } = await file.read(header, 0, Math.min(header.length, end - pos), pos);
      if (bytesRead < 8) throw new MediaError('Intestazione del video incompleta.');
      const len = header.readUInt32BE(0);
      const type = header.toString('ascii', 4, 8);
      const offset = len === 1 ? 16 : 8;
      if (bytesRead < offset) throw new MediaError('Intestazione del video incompleta.');
      const size = len === 1 ? Number(header.readBigUInt64BE(8)) : len || end - pos;
      if (size < offset || size > end - pos) throw new MediaError('Struttura del contenitore video non valida.');
      yield { type, start: pos + offset, end: pos + size };
      pos += size;
    }
  }
  try {
    let fastStart = false;
    let mediaData = false;
    let editLists = false;
    for await (const box of boxes(0, bytes)) {
      if (box.type === 'mdat') mediaData = true;
      if (box.type !== 'moov') continue;
      fastStart = !mediaData;
      for await (const track of boxes(box.start, box.end)) {
        if (track.type !== 'trak') continue;
        for await (const edit of boxes(track.start, track.end)) {
          if (edit.type !== 'edts') continue;
          for await (const entry of boxes(edit.start, edit.end)) if (entry.type === 'elst') editLists = true;
        }
      }
    }
    return { fastStart: fastStart && mediaData, editLists };
  } finally { await file.close(); }
}

function probe(path) {
  const formats = 'image2,jpeg_pipe,png_pipe,webp_pipe,mov,mp4,m4a,3gp,3g2,mj2,matroska,webm';
  const args = ['-v', 'error', '-protocol_whitelist', 'file', '-format_whitelist', formats, '-show_streams', '-show_format', '-of', 'json', '-i', path];
  return new Promise((resolve, reject) => {
    const program = findExecutable('ffprobe');
    if (!program) return reject(new MediaError('Per caricare media installa FFmpeg e rendi ffprobe disponibile nel PATH.'));
    const child = spawn(program, args, { stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 });
    let stdout = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > 128_000) child.kill(); });
    child.on('error', () => reject(new MediaError('Per caricare media installa FFmpeg e rendi ffprobe disponibile nel PATH.')));
    child.on('close', (code) => {
      if (code === 0) {
        try { return resolve(JSON.parse(stdout)); } catch { /* Invalid file. */ }
      }
      reject(new MediaError('File illeggibile o formato non supportato. Usa JPG, PNG, WebP, MP4, MOV o WebM.'));
    });
  });
}

async function inspectReel(path, bytes, video, audio) {
  return { ...await reelContainer(path, bytes), pixelFormat: video.pix_fmt, fieldOrder: video.field_order,
    videoBitrate: Number(video.bit_rate) || null, audioRate: Number(audio?.sample_rate) || null, audioChannels: audio?.channels ?? null };
}
const videoStream = (data) => data.streams?.find(stream => stream.codec_type === 'video' && !stream.disposition?.attached_pic);
const audioStream = (data) => data.streams?.find(stream => stream.codec_type === 'audio');

export async function verifyStoredReel(media) {
  if (media.reel || media.duration === null) return;
  const data = await probe(media.path);
  const video = videoStream(data);
  if (!video) throw new MediaError('Il file non contiene un video valido.');
  checkMedia('instagram', { ...media, reel: await inspectReel(media.path, media.bytes, video, audioStream(data)) });
}

async function isWebm(path) {
  const file = await open(path, 'r');
  const head = Buffer.alloc(64);
  try { await file.read(head); } finally { await file.close(); }
  return head.includes(Buffer.from([0x42, 0x82, 0x84, 0x77, 0x65, 0x62, 0x6d]));
}

export async function storeMedia(input, dir, channel, originalName) {
  const id = randomUUID();
  const temporary = join(dir, `${id}.part`);
  const path = join(dir, id);
  let bytes = 0;
  const limiter = new Transform({ transform(chunk, encoding, done) {
    bytes += chunk.length;
    done(bytes > maxUpload ? new MediaError('Il file supera 100 MB.') : null, chunk);
  } });
  try {
    await pipeline(input, limiter, createWriteStream(temporary, { flags: 'wx' }));
    const data = await probe(temporary);
    const video = videoStream(data);
    const audio = audioStream(data);
    if (!video?.width || !video?.height) throw new MediaError('Il file non contiene una foto o un video valido.');
    const demuxer = data.format.format_name.split(',');
    const iso = demuxer.includes('mov');
    const ebml = demuxer.includes('webm');
    const webm = ebml && await isWebm(temporary);
    const pictures = { mjpeg: 'jpeg', png: 'png', webp: 'webp' };
    const brand = data.format.tags?.major_brand?.trim();
    const format = webm ? 'webm' : iso ? (brand === 'qt' ? 'mov' : 'mp4') : pictures[video.codec_name];
    if (!Object.hasOwn(formats, format) || (ebml && !webm) || (iso && (!brand || /^(3g|m4a|mjp)/i.test(brand)))) throw new MediaError('Formato del file non compatibile.');
    const isVideo = iso || webm;
    const duration = isVideo ? Number(data.format.duration) : null;
    const [frames, seconds] = (video.avg_frame_rate || '0/1').split('/').map(Number);
    const fps = isVideo ? frames / seconds : null;
    if (isVideo && (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(fps) || fps <= 0)) throw new MediaError('Durata o frequenza dei fotogrammi non valida.');
    const rotation = Number(video.side_data_list?.find(item => item.rotation != null)?.rotation ?? 0);
    const [type, extension] = formats[format];
    const stem = originalName.replace(/\.[^.]*$/, '').replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'media';
    const media = { id, name: `${stem}.${extension}`, type, format, bytes, width: video.width, height: video.height, duration, fps, codec: video.codec_name, audio: audio?.codec_name, rotation };
    if (iso) media.reel = await inspectReel(temporary, bytes, video, audio);
    checkMedia(channel, media);
    await rename(temporary, path);
    return media;
  } finally { await rm(temporary, { force: true }); }
}

const storedName = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}(?:\.part)?$/;

/**
 * Removes uploads that no post or plan uses and that are older than the retention period:
 * replaced attachments, abandoned uploads, files without a database row and leftover .part files.
 * `used` is the set of media ids still referenced.
 */
export function pruneMedia(db, directory, used, retention = 86_400_000) {
  const cutoff = Date.now() - retention;
  const old = (name) => {
    try { return statSync(join(directory, name)).mtimeMs < cutoff; } catch { return true; }
  };
  const known = new Set();
  for (const { id } of db.prepare('SELECT id FROM media').all()) {
    known.add(id);
    if (used.has(id) || !old(id)) continue;
    db.prepare('DELETE FROM media WHERE id = ?').run(id);
    rmSync(join(directory, id), { force: true });
  }
  for (const name of readdirSync(directory)) {
    if (!known.has(name) && storedName.test(name) && old(name)) rmSync(join(directory, name), { force: true });
  }
}

export function sendMedia(res, metadata, file, range, attachment = false) {
  const headers = { 'Content-Type': metadata.type, 'Accept-Ranges': 'bytes', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
  if (attachment) headers['Content-Disposition'] = `attachment; filename="${metadata.name}"`;
  let start = 0;
  let end = metadata.bytes - 1;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match?.[1]) {
      start = Number(match[1]);
      if (match[2]) end = Math.min(Number(match[2]), end);
    } else if (match?.[2]) start = Math.max(0, metadata.bytes - Number(match[2]));
    else start = metadata.bytes;
    if (start > end) {
      res.writeHead(416, { 'Content-Range': `bytes */${metadata.bytes}` });
      return res.end();
    }
    headers['Content-Range'] = `bytes ${start}-${end}/${metadata.bytes}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(range ? 206 : 200, headers);
  if (res.req.method === 'HEAD') return res.end();
  const stream = createReadStream(file, { start, end });
  stream.on('error', () => res.destroy());
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}
