(()=>{
'use strict';

const $ = (selector) => document.querySelector(selector);
const canvas = $('#c');
const ctx = canvas.getContext('2d');
const titleScreen = $('#title');
const gameScreen = $('#game');
const toast = $('#toast');

const FIXED_DT = 1 / 120;
const MAX_FRAME = 0.05;
const MAX_STEPS = 8;
const PHASE = Object.freeze({ TITLE: 'title', PLAYING: 'playing', GOAL: 'goal', GAME_OVER: 'game-over' });

let settings = { bgm: true, sfx: true, points: 5 };
try { settings = { ...settings, ...JSON.parse(localStorage.getItem('puniSettings') || '{}') }; } catch {}

const state = {
  running: false, paused: false, phase: PHASE.TITLE, rafId: null, resultTimer: null,
  last: 0, accumulator: 0, width: 1, height: 1, dpr: 1, score: [0, 0], win: 5,
  roundWait: 0, hitstop: 0, shake: 0, flash: 0, particles: [], trail: [],
};

const players = [0, 1].map((i) => ({
  i, x: 0, y: 0, tx: 0, ty: 0, vx: 0, vy: 0, inputVx: 0, inputVy: 0, inputTime: 0,
  pointerId: null, r: 44, mass: 2.8, squash: 0, squashV: 0, face: 0, gauge: 0, burst: 0,
  touchingPuck: false, gaugeCooldown: 0,
  color: i ? '#ff6fae' : '#4cc9ff', dark: i ? '#d73778' : '#168ed6',
}));
const puck = { x: 0, y: 0, vx: 0, vy: 0, r: 20, mass: 1, spin: 0, boost: 0 };
const keys = new Set();

class AudioManager {
  constructor() {
    this.bgm = new Audio('./assets/audio/bgm/mahou-no-cooking.mp3');
    this.bgm.loop = true;
    this.bgm.preload = 'auto';
    this.bgm.volume = 0.28;
    this.unlocked = false;
    this.lastHitAt = 0;
    this.lastWallAt = 0;
    this.se = {
      hit: this.makeSe('hit', 0.56),
      smash: this.makeSe('smash', 0.68),
      goal: this.makeSe('goal', 0.72),
    };
  }

  makeSe(kind, volume) {
    const audio = new Audio(this.makeWavUrl(kind));
    audio.preload = 'auto';
    audio.volume = volume;
    return audio;
  }

  makeWavUrl(kind) {
    const sampleRate = 22050;
    const duration = kind === 'goal' ? 0.62 : kind === 'smash' ? 0.22 : 0.13;
    const count = Math.floor(sampleRate * duration);
    const samples = new Float32Array(count);
    const envelope = (t, attack = 0.004, power = 2.2) => t < attack ? t / attack : Math.pow(Math.max(0, 1 - (t - attack) / (duration - attack)), power);

    if (kind === 'goal') {
      const notes = [[523.25, 0], [659.25, 0.10], [783.99, 0.20], [1046.5, 0.31]];
      for (const [frequency, start] of notes) {
        for (let j = 0; j < sampleRate * 0.28; j++) {
          const index = Math.floor((start + j / sampleRate) * sampleRate);
          if (index >= count) break;
          const t = j / sampleRate;
          const e = t < 0.003 ? t / 0.003 : Math.pow(Math.max(0, 1 - (t - 0.003) / 0.277), 2.3);
          samples[index] += (0.55 * Math.sin(2 * Math.PI * frequency * t) + 0.15 * Math.sin(4 * Math.PI * frequency * t)) * e;
        }
      }
    } else if (kind === 'smash') {
      for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        const e = envelope(t, 0.002, 1.8);
        const sweep = (240 - 90) / duration;
        const phase = 2 * Math.PI * (240 * t - 0.5 * sweep * t * t);
        const noise = t < 0.025 ? (Math.random() * 2 - 1) * 0.10 * (1 - t / 0.025) : 0;
        samples[i] = (0.8 * Math.sin(phase) + 0.28 * Math.sin(2 * phase)) * e + noise;
      }
    } else {
      for (let i = 0; i < count; i++) {
        const t = i / sampleRate;
        const e = envelope(t, 0.003, 2.6);
        const phase = 2 * Math.PI * (520 * t - 125 * t * t / duration);
        const noise = t < 0.018 ? (Math.random() * 2 - 1) * 0.04 * (1 - t / 0.018) : 0;
        samples[i] = (0.72 * Math.sin(phase) + 0.22 * Math.sin(phase * 0.5)) * e + noise;
      }
    }

    const buffer = new ArrayBuffer(44 + count * 2);
    const view = new DataView(buffer);
    const writeText = (offset, text) => { for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i)); };
    writeText(0, 'RIFF'); view.setUint32(4, 36 + count * 2, true); writeText(8, 'WAVE'); writeText(12, 'fmt ');
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true); view.setUint32(28, sampleRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    writeText(36, 'data'); view.setUint32(40, count * 2, true);
    for (let i = 0; i < count; i++) view.setInt16(44 + i * 2, Math.max(-32767, Math.min(32767, samples[i] * 27000)), true);
    return URL.createObjectURL(new Blob([buffer], { type: 'audio/wav' }));
  }

  unlock() {
    if (!this.unlocked) {
      this.unlocked = true;
      for (const audio of Object.values(this.se)) {
        const volume = audio.volume;
        audio.volume = 0.001;
        const play = audio.play();
        play?.then(() => { audio.pause(); audio.currentTime = 0; audio.volume = volume; }).catch(() => { audio.volume = volume; });
      }
    }
    if (settings.bgm) this.playBgm();
  }

  playBgm() { if (settings.bgm) this.bgm.play().catch(() => {}); }
  stopBgm() { this.bgm.pause(); }
  resume() { if (settings.bgm) this.playBgm(); }
  setBgmEnabled(enabled) { if (enabled) { this.unlock(); this.playBgm(); } else this.stopBgm(); }

  duck(amount = 0.35, ms = 300) {
    if (!settings.bgm || this.bgm.paused) return;
    this.bgm.volume = 0.28 * (1 - amount);
    setTimeout(() => { this.bgm.volume = 0.28; }, ms);
  }

  playSe(kind = 'hit', power = 1) {
    if (!settings.sfx) return;
    const now = performance.now();
    if (kind === 'hit' && now - this.lastHitAt < 24) return;
    if (kind === 'wall' && now - this.lastWallAt < 30) return;
    if (kind === 'wall') { this.lastWallAt = now; kind = 'hit'; power = 0.45; }
    else if (kind === 'hit') this.lastHitAt = now;

    const audio = this.se[kind] || this.se.hit;
    try {
      audio.pause();
      audio.currentTime = 0;
      audio.playbackRate = kind === 'hit' ? Math.max(0.9, Math.min(1.22, 0.94 + power * 0.04)) : 1;
      audio.play().catch(() => {});
    } catch {}
    if (kind === 'smash') this.duck(0.20, 220);
    if (kind === 'goal') this.duck(0.52, 650);
  }
}
const audio = new AudioManager();

