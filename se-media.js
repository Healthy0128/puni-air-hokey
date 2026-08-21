(()=>{
'use strict';
const SR=22050;
function wavURL(kind){
  let dur=kind==='goal'?.62:kind==='smash'?.22:.13,n=Math.floor(SR*dur),s=new Float32Array(n);
  const env=(t,a=.004,p=2.2)=>t<a?t/a:Math.pow(Math.max(0,1-(t-a)/(dur-a)),p);
  if(kind==='goal'){
    const notes=[[523.25,0],[659.25,.10],[783.99,.20],[1046.5,.31]];
    for(const [f,st] of notes){for(let j=0;j<SR*.28;j++){let i=Math.floor((st+j/SR)*SR);if(i>=n)break;let t=j/SR,e=t<.003?t/.003:Math.pow(Math.max(0,1-(t-.003)/.277),2.3);s[i]+=(.55*Math.sin(2*Math.PI*f*t)+.15*Math.sin(4*Math.PI*f*t))*e}}
  }else if(kind==='smash'){
    for(let i=0;i<n;i++){let t=i/SR,e=env(t,.002,1.8),k=(240-90)/dur,ph=2*Math.PI*(240*t-.5*k*t*t);s[i]=(.8*Math.sin(ph)+.28*Math.sin(2*ph))*e+(t<.025?(Math.random()*2-1)*.10*(1-t/.025):0)}
  }else{
    for(let i=0;i<n;i++){let t=i/SR,e=env(t,.003,2.6),ph=2*Math.PI*(520*t-125*t*t/dur);s[i]=(.72*Math.sin(ph)+.22*Math.sin(ph*.5))*e+(t<.018?(Math.random()*2-1)*.04*(1-t/.018):0)}
  }
  let buf=new ArrayBuffer(44+n*2),v=new DataView(buf),w=(o,x)=>{for(let i=0;i<x.length;i++)v.setUint8(o+i,x.charCodeAt(i))};
  w(0,'RIFF');v.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);w(36,'data');v.setUint32(40,n*2,true);
  for(let i=0;i<n;i++)v.setInt16(44+i*2,Math.max(-32767,Math.min(32767,s[i]*27000)),true);
  return URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
}
const sounds={};
for(const kind of ['hit','smash','goal']){
  const a=new Audio(wavURL(kind));
  a.preload='auto';a.playsInline=true;a.volume=kind==='goal'?.78:kind==='smash'?.72:.62;
  sounds[kind]=a;
}
function sfxOn(){try{return JSON.parse(localStorage.getItem('puniSettings')||'{}').sfx!==false}catch{return true}}
let unlocked=false;
function unlock(){
  if(unlocked)return;
  unlocked=true;
  for(const a of Object.values(sounds)){
    const vol=a.volume;a.volume=.001;
    try{const p=a.play();p?.then?.(()=>{a.pause();a.currentTime=0;a.volume=vol}).catch(()=>{a.volume=vol})}catch{a.volume=vol}
  }
}
document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
document.addEventListener('touchstart',unlock,{capture:true,passive:true});
document.addEventListener('click',unlock,{capture:true,passive:true});
let last=0;
window.PuniSE={play(kind='hit',power=1){
  if(!sfxOn())return;
  const now=performance.now();if(kind!=='goal'&&now-last<24)return;last=now;
  const a=sounds[kind]||sounds.hit;
  try{a.pause();a.currentTime=0;a.playbackRate=kind==='hit'?Math.max(.9,Math.min(1.22,.94+power*.04)):1;const p=a.play();p?.catch?.(()=>{})}catch{}
}};
})();
