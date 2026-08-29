const COBALT = 'https://zestful-contentment-production-c014.up.railway.app/';
const RAPID_HOST = 'social-download-all-in-one.p.rapidapi.com';
const RAPID_ENDPOINT = `https://${RAPID_HOST}/v1/social/autolink`;

async function rapidResolve(url) {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return null;

  const r = await fetch(RAPID_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-rapidapi-host': RAPID_HOST,
      'x-rapidapi-key': key
    },
    body: JSON.stringify({ url })
  });

  if (!r.ok) return null;
  const data = await r.json();

  const candidates = [
    data?.url,
    data?.video,
    data?.videoUrl,
    data?.downloadUrl,
    data?.medias?.find?.(x => x?.url)?.url,
    data?.media?.find?.(x => x?.url)?.url,
    data?.links?.find?.(x => x?.url)?.url
  ].filter(Boolean);

  if (!candidates.length) return null;
  return {
    mediaUrl: candidates[0],
    filename: data?.filename || data?.title || `Vault-${Date.now()}.mp4`
  };
}

async function cobaltResolve(url) {
  const cr = await fetch(COBALT, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      videoQuality: '1080',
      downloadMode: 'auto',
      youtubeVideoCodec: 'h264',
      youtubeVideoContainer: 'mp4',
      alwaysProxy: true
    })
  });
  const data = await cr.json();
  if (!cr.ok || data.status === 'error') return null;

  let mediaUrl;
  let filename = data.filename || `Vault-${Date.now()}.mp4`;
  if (data.status === 'tunnel' || data.status === 'redirect') mediaUrl = data.url;
  else if (data.status === 'picker') {
    const item = data.picker?.find(x => x.type === 'video') || data.picker?.[0];
    mediaUrl = item?.url;
    filename = item?.filename || filename;
  }
  return mediaUrl ? { mediaUrl, filename } : null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const url = req.body?.url;
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Enter a valid URL' });

  try {
    // RapidAPI is the primary resolver for supported/permitted sources.
    // Cobalt remains as a fallback so existing supported links keep working.
    let resolved = await rapidResolve(url);
    if (!resolved) resolved = await cobaltResolve(url);
    if (!resolved?.mediaUrl) return res.status(400).json({ error: 'No downloadable media returned for this link' });

    const mr = await fetch(resolved.mediaUrl, { redirect: 'follow' });
    if (!mr.ok || !mr.body) return res.status(502).json({ error: `Media fetch failed (${mr.status})` });
    const len = mr.headers.get('content-length');
    if (len === '0') return res.status(502).json({ error: 'Empty video returned' });

    res.statusCode = 200;
    res.setHeader('Content-Type', mr.headers.get('content-type') || 'video/mp4');
    if (len) res.setHeader('Content-Length', len);
    res.setHeader('X-Vault-Filename', encodeURIComponent(String(resolved.filename).replace(/[\r\n]/g, ' ')));

    const reader = mr.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    console.error('resolve failed', e);
    if (!res.headersSent) res.status(500).json({ error: 'Server download failed' });
    else res.end();
  }
};