function saveSettings() { try { localStorage.setItem('puniSettings', JSON.stringify(settings)); } catch {} syncUI(); }
function syncUI() {
  for (const [id, key] of [['#bgmToggle', 'bgm'], ['#sfxToggle', 'sfx']]) {
    const element = $(id); if (!element) continue;
    element.classList.toggle('on', settings[key]); element.textContent = settings[key] ? 'ON' : 'OFF';
  }
  if ($('#pointsSelect')) $('#pointsSelect').value = String(settings.points);
  state.win = +settings.points || 5;
  syncSpecialUI();
}
function syncScoreUI() { $('#s1').textContent = state.score[0]; $('#s2').textContent = state.score[1]; }
function playerRadius(player) { return player.r * (player.burst ? 1.34 : 1); }
function playerMass(player) { return player.mass * (player.burst ? 1.7 : 1); }
function syncSpecialUI() {
  players.forEach((player, i) => {
    const fill = $('#specialFill' + (i + 1)), button = $('#specialBtn' + (i + 1)), text = $('#specialText' + (i + 1));
    if (fill) fill.style.transform = `scaleX(${player.gauge / 100})`;
    if (text) text.textContent = player.burst ? `BURST ${player.burst.toFixed(1)}s` : player.gauge >= 100 ? 'READY!' : `${player.gauge | 0}%`;
    if (button) {
      const ready = player.gauge >= 100 && !player.burst && state.running && !state.paused && state.phase === PHASE.PLAYING;
      button.disabled = !ready; button.classList.toggle('ready', ready); button.classList.toggle('active-special', !!player.burst);
    }
  });
}
function addGauge(player, amount) { if (!player.burst) player.gauge = Math.min(100, player.gauge + amount); }
function say(text) { toast.textContent = text; toast.classList.remove('pop'); void toast.offsetWidth; toast.classList.add('pop'); }
function hideOverlays() { document.querySelectorAll('.overlay').forEach((overlay) => overlay.classList.remove('show')); }
function clearResultTimer() { if (state.resultTimer !== null) { clearTimeout(state.resultTimer); state.resultTimer = null; } }

