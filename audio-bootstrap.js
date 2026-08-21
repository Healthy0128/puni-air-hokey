(()=>{
'use strict';
const trackedAudio=new Set();
const nativeAudio=window.Audio;
if(nativeAudio){
  function PuniAudio(src){
    const a=new nativeAudio(src);
    trackedAudio.add(a);
    const nativePlay=a.play.bind(a),nativePause=a.pause.bind(a),nativeLoad=a.load.bind(a);
    a.__puniNativePlay=nativePlay;
    a.__puniWantsPlay=false;
    a.play=(...args)=>{a.__puniWantsPlay=true;return nativePlay(...args)};
    a.pause=(...args)=>{a.__puniWantsPlay=false;return nativePause(...args)};
    a.load=(...args)=>{
      const r=nativeLoad(...args);
      if(a.loop&&a.src){
        a.__puniWantsPlay=true;
        nativePlay().catch(()=>{});
      }
      return r;
    };
    return a;
  }
  PuniAudio.prototype=nativeAudio.prototype;
  window.Audio=PuniAudio;
}
const contexts=new Set();
const NativeAC=window.AudioContext||window.webkitAudioContext;
if(NativeAC){
  class PuniAudioContext extends NativeAC{
    constructor(...args){super(...args);contexts.add(this)}
  }
  window.AudioContext=PuniAudioContext;
  if(window.webkitAudioContext)window.webkitAudioContext=PuniAudioContext;
}
function unlockAll(){
  contexts.forEach(ctx=>{if(ctx.state==='suspended')ctx.resume().catch(()=>{})});
  trackedAudio.forEach(a=>{
    if(a.__puniWantsPlay&&a.paused&&!a.ended&&a.__puniNativePlay)a.__puniNativePlay().catch(()=>{});
  });
}
function afterGesture(){setTimeout(unlockAll,0)}
document.addEventListener('click',afterGesture,false);
document.addEventListener('pointerup',afterGesture,false);
document.addEventListener('touchend',afterGesture,{passive:true});
window.addEventListener('keydown',afterGesture,false);
})();
