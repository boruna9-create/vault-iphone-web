const COBALT='https://zestful-contentment-production-c014.up.railway.app/';
module.exports=async function handler(req,res){
  if(req.method!=='POST') return res.status(405).json({error:'Method not allowed'});
  const url=req.body?.url;
  if(!url||!/^https?:\/\//i.test(url)) return res.status(400).json({error:'Enter a valid URL'});
  try{
    const cr=await fetch(COBALT,{method:'POST',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({url,videoQuality:'1080',downloadMode:'auto',youtubeVideoCodec:'h264',youtubeVideoContainer:'mp4',alwaysProxy:true})});
    const data=await cr.json();
    if(!cr.ok||data.status==='error') return res.status(400).json({error:data?.error?.code||'Cobalt could not process this link'});
    let mediaUrl,filename=data.filename||`Vault-${Date.now()}.mp4`;
    if(data.status==='tunnel'||data.status==='redirect') mediaUrl=data.url;
    else if(data.status==='picker'){
      const item=data.picker?.find(x=>x.type==='video')||data.picker?.[0];
      mediaUrl=item?.url; filename=item?.filename||filename;
    } else return res.status(400).json({error:`Unsupported response: ${data.status}`});
    if(!mediaUrl) return res.status(400).json({error:'No video returned'});
    const mr=await fetch(mediaUrl,{redirect:'follow'});
    if(!mr.ok||!mr.body) return res.status(502).json({error:`Media fetch failed (${mr.status})`});
    const len=mr.headers.get('content-length');
    if(len==='0') return res.status(502).json({error:'Empty video returned'});
    res.statusCode=200;
    res.setHeader('Content-Type',mr.headers.get('content-type')||'video/mp4');
    if(len) res.setHeader('Content-Length',len);
    res.setHeader('X-Vault-Filename',encodeURIComponent(filename));
    const reader=mr.body.getReader();
    while(true){const {done,value}=await reader.read();if(done)break;res.write(Buffer.from(value))}
    res.end();
  }catch(e){if(!res.headersSent)res.status(500).json({error:'Server download failed'});else res.end()}
};