function resetRound(resetGauge = false) {
  players[0].x = state.width * 0.5; players[0].y = state.height * 0.78;
  players[1].x = state.width * 0.5; players[1].y = state.height * 0.22;
  players.forEach((player) => {
    player.tx = player.x; player.ty = player.y; player.vx = player.vy = 0; player.inputVx = player.inputVy = 0;
    player.pointerId = null; player.squash = player.squashV = 0; player.face = 0; player.burst = 0;
    player.touchingPuck = false; player.gaugeCooldown = 0; if (resetGauge) player.gauge = 0;
  });
  puck.x = state.width / 2; puck.y = state.height / 2; puck.vx = (Math.random() - 0.5) * 160; puck.vy = (Math.random() > 0.5 ? 1 : -1) * 200;
  puck.spin = 0; puck.boost = 0; state.accumulator = 0; state.hitstop = 0; state.roundWait = 0; syncSpecialUI();
}
function resetMatch() { state.score = [0, 0]; syncScoreUI(); resetRound(true); }

function startGame() {
  audio.unlock(); clearResultTimer(); hideOverlays(); stopLoop();
  state.running = true; state.paused = false; state.phase = PHASE.PLAYING;
  titleScreen.classList.remove('active'); gameScreen.classList.add('active');
  resize(); resetMatch(); say('READY!'); startLoop();
}
function restartGame() {
  audio.unlock(); clearResultTimer(); hideOverlays(); state.running = true; state.paused = false; state.phase = PHASE.PLAYING;
  resetMatch(); say('READY!'); startLoop();
}
function goHome() {
  clearResultTimer(); stopLoop(); state.running = false; state.paused = false; state.phase = PHASE.TITLE; keys.clear(); hideOverlays();
  gameScreen.classList.remove('active'); titleScreen.classList.add('active');
}
function pauseGame() {
  if (!state.running || state.paused || state.phase === PHASE.GAME_OVER) return;
  state.paused = true; $('#pauseOverlay').classList.add('show'); syncSpecialUI();
}
function resumeGame() {
  if (!state.running || state.phase === PHASE.GAME_OVER) return;
  state.paused = false; $('#pauseOverlay').classList.remove('show'); state.last = performance.now(); audio.resume(); syncSpecialUI();
}

function awardGoal(winner) {
  if (state.phase !== PHASE.PLAYING) return false;
  state.phase = PHASE.GOAL;
  state.accumulator = 0;
  state.roundWait = 0.72;
  state.score[winner] += 1;
  addGauge(players[winner], 8); addGauge(players[1 - winner], 18); syncScoreUI();
  audio.playSe('goal'); state.shake = 1; state.flash = 1;
  players.forEach((player) => { player.touchingPuck = false; player.gaugeCooldown = 0.2; });
  particles(puck.x, winner ? state.height - 18 : 18, winner ? '#ff6fae' : '#4cc9ff', 36);
  say('GOAL!'); syncSpecialUI();

  if (state.score[winner] >= state.win) {
    state.phase = PHASE.GAME_OVER; state.roundWait = 0; state.paused = true; clearResultTimer();
    state.resultTimer = setTimeout(() => {
      if (!state.running || state.phase !== PHASE.GAME_OVER) return;
      $('#resultTitle').textContent = (winner ? 'PINK（奥）' : 'BLUE（手前）') + ' WIN!';
      $('#resultScore').textContent = state.score[0] + ' - ' + state.score[1];
      $('#resultOverlay').classList.add('show'); state.resultTimer = null;
    }, 450);
  }
  return true;
}

