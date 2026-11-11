import { SECTORS, WORLD_HEIGHT, WORLD_OBSTACLES, WORLD_WIDTH } from './initialData';
import {
  CampaignState,
  FloatingEffect,
  Projectile,
  Specialty,
} from './types';

export function renderGameWorld(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  state: CampaignState,
  projectiles: Projectile[],
  floatingEffects: FloatingEffect[],
  timeMs: number
) {
  const p = state.protagonist;
  const camX = Math.max(0, Math.min(WORLD_WIDTH - width, p.x - width / 2));
  const camY = Math.max(0, Math.min(WORLD_HEIGHT - height, p.y - height / 2));

  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.translate(-camX, -camY);

  // 1. Base Ground & Sector Tints
  for (const sec of SECTORS) {
    if (
      sec.bounds.x + sec.bounds.w < camX ||
      sec.bounds.x > camX + width ||
      sec.bounds.y + sec.bounds.h < camY ||
      sec.bounds.y > camY + height
    ) {
      continue;
    }
    const tones: Record<number, string> = {
      1: '#232b1e', // Bocage green
      2: '#1f2822', // Carentan marsh olive
      3: '#29271f', // Falaise dusty ochre
      4: '#1e2920', // Seine deep woods
      5: '#1d241f', // Ardennes dark pine
      6: '#252622', // Rhine border slate
    };
    ctx.fillStyle = tones[sec.id] || '#232b1e';
    ctx.fillRect(sec.bounds.x, sec.bounds.y, sec.bounds.w, sec.bounds.h);

    // Subtle sector border line
    ctx.strokeStyle = 'rgba(168, 162, 158, 0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(sec.bounds.x, sec.bounds.y, sec.bounds.w, sec.bounds.h);
  }

  // Subtle tactical grid (every 200px)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  const startGridX = Math.floor(camX / 200) * 200;
  const startGridY = Math.floor(camY / 200) * 200;
  for (let gx = startGridX; gx <= camX + width; gx += 200) {
    ctx.beginPath();
    ctx.moveTo(gx, camY);
    ctx.lineTo(gx, camY + height);
    ctx.stroke();
  }
  for (let gy = startGridY; gy <= camY + height; gy += 200) {
    ctx.beginPath();
    ctx.moveTo(camX, gy);
    ctx.lineTo(camX + width, gy);
    ctx.stroke();
  }

  // 2. Military Roads & Dirt Paths connecting sectors
  ctx.save();
  ctx.strokeStyle = '#3d372e';
  ctx.lineWidth = 44;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  // Road from Sector 1 (Sainte-Mère) -> Carentan Bridge -> Sector 2 -> Sector 3 (Falaise) -> Sector 4 (Seine Bridge) -> Sector 5 (Ardennes) -> Sector 6 (Rhine)
  ctx.moveTo(180, 180);
  ctx.lineTo(500, 520);
  ctx.lineTo(505, 1525); // Carentan Bridge
  ctx.lineTo(510, 1880);
  ctx.lineTo(1380, 1580); // Moreau Farm
  ctx.lineTo(1520, 560); // Falaise
  ctx.lineTo(1820, 1780);
  ctx.lineTo(2080, 1780); // Seine Bridge
  ctx.lineTo(2580, 620); // Ardennes
  ctx.lineTo(2940, 2120); // Rhine Checkpoint
  ctx.stroke();

  // Inner worn track
  ctx.strokeStyle = '#4a4338';
  ctx.lineWidth = 26;
  ctx.setLineDash([18, 12]);
  ctx.stroke();
  ctx.restore();

  // 3. Obstacles (Rivers, Bridges, Trenches, Hedgerows, Buildings, Forests)
  for (const obs of WORLD_OBSTACLES) {
    if (
      obs.x + obs.w < camX - 60 ||
      obs.x > camX + width + 60 ||
      obs.y + obs.h < camY - 60 ||
      obs.y > camY + height + 60
    ) {
      continue;
    }

    ctx.save();
    if (obs.type === 'RIVER') {
      ctx.fillStyle = '#173042';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      // Water banks
      ctx.strokeStyle = '#2b4c63';
      ctx.lineWidth = 3;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // Animated water ripples
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.18)';
      ctx.lineWidth = 1.5;
      const offset = (timeMs * 0.02) % 40;
      for (let rx = obs.x + 20; rx < obs.x + obs.w - 20; rx += 55) {
        for (let ry = obs.y + 18; ry < obs.y + obs.h - 15; ry += 28) {
          ctx.beginPath();
          ctx.moveTo(rx + offset * 0.4, ry);
          ctx.lineTo(rx + 18 + offset * 0.4, ry);
          ctx.stroke();
        }
      }
    } else if (obs.type === 'BRIDGE') {
      ctx.fillStyle = '#57534e';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#a8a29e';
      ctx.lineWidth = 4;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // Planks
      ctx.strokeStyle = '#292524';
      ctx.lineWidth = 2;
      for (let py = obs.y + 10; py < obs.y + obs.h; py += 14) {
        ctx.beginPath();
        ctx.moveTo(obs.x + 4, py);
        ctx.lineTo(obs.x + obs.w - 4, py);
        ctx.stroke();
      }
    } else if (obs.type === 'TRENCH') {
      ctx.fillStyle = '#2b231d';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#5c4d3c';
      ctx.lineWidth = 3;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      // Duckboards
      ctx.strokeStyle = '#47392b';
      ctx.lineWidth = 2;
      for (let tx = obs.x + 12; tx < obs.x + obs.w - 8; tx += 14) {
        ctx.beginPath();
        ctx.moveTo(tx, obs.y + 5);
        ctx.lineTo(tx, obs.y + obs.h - 5);
        ctx.stroke();
      }
    } else if (obs.type === 'SANDBAG') {
      ctx.fillStyle = '#786b59';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = '#3f372d';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    } else if (obs.type === 'CRATER') {
      const cx = obs.x + obs.w / 2;
      const cy = obs.y + obs.h / 2;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(cx, cy, obs.w / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#44403c';
      ctx.lineWidth = 4;
      ctx.stroke();
    } else if (obs.type === 'HEDGEROW') {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(obs.x + 5, obs.y + 6, obs.w, obs.h);
      // Dense Normandy Bocage bushes
      ctx.fillStyle = '#16301b';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.fillStyle = '#224528';
      for (let bx = obs.x + 14; bx < obs.x + obs.w - 10; bx += 24) {
        for (let by = obs.y + 14; by < obs.y + obs.h - 8; by += 24) {
          ctx.beginPath();
          ctx.arc(bx, by, 13, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.strokeStyle = '#0f2413';
      ctx.lineWidth = 2;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    } else if (obs.type === 'FOREST') {
      ctx.fillStyle = 'rgba(18, 38, 22, 0.65)';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      ctx.strokeStyle = 'rgba(52, 94, 59, 0.45)';
      ctx.setLineDash([6, 6]);
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
      ctx.setLineDash([]);
      // Draw trees inside forest zone
      for (let tx = obs.x + 35; tx < obs.x + obs.w - 30; tx += 65) {
        for (let ty = obs.y + 35; ty < obs.y + obs.h - 30; ty += 65) {
          ctx.fillStyle = 'rgba(0,0,0,0.3)';
          ctx.beginPath();
          ctx.arc(tx + 5, ty + 6, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#1b3b22';
          ctx.beginPath();
          ctx.arc(tx, ty, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#285231';
          ctx.beginPath();
          ctx.arc(tx - 4, ty - 4, 13, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (obs.type === 'BUILDING' || obs.type === 'RUIN') {
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(obs.x + 8, obs.y + 8, obs.w, obs.h);
      // Stone walls
      ctx.fillStyle = obs.type === 'RUIN' ? '#44403c' : '#57534e';
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
      // Roof
      ctx.fillStyle = obs.type === 'RUIN' ? '#3b251e' : '#6b3428';
      ctx.fillRect(obs.x + 6, obs.y + 6, obs.w - 12, obs.h - 12);
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 3;
      ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
    }

    if (obs.label) {
      ctx.fillStyle = 'rgba(231, 229, 228, 0.65)';
      ctx.font = '600 11px "IBM Plex Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(obs.label, obs.x + obs.w / 2, obs.y - 6);
    }
    ctx.restore();
  }

  // 4. Points of Interest (POIs)
  for (const poi of state.pois) {
    if (
      poi.x < camX - 100 ||
      poi.x > camX + width + 100 ||
      poi.y < camY - 100 ||
      poi.y > camY + height + 100
    ) {
      continue;
    }

    const dist = Math.hypot(p.x - poi.x, p.y - poi.y);
    ctx.save();

    // Interaction highlight ring when close
    if (dist < 95 && !poi.interacted) {
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 38, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    if (poi.type === 'ABANDONED_VEHICLE') {
      // Draw Kübelwagen or Sd.Kfz. 251
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(poi.x - 24, poi.y - 12, 52, 30);
      ctx.fillStyle = poi.repaired ? '#4d5d53' : '#57534e';
      ctx.fillRect(poi.x - 26, poi.y - 14, 52, 28);
      ctx.strokeStyle = '#1c1917';
      ctx.lineWidth = 2;
      ctx.strokeRect(poi.x - 26, poi.y - 14, 52, 28);
      // Balkenkreuz emblem
      ctx.strokeStyle = '#e7e5e4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(poi.x - 5, poi.y);
      ctx.lineTo(poi.x + 5, poi.y);
      ctx.moveTo(poi.x, poi.y - 5);
      ctx.lineTo(poi.x, poi.y + 5);
      ctx.stroke();
    } else if (poi.type === 'SUPPLY_CACHE') {
      ctx.fillStyle = poi.interacted ? '#44403c' : '#654321';
      ctx.fillRect(poi.x - 16, poi.y - 14, 32, 28);
      ctx.strokeStyle = '#d97706';
      ctx.lineWidth = 2;
      ctx.strokeRect(poi.x - 16, poi.y - 14, 32, 28);
    } else if (poi.type === 'FIELD_HOSPITAL') {
      ctx.fillStyle = '#3f4739';
      ctx.fillRect(poi.x - 24, poi.y - 20, 48, 40);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(poi.x - 7, poi.y - 2.5, 14, 5);
      ctx.fillRect(poi.x - 2.5, poi.y - 7, 5, 14);
    } else if (poi.type === 'RADIO_RELAY' || poi.type === 'SABOTAGE_TARGET') {
      ctx.strokeStyle = poi.type === 'SABOTAGE_TARGET' ? '#ef4444' : '#38bdf8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(poi.x - 14, poi.y + 18);
      ctx.lineTo(poi.x, poi.y - 22);
      ctx.lineTo(poi.x + 14, poi.y + 18);
      ctx.stroke();
      // Radio wave arcs
      if (!poi.interacted) {
        ctx.beginPath();
        ctx.arc(poi.x, poi.y - 22, 12 + ((timeMs * 0.02) % 12), 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (poi.type === 'RHINE_CHECKPOINT') {
      ctx.fillStyle = '#15803d';
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      // French Farm
      ctx.fillStyle = '#78716c';
      ctx.beginPath();
      ctx.arc(poi.x, poi.y, 18, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Label
    ctx.fillStyle = poi.interacted ? '#a8a29e' : '#fde68a';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      poi.interacted ? `${poi.name} (Completado)` : poi.name,
      poi.x,
      poi.y - 26
    );
    if (dist < 95 && !poi.interacted) {
      ctx.fillStyle = '#f59e0b';
      ctx.font = '700 11px "IBM Plex Mono", monospace';
      ctx.fillText('[E / BOTÓN ACCIÓN: INTERACTUAR]', poi.x, poi.y + 34);
    }
    ctx.restore();
  }

  // 5. Active Mission Objective Markers
  for (const m of state.missions) {
    if (m.status !== 'ACTIVA') continue;
    if (
      m.x < camX - 150 ||
      m.x > camX + width + 150 ||
      m.y < camY - 150 ||
      m.y > camY + height + 150
    ) {
      continue;
    }
    ctx.save();
    ctx.strokeStyle = m.type === 'PRINCIPAL' ? 'rgba(245, 158, 11, 0.45)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 6. Radio Range Circle around Protagonist
  if (!state.mainRadioBroken && state.supplies.batteries > 0) {
    ctx.save();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.arc(p.x, p.y, state.radioRangeMeters, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 7. Enemy Units (Patrols & Garrisons)
  for (const en of state.enemies) {
    if (en.alertState === 'NEUTRALIZED') continue;
    if (
      en.x < camX - 240 ||
      en.x > camX + width + 240 ||
      en.y < camY - 240 ||
      en.y > camY + height + 240
    ) {
      continue;
    }

    ctx.save();
    // Detection cone
    if (en.alertState !== 'EVADED') {
      ctx.fillStyle =
        en.alertState === 'COMBAT'
          ? 'rgba(239, 68, 68, 0.16)'
          : 'rgba(245, 158, 11, 0.09)';
      ctx.beginPath();
      ctx.moveTo(en.x, en.y);
      ctx.arc(en.x, en.y, 195, en.angle - 0.55, en.angle + 0.55);
      ctx.closePath();
      ctx.fill();
    }

    // Draw squad members around enemy center
    for (let i = 0; i < Math.min(en.troopCount, 4); i++) {
      const ox = Math.cos(i * 1.6) * (i === 0 ? 0 : 18);
      const oy = Math.sin(i * 1.6) * (i === 0 ? 0 : 18);
      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.beginPath();
      ctx.arc(en.x + ox + 2, en.y + oy + 3, 9, 0, Math.PI * 2);
      ctx.fill();
      // Olive drab uniform
      ctx.fillStyle = '#5c6b38';
      ctx.beginPath();
      ctx.arc(en.x + ox, en.y + oy, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#dc2626';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Health bar & Name
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(en.x - 28, en.y - 30, 56, 6);
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(en.x - 28, en.y - 30, (56 * Math.max(0, en.hp)) / en.maxHp, 6);

    ctx.fillStyle = '#fca5a5';
    ctx.font = '600 11px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${en.name} (${en.alertState === 'COMBAT' ? '¡EN COMBATE!' : 'Patrulla'})`,
      en.x,
      en.y - 35
    );
    ctx.restore();
  }

  // 8. Independent Friendly Detachments on the World Map
  for (const det of state.detachments) {
    if (
      det.x < camX - 100 ||
      det.x > camX + width + 100 ||
      det.y < camY - 100 ||
      det.y > camY + height + 100
    ) {
      continue;
    }
    ctx.save();
    // Detachment perimeter
    ctx.strokeStyle = det.inRadioContact ? '#38bdf8' : '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(det.x, det.y, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Draw detachment leader & members
    det.memberIds.forEach((id, idx) => {
      const ox = Math.cos(idx * 2.1) * (idx === 0 ? 0 : 15);
      const oy = Math.sin(idx * 2.1) * (idx === 0 ? 0 : 15);
      ctx.fillStyle = '#4a5d4e';
      ctx.beginPath();
      ctx.arc(det.x + ox, det.y + oy, 8.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    ctx.fillStyle = '#bae6fd';
    ctx.font = '700 11px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${det.callsign} [${det.memberIds.length}h · ${det.inRadioContact ? 'RADIO OK' : 'SIN SEÑAL'}]`,
      det.x,
      det.y - 32
    );
    ctx.restore();
  }

  // 9. Soldiers (Main Column + Dispersed Stragglers)
  for (const sol of state.soldiers) {
    if (sol.status === 'CAIDO') continue;
    if (sol.detachmentId !== 'MAIN' && sol.detachmentId !== 'DISPERSED') continue;
    if (
      sol.x < camX - 80 ||
      sol.x > camX + width + 80 ||
      sol.y < camY - 80 ||
      sol.y > camY + height + 80
    ) {
      continue;
    }

    ctx.save();
    const isDispersed = sol.detachmentId === 'DISPERSED';

    if (isDispersed) {
      // Rescue beacon ring
      const pulse = 18 + Math.sin(timeMs * 0.005) * 4;
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(sol.x, sol.y, pulse, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath();
    ctx.arc(sol.x + 2, sol.y + 4, 10, 0, Math.PI * 2);
    ctx.fill();

    // Animated boots when moving
    const speed = Math.hypot(sol.vx, sol.vy);
    if (speed > 5) {
      const legOffset = Math.sin(timeMs * 0.015) * 5;
      ctx.fillStyle = '#1c1917';
      ctx.beginPath();
      ctx.arc(sol.x + legOffset, sol.y + 7, 3.5, 0, Math.PI * 2);
      ctx.arc(sol.x - legOffset, sol.y + 7, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Wehrmacht Feldgrau Tunic & Stahlhelm
    ctx.fillStyle = isDispersed ? '#657366' : '#4d5d53';
    ctx.beginPath();
    ctx.arc(sol.x, sol.y, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = isDispersed ? '#fbbf24' : '#a7f3d0';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Rifle barrel direction
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sol.x, sol.y);
    ctx.lineTo(
      sol.x + Math.cos(sol.angle) * 14,
      sol.y + Math.sin(sol.angle) * 14
    );
    ctx.stroke();

    // Specialty badge
    drawSpecialtyMicroIcon(ctx, sol.x, sol.y, sol.specialty);

    // Health bar if damaged or dispersed
    if (sol.hp < sol.maxHp || isDispersed) {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(sol.x - 14, sol.y - 18, 28, 4);
      ctx.fillStyle = sol.hp > 50 ? '#10b981' : '#f59e0b';
      ctx.fillRect(sol.x - 14, sol.y - 18, (28 * sol.hp) / sol.maxHp, 4);
    }

    ctx.fillStyle = isDispersed ? '#fde68a' : '#e7e5e4';
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      isDispersed ? `¡Reclutar! ${sol.rank} ${sol.name}` : sol.name.split(' ')[1] || sol.name,
      sol.x,
      sol.y - 21
    );
    ctx.restore();
  }

  // 10. Protagonist: Hauptmann Karl von Falken
  ctx.save();
  if (p.activeVehicleId) {
    // Draw driven vehicle around Hauptmann
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(p.x - 24, p.y - 14, 52, 32);
    ctx.fillStyle = p.activeVehicleId === 'SDKFZ251' ? '#3f4d43' : '#525e54';
    ctx.fillRect(p.x - 26, p.y - 16, 52, 32);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(p.x - 26, p.y - 16, 52, 32);
  }

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.beginPath();
  ctx.arc(p.x + 2, p.y + 4, 13, 0, Math.PI * 2);
  ctx.fill();

  // Boots animation when moving
  const pSpeed = Math.hypot(p.vx, p.vy);
  if (pSpeed > 5 && !p.activeVehicleId) {
    const stride = Math.sin(timeMs * 0.018) * 6;
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.arc(p.x + stride, p.y + 9, 4, 0, Math.PI * 2);
    ctx.arc(p.x - stride, p.y + 9, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Hauptmann body (Feldgrau officer coat)
  ctx.fillStyle = '#3b4d41';
  ctx.beginPath();
  ctx.arc(p.x, p.y, 12.5, 0, Math.PI * 2);
  ctx.fill();

  // Command ring highlight
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Officer peaked cap visor & MP40 barrel direction
  ctx.strokeStyle = '#e7e5e4';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.lineTo(p.x + Math.cos(p.angle) * 18, p.y + Math.sin(p.angle) * 18);
  ctx.stroke();

  ctx.fillStyle = '#fef3c7';
  ctx.font = '700 11px "Plus Jakarta Sans", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Hptm. ${p.name.split(' ').pop()}`, p.x, p.y - 20);
  ctx.restore();

  // 11. Projectiles / Tracer Fire
  for (const proj of projectiles) {
    ctx.save();
    ctx.strokeStyle = proj.fromAlly ? '#fde047' : '#f87171';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(proj.x, proj.y);
    ctx.lineTo(proj.x - proj.vx * 0.03, proj.y - proj.vy * 0.03);
    ctx.stroke();
    ctx.restore();
  }

  // 12. Floating Combat / Tactical Effects
  for (const ef of floatingEffects) {
    ctx.save();
    ctx.fillStyle = ef.color;
    ctx.font = '700 12px "IBM Plex Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(ef.text, ef.x, ef.y);
    ctx.restore();
  }

  ctx.restore();
}

function drawSpecialtyMicroIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  spec: Specialty
) {
  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 9px "IBM Plex Mono", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const map: Record<Specialty, string> = {
    OFICIAL: '★',
    SANITARIO: '+',
    RADIO: '⚡',
    INGENIERO: '⚙',
    CONDUCTOR: '⊗',
    EXPLORADOR: '◈',
    INFANTERIA: '•',
  };
  ctx.fillText(map[spec] || '•', x, y);
  ctx.restore();
}
