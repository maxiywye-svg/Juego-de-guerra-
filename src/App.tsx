import React, { useEffect, useRef, useState } from 'react';
import {
  CampaignState,
  Detachment,
  DetachmentOrderType,
  FloatingEffect,
  Projectile,
} from './game/types';
import {
  createInitialCampaignState,
  getSectorAt,
  WORLD_HEIGHT,
  WORLD_OBSTACLES,
  WORLD_WIDTH,
} from './game/initialData';
import { renderGameWorld } from './game/canvasRenderer';
import { soundEngine } from './game/sound';
import {
  checkGeminiServiceStatus,
  requestRadioReport,
} from './game/aiService';
import { exportStandaloneSingleFileHTML } from './game/standaloneExporter';
import { ORDER_LABELS, StrategicMapModal } from './components/StrategicMapModal';
import { ForcesAndDialogueModal } from './components/ForcesAndDialogueModal';
import { CommandPanelsModal } from './components/CommandPanelsModal';
import {
  Backpack,
  Compass,
  Crosshair,
  Download,
  Flag,
  Hand,
  Map,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Users,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';

const SAVE_STORAGE_KEY = 'el_largo_camino_campaign_v1';

export default function App() {
  const [screenState, setScreenState] = useState<
    'TITLE_MENU' | 'PLAYING' | 'PAUSED' | 'VICTORY' | 'GAME_OVER'
  >('TITLE_MENU');

  const [campaign, setCampaign] = useState<CampaignState>(() => {
    try {
      const saved = localStorage.getItem(SAVE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.protagonist && parsed.soldiers) {
          return parsed;
        }
      }
    } catch {
      // Ignore storage error and use default
    }
    return createInitialCampaignState();
  });

  const [hasSavedGame, setHasSavedGame] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem(SAVE_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  // Active Modals
  const [activeModal, setActiveModal] = useState<
    | 'NONE'
    | 'MAP'
    | 'SOLDADOS'
    | 'DESTACAMENTOS'
    | 'DIALOGO'
    | 'RADIO'
    | 'INVENTARIO'
    | 'MISIONES'
    | 'SETTINGS'
  >('NONE');
  const [selectedDialogSoldierId, setSelectedDialogSoldierId] = useState<
    string | null
  >(null);

  // Audio & AI status
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.45);
  const [aiStatus, setAiStatus] = useState<{
    available: boolean;
    model: string;
    mode: string;
    message: string;
  }>({
    available: true,
    model: 'gemini-3.8-flash',
    mode: 'VERIFICANDO',
    message: 'Comprobando enlace con el motor narrativo del servidor...',
  });

  // Toast / discrete tactical notification
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Refs for real-time 60fps simulation loop
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<CampaignState>(campaign);
  stateRef.current = campaign;

  const projectilesRef = useRef<Projectile[]>([]);
  const floatingEffectsRef = useRef<FloatingEffect[]>([]);
  const keysRef = useRef<Record<string, boolean>>({});
  const joystickRef = useRef<{ active: boolean; vx: number; vy: number }>({
    active: false,
    vx: 0,
    vy: 0,
  });
  const [stickPos, setStickPos] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const sprintingRef = useRef<boolean>(false);
  const [isSprintingUI, setIsSprintingUI] = useState(false);

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const t = setTimeout(() => setToastMsg(null), 4200);
    return () => clearTimeout(t);
  }, [toastMsg]);

  // Verify Gemini status on mount
  useEffect(() => {
    checkGeminiServiceStatus().then(setAiStatus);
  }, []);

  // Save helper
  const saveCampaignToLocal = (st: CampaignState, silent = false) => {
    try {
      localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(st));
      setHasSavedGame(true);
      if (!silent) showToast('Partida guardada en LocalStorage.');
    } catch {
      if (!silent)
        showToast('Aviso: LocalStorage no disponible en este navegador.');
    }
  };

  const addFloatingText = (x: number, y: number, text: string, color: string) => {
    floatingEffectsRef.current.push({
      id: `${Date.now()}_${Math.random()}`,
      x,
      y,
      text,
      color,
      ttl: 1.4,
    });
  };

  // Keyboard bindings for desktop testing & play
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA' ||
        document.activeElement?.tagName === 'SELECT'
      ) {
        return;
      }
      const k = e.key.toLowerCase();
      keysRef.current[k] = true;
      if (k === 'shift') {
        sprintingRef.current = true;
        setIsSprintingUI(true);
      }
      if (screenState === 'PLAYING') {
        if (k === 'e') handleInteractAction();
        if (k === ' ') {
          e.preventDefault();
          handleFireWeapon();
        }
        if (k === 'm')
          setActiveModal((prev) => (prev === 'MAP' ? 'NONE' : 'MAP'));
        if (k === 'r')
          setActiveModal((prev) => (prev === 'RADIO' ? 'NONE' : 'RADIO'));
        if (k === 'i')
          setActiveModal((prev) =>
            prev === 'INVENTARIO' ? 'NONE' : 'INVENTARIO'
          );
        if (k === 'o')
          setActiveModal((prev) =>
            prev === 'DESTACAMENTOS' ? 'NONE' : 'DESTACAMENTOS'
          );
        if (k === 'escape') setScreenState('PAUSED');
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      keysRef.current[k] = false;
      if (k === 'shift') {
        sprintingRef.current = false;
        setIsSprintingUI(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  // Check if point collides with solid obstacles
  const isBlockedByObstacle = (x: number, y: number, radius = 12): boolean => {
    if (x < radius || x > WORLD_WIDTH - radius || y < radius || y > WORLD_HEIGHT - radius) {
      return true;
    }
    // Check if on bridge first (bridges override river collision)
    for (const obs of WORLD_OBSTACLES) {
      if (obs.type === 'BRIDGE') {
        if (
          x >= obs.x &&
          x <= obs.x + obs.w &&
          y >= obs.y &&
          y <= obs.y + obs.h
        ) {
          return false;
        }
      }
    }
    for (const obs of WORLD_OBSTACLES) {
      if (!obs.blocksMovement) continue;
      if (
        x + radius > obs.x &&
        x - radius < obs.x + obs.w &&
        y + radius > obs.y &&
        y - radius < obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  };

  // Check if entity is currently in cover (Trench, Sandbag, Forest, or close to Hedgerow)
  const isInTacticalCover = (x: number, y: number): boolean => {
    for (const obs of WORLD_OBSTACLES) {
      if (!obs.providesCover) continue;
      const pad = obs.blocksMovement ? 20 : 4;
      if (
        x >= obs.x - pad &&
        x <= obs.x + obs.w + pad &&
        y >= obs.y - pad &&
        y <= obs.y + obs.h + pad
      ) {
        return true;
      }
    }
    return false;
  };

  // Fire weapon action
  const handleFireWeapon = () => {
    const st = stateRef.current;
    if (st.supplies.ammo <= 0) {
      showToast('¡Sin munición! Busca suministros o evita el combate.');
      return;
    }
    soundEngine.playGunshot(true);

    const p = st.protagonist;
    // Aim toward nearest alert enemy within 360px, or current facing angle
    let aimAngle = p.angle;
    let nearestDist = 360;
    for (const en of st.enemies) {
      if (en.alertState === 'NEUTRALIZED') continue;
      const d = Math.hypot(en.x - p.x, en.y - p.y);
      if (d < nearestDist) {
        nearestDist = d;
        aimAngle = Math.atan2(en.y - p.y, en.x - p.x);
      }
    }

    projectilesRef.current.push({
      id: `proj_${Date.now()}_${Math.random()}`,
      x: p.x + Math.cos(aimAngle) * 16,
      y: p.y + Math.sin(aimAngle) * 16,
      vx: Math.cos(aimAngle) * 520,
      vy: Math.sin(aimAngle) * 520,
      fromAlly: true,
      damage: 24,
      ttl: 0.75,
    });

    setCampaign((prev) => ({
      ...prev,
      supplies: {
        ...prev.supplies,
        ammo: Math.max(0, prev.supplies.ammo - 1),
      },
    }));
  };

  // Interact with nearby Dispersed Soldier, POI, or Negotiable Checkpoint
  const handleInteractAction = () => {
    const st = stateRef.current;
    const p = st.protagonist;

    // 1. Check nearby dispersed soldiers to recruit
    const nearbyStraggler = st.soldiers.find(
      (s) =>
        s.detachmentId === 'DISPERSED' &&
        s.status !== 'CAIDO' &&
        Math.hypot(s.x - p.x, s.y - p.y) < 95
    );
    if (nearbyStraggler) {
      soundEngine.playSupplyPickup();
      addFloatingText(
        nearbyStraggler.x,
        nearbyStraggler.y - 20,
        `+Reclutado: ${nearbyStraggler.rank} ${nearbyStraggler.name}`,
        '#fde047'
      );
      showToast(
        `${nearbyStraggler.rank} ${nearbyStraggler.name} (${nearbyStraggler.specialty}) se ha unido a tu columna.`
      );

      setCampaign((prev) => {
        const updatedSoldiers = prev.soldiers.map((s) =>
          s.id === nearbyStraggler.id
            ? {
                ...s,
                detachmentId: 'MAIN',
                morale: Math.min(100, s.morale + 12),
                memories: [
                  ...s.memories,
                  `Reagrupado por el Hauptmann von Falken en el Sector ${prev.currentSectorId}.`,
                ],
              }
            : s
        );
        const updatedMissions = prev.missions.map((m) =>
          m.id === 'mis_main_1' && nearbyStraggler.id === 'sol_braun'
            ? { ...m, status: 'COMPLETADA' as const }
            : m
        );
        return {
          ...prev,
          protagonist: {
            ...prev.protagonist,
            xp: prev.protagonist.xp + 35,
            reputation: Math.min(100, prev.protagonist.reputation + 4),
          },
          soldiers: updatedSoldiers,
          missions: updatedMissions,
          eventHistory: [
            {
              id: `ev_${Date.now()}`,
              time: prev.dateTime,
              text: `Reclutado ${nearbyStraggler.rank} ${nearbyStraggler.name} (${nearbyStraggler.specialty}) para la columna.`,
              category: 'MANDO',
            },
            ...prev.eventHistory,
          ],
        };
      });
      return;
    }

    // 2. Check nearby Point of Interest (POI)
    const nearbyPOI = st.pois.find(
      (poi) => !poi.interacted && Math.hypot(poi.x - p.x, poi.y - p.y) < 105
    );
    if (nearbyPOI) {
      if (nearbyPOI.type === 'ABANDONED_VEHICLE') {
        const hasMechanicOrEngineer = st.soldiers.some(
          (s) =>
            s.detachmentId === 'MAIN' &&
            (s.specialty === 'CONDUCTOR' || s.specialty === 'INGENIERO') &&
            s.status !== 'CAIDO'
        );
        if (st.supplies.tools <= 0 || !hasMechanicOrEngineer) {
          showToast(
            'Necesitas 1 Herramienta y un Conductor o Ingeniero en tu columna para reparar este vehículo.'
          );
          return;
        }
        soundEngine.playSupplyPickup();
        const vName =
          nearbyPOI.vehicleType === 'SDKFZ251'
            ? 'Semioruga Sd.Kfz. 251'
            : 'Kübelwagen Typ 82';
        addFloatingText(nearbyPOI.x, nearbyPOI.y - 20, `¡${vName} Reparado!`, '#34d399');
        showToast(
          `¡${vName} puesto en marcha! Velocidad y capacidad de carga de la columna aumentadas.`
        );
        setCampaign((prev) => ({
          ...prev,
          protagonist: {
            ...prev.protagonist,
            activeVehicleId: nearbyPOI.vehicleType || 'KUBELWAGEN',
            maxCarryWeight: prev.protagonist.maxCarryWeight + 25,
            xp: prev.protagonist.xp + 50,
          },
          supplies: {
            ...prev.supplies,
            tools: Math.max(0, prev.supplies.tools - 1),
            fuel: prev.supplies.fuel + 15,
          },
          pois: prev.pois.map((item) =>
            item.id === nearbyPOI.id
              ? { ...item, interacted: true, repaired: true }
              : item
          ),
          missions: prev.missions.map((m) =>
            m.id === 'mis_sec_vehicle_1' && nearbyPOI.id === 'poi_kubel_s1'
              ? { ...m, status: 'COMPLETADA' as const }
              : m
          ),
          eventHistory: [
            {
              id: `ev_${Date.now()}`,
              time: prev.dateTime,
              text: `El conductor reparó y puso en servicio el vehículo ${vName}.`,
              category: 'SUMINISTROS',
            },
            ...prev.eventHistory,
          ],
        }));
        return;
      }

      if (nearbyPOI.type === 'FRENCH_FARM') {
        if (st.supplies.meds < 2) {
          showToast(
            'La familia Moreau necesita 2 Botiquines para atender a sus heridos antes de entregarte sus mapas y víveres.'
          );
          return;
        }
        soundEngine.playSupplyPickup();
        addFloatingText(
          nearbyPOI.x,
          nearbyPOI.y - 20,
          'Trato Humanitario (+Víveres y Mapa)',
          '#fde047'
        );
        showToast(
          'Ayudaste a los civiles heridos en la Granja Moreau. Recibes raciones, combustible y la ruta segura del Sena.'
        );
        setCampaign((prev) => ({
          ...prev,
          protagonist: {
            ...prev.protagonist,
            reputation: Math.min(100, prev.protagonist.reputation + 10),
            groupMorale: Math.min(100, prev.protagonist.groupMorale + 10),
            xp: prev.protagonist.xp + 65,
          },
          supplies: {
            ...prev.supplies,
            meds: prev.supplies.meds - 2,
            food: prev.supplies.food + 35,
            water: prev.supplies.water + 35,
            fuel: prev.supplies.fuel + 25,
          },
          pois: prev.pois.map((item) =>
            item.id === nearbyPOI.id ? { ...item, interacted: true } : item
          ),
          missions: prev.missions.map((m) =>
            m.id === 'mis_sec_farm' ? { ...m, status: 'COMPLETADA' as const } : m
          ),
          eventHistory: [
            {
              id: `ev_${Date.now()}`,
              time: prev.dateTime,
              text: 'Decisión humanitaria en la Granja Moreau: se compartió material médico con civiles franceses a cambio de víveres y mapas del Sena.',
              category: 'DECISION',
            },
            ...prev.eventHistory,
          ],
        }));
        return;
      }

      if (nearbyPOI.type === 'RHINE_CHECKPOINT') {
        soundEngine.playSupplyPickup();
        setCampaign((prev) => ({
          ...prev,
          victoryAchieved: true,
          missions: prev.missions.map((m) =>
            m.id === 'mis_main_4' ? { ...m, status: 'COMPLETADA' as const } : m
          ),
        }));
        setScreenState('VICTORY');
        return;
      }

      // Supply Cache, Field Hospital, Radio Relay, or Sabotage Target
      soundEngine.playSupplyPickup();
      const sup = nearbyPOI.suppliesAvailable || {};
      addFloatingText(
        nearbyPOI.x,
        nearbyPOI.y - 20,
        `+${nearbyPOI.name}`,
        '#38bdf8'
      );
      showToast(`Completado: ${nearbyPOI.name}. Recursos incorporados a la columna.`);

      setCampaign((prev) => {
        const isHospital = nearbyPOI.type === 'FIELD_HOSPITAL';
        const isRelay = nearbyPOI.type === 'RADIO_RELAY';
        const isSabotage = nearbyPOI.type === 'SABOTAGE_TARGET';

        return {
          ...prev,
          radioRangeMeters: isRelay
            ? prev.radioRangeMeters + 450
            : prev.radioRangeMeters,
          mainRadioBroken: isRelay ? false : prev.mainRadioBroken,
          protagonist: {
            ...prev.protagonist,
            hp: isHospital ? prev.protagonist.maxHp : prev.protagonist.hp,
            xp: prev.protagonist.xp + 55,
          },
          soldiers: isHospital
            ? prev.soldiers.map((s) =>
                s.detachmentId === 'MAIN' && s.status !== 'CAIDO'
                  ? { ...s, hp: s.maxHp, status: 'ESTABLE' as const }
                  : s
              )
            : prev.soldiers,
          supplies: {
            food: prev.supplies.food + (sup.food || 0),
            water: prev.supplies.water + (sup.water || 0),
            ammo: prev.supplies.ammo + (sup.ammo || 0),
            meds: prev.supplies.meds + (sup.meds || 0),
            fuel: prev.supplies.fuel + (sup.fuel || 0),
            batteries: Math.min(
              100,
              prev.supplies.batteries + (sup.batteries || 0)
            ),
            tools: prev.supplies.tools + (sup.tools || 0),
            spareParts: prev.supplies.spareParts + (sup.spareParts || 0),
          },
          pois: prev.pois.map((item) =>
            item.id === nearbyPOI.id ? { ...item, interacted: true } : item
          ),
          missions: prev.missions.map((m) => {
            if (m.id === 'mis_main_1' && nearbyPOI.id === 'poi_cache_s1')
              return { ...m, status: 'COMPLETADA' as const };
            if (m.id === 'mis_sec_relay' && isRelay)
              return { ...m, status: 'COMPLETADA' as const };
            if (m.id === 'mis_sec_sabotage' && isSabotage)
              return { ...m, status: 'COMPLETADA' as const };
            return m;
          }),
          eventHistory: [
            {
              id: `ev_${Date.now()}`,
              time: prev.dateTime,
              text: `Asegurado punto de interés: ${nearbyPOI.name}.`,
              category: 'SUMINISTROS',
            },
            ...prev.eventHistory,
          ],
        };
      });
      return;
    }

    // 3. Otherwise open dialogue with closest squad member
    const closestSquadMember = st.soldiers.find(
      (s) =>
        s.detachmentId === 'MAIN' &&
        s.status !== 'CAIDO' &&
        Math.hypot(s.x - p.x, s.y - p.y) < 110
    );
    if (closestSquadMember) {
      soundEngine.playClick();
      setSelectedDialogSoldierId(closestSquadMember.id);
      setActiveModal('DIALOGO');
    } else {
      showToast('Acércate a un soldado, vehículo, suministro o punto de interés para interactuar.');
    }
  };

  // Main 60fps Canvas & Simulation Loop
  useEffect(() => {
    if (screenState !== 'PLAYING') return;

    let animationFrameId: number;
    let lastTime = performance.now();
    let aiTickAccumulator = 0;
    let economyTickAccumulator = 0;

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!document.hidden && activeModal === 'NONE') {
        updateRealTimePhysics(dt, now);
        aiTickAccumulator += dt;
        economyTickAccumulator += dt;

        // Every 1.2s update autonomous detachments, radio links, and mission triggers
        if (aiTickAccumulator >= 1.2) {
          aiTickAccumulator = 0;
          updateTacticalSimulation();
        }

        // Every 18s advance campaign clock, consume rations/fuel/battery
        if (economyTickAccumulator >= 18) {
          economyTickAccumulator = 0;
          updateSurvivalEconomy();
        }
      }

      // Render Canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          if (
            canvas.width !== canvas.clientWidth ||
            canvas.height !== canvas.clientHeight
          ) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
          }
          renderGameWorld(
            ctx,
            canvas.width,
            canvas.height,
            stateRef.current,
            projectilesRef.current,
            floatingEffectsRef.current,
            now
          );
        }
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [screenState, activeModal]);

  // Real-time movement, collisions, squad following, and projectiles
  const updateRealTimePhysics = (dt: number, nowMs: number) => {
    const st = stateRef.current;
    const p = st.protagonist;

    // 1. Protagonist 8-directional input
    let dx = joystickRef.current.vx;
    let dy = joystickRef.current.vy;
    const k = keysRef.current;
    if (k['w'] || k['arrowup']) dy -= 1;
    if (k['s'] || k['arrowdown']) dy += 1;
    if (k['a'] || k['arrowleft']) dx -= 1;
    if (k['d'] || k['arrowright']) dx += 1;

    const mag = Math.hypot(dx, dy);
    if (mag > 1) {
      dx /= mag;
      dy /= mag;
    }

    const canSprint = sprintingRef.current && p.stamina > 8;
    const vehicleBonus =
      p.activeVehicleId && st.supplies.fuel > 0 ? 1.42 : 1.0;
    const paceFactor =
      p.marchPace === 'FORZADA'
        ? 1.18
        : p.marchPace === 'SIGILO'
        ? 0.78
        : 1.0;
    const baseSpeed = (canSprint ? 175 : 115) * vehicleBonus * paceFactor;

    p.vx = dx * baseSpeed;
    p.vy = dy * baseSpeed;

    if (mag > 0.08) {
      p.angle = Math.atan2(dy, dx);
      soundEngine.playFootstep(Boolean(p.activeVehicleId && st.supplies.fuel > 0));

      const nextX = p.x + p.vx * dt;
      const nextY = p.y + p.vy * dt;
      if (!isBlockedByObstacle(nextX, p.y)) p.x = nextX;
      if (!isBlockedByObstacle(p.x, nextY)) p.y = nextY;

      if (canSprint) {
        p.stamina = Math.max(0, p.stamina - 16 * dt);
      } else {
        p.stamina = Math.min(p.maxStamina, p.stamina + 6 * dt);
      }
    } else {
      p.stamina = Math.min(p.maxStamina, p.stamina + 14 * dt);
    }

    // 2. Main Column Soldiers follow protagonist in wedge formation & avoid obstacles
    const mainSoldiers = st.soldiers.filter(
      (s) => s.detachmentId === 'MAIN' && s.status !== 'CAIDO'
    );
    mainSoldiers.forEach((sol, idx) => {
      const row = Math.floor(idx / 2) + 1;
      const side = idx % 2 === 0 ? 1 : -1;
      const formAngle = p.angle + Math.PI + side * 0.55;
      const targetX = p.x + Math.cos(formAngle) * (28 + row * 20);
      const targetY = p.y + Math.sin(formAngle) * (28 + row * 20);

      const sdx = targetX - sol.x;
      const sdy = targetY - sol.y;
      const dist = Math.hypot(sdx, sdy);

      if (dist > 8) {
        const moveSpd = Math.min(baseSpeed * 1.08, dist * 3.2);
        const ux = sdx / dist;
        const uy = sdy / dist;
        sol.vx = ux * moveSpd;
        sol.vy = uy * moveSpd;
        sol.angle = Math.atan2(uy, ux);

        const nx = sol.x + sol.vx * dt;
        const ny = sol.y + sol.vy * dt;
        if (!isBlockedByObstacle(nx, sol.y, 9)) sol.x = nx;
        if (!isBlockedByObstacle(sol.x, ny, 9)) sol.y = ny;
      } else {
        sol.vx = 0;
        sol.vy = 0;
        sol.angle = p.angle;
      }

      // Allied soldiers return fire if in DEFENSIVE_FIRE stance
      if (
        p.combatStance === 'DEFENSIVE_FIRE' &&
        st.supplies.ammo > 0 &&
        (!sol.lastShotTime || nowMs - sol.lastShotTime > 1400 + idx * 180)
      ) {
        const targetEnemy = st.enemies.find(
          (en) =>
            en.alertState !== 'NEUTRALIZED' &&
            Math.hypot(en.x - sol.x, en.y - sol.y) < 270
        );
        if (targetEnemy) {
          sol.lastShotTime = nowMs;
          const ang =
            Math.atan2(targetEnemy.y - sol.y, targetEnemy.x - sol.x) +
            (Math.random() - 0.5) * 0.14;
          sol.angle = ang;
          projectilesRef.current.push({
            id: `ally_${nowMs}_${sol.id}`,
            x: sol.x,
            y: sol.y,
            vx: Math.cos(ang) * 460,
            vy: Math.sin(ang) * 460,
            fromAlly: true,
            damage: 14,
            ttl: 0.65,
          });
          st.supplies.ammo = Math.max(0, st.supplies.ammo - 1);
          soundEngine.playGunshot(false);
        }
      }
    });

    // 3. Enemy Patrol Movement & Combat Fire
    for (const en of st.enemies) {
      if (en.alertState === 'NEUTRALIZED') continue;
      const distToPlayer = Math.hypot(p.x - en.x, p.y - en.y);
      const playerInCover = isInTacticalCover(p.x, p.y);
      const detectionRadius =
        p.combatStance === 'STEALTH_HOLD_FIRE' || p.marchPace === 'SIGILO'
          ? playerInCover
            ? 95
            : 135
          : playerInCover
          ? 165
          : 235;

      if (distToPlayer < detectionRadius) {
        if (en.alertState !== 'COMBAT') {
          en.alertState = 'COMBAT';
          soundEngine.playAlert();
          addFloatingText(en.x, en.y - 40, '¡CONTACTO ENEMIGO!', '#f87171');
        }
        en.angle = Math.atan2(p.y - en.y, p.x - en.x);

        if (nowMs - en.lastShotTime > 1250) {
          en.lastShotTime = nowMs;
          const spread = (Math.random() - 0.5) * 0.22;
          projectilesRef.current.push({
            id: `en_${nowMs}_${en.id}`,
            x: en.x,
            y: en.y,
            vx: Math.cos(en.angle + spread) * 420,
            vy: Math.sin(en.angle + spread) * 420,
            fromAlly: false,
            damage: 11,
            ttl: 0.7,
          });
          soundEngine.playGunshot(false);
        }
      } else {
        if (en.alertState === 'COMBAT' && distToPlayer > 330) {
          en.alertState = 'UNAWARE';
        }
        // Patrol around home position
        if (en.type === 'PATROL') {
          en.angle += 0.45 * dt;
          en.x = en.homeX + Math.cos(en.angle) * (en.patrolRadius * 0.45);
          en.y = en.homeY + Math.sin(en.angle) * (en.patrolRadius * 0.45);
        }
      }
    }

    // 4. Update Projectiles & Hit Detection
    const remainingProjectiles: Projectile[] = [];
    for (const proj of projectilesRef.current) {
      proj.x += proj.vx * dt;
      proj.y += proj.vy * dt;
      proj.ttl -= dt;
      if (proj.ttl <= 0 || isBlockedByObstacle(proj.x, proj.y, 3)) {
        continue;
      }

      let hit = false;
      if (proj.fromAlly) {
        for (const en of st.enemies) {
          if (en.alertState === 'NEUTRALIZED') continue;
          if (Math.hypot(proj.x - en.x, proj.y - en.y) < 24) {
            en.hp -= proj.damage;
            en.alertState = 'COMBAT';
            hit = true;
            addFloatingText(en.x, en.y - 20, `-${proj.damage}`, '#fde047');
            if (en.hp <= 0) {
              en.hp = 0;
              en.alertState = 'NEUTRALIZED';
              p.xp += 45;
              st.supplies.ammo += 12;
              addFloatingText(
                en.x,
                en.y - 30,
                '¡Posición Neutralizada! (+12 Munición)',
                '#34d399'
              );
            }
            break;
          }
        }
      } else {
        // Enemy projectile hitting protagonist or squad
        if (Math.hypot(proj.x - p.x, proj.y - p.y) < 15) {
          const inCover = isInTacticalCover(p.x, p.y);
          const armorFactor = p.activeVehicleId === 'SDKFZ251' ? 0.4 : 1.0;
          const actualDmg = Math.max(
            2,
            Math.round(proj.damage * (inCover ? 0.45 : 1.0) * armorFactor)
          );
          p.hp = Math.max(0, p.hp - actualDmg);
          hit = true;
          addFloatingText(
            p.x,
            p.y - 22,
            inCover ? `-${actualDmg} (Cubierto)` : `-${actualDmg} HP`,
            '#f87171'
          );
          if (p.hp <= 0) {
            st.defeatReason =
              'El Hauptmann Karl von Falken ha caído en combate antes de alcanzar la frontera alemana.';
            setScreenState('GAME_OVER');
          }
        } else {
          for (const sol of mainSoldiers) {
            if (Math.hypot(proj.x - sol.x, proj.y - sol.y) < 13) {
              const inCover = isInTacticalCover(sol.x, sol.y);
              const actualDmg = Math.max(
                2,
                Math.round(proj.damage * (inCover ? 0.45 : 1.0))
              );
              sol.hp = Math.max(0, sol.hp - actualDmg);
              hit = true;
              addFloatingText(sol.x, sol.y - 18, `-${actualDmg}`, '#fb923c');
              if (sol.hp <= 0) {
                sol.status = 'CAIDO';
                p.groupMorale = Math.max(10, p.groupMorale - 12);
                showToast(`¡Baja en combate! ${sol.rank} ${sol.name} ha caído.`);
              } else if (sol.hp < 50) {
                sol.status = 'HERIDO';
              }
              break;
            }
          }
        }
      }

      if (!hit) {
        remainingProjectiles.push(proj);
      }
    }
    projectilesRef.current = remainingProjectiles;

    // 5. Update Floating Effects
    floatingEffectsRef.current = floatingEffectsRef.current
      .map((ef) => ({ ...ef, y: ef.y - 18 * dt, ttl: ef.ttl - dt }))
      .filter((ef) => ef.ttl > 0);
  };

  // Periodic Tactical Simulation (Fog of War, Autonomous Detachments, Radio Contact, Sanitario Auto-Heal, Mission Completion)
  const updateTacticalSimulation = () => {
    setCampaign((prev) => {
      const p = { ...prev.protagonist };
      const sector = getSectorAt(p.x, p.y);
      const exploredSet = new Set(prev.exploredCells);

      // 1. Reveal Fog of War around Protagonist
      const hasBinoculars = p.inventory.some(
        (i) => i.id === 'eq_zeiss' && i.durability > 0
      );
      const sightCells = hasBinoculars ? 2 : 1;
      const pgx = Math.floor(p.x / 200);
      const pgy = Math.floor(p.y / 200);
      for (let ox = -sightCells; ox <= sightCells; ox++) {
        for (let oy = -sightCells; oy <= sightCells; oy++) {
          const cx = pgx + ox;
          const cy = pgy + oy;
          if (cx >= 0 && cx < 16 && cy >= 0 && cy < 12) {
            exploredSet.add(`${cx},${cy}`);
          }
        }
      }

      // Discover nearby POIs
      const updatedPois = prev.pois.map((poi) =>
        !poi.discovered && Math.hypot(poi.x - p.x, poi.y - p.y) < 380
          ? { ...poi, discovered: true }
          : poi
      );

      // 2. Sanitario in Main Squad automatically tends to wounded squadmates if meds > 0
      let medsAvailable = prev.supplies.meds;
      const hasMedicInMain = prev.soldiers.some(
        (s) =>
          s.detachmentId === 'MAIN' &&
          s.specialty === 'SANITARIO' &&
          s.status !== 'CAIDO'
      );
      const updatedSoldiers = prev.soldiers.map((sol) => {
        if (
          hasMedicInMain &&
          medsAvailable > 0 &&
          sol.detachmentId === 'MAIN' &&
          sol.status !== 'CAIDO' &&
          sol.hp < 55
        ) {
          medsAvailable--;
          addFloatingText(
            sol.x,
            sol.y - 20,
            '+Sanitario (+30 HP)',
            '#34d399'
          );
          return {
            ...sol,
            hp: Math.min(sol.maxHp, sol.hp + 30),
            status: 'ESTABLE' as const,
          };
        }
        return sol;
      });

      // 3. Simulate Independent Detachments locally
      const hasMainRadioOp = updatedSoldiers.some(
        (s) =>
          s.detachmentId === 'MAIN' &&
          s.specialty === 'RADIO' &&
          s.status !== 'CAIDO'
      );
      const effectiveRadioRange =
        prev.mainRadioBroken || prev.supplies.batteries <= 0
          ? 0
          : hasMainRadioOp
          ? prev.radioRangeMeters
          : prev.radioRangeMeters * 0.55;

      const updatedDetachments: Detachment[] = prev.detachments.map((det) => {
        let tx = det.targetX;
        let ty = det.targetY;
        if (det.order === 'FOLLOW' || det.order === 'RETURN_MAIN') {
          tx = p.x - 45;
          ty = p.y + 45;
        }

        const dx = tx - det.x;
        const dy = ty - det.y;
        const distToTarget = Math.hypot(dx, dy);
        let nx = det.x;
        let ny = det.y;
        const moveStep = det.supplies.food > 0 ? 38 : 18;
        if (distToTarget > 20 && det.order !== 'HOLD') {
          nx += (dx / distToTarget) * Math.min(moveStep, distToTarget);
          ny += (dy / distToTarget) * Math.min(moveStep, distToTarget);
        }

        // Reveal fog of war around detachment
        const dgx = Math.floor(nx / 200);
        const dgy = Math.floor(ny / 200);
        exploredSet.add(`${dgx},${dgy}`);

        const newEvents = [...det.accumulatedEvents];
        let sitrep = det.situationReport;

        // Execute autonomous actions at destination
        if (det.order === 'SEARCH_SURVIVORS') {
          const foundSol = updatedSoldiers.find(
            (s) =>
              s.detachmentId === 'DISPERSED' &&
              Math.hypot(s.x - nx, s.y - ny) < 160
          );
          if (foundSol) {
            foundSol.detachmentId = det.id;
            det.memberIds = [...det.memberIds, foundSol.id];
            const msg = `Rescatado ${foundSol.rank} ${foundSol.name} (${foundSol.specialty})`;
            newEvents.push(msg);
            sitrep = msg;
          }
        } else if (det.order === 'GATHER_SUPPLIES') {
          const foundCache = updatedPois.find(
            (poi) =>
              poi.type === 'SUPPLY_CACHE' &&
              !poi.interacted &&
              Math.hypot(poi.x - nx, poi.y - ny) < 150
          );
          if (foundCache) {
            foundCache.interacted = true;
            foundCache.discovered = true;
            det.supplies.food += foundCache.suppliesAvailable?.food || 12;
            det.supplies.ammo += foundCache.suppliesAvailable?.ammo || 25;
            const msg = `Suministros recuperados en ${foundCache.name}`;
            newEvents.push(msg);
            sitrep = msg;
          }
        }

        // Check radio contact & signal quality
        const distFromMain = Math.hypot(nx - p.x, ny - p.y);
        const inContact =
          !det.radioBroken &&
          det.hasRadioEquipment &&
          distFromMain <= effectiveRadioRange;
        const sigQuality = inContact
          ? Math.max(
              25,
              Math.round((1 - distFromMain / (effectiveRadioRange + 1)) * 100)
            )
          : 0;

        // If contact just restored after being out of contact, trigger consolidated radio report!
        if (!det.inRadioContact && inContact) {
          const leader = updatedSoldiers.find((s) => s.id === det.leaderId);
          const detSec = getSectorAt(nx, ny);
          requestRadioReport({
            detachment: { ...det, x: nx, y: ny },
            leaderName: leader ? `${leader.rank} ${leader.name}` : 'Suboficial',
            sectorName: detSec.name,
            orderLabel: ORDER_LABELS[det.order],
            signalQuality: sigQuality,
            accumulatedEvents: newEvents,
            isReconnected: true,
          }).then((rep) => {
            soundEngine.playRadioBeep(true);
            showToast(`Radio: Contacto restablecido con ${det.callsign}.`);
            setCampaign((latest) => ({
              ...latest,
              radioLog: [
                {
                  id: `rad_${Date.now()}`,
                  timestamp: latest.dateTime.split('·')[1]?.trim() || '12:00',
                  senderCallsign: det.callsign,
                  senderName: leader ? leader.name : det.name,
                  channel: 'RADIO',
                  signalQuality: sigQuality,
                  urgency: rep.urgency,
                  text: rep.transmission,
                  read: false,
                },
                ...latest.radioLog,
              ],
            }));
          });
        }

        return {
          ...det,
          x: nx,
          y: ny,
          lastKnownX: inContact ? nx : det.lastKnownX,
          lastKnownY: inContact ? ny : det.lastKnownY,
          lastContactTimestamp: inContact
            ? prev.dateTime.split('·')[1]?.trim() || '08:00'
            : det.lastContactTimestamp,
          inRadioContact: inContact,
          signalQuality: sigQuality,
          accumulatedEvents: inContact ? [] : newEvents,
          situationReport: sitrep,
        };
      });

      // 4. Check Main Campaign Bridge & River Crossing Missions
      const updatedMissions = prev.missions.map((m) => {
        if (m.status !== 'ACTIVA') return m;
        if (
          m.id === 'mis_main_2' &&
          p.y > 1580 &&
          Math.hypot(p.x - m.x, p.y - m.y) < 280
        ) {
          soundEngine.playSupplyPickup();
          showToast('¡Misión Cumplida: Cruce del Río Douve en Carentan!');
          p.xp += 80;
          return { ...m, status: 'COMPLETADA' as const };
        }
        if (m.id === 'mis_main_3' && p.x > 2110) {
          soundEngine.playSupplyPickup();
          showToast('¡Misión Cumplida: El Paso del Río Sena!');
          p.xp += 95;
          return { ...m, status: 'COMPLETADA' as const };
        }
        return m;
      });

      // Level up command level every 150 XP
      p.commandLevel = 1 + Math.floor(p.xp / 150);
      p.physicalState =
        p.hp < 45
          ? 'HERIDO'
          : p.stamina < 30
          ? 'EXHAUSTO'
          : p.stamina < 65
          ? 'FATIGADO'
          : 'ESTABLE';

      return {
        ...prev,
        currentSectorId: sector.id,
        protagonist: p,
        soldiers: updatedSoldiers,
        detachments: updatedDetachments,
        pois: updatedPois,
        missions: updatedMissions,
        supplies: {
          ...prev.supplies,
          meds: medsAvailable,
        },
        exploredCells: Array.from(exploredSet),
      };
    });
  };

  // Survival Economy Tick (every 18 seconds of active play)
  const updateSurvivalEconomy = () => {
    setCampaign((prev) => {
      const newMinutes = prev.minutesElapsed + 15;
      const totalHours = 6 + Math.floor((45 + newMinutes) / 60);
      const mins = (45 + newMinutes) % 60;
      const day = 6 + Math.floor(totalHours / 24);
      const hr = totalHours % 24;
      const dateStr = `${day} Jun 1944 · ${String(hr).padStart(2, '0')}:${String(
        mins
      ).padStart(2, '0')}`;

      const p = { ...prev.protagonist };
      const rationMultiplier =
        p.rationPolicy === 'COMPLETA'
          ? 1.5
          : p.rationPolicy === 'EMERGENCIA'
          ? 0.5
          : 1.0;
      const foodConsumed = Math.max(1, Math.round(1.5 * rationMultiplier));
      const waterConsumed = 1;
      const fuelConsumed = p.activeVehicleId ? 2 : 0;
      const batteryDrain = prev.detachments.length > 0 ? 1.5 : 0.5;

      const nextFood = Math.max(0, prev.supplies.food - foodConsumed);
      const nextWater = Math.max(0, prev.supplies.water - waterConsumed);
      const nextFuel = Math.max(0, prev.supplies.fuel - fuelConsumed);
      const nextBattery = Math.max(0, prev.supplies.batteries - batteryDrain);

      if (nextFood === 0 || nextWater === 0) {
        p.groupMorale = Math.max(15, p.groupMorale - 5);
        p.stamina = Math.max(20, p.stamina - 8);
      } else if (p.rationPolicy === 'COMPLETA') {
        p.groupMorale = Math.min(100, p.groupMorale + 2);
      }

      const nextState: CampaignState = {
        ...prev,
        minutesElapsed: newMinutes,
        dateTime: dateStr,
        protagonist: p,
        supplies: {
          ...prev.supplies,
          food: nextFood,
          water: nextWater,
          fuel: nextFuel,
          batteries: nextBattery,
        },
      };

      // Auto-save to LocalStorage
      saveCampaignToLocal(nextState, true);
      return nextState;
    });
  };

  // Detachment creation handler
  const handleCreateDetachment = (
    name: string,
    memberIds: string[],
    food: number,
    ammo: number,
    initialOrder: DetachmentOrderType
  ) => {
    soundEngine.playRadioBeep(false);
    setCampaign((prev) => {
      const members = prev.soldiers.filter((s) => memberIds.includes(s.id));
      if (members.length === 0) return prev;
      const leader =
        members.find((m) => m.specialty === 'OFICIAL') || members[0];
      const hasRadio =
        members.some((m) => m.specialty === 'RADIO') ||
        prev.supplies.batteries > 20;
      const detId = `det_${Date.now()}`;
      const callsign = `GRUPO-${prev.detachments.length + 1}`;

      const actualFood = Math.min(food, prev.supplies.food);
      const actualAmmo = Math.min(ammo, prev.supplies.ammo);

      const newDet: Detachment = {
        id: detId,
        name: name || callsign,
        callsign,
        leaderId: leader.id,
        memberIds,
        x: prev.protagonist.x + 35,
        y: prev.protagonist.y + 35,
        targetX: prev.protagonist.x + 240,
        targetY: prev.protagonist.y + 80,
        lastKnownX: prev.protagonist.x + 35,
        lastKnownY: prev.protagonist.y + 35,
        lastContactTimestamp: prev.dateTime.split('·')[1]?.trim() || '07:00',
        order: initialOrder,
        supplies: {
          food: actualFood,
          water: actualFood,
          ammo: actualAmmo,
          meds: 1,
        },
        morale: Math.round(
          members.reduce((a, b) => a + b.morale, 0) / members.length
        ),
        hasRadioEquipment: hasRadio,
        radioBroken: false,
        inRadioContact: true,
        signalQuality: 96,
        accumulatedEvents: [],
        situationReport: `Destacamento desplegado con orden: ${ORDER_LABELS[initialOrder]}`,
      };

      showToast(
        `${callsign} (${members.length} hombres) desplegado al mando de ${leader.rank} ${leader.name}.`
      );

      return {
        ...prev,
        soldiers: prev.soldiers.map((s) =>
          memberIds.includes(s.id) ? { ...s, detachmentId: detId } : s
        ),
        detachments: [...prev.detachments, newDet],
        supplies: {
          ...prev.supplies,
          food: prev.supplies.food - actualFood,
          ammo: prev.supplies.ammo - actualAmmo,
        },
        eventHistory: [
          {
            id: `ev_${Date.now()}`,
            time: prev.dateTime,
            text: `Creado destacamento ${callsign} (${name}) con ${members.length} efectivos y orden: ${ORDER_LABELS[initialOrder]}.`,
            category: 'MANDO',
          },
          ...prev.eventHistory,
        ],
      };
    });
  };

  // Merge detachment back into Main Column
  const handleMergeDetachment = (detachmentId: string) => {
    soundEngine.playSupplyPickup();
    setCampaign((prev) => {
      const det = prev.detachments.find((d) => d.id === detachmentId);
      if (!det) return prev;
      showToast(`${det.callsign} se ha reintegrado a la Columna Principal.`);
      return {
        ...prev,
        soldiers: prev.soldiers.map((s) =>
          s.detachmentId === detachmentId
            ? {
                ...s,
                detachmentId: 'MAIN',
                x: prev.protagonist.x - 25,
                y: prev.protagonist.y + 25,
              }
            : s
        ),
        detachments: prev.detachments.filter((d) => d.id !== detachmentId),
        supplies: {
          ...prev.supplies,
          food: prev.supplies.food + det.supplies.food,
          ammo: prev.supplies.ammo + det.supplies.ammo,
        },
      };
    });
  };

  // Issue order to a detachment
  const handleIssueDetachmentOrder = (
    detachmentId: string,
    order: DetachmentOrderType,
    targetX?: number,
    targetY?: number
  ) => {
    soundEngine.playRadioBeep(true);
    setCampaign((prev) => {
      const det = prev.detachments.find((d) => d.id === detachmentId);
      if (!det) return prev;

      const dist = Math.hypot(
        det.x - prev.protagonist.x,
        det.y - prev.protagonist.y
      );
      if (!det.inRadioContact && dist > 160) {
        showToast(
          `Imposible transmitir orden: ${det.callsign} está fuera de alcance de radio.`
        );
        return prev;
      }

      const tx =
        targetX ??
        (order === 'RETURN_MAIN' || order === 'FOLLOW'
          ? prev.protagonist.x
          : det.x + 260);
      const ty =
        targetY ??
        (order === 'RETURN_MAIN' || order === 'FOLLOW'
          ? prev.protagonist.y
          : det.y);

      showToast(
        `Orden transmitida a ${det.callsign}: ${ORDER_LABELS[order]}`
      );

      return {
        ...prev,
        supplies: {
          ...prev.supplies,
          batteries: Math.max(0, prev.supplies.batteries - 1),
        },
        detachments: prev.detachments.map((d) =>
          d.id === detachmentId
            ? {
                ...d,
                order,
                targetX: tx,
                targetY: ty,
                situationReport: `Recibida orden: ${ORDER_LABELS[order]} hacia (${Math.round(
                  tx
                )}, ${Math.round(ty)})`,
              }
            : d
        ),
        radioLog: [
          {
            id: `rad_${Date.now()}`,
            timestamp: prev.dateTime.split('·')[1]?.trim() || '08:00',
            senderCallsign: det.callsign,
            senderName: det.name,
            channel: dist < 140 ? 'PRESENCIAL' : 'RADIO',
            signalQuality: det.signalQuality,
            urgency: 'ROUTINE',
            text: `Recibido Águila Uno. Ejecutando orden: "${ORDER_LABELS[order]}" en coordenadas (${Math.round(
              tx
            )}, ${Math.round(ty)}). Cambio.`,
            read: false,
          },
          ...prev.radioLog,
        ],
      };
    });
  };

  // Virtual Joystick Touch Handlers
  const handleJoystickPointer = (
    e: React.PointerEvent<HTMLDivElement>,
    isEnd = false
  ) => {
    if (isEnd) {
      joystickRef.current = { active: false, vx: 0, vy: 0 };
      setStickPos({ x: 0, y: 0 });
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = e.clientX - cx;
    const dy = e.clientY - cy;
    const maxR = 42;
    const dist = Math.min(maxR, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const sx = Math.cos(angle) * dist;
    const sy = Math.sin(angle) * dist;
    setStickPos({ x: sx, y: sy });
    joystickRef.current = {
      active: true,
      vx: sx / maxR,
      vy: sy / maxR,
    };
  };

  const currentSector = getSectorAt(
    campaign.protagonist.x,
    campaign.protagonist.y
  );
  const mainSquadCount = campaign.soldiers.filter(
    (s) => s.detachmentId === 'MAIN' && s.status !== 'CAIDO'
  ).length;
  const activePrimaryMission = campaign.missions.find(
    (m) => m.type === 'PRINCIPAL' && m.status === 'ACTIVA'
  );

  // ============================================================================
  // 1. TITLE MENU SCREEN
  // ============================================================================
  if (screenState === 'TITLE_MENU') {
    return (
      <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto">
        <div className="max-w-4xl mx-auto w-full my-auto space-y-6 py-6">
          <div className="border border-stone-800 bg-stone-900/90 rounded-xl p-6 sm:p-8 shadow-2xl space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-mono text-amber-400 tracking-wider">
                6 DE JUNIO DE 1944 · SECTOR DE NORMANDÍA — FRONTERA DEL RIN
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-stone-100 font-display">
                EL LARGO CAMINO A CASA
              </h1>
              <p className="text-sm sm:text-base text-stone-300 max-w-2xl leading-relaxed">
                Supervivencia táctica 2D, mando de destacamentos, comunicaciones por radio y narrativa dinámica con IA. Encarnas al <strong>Hauptmann Karl von Falken</strong>, aislado tras el desembarco en Normandía. Reúne a los soldados dispersos, gestiona los suministros de tu columna, divide destacamentos autónomos y conduce a tus hombres con vida hasta el Rin.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  soundEngine.playClick();
                  const fresh = createInitialCampaignState();
                  setCampaign(fresh);
                  saveCampaignToLocal(fresh, true);
                  setScreenState('PLAYING');
                }}
                className="py-3.5 px-5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                Iniciar Nueva Campaña (6 Jun 1944)
              </button>

              {hasSavedGame && (
                <button
                  onClick={() => {
                    soundEngine.playClick();
                    setScreenState('PLAYING');
                  }}
                  className="py-3.5 px-5 bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold rounded-lg text-sm flex items-center justify-center gap-2 border border-stone-700 transition-colors cursor-pointer"
                >
                  <Compass className="w-4 h-4 text-amber-400" />
                  Continuar Partida Guardada ({campaign.dateTime})
                </button>
              )}
            </div>

            {/* Secondary Actions: Audio, AI Status & Standalone HTML5 Download */}
            <div className="pt-4 border-t border-stone-800 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-stone-950 border border-stone-800 rounded-lg p-3.5 space-y-2">
                <div className="font-bold text-stone-200 flex items-center justify-between">
                  <span>Motor Narrativo y Comunicaciones IA</span>
                  <span className="font-mono text-amber-400">
                    {aiStatus.mode}
                  </span>
                </div>
                <p className="text-stone-400 leading-relaxed">
                  {aiStatus.message} Las conversaciones con oficiales y soldados utilizan <strong>{aiStatus.model}</strong> en el servidor con respaldo táctico local instantáneo para que la campaña nunca se bloquee.
                </p>
                <button
                  onClick={() => checkGeminiServiceStatus().then(setAiStatus)}
                  className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-semibold"
                >
                  Probar Enlace con Servidor IA
                </button>
              </div>

              <div className="bg-stone-950 border border-stone-800 rounded-lg p-3.5 space-y-2 flex flex-col justify-between">
                <div>
                  <div className="font-bold text-stone-200">
                    Audio Web y Exportación Autónoma (Android / Acode)
                  </div>
                  <p className="text-stone-400 mt-1">
                    Sintetizador Web Audio integrado para pasos, disparos, estática de radio y alertas. También puedes exportar la edición autónoma en un único archivo <code>index.html</code>.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      const nextMute = !muted;
                      setMuted(nextMute);
                      soundEngine.muted = nextMute;
                    }}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 rounded font-semibold flex items-center gap-1.5"
                  >
                    {muted ? (
                      <VolumeX className="w-3.5 h-3.5 text-red-400" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                    )}
                    {muted ? 'Sonido Silenciado' : 'Sonido Activo'}
                  </button>
                  <button
                    onClick={() => exportStandaloneSingleFileHTML(campaign)}
                    className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-amber-300 rounded font-semibold flex items-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Descargar index.html único
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 2. VICTORY OR DEFEAT SCREEN
  // ============================================================================
  if (screenState === 'VICTORY' || screenState === 'GAME_OVER') {
    const survivors = campaign.soldiers.filter(
      (s) => s.detachmentId !== 'DISPERSED' && s.status !== 'CAIDO'
    );
    const fallen = campaign.soldiers.filter((s) => s.status === 'CAIDO');

    return (
      <div className="min-h-screen w-full bg-stone-950 text-stone-100 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-stone-900 border border-stone-700 rounded-xl p-6 sm:p-8 space-y-5 shadow-2xl">
          <div className="text-xs font-mono text-amber-400">
            INFORME FINAL DE CAMPAÑA · {campaign.dateTime}
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold font-display text-stone-100">
            {screenState === 'VICTORY'
              ? '¡LA COLUMNA HA CRUZADO EL RIN!'
              : 'LA COLUMNA HA CAÍDO EN FRANCIA'}
          </h1>
          <p className="text-sm text-stone-300 leading-relaxed">
            {screenState === 'VICTORY'
              ? `Tras abrirse paso desde los setos de Normandía a través de Carentan, Falaise, el Sena y las Ardenas, el Hauptmann Karl von Falken ha alcanzado el puesto fronterizo del Rin junto a ${survivors.length} soldados supervivientes.`
              : campaign.defeatReason ||
                'Las fuerzas bajo tu mando no lograron completar el repliegue hacia Alemania.'}
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono bg-stone-950 p-4 rounded-lg border border-stone-800">
            <div>
              <div className="text-stone-400">Supervivientes</div>
              <div className="text-lg font-bold text-emerald-400">
                {survivors.length} hombres
              </div>
            </div>
            <div>
              <div className="text-stone-400">Bajas en Campaña</div>
              <div className="text-lg font-bold text-red-400">
                {fallen.length} caídos
              </div>
            </div>
            <div>
              <div className="text-stone-400">Reputación Mando</div>
              <div className="text-lg font-bold text-amber-400">
                {campaign.protagonist.reputation}/100
              </div>
            </div>
            <div>
              <div className="text-stone-400">Experiencia</div>
              <div className="text-lg font-bold text-sky-400">
                {campaign.protagonist.xp} XP
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={() => {
                const fresh = createInitialCampaignState();
                setCampaign(fresh);
                saveCampaignToLocal(fresh, true);
                setScreenState('PLAYING');
              }}
              className="py-2.5 px-5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded-lg text-xs flex items-center gap-2"
            >
              <RotateCcw className="w-4 h-4" />
              Iniciar Nueva Campaña
            </button>
            <button
              onClick={() => setScreenState('TITLE_MENU')}
              className="py-2.5 px-5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded-lg text-xs"
            >
              Volver al Menú Principal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // 3. ACTIVE GAMEPLAY VIEW (2D CANVAS + TACTICAL HUD + MOBILE TOUCH CONTROLS)
  // ============================================================================
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-stone-950 select-none touch-none">
      {/* 2D World Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Top Unobtrusive Tactical HUD */}
      <header className="fixed top-0 left-0 right-0 z-20 bg-stone-950/90 border-b border-stone-800 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        {/* Left: Protagonist & Sector Status */}
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-bold text-amber-400 font-display text-sm tracking-wide">
            Hptm. {campaign.protagonist.name}
          </span>
          <span className="font-mono text-stone-200">
            HP {Math.round(campaign.protagonist.hp)}% · Stamina{' '}
            {Math.round(campaign.protagonist.stamina)}%
          </span>
          <span className="hidden sm:inline text-stone-500">·</span>
          <span className="font-mono text-stone-300">
            Columna: {mainSquadCount}h · Destacamentos:{' '}
            {campaign.detachments.length}
          </span>
          <span className="hidden md:inline text-stone-500">·</span>
          <span className="hidden md:inline font-mono text-amber-200/90">
            S{currentSector.id}: {currentSector.name} ({campaign.dateTime})
          </span>
        </div>

        {/* Right: Critical Supplies & Pause */}
        <div className="flex items-center gap-3 font-mono">
          <span title="Raciones de comida">Raciones: {campaign.supplies.food}</span>
          <span title="Cartuchos de munición" className="text-amber-400">
            Munición: {campaign.supplies.ammo}
          </span>
          <span title="Botiquines médicos" className="hidden sm:inline text-emerald-400">
            Botiquines: {campaign.supplies.meds}
          </span>
          <span title="Carga de batería de radio" className="text-sky-400">
            Radio: {Math.round(campaign.supplies.batteries)}%
          </span>
          <button
            onClick={() => {
              soundEngine.playClick();
              setScreenState((prev) =>
                prev === 'PAUSED' ? 'PLAYING' : 'PAUSED'
              );
            }}
            className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded border border-stone-700 flex items-center gap-1"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pausa</span>
          </button>
        </div>
      </header>

      {/* Active Mission Strip & Discrete Toast Notification */}
      <div className="fixed top-12 left-3 right-3 z-10 pointer-events-none flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        {activePrimaryMission && (
          <div className="bg-stone-950/85 border border-stone-800 px-3 py-1.5 rounded text-xs text-stone-200 max-w-md">
            <span className="text-amber-400 font-bold">
              Objetivo Activo ({activePrimaryMission.title}):
            </span>{' '}
            {activePrimaryMission.objective}
          </div>
        )}
        {toastMsg && (
          <div className="bg-amber-950/95 border border-amber-600/80 text-amber-100 px-3 py-1.5 rounded text-xs font-medium shadow-lg">
            {toastMsg}
          </div>
        )}
      </div>

      {/* Bottom Tactical Command Bar (Map, Soldiers, Detachments, Radio, Inventory, Missions) */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-stone-950/90 border border-stone-700 px-2.5 py-1.5 rounded-lg shadow-xl max-w-[96vw] overflow-x-auto">
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('MAP');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Map className="w-3.5 h-3.5 text-amber-400" />
          Mapa
        </button>
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('DESTACAMENTOS');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Flag className="w-3.5 h-3.5 text-sky-400" />
          Órdenes ({campaign.detachments.length})
        </button>
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('SOLDADOS');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Users className="w-3.5 h-3.5 text-emerald-400" />
          Soldados ({mainSquadCount})
        </button>
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('RADIO');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Radio className="w-3.5 h-3.5 text-sky-400" />
          Radio
        </button>
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('INVENTARIO');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Backpack className="w-3.5 h-3.5 text-amber-400" />
          Inventario
        </button>
        <button
          onClick={() => {
            soundEngine.playClick();
            setActiveModal('MISIONES');
          }}
          className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center gap-1 whitespace-nowrap shrink-0"
        >
          <Compass className="w-3.5 h-3.5 text-amber-400" />
          Misiones
        </button>
      </div>

      {/* Left Virtual Touch Joystick (Mobile + Tablet + Mouse drag) */}
      <div
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          handleJoystickPointer(e, false);
        }}
        onPointerMove={(e) => {
          if (joystickRef.current.active) handleJoystickPointer(e, false);
        }}
        onPointerUp={() => handleJoystickPointer({} as React.PointerEvent<HTMLDivElement>, true)}
        onPointerCancel={() =>
          handleJoystickPointer({} as React.PointerEvent<HTMLDivElement>, true)
        }
        className="fixed bottom-16 left-4 z-20 w-28 h-28 rounded-full bg-stone-900/70 border-2 border-stone-600/80 flex items-center justify-center touch-none cursor-pointer"
      >
        <div
          style={{
            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`,
          }}
          className="w-11 h-11 rounded-full bg-amber-500/90 border-2 border-amber-200 shadow-md pointer-events-none"
        />
      </div>

      {/* Right Mobile Action Pad (Interact, Sprint, Fire, Stance Toggle) */}
      <div className="fixed bottom-16 right-4 z-20 flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              soundEngine.playClick();
              setCampaign((prev) => ({
                ...prev,
                protagonist: {
                  ...prev.protagonist,
                  combatStance:
                    prev.protagonist.combatStance === 'DEFENSIVE_FIRE'
                      ? 'STEALTH_HOLD_FIRE'
                      : 'DEFENSIVE_FIRE',
                },
              }));
            }}
            className={`px-3 py-2.5 rounded-lg font-bold text-xs border flex items-center gap-1.5 shadow-lg ${
              campaign.protagonist.combatStance === 'STEALTH_HOLD_FIRE'
                ? 'bg-emerald-800/90 border-emerald-400 text-emerald-100'
                : 'bg-stone-900/90 border-stone-600 text-stone-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            {campaign.protagonist.combatStance === 'STEALTH_HOLD_FIRE'
              ? 'Sigilo / Evasión'
              : 'Fuego a Discreción'}
          </button>

          <button
            onPointerDown={() => {
              sprintingRef.current = true;
              setIsSprintingUI(true);
            }}
            onPointerUp={() => {
              sprintingRef.current = false;
              setIsSprintingUI(false);
            }}
            onPointerLeave={() => {
              sprintingRef.current = false;
              setIsSprintingUI(false);
            }}
            className={`px-3.5 py-2.5 rounded-lg font-bold text-xs border flex items-center gap-1.5 shadow-lg ${
              isSprintingUI
                ? 'bg-amber-500 text-stone-950 border-amber-300'
                : 'bg-stone-900/90 text-stone-200 border-stone-600'
            }`}
          >
            <Zap className="w-4 h-4" />
            Correr
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleFireWeapon}
            className="px-4 py-3 rounded-lg bg-red-800/90 hover:bg-red-700 active:bg-red-600 border border-red-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg"
          >
            <Crosshair className="w-4 h-4" />
            Disparar
          </button>

          <button
            onClick={handleInteractAction}
            className="px-4 py-3 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-400 border border-amber-300 text-stone-950 font-bold text-xs flex items-center gap-1.5 shadow-lg"
          >
            <Hand className="w-4 h-4" />
            Interactuar
          </button>
        </div>
      </div>

      {/* Pause Overlay Modal */}
      {screenState === 'PAUSED' && (
        <div className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-700 rounded-xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h2 className="text-xl font-bold text-amber-400 font-display">
              Partida en Pausa · {campaign.dateTime}
            </h2>
            <p className="text-xs text-stone-400">
              Sector actual: {currentSector.name} ({currentSector.region}).
            </p>

            <div className="space-y-2">
              <button
                onClick={() => setScreenState('PLAYING')}
                className="w-full py-2.5 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold rounded text-xs"
              >
                Reanudar Operaciones
              </button>
              <button
                onClick={() => saveCampaignToLocal(campaign, false)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-100 font-semibold rounded text-xs border border-stone-700"
              >
                Guardar Partida Manualmente
              </button>
              <button
                onClick={() => exportStandaloneSingleFileHTML(campaign)}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-amber-300 font-semibold rounded text-xs border border-stone-700 flex items-center justify-center gap-1.5"
              >
                <Download className="w-4 h-4" />
                Descargar index.html Autónomo (Android / Acode)
              </button>
              <button
                onClick={() => {
                  const nextMute = !muted;
                  setMuted(nextMute);
                  soundEngine.muted = nextMute;
                }}
                className="w-full py-2.5 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold rounded text-xs border border-stone-700"
              >
                {muted ? 'Activar Sonido' : 'Silenciar Sonido'}
              </button>
              <button
                onClick={() => setScreenState('TITLE_MENU')}
                className="w-full py-2.5 bg-red-950/60 hover:bg-red-900/70 text-red-200 font-semibold rounded text-xs border border-red-800/60"
              >
                Salir al Menú Principal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Strategic Map Modal */}
      {activeModal === 'MAP' && (
        <StrategicMapModal
          state={campaign}
          onClose={() => setActiveModal('NONE')}
          onIssueDetachmentOrder={handleIssueDetachmentOrder}
        />
      )}

      {/* Soldiers, Detachments & AI Dialogue Modal */}
      {(activeModal === 'SOLDADOS' ||
        activeModal === 'DESTACAMENTOS' ||
        activeModal === 'DIALOGO') && (
        <ForcesAndDialogueModal
          state={campaign}
          initialTab={activeModal}
          initialSoldierId={selectedDialogSoldierId}
          onClose={() => setActiveModal('NONE')}
          onHealSoldier={(solId) => {
            soundEngine.playSupplyPickup();
            setCampaign((prev) => {
              if (prev.supplies.meds <= 0) return prev;
              return {
                ...prev,
                supplies: { ...prev.supplies, meds: prev.supplies.meds - 1 },
                soldiers: prev.soldiers.map((s) =>
                  s.id === solId
                    ? {
                        ...s,
                        hp: Math.min(s.maxHp, s.hp + 40),
                        status: 'ESTABLE' as const,
                        morale: Math.min(100, s.morale + 6),
                      }
                    : s
                ),
              };
            });
          }}
          onCreateDetachment={handleCreateDetachment}
          onMergeDetachment={handleMergeDetachment}
          onIssueDetachmentOrder={(detId, ord) =>
            handleIssueDetachmentOrder(detId, ord)
          }
          onRecordSoldierMemory={(solId, note, trustDelta) => {
            setCampaign((prev) => ({
              ...prev,
              soldiers: prev.soldiers.map((s) =>
                s.id === solId
                  ? {
                      ...s,
                      trust: Math.min(100, Math.max(0, s.trust + trustDelta)),
                      memories: [...s.memories.slice(-7), note],
                    }
                  : s
              ),
            }));
          }}
        />
      )}

      {/* Radio, Inventory & Missions Modal */}
      {(activeModal === 'RADIO' ||
        activeModal === 'INVENTARIO' ||
        activeModal === 'MISIONES') && (
        <CommandPanelsModal
          state={campaign}
          initialView={activeModal}
          onClose={() => setActiveModal('NONE')}
          onRepairMainRadio={() => {
            soundEngine.playSupplyPickup();
            setCampaign((prev) => ({
              ...prev,
              mainRadioBroken: false,
              supplies: {
                ...prev.supplies,
                tools: Math.max(0, prev.supplies.tools - 1),
                spareParts: Math.max(0, prev.supplies.spareParts - 1),
              },
            }));
            showToast('Equipo de radio Torn.Eb reparado y operativo.');
          }}
          onRequestAllSitrep={() => {
            soundEngine.playRadioBeep(true);
            campaign.detachments.forEach((det) => {
              if (!det.inRadioContact) return;
              const leader = campaign.soldiers.find(
                (s) => s.id === det.leaderId
              );
              const sec = getSectorAt(det.x, det.y);
              requestRadioReport({
                detachment: det,
                leaderName: leader ? `${leader.rank} ${leader.name}` : det.name,
                sectorName: sec.name,
                orderLabel: ORDER_LABELS[det.order],
                signalQuality: det.signalQuality,
                accumulatedEvents: det.accumulatedEvents,
                isReconnected: false,
              }).then((rep) => {
                setCampaign((latest) => ({
                  ...latest,
                  supplies: {
                    ...latest.supplies,
                    batteries: Math.max(0, latest.supplies.batteries - 2),
                  },
                  radioLog: [
                    {
                      id: `rad_${Date.now()}_${det.id}`,
                      timestamp:
                        latest.dateTime.split('·')[1]?.trim() || '09:00',
                      senderCallsign: det.callsign,
                      senderName: leader ? leader.name : det.name,
                      channel: 'RADIO',
                      signalQuality: det.signalQuality,
                      urgency: rep.urgency,
                      text: rep.transmission,
                      read: false,
                    },
                    ...latest.radioLog,
                  ],
                }));
              });
            });
          }}
          onUseProtagonistMedkit={() => {
            soundEngine.playSupplyPickup();
            setCampaign((prev) => ({
              ...prev,
              supplies: {
                ...prev.supplies,
                meds: Math.max(0, prev.supplies.meds - 1),
              },
              protagonist: {
                ...prev.protagonist,
                hp: Math.min(
                  prev.protagonist.maxHp,
                  prev.protagonist.hp + 35
                ),
              },
            }));
          }}
          onUseProtagonistRation={() => {
            soundEngine.playSupplyPickup();
            setCampaign((prev) => ({
              ...prev,
              supplies: {
                ...prev.supplies,
                food: Math.max(0, prev.supplies.food - 1),
              },
              protagonist: {
                ...prev.protagonist,
                stamina: Math.min(
                  prev.protagonist.maxStamina,
                  prev.protagonist.stamina + 45
                ),
              },
            }));
          }}
          onRepairEquipmentItem={(itemId) => {
            soundEngine.playSupplyPickup();
            setCampaign((prev) => ({
              ...prev,
              supplies: {
                ...prev.supplies,
                spareParts: Math.max(0, prev.supplies.spareParts - 1),
              },
              protagonist: {
                ...prev.protagonist,
                inventory: prev.protagonist.inventory.map((it) =>
                  it.id === itemId ? { ...it, durability: 100 } : it
                ),
              },
            }));
          }}
          onChangeRationPolicy={(pol) =>
            setCampaign((prev) => ({
              ...prev,
              protagonist: { ...prev.protagonist, rationPolicy: pol },
            }))
          }
          onChangeMarchPace={(pace) =>
            setCampaign((prev) => ({
              ...prev,
              protagonist: { ...prev.protagonist, marchPace: pace },
            }))
          }
        />
      )}
    </div>
  );
}
