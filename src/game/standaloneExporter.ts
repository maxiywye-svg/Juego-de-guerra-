import { CampaignState } from './types';
import { SECTORS, WORLD_OBSTACLES } from './initialData';

export function exportStandaloneSingleFileHTML(state: CampaignState) {
  const serializedState = JSON.stringify(state);
  const serializedObstacles = JSON.stringify(WORLD_OBSTACLES);
  const serializedSectors = JSON.stringify(SECTORS);

  const htmlContent = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
<title>El Largo Camino a Casa - Edición Autónoma HTML5</title>
<style>
  * { box-sizing: border-box; user-select: none; -webkit-user-select: none; touch-action: none; }
  body { margin: 0; background: #141613; color: #e7e5e4; font-family: system-ui, -apple-system, sans-serif; overflow: hidden; }
  #hud { position: fixed; top: 0; left: 0; right: 0; padding: 8px 12px; background: rgba(20,22,19,0.88); border-bottom: 1px solid #44403c; display: flex; justify-content: space-between; align-items: center; z-index: 10; font-size: 12px; }
  .btn { background: #292524; color: #e7e5e4; border: 1px solid #57534e; padding: 6px 10px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 12px; }
  .btn:active { background: #f59e0b; color: #141613; }
  #controls { position: fixed; bottom: 16px; left: 16px; right: 16px; display: flex; justify-content: space-between; align-items: flex-end; pointer-events: none; z-index: 10; }
  .pad { pointer-events: auto; width: 120px; height: 120px; border-radius: 50%; background: rgba(41,37,36,0.7); border: 2px solid #78716c; position: relative; }
  #stick { width: 44px; height: 44px; border-radius: 50%; background: #f59e0b; position: absolute; left: 38px; top: 38px; }
  .actions { pointer-events: auto; display: flex; gap: 8px; flex-wrap: wrap; max-width: 220px; justify-content: flex-end; }
  #modal { position: fixed; inset: 50px 16px 150px 16px; background: rgba(20,22,19,0.95); border: 1px solid #78716c; border-radius: 8px; padding: 14px; overflow-y: auto; display: none; z-index: 20; }
</style>
</head>
<body>
<div id="hud">
  <div><strong id="h-name">Hptm. Karl von Falken</strong> · <span id="h-hp">HP 100</span> · <span id="h-sec">Normandía</span></div>
  <div style="display:flex;gap:6px;">
    <button class="btn" onclick="toggleModal('soldiers')">Soldados</button>
    <button class="btn" onclick="toggleModal('radio')">Radio</button>
    <button class="btn" onclick="saveLocal()">Guardar</button>
  </div>
</div>
<canvas id="gameCanvas"></canvas>
<div id="modal"></div>
<div id="controls">
  <div class="pad" id="joy"><div id="stick"></div></div>
  <div class="actions">
    <button class="btn" id="btn-run">Correr</button>
    <button class="btn" onclick="interact()">Interactuar (E)</button>
    <button class="btn" onclick="shoot()">Fuego (Espacio)</button>
  </div>
</div>
<script>
const STATE = JSON.parse(localStorage.getItem('el_largo_camino_standalone') || ${JSON.stringify(serializedState)});
const OBSTACLES = ${serializedObstacles};
const SECTORS = ${serializedSectors};
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
let joyX = 0, joyY = 0, sprinting = false, keys = {};
function resize(){ canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize); resize();
window.addEventListener('keydown', e => { keys[e.key.toLowerCase()] = true; if(e.key==='e') interact(); if(e.key===' ') shoot(); });
window.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });
const joy = document.getElementById('joy'), stick = document.getElementById('stick');
joy.addEventListener('pointerdown', e => moveJoy(e));
joy.addEventListener('pointermove', e => { if(e.buttons) moveJoy(e); });
joy.addEventListener('pointerup', () => { joyX=0; joyY=0; stick.style.left='38px'; stick.style.top='38px'; });
function moveJoy(e){
  const r = joy.getBoundingClientRect();
  const dx = e.clientX - (r.left + 60), dy = e.clientY - (r.top + 60);
  const d = Math.min(40, Math.hypot(dx,dy)), a = Math.atan2(dy,dx);
  joyX = (Math.cos(a)*d)/40; joyY = (Math.sin(a)*d)/40;
  stick.style.left = (38 + Math.cos(a)*d)+'px'; stick.style.top = (38 + Math.sin(a)*d)+'px';
}
document.getElementById('btn-run').addEventListener('pointerdown', ()=>sprinting=true);
document.getElementById('btn-run').addEventListener('pointerup', ()=>sprinting=false);
function saveLocal(){ localStorage.setItem('el_largo_camino_standalone', JSON.stringify(STATE)); alert('Partida guardada en LocalStorage.'); }
function toggleModal(tab){
  const m = document.getElementById('modal');
  if(m.style.display==='block' && m.dataset.tab===tab){ m.style.display='none'; return; }
  m.dataset.tab = tab; m.style.display='block';
  if(tab==='soldiers'){
    m.innerHTML = '<h3>Columna y Destacamentos</h3>' + STATE.soldiers.map(s => '<div><b>'+s.rank+' '+s.name+'</b> ('+s.specialty+') - HP: '+s.hp+'% - Grupo: '+s.detachmentId+'</div>').join('<hr style="border-color:#333"/>');
  } else {
    m.innerHTML = '<h3>Registro de Radio</h3>' + STATE.radioLog.map(r => '<div>['+r.timestamp+'] <b>'+r.senderCallsign+':</b> '+r.text+'</div>').join('<hr style="border-color:#333"/>');
  }
}
function interact(){
  const p = STATE.protagonist;
  STATE.soldiers.forEach(s => { if(s.detachmentId==='DISPERSED' && Math.hypot(s.x-p.x, s.y-p.y)<75) s.detachmentId='MAIN'; });
  STATE.pois.forEach(poi => { if(!poi.interacted && Math.hypot(poi.x-p.x, poi.y-p.y)<85){ poi.interacted=true; STATE.supplies.food += 15; STATE.supplies.ammo += 30; } });
}
function shoot(){ if(STATE.supplies.ammo>0) STATE.supplies.ammo--; }
let last = performance.now();
function loop(now){
  const dt = Math.min(0.05, (now - last)/1000); last = now;
  const p = STATE.protagonist;
  let vx = joyX, vy = joyY;
  if(keys['w']||keys['arrowup']) vy = -1;
  if(keys['s']||keys['arrowdown']) vy = 1;
  if(keys['a']||keys['arrowleft']) vx = -1;
  if(keys['d']||keys['arrowright']) vx = 1;
  const spd = sprinting ? 175 : 115;
  p.x = Math.max(20, Math.min(3180, p.x + vx * spd * dt));
  p.y = Math.max(20, Math.min(2380, p.y + vy * spd * dt));
  STATE.soldiers.filter(s => s.detachmentId==='MAIN').forEach((s, i) => {
    const tx = p.x - 28 - (i%3)*22, ty = p.y + ((i%2===0)?22:-22);
    s.x += (tx - s.x)*2.5*dt; s.y += (ty - s.y)*2.5*dt;
  });
  document.getElementById('h-hp').textContent = 'HP ' + Math.round(p.hp) + '% · Munición ' + STATE.supplies.ammo + ' · Raciones ' + STATE.supplies.food;
  const camX = Math.max(0, Math.min(3200 - canvas.width, p.x - canvas.width/2));
  const camY = Math.max(0, Math.min(2400 - canvas.height, p.y - canvas.height/2));
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.save(); ctx.translate(-camX, -camY);
  ctx.fillStyle = '#232b1e'; ctx.fillRect(0,0,3200,2400);
  OBSTACLES.forEach(o => {
    ctx.fillStyle = o.type==='RIVER' ? '#173042' : o.type==='BRIDGE' ? '#57534e' : '#16301b';
    ctx.fillRect(o.x, o.y, o.w, o.h);
  });
  STATE.pois.forEach(poi => {
    ctx.fillStyle = poi.interacted ? '#57534e' : '#f59e0b';
    ctx.fillRect(poi.x-12, poi.y-12, 24, 24);
    ctx.fillStyle = '#fff'; ctx.fillText(poi.name, poi.x-30, poi.y-16);
  });
  STATE.soldiers.forEach(s => {
    ctx.fillStyle = s.detachmentId==='DISPERSED' ? '#fbbf24' : '#4d5d53';
    ctx.beginPath(); ctx.arc(s.x, s.y, 9, 0, Math.PI*2); ctx.fill();
  });
  ctx.fillStyle = '#3b4d41'; ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.fill();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 2; ctx.stroke();
  ctx.restore();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
</script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'index.html';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