function resize() {
  const viewport = window.visualViewport;
  state.dpr = Math.min(2, devicePixelRatio || 1);
  state.width = Math.max(1, Math.round(viewport?.width || innerWidth)); state.height = Math.max(1, Math.round(viewport?.height || innerHeight));
  canvas.width = Math.round(state.width * state.dpr); canvas.height = Math.round(state.height * state.dpr);
  canvas.style.width = state.width + 'px'; canvas.style.height = state.height + 'px'; ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
  const q = Math.min(state.width, state.height);
  players.forEach((player) => { player.r = Math.min(62, Math.max(32, q * 0.085)); }); puck.r = Math.max(14, q * 0.034);
  if (state.running) players.forEach(clampPlayer); else resetRound(false);
}
function clampPlayer(player) {
  const r = playerRadius(player), pad = r + 9, mid = state.height / 2, overlap = -2;
  const minY = player.i ? pad : mid + overlap + r, maxY = player.i ? mid - overlap - r : state.height - pad;
  player.x = Math.max(pad, Math.min(state.width - pad, player.x)); player.y = Math.max(minY, Math.min(maxY, player.y));
  player.tx = Math.max(pad, Math.min(state.width - pad, player.tx)); player.ty = Math.max(minY, Math.min(maxY, player.ty));
}

