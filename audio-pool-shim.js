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
    this._pool=Array.from({length:4},()=>{
      const a=new NativeAudio(src);
      a.preload='auto';
      a.addEventListener('ended',()=>{try{a.currentTime=0}catch{}});
      return a;
    });
  }
  get paused(){return this._pool.every(a=>a.paused)}
  get ended(){return this._pool.every(a=>a.ended)}
  get currentTime(){return this._currentTime}
  set currentTime(v){this._currentTime=Number(v)||0}
  load(){for(const a of this._pool){try{a.load()}catch{}}}
  pause(){/* intentionally no-op: never interrupt an in-flight SE */}
  play(){
    const a=this._pool.find(x=>x.paused||x.ended);
    if(!a)return Promise.resolve();
    try{
      if(a.ended){try{a.currentTime=0}catch{}}
      a.volume=this.volume;
      a.playbackRate=this.playbackRate;
      return a.play();
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
