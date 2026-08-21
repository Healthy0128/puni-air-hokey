(()=>{
'use strict';
// Keep Safari's native Audio/AudioContext objects untouched.
// The game itself creates and resumes its AudioContext synchronously from START.
// Only retry media playback after a real user gesture; this helps BGM on iOS
// without interfering with Web Audio sound effects.
const trackedAudio=new Set();
const NativeAudio=window.Audio;
if(!NativeAudio)return;
function PuniAudio(src){
  const a=new NativeAudio(src);
  trackedAudio.add(a);
  const nativePlay=a.play.bind(a);
  const nativePause=a.pause.bind(a);
  a.__puniNativePlay=nativePlay;
  a.__puniWantsPlay=false;
  a.play=(...args)=>{a.__puniWantsPlay=true;return nativePlay(...args)};
  a.pause=(...args)=>{a.__puniWantsPlay=false;return nativePause(...args)};
  return a;
}
PuniAudio.prototype=NativeAudio.prototype;
window.Audio=PuniAudio;
function retryMedia(){
  trackedAudio.forEach(a=>{
    if(a.__puniWantsPlay&&a.paused&&!a.ended&&a.__puniNativePlay){
      a.__puniNativePlay().catch(()=>{});
    }
  });
}
document.addEventListener('click',retryMedia,false);
document.addEventListener('pointerup',retryMedia,false);
document.addEventListener('touchend',retryMedia,{passive:true});
window.addEventListener('keydown',retryMedia,false);
})();