function onPointerDown(event) {
  if (!state.running || state.paused || state.phase !== PHASE.PLAYING) return;
  event.preventDefault(); const index = event.clientY >= state.height / 2 ? 0 : 1, player = players[index]; if (player.pointerId !== null) return;
  player.pointerId = event.pointerId; player.tx = event.clientX; player.ty = event.clientY; player.inputVx = player.inputVy = 0;
  player.inputTime = event.timeStamp || performance.now(); try { canvas.setPointerCapture(event.pointerId); } catch {}
}
function onPointerMove(event) {
  const player = players.find((item) => item.pointerId === event.pointerId); if (!player || state.paused || state.phase !== PHASE.PLAYING) return;
  event.preventDefault(); const now = event.timeStamp || performance.now();
  const dt = Math.max(0.004, Math.min(0.05, (now - player.inputTime) / 1000 || 0.016));
  let vx = (event.clientX - player.tx) / dt, vy = (event.clientY - player.ty) / dt;
  const speed = Math.hypot(vx, vy), scale = speed > 3300 ? 3300 / speed : 1;
  player.inputVx = vx * scale; player.inputVy = vy * scale; player.tx = event.clientX; player.ty = event.clientY; player.inputTime = now; clampPlayer(player);
}
function onPointerUp(event) {
  const player = players.find((item) => item.pointerId === event.pointerId); if (!player) return;
  player.pointerId = null; player.inputVx = player.inputVy = 0;
  try { if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch {}
}
function applyKeyboard(dt) {
  const map = [['KeyA', 'KeyD', 'KeyW', 'KeyS'], ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']];
  const speed = Math.max(480, Math.min(1050, Math.min(state.width, state.height) * 1.3));
  players.forEach((player, i) => {
    if (player.pointerId !== null) return;
    const [left, right, up, down] = map[i];
    const dx = (keys.has(right) ? 1 : 0) - (keys.has(left) ? 1 : 0), dy = (keys.has(down) ? 1 : 0) - (keys.has(up) ? 1 : 0);
    player.inputVx = player.inputVy = 0; if (!dx && !dy) return;
    const length = Math.hypot(dx, dy); player.inputVx = dx / length * speed; player.inputVy = dy / length * speed;
    player.tx += player.inputVx * dt; player.ty += player.inputVy * dt; clampPlayer(player);
  });
}
function activateBurst(index) {
  const player = players[index];
  if (!state.running || state.paused || state.phase !== PHASE.PLAYING || player.burst || player.gauge < 100) return;
  player.gauge = 0; player.burst = 4.5; player.face = 0.35; player.squashV += (index ? 1 : -1) * 2.5;
  audio.playSe('smash', 3); state.shake = 0.4; state.flash = 0.18; particles(player.x, player.y, player.color, 30);
  say((index ? 'PINK 奥' : '手前 BLUE') + ' PUNI BURST!'); syncSpecialUI();
}

function movePlayer(player, dt) {
  const spring = 430, velocityFollow = 31, drag = 7;
  player.vx += ((player.tx - player.x) * spring + (player.inputVx - player.vx) * velocityFollow - player.vx * drag) * dt;
  player.vy += ((player.ty - player.y) * spring + (player.inputVy - player.vy) * velocityFollow - player.vy * drag) * dt;
  const limit = player.burst ? 3000 : 2700, speed = Math.hypot(player.vx, player.vy);
  if (speed > limit) { player.vx *= limit / speed; player.vy *= limit / speed; }
  player.x += player.vx * dt; player.y += player.vy * dt;
  if (player.pointerId !== null) { const decay = Math.exp(-dt * 17); player.inputVx *= decay; player.inputVy *= decay; }
  if (player.burst) player.burst = Math.max(0, player.burst - dt);
  player.gaugeCooldown = Math.max(0, player.gaugeCooldown - dt);
  player.squashV += (-90 * player.squash - 14 * player.squashV) * dt; player.squash += player.squashV * dt;
  player.squash = Math.max(-0.32, Math.min(0.32, player.squash)); player.face = Math.max(0, player.face - dt); clampPlayer(player);
}

function collidePuckWithPlayer(player) {
  const dx = puck.x - player.x, dy = puck.y - player.y, distance = Math.hypot(dx, dy), minDistance = playerRadius(player) + puck.r;
  if (!distance || distance >= minDistance) { player.touchingPuck = false; return; }
  const wasTouching = player.touchingPuck; player.touchingPuck = true;
  const nx = dx / distance, ny = dy / distance, penetration = minDistance - distance;
  const inversePlayer = 1 / playerMass(player), inversePuck = 1 / puck.mass, inverseSum = inversePlayer + inversePuck;
  puck.x += nx * penetration * inversePuck / inverseSum; puck.y += ny * penetration * inversePuck / inverseSum;
  const rvx = puck.vx - player.vx, rvy = puck.vy - player.vy, normalVelocity = rvx * nx + rvy * ny; if (normalVelocity >= 0) return;
  const tx = -ny, ty = nx, tangentVelocity = rvx * tx + rvy * ty, normalSpeed = -normalVelocity, malletSpeed = Math.hypot(player.vx, player.vy);
  const smash = normalSpeed > 850 || malletSpeed > 1425, graze = !smash && Math.abs(tangentVelocity) > normalSpeed * 1.25 && normalSpeed < 500;
  const restitution = player.burst ? 1.02 : smash ? 0.95 : graze ? 0.84 : 0.92;
  let impulse = -(1 + restitution) * normalVelocity / inverseSum; impulse = Math.min(impulse, player.burst ? 6100 : smash ? 4700 : 4000);
  puck.vx += impulse * inversePuck * nx; puck.vy += impulse * inversePuck * ny;
  const friction = graze ? 0.16 : 0.08, tangentImpulse = Math.max(-impulse * friction, Math.min(impulse * friction, -tangentVelocity / inverseSum));
  puck.vx += tangentImpulse * inversePuck * tx; puck.vy += tangentImpulse * inversePuck * ty; puck.spin += tangentImpulse * 0.006;
  if (player.burst) { puck.vx += nx * 130; puck.vy += ny * 130; }
  const impact = Math.min(5, normalSpeed / 520), newStrike = !wasTouching && player.gaugeCooldown <= 0 && normalSpeed > 70;
  if (newStrike) { addGauge(player, (smash ? 15 : graze ? 6 : 9) + impact * 2.4); player.gaugeCooldown = smash ? 0.24 : 0.18; }
  player.squashV -= ny * (0.8 + impact * 0.5); player.face = 0.16; audio.playSe(smash ? 'smash' : 'hit', impact);
  particles(puck.x, puck.y, smash ? '#fff1a3' : player.color, smash ? 18 : graze ? 4 : 7);
  if (smash) { puck.boost = Math.max(puck.boost, 0.18); state.hitstop = Math.max(state.hitstop, player.burst ? 0.045 : 0.032); state.shake = Math.max(state.shake, 0.5); state.flash = Math.max(state.flash, 0.2); }
}

function collideMallets() {
  const a = players[0], b = players[1], dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy), minDistance = playerRadius(a) + playerRadius(b);
  if (!distance || distance >= minDistance) return;
  const nx = dx / distance, ny = dy / distance, penetration = minDistance - distance;
  a.x -= nx * penetration * 0.5; a.y -= ny * penetration * 0.5; b.x += nx * penetration * 0.5; b.y += ny * penetration * 0.5; clampPlayer(a); clampPlayer(b);
  const normalVelocity = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny; if (normalVelocity >= 0) return;
  const impulse = -(1 + 0.55) * normalVelocity / (1 / playerMass(a) + 1 / playerMass(b));
  a.vx -= impulse / playerMass(a) * nx * 0.55; a.vy -= impulse / playerMass(a) * ny * 0.55; b.vx += impulse / playerMass(b) * nx * 0.55; b.vy += impulse / playerMass(b) * ny * 0.55;
  particles((a.x + b.x) / 2, (a.y + b.y) / 2, '#fff', 5);
}

function bouncePuck(axis, positiveSide) {
  const speed = Math.hypot(puck.vx, puck.vy), normal = Math.abs(axis === 'x' ? puck.vx : puck.vy), tangent = Math.abs(axis === 'x' ? puck.vy : puck.vx);
  const damping = tangent > normal * 1.8 ? 0.975 : 0.95;
  if (axis === 'x') puck.vx = (positiveSide ? 1 : -1) * Math.abs(puck.vx) * damping;
  else puck.vy = (positiveSide ? 1 : -1) * Math.abs(puck.vy) * damping;
  puck.spin *= 0.9; audio.playSe('wall', Math.min(4, speed / 650)); if (speed > 950) particles(puck.x, puck.y, '#ffe8a6', 4);
}
function puckSpeedCap() { if (players.some((player) => player.burst > 0)) return 1800; if (puck.boost > 0) return 1600; return 1400; }

function physicsStep(dt) {
  if (state.phase !== PHASE.PLAYING) return true;
  players.forEach((player) => movePlayer(player, dt)); collideMallets(); puck.x += puck.vx * dt; puck.y += puck.vy * dt;
  const goalWidth = Math.min(state.width * 0.38, 240), goalX = (state.width - goalWidth) / 2;
  if (puck.x - puck.r < 0) { puck.x = puck.r; bouncePuck('x', true); }
  if (puck.x + puck.r > state.width) { puck.x = state.width - puck.r; bouncePuck('x', false); }
  const insideGoal = puck.x > goalX && puck.x < goalX + goalWidth;
  if (puck.y - puck.r < 0) { if (insideGoal) return awardGoal(0); puck.y = puck.r; bouncePuck('y', true); }
  if (puck.y + puck.r > state.height) { if (insideGoal) return awardGoal(1); puck.y = state.height - puck.r; bouncePuck('y', false); }
  players.forEach(collidePuckWithPlayer);
  const drag = Math.pow(0.9987, dt * 120); puck.vx *= drag; puck.vy *= drag; puck.spin *= Math.pow(0.996, dt * 120); puck.boost = Math.max(0, puck.boost - dt);
  const speed = Math.hypot(puck.vx, puck.vy), cap = puckSpeedCap(); if (speed > cap) { puck.vx *= cap / speed; puck.vy *= cap / speed; }
  return false;
}

function particles(px, py, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2, speed = 70 + Math.random() * 340;
    state.particles.push({ x: px, y: py, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 0.3 + Math.random() * 0.45, size: 3 + Math.random() * 6, color });
  }
  if (state.particles.length > 160) state.particles.splice(0, state.particles.length - 160);
}
function updateEffects(dt) {
  syncSpecialUI(); state.trail.push({ x: puck.x, y: puck.y, life: 0.15 }); if (state.trail.length > 15) state.trail.shift();
  state.trail.forEach((item) => { item.life -= dt; }); state.trail = state.trail.filter((item) => item.life > 0);
  state.particles.forEach((item) => { item.x += item.vx * dt; item.y += item.vy * dt; item.vy += 160 * dt; item.life -= dt; });
  state.particles = state.particles.filter((item) => item.life > 0); state.shake = Math.max(0, state.shake - dt * 18); state.flash = Math.max(0, state.flash - dt * 3);
}
function update(dt) {
  if (state.phase === PHASE.GOAL) {
    state.roundWait = Math.max(0, state.roundWait - dt); updateEffects(dt);
    if (state.roundWait <= 0) { resetRound(false); state.phase = PHASE.PLAYING; syncSpecialUI(); }
    return;
  }
  if (state.phase !== PHASE.PLAYING) { updateEffects(dt); return; }
  applyKeyboard(dt);
  if (state.hitstop > 0) { state.hitstop = Math.max(0, state.hitstop - dt); state.accumulator = 0; updateEffects(dt); return; }
  state.accumulator = Math.min(MAX_FRAME, state.accumulator + dt);
  let steps = 0;
  while (state.accumulator >= FIXED_DT && steps < MAX_STEPS) {
    const roundEnded = physicsStep(FIXED_DT); state.accumulator -= FIXED_DT; steps++;
    if (roundEnded || state.phase !== PHASE.PLAYING || state.hitstop > 0) { state.accumulator = 0; break; }
  }
  updateEffects(dt);
}

