const {spawnSync}=require('node:child_process');
const {fetch:networkFetch,ProxyAgent}=require('undici');
let dispatcher;
let configured=false;
function systemProxy() {
  const explicit=process.env.ISU_HTTPS_PROXY||process.env.HTTPS_PROXY||process.env.https_proxy||process.env.HTTP_PROXY||process.env.http_proxy;
  if(explicit)return explicit;
  if(process.platform!=='win32')return null;
  const key='HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings';
  const enabled=spawnSync('reg.exe',['query',key,'/v','ProxyEnable'],{encoding:'utf8',windowsHide:true}).stdout||'';
  if(!/REG_DWORD\s+0x1\b/.test(enabled))return null;
  const output=spawnSync('reg.exe',['query',key,'/v','ProxyServer'],{encoding:'utf8',windowsHide:true}).stdout||'';
  const server=output.match(/ProxyServer\s+REG_SZ\s+([^\r\n]+)/)?.[1]?.trim();
  if(!server)return null;
  const address=server.includes('=')?server.split(';').find(s=>s.startsWith('https='))?.slice(6)||server.split(';').find(s=>s.startsWith('http='))?.slice(5):server;
  return address ? (/^https?:\/\//.test(address)?address:'http://'+address) : null;
}
function isuFetch(url,options) {
  if(!configured){const proxy=systemProxy();if(proxy)dispatcher=new ProxyAgent(proxy);configured=true;}
  return networkFetch(url,{...options,...(dispatcher?{dispatcher}:{})});
}
module.exports={isuFetch};
