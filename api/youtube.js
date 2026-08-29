module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return res.status(500).json({ error: 'YOUTUBE_API_KEY is not configured' });

  const q = String(req.query?.q || '').trim();
  if (!q) return res.status(400).json({ error: 'Enter a YouTube search' });

  try {
    const params = new URLSearchParams({
      part: 'snippet',
      type: 'video',
      maxResults: '10',
      safeSearch: 'moderate',
      q,
      key
    });
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || 'YouTube API request failed' });

    const videos = (data.items || []).map(item => ({
      id: item.id?.videoId,
      title: item.snippet?.title,
      channel: item.snippet?.channelTitle,
      thumbnail: item.snippet?.thumbnails?.medium?.url || item.snippet?.thumbnails?.default?.url,
      publishedAt: item.snippet?.publishedAt,
      watchUrl: item.id?.videoId ? `https://www.youtube.com/watch?v=${item.id.videoId}` : null
    })).filter(v => v.id);

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ videos });
  } catch (e) {
    return res.status(500).json({ error: 'YouTube search failed' });
  }
};