function drawField() {
  const w = state.width, h = state.height, goalWidth = Math.min(w * 0.38, 240), goalX = (w - goalWidth) / 2;
  const gradient = ctx.createLinearGradient(0, 0, 0, h); gradient.addColorStop(0, '#4c203d'); gradient.addColorStop(0.5, '#20213f'); gradient.addColorStop(1, '#17324e');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = 'rgba(255,255,255,.34)'; ctx.lineWidth = 4; ctx.setLineDash([12, 14]);
  ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke(); ctx.setLineDash([]); ctx.beginPath(); ctx.arc(w / 2, h / 2, Math.min(72, Math.min(w, h) * 0.16), 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 9; ctx.strokeStyle = '#ff77b5'; ctx.beginPath(); ctx.moveTo(goalX, 0); ctx.lineTo(goalX + goalWidth, 0); ctx.stroke();
  ctx.strokeStyle = '#69d7ff'; ctx.beginPath(); ctx.moveTo(goalX, h); ctx.lineTo(goalX + goalWidth, h); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(goalX, 0, goalWidth, 14); ctx.fillRect(goalX, h - 14, goalWidth, 14);
}
function drawPuck() {
  const gradient = ctx.createRadialGradient(puck.x - puck.r * 0.35, puck.y - puck.r * 0.4, 2, puck.x, puck.y, puck.r);
  gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.18, '#fff4a8'); gradient.addColorStop(0.52, '#ffd44d'); gradient.addColorStop(1, '#f38b3e');
  ctx.shadowColor = '#ffd44daa'; ctx.shadowBlur = 18 + Math.min(12, Math.hypot(puck.vx, puck.vy) / 120); ctx.fillStyle = gradient;
  ctx.beginPath(); ctx.arc(puck.x, puck.y, puck.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
}
function drawPlayer(player) {
  const r = playerRadius(player), speed = Math.min(1.3, Math.hypot(player.vx, player.vy) / 1200), angle = Math.atan2(player.vy, player.vx);
  ctx.save(); ctx.translate(player.x, player.y);
  if (player.burst) { ctx.strokeStyle = player.color; ctx.globalAlpha = 0.5; ctx.lineWidth = 5; ctx.shadowColor = player.color; ctx.shadowBlur = 22; ctx.beginPath(); ctx.arc(0, 0, r * 1.14 * (1 + 0.05 * Math.sin(performance.now() * 0.012)), 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; ctx.shadowBlur = 0; }
  ctx.rotate(angle); ctx.scale(Math.max(0.7, 1 + speed * 0.11 - player.squash * 0.2), Math.max(0.7, 1 - speed * 0.05 + player.squash));
  const gradient = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.08, 0, 0, r); gradient.addColorStop(0, '#fff'); gradient.addColorStop(0.12, player.burst ? '#fff7ba' : player.color); gradient.addColorStop(1, player.dark);
  ctx.fillStyle = gradient; ctx.beginPath(); ctx.ellipse(0, 0, r, r * 0.93, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  ctx.save(); ctx.translate(player.x, player.y); if (player.i === 1) ctx.rotate(Math.PI); ctx.fillStyle = '#17213a'; ctx.beginPath();
  ctx.arc(-r * 0.22, -r * 0.1, r * 0.065, 0, Math.PI * 2); ctx.arc(r * 0.22, -r * 0.1, r * 0.065, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#17213a'; ctx.lineWidth = Math.max(3, r * 0.07); ctx.beginPath(); ctx.arc(0, r * 0.14, r * 0.2, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); ctx.restore();
}
function draw() {
  ctx.save(); if (state.shake) { const amount = state.shake * 5; ctx.translate((Math.random() - 0.5) * amount, (Math.random() - 0.5) * amount); }
  drawField(); state.trail.forEach((item) => { ctx.globalAlpha = item.life / 0.15 * 0.24; ctx.fillStyle = '#ffe46b'; ctx.beginPath(); ctx.arc(item.x, item.y, puck.r * 0.7, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1; drawPuck(); players.forEach(drawPlayer);
  state.particles.forEach((item) => { ctx.globalAlpha = Math.max(0, item.life / 0.7); ctx.fillStyle = item.color; ctx.beginPath(); ctx.arc(item.x, item.y, item.size, 0, Math.PI * 2); ctx.fill(); });
  ctx.globalAlpha = 1; if (state.flash) { ctx.fillStyle = `rgba(255,255,255,${state.flash * 0.12})`; ctx.fillRect(0, 0, state.width, state.height); } ctx.restore();
}

function startLoop() { if (state.rafId !== null) return; state.last = performance.now(); state.rafId = requestAnimationFrame(loop); }
function stopLoop() { if (state.rafId !== null) cancelAnimationFrame(state.rafId); state.rafId = null; }
function loop(now) {
  state.rafId = null; if (!state.running) return;
  const dt = Math.min(MAX_FRAME, (now - state.last) / 1000 || 1 / 60); state.last = now;
  if (!state.paused) update(dt); draw(); state.rafId = requestAnimationFrame(loop);
}

canvas.addEventListener('pointerdown', onPointerDown, { passive: false });
canvas.addEventListener('pointermove', onPointerMove, { passive: false });
['pointerup', 'pointercancel', 'lostpointercapture'].forEach((name) => canvas.addEventListener(name, onPointerUp));
$('#startBtn').onclick = startGame;
$('#howBtn').onclick = () => $('#howOverlay').classList.add('show');
$('#settingsBtn').onclick = () => $('#settingsOverlay').classList.add('show');
document.querySelectorAll('.close').forEach((button) => { button.onclick = () => button.closest('.overlay').classList.remove('show'); });
$('#pauseBtn').onclick = pauseGame; $('#resumeBtn').onclick = resumeGame; $('#restartBtn').onclick = restartGame; $('#titleBtn').onclick = goHome; $('#againBtn').onclick = restartGame; $('#resultTitleBtn').onclick = goHome;
function bindBurstButton(id, index) {
  const button = $(id); if (!button) return;
  button.addEventListener('pointerdown', (event) => { event.preventDefault(); event.stopPropagation(); activateBurst(index); }, { passive: false });
  button.addEventListener('click', (event) => { event.preventDefault(); event.stopPropagation(); });
}
bindBurstButton('#specialBtn1', 0); bindBurstButton('#specialBtn2', 1);
$('#bgmToggle').onclick = () => { settings.bgm = !settings.bgm; audio.setBgmEnabled(settings.bgm); saveSettings(); };
$('#sfxToggle').onclick = () => { settings.sfx = !settings.sfx; if (settings.sfx) audio.unlock(); saveSettings(); };
$('#pointsSelect').onchange = (event) => { settings.points = +event.target.value || 5; saveSettings(); };
window.addEventListener('keydown', (event) => {
  const controlled = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyP', 'Escape', 'KeyQ', 'Enter'];
  if (controlled.includes(event.code)) event.preventDefault();
  if (event.code === 'KeyQ') return activateBurst(0); if (event.code === 'Enter') return activateBurst(1);
  if (event.code === 'KeyP' || event.code === 'Escape') { if (state.running && !state.paused) pauseGame(); else if (state.paused && $('#pauseOverlay').classList.contains('show')) resumeGame(); return; }
  keys.add(event.code); audio.resume();
}, { passive: false });
window.addEventListener('keyup', (event) => keys.delete(event.code));
window.addEventListener('blur', () => { keys.clear(); if (state.running && !state.paused && state.phase !== PHASE.GAME_OVER) pauseGame(); });
window.addEventListener('resize', resize); window.visualViewport?.addEventListener('resize', resize);
document.addEventListener('visibilitychange', () => { if (document.hidden && state.running && !state.paused && state.phase !== PHASE.GAME_OVER) pauseGame(); else if (!document.hidden) audio.resume(); });
document.addEventListener('contextmenu', (event) => { if (state.running) event.preventDefault(); });
document.addEventListener('dragstart', (event) => event.preventDefault());
if (matchMedia('(pointer:fine)').matches) document.body.classList.add('has-keyboard');
syncUI(); resize();
})();
