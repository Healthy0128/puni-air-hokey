(()=>{
'use strict';
const SR=8000,DUR=0.5,N=SR*DUR,buf=new ArrayBuffer(44+N*2),v=new DataView(buf);
const txt=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
txt(0,'RIFF');v.setUint32(4,36+N*2,true);txt(8,'WAVE');txt(12,'fmt ');
v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SR,true);v.setUint32(28,SR*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);txt(36,'data');v.setUint32(40,N*2,true);
for(let i=0;i<N;i++)v.setInt16(44+i*2,(i&1)?1:-1,true);
const url=URL.createObjectURL(new Blob([buf],{type:'audio/wav'}));
const carrier=new Audio(url);carrier.loop=true;carrier.preload='auto';carrier.playsInline=true;carrier.volume=1;
let active=false;
function start(){if(active)return;active=true;try{carrier.currentTime=0}catch{};carrier.play().catch(()=>{active=false})}
function stop(){if(!active)return;active=false;try{carrier.pause();carrier.currentTime=0}catch{}}
window.PuniAudioSession={start,stop};
for(const id of ['startBtn','restartBtn','againBtn','resumeBtn'])document.getElementById(id)?.addEventListener('pointerdown',start,{capture:true,passive:true});
for(const id of ['titleBtn','resultTitleBtn'])document.getElementById(id)?.addEventListener('pointerdown',stop,{capture:true,passive:true});
window.addEventListener('pagehide',stop);
})();
