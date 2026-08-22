(()=>{
'use strict';
const NativeAudio=window.Audio;
if(!NativeAudio)return;

class PooledSeAudio{
  constructor(src){
    this.src=src;
    this.preload='auto';
    this.volume=1;
    this.playbackRate=1;
    this._currentTime=0;
    this._warmed=false;
    this._pool=Array.from({length:4},()=>{
      const a=new NativeAudio(src);
      a.preload='auto';
      a.playsInline=true;
      a.addEventListener('ended',()=>{try{a.currentTime=0}catch{}});
      try{a.load()}catch{}
      return a;
    });
  }
  get paused(){return this._pool.every(a=>a.paused)}
  get ended(){return this._pool.every(a=>a.ended)}
  get currentTime(){return this._currentTime}
  set currentTime(v){this._currentTime=Number(v)||0}
  load(){for(const a of this._pool){try{a.load()}catch{}}}
  pause(){
    // app.js calls pause()+currentTime=0 before every SE.
    // Keep those calls cheap during gameplay; only actually stop muted warm-up voices.
    if(this.volume>.002)return;
    for(const a of this._pool){
      try{a.pause();a.currentTime=0}catch{}
    }
  }
  async _warmPool(){
    if(this._warmed)return;
    this._warmed=true;
    const tasks=this._pool.map(async a=>{
      const oldVol=a.volume;
      try{
        a.volume=0.001;
        a.playbackRate=1;
        const p=a.play();
        if(p?.then)await p;
      }catch{}
      try{a.pause();a.currentTime=0}catch{}
      a.volume=oldVol;
    });
    await Promise.allSettled(tasks);
  }
  play(){
    // START-time unlock path: app temporarily sets volume to 0.001.
    // Warm every pooled voice here so later hits do not trigger first-use decode work.
    if(this.volume<=.002)return this._warmPool();

    const a=this._pool.find(x=>x.paused&&x.currentTime===0) || this._pool.find(x=>x.ended);
    if(!a)return Promise.resolve();
    try{
      // Reset only after the previous playback has already ended, never on the hit hot path.
      if(a.ended){try{a.currentTime=0}catch{}}
      a.volume=this.volume;
      a.playbackRate=this.playbackRate;
      const p=a.play();
      return p&&typeof p.then==='function'?p:Promise.resolve();
    }catch(e){return Promise.reject(e)}
  }
  addEventListener(...args){for(const a of this._pool)a.addEventListener(...args)}
  removeEventListener(...args){for(const a of this._pool)a.removeEventListener(...args)}
}

function PuniAudio(src){
  if(typeof src==='string'&&src.startsWith('blob:'))return new PooledSeAudio(src);
  return new NativeAudio(src);
}
PuniAudio.prototype=NativeAudio.prototype;
window.Audio=PuniAudio;
})();
