export type Specialty =
  | 'OFICIAL'
  | 'INFANTERIA'
  | 'SANITARIO'
  | 'INGENIERO'
  | 'EXPLORADOR'
  | 'CONDUCTOR'
  | 'RADIO';

export type DetachmentOrderType =
  | 'FOLLOW'
  | 'HOLD'
  | 'SCOUT'
  | 'SEARCH_SURVIVORS'
  | 'GATHER_SUPPLIES'
  | 'ESCORT_VEHICLE'
  | 'COMPLETE_MISSION'
  | 'RETURN_MAIN'
  | 'RENDEZVOUS'
  | 'REPORT_STATUS';

export interface EquipmentItem {
  id: string;
  name: string;
  category:
    | 'UNIFORME'
    | 'ARMA'
    | 'SANIDAD'
    | 'RADIO'
    | 'HERRAMIENTA'
    | 'OPTICA'
    | 'RACION'
    | 'TRANSPORTE';
  weight: number; // kg
  durability: number; // 0-100
  maxDurability: number;
  equipped: boolean;
  description: string;
  effectText: string;
  iconType: string;
  quantity?: number;
}

export interface Soldier {
  id: string;
  name: string;
  rank: string;
  specialty: Specialty;
  hp: number;
  maxHp: number;
  stamina: number;
  morale: number; // 0-100
  xp: number;
  trust: number; // 0-100 relationship with Hauptmann
  personality: string;
  motivation: string;
  bio: string;
  equipment: string[]; // item names
  detachmentId: string; // 'MAIN' or detachment id, or 'DISPERSED' if not yet recruited
  status: 'ESTABLE' | 'HERIDO' | 'FATIGADO' | 'CRITICO' | 'CAIDO';
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  memories: string[];
  lastShotTime?: number;
}

export interface Supplies {
  food: number; // raciones
  water: number; // cantimploras
  ammo: number; // cartuchos
  meds: number; // botiquines / vendas
  fuel: number; // litros / bidones
  batteries: number; // % carga acumuladores radio
  tools: number; // juegos de herramientas
  spareParts: number; // piezas de repuesto
}

export interface Detachment {
  id: string;
  name: string;
  callsign: string;
  leaderId: string;
  memberIds: string[];
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  lastKnownX: number;
  lastKnownY: number;
  lastContactTimestamp: string;
  order: DetachmentOrderType;
  missionId?: string;
  supplies: {
    food: number;
    water: number;
    ammo: number;
    meds: number;
  };
  morale: number;
  hasRadioEquipment: boolean;
  radioBroken: boolean;
  inRadioContact: boolean;
  signalQuality: number; // 0-100
  accumulatedEvents: string[];
  situationReport: string;
}

export interface RadioMessage {
  id: string;
  timestamp: string;
  senderCallsign: string;
  senderName: string;
  channel: 'RADIO' | 'PRESENCIAL' | 'MENSAJERO';
  signalQuality: number;
  urgency: 'ROUTINE' | 'PRIORITY' | 'DISTRESS';
  text: string;
  read: boolean;
}

export interface Mission {
  id: string;
  title: string;
  type: 'PRINCIPAL' | 'SECUNDARIA';
  sectorId: number;
  context: string;
  objective: string;
  x: number;
  y: number;
  radius: number;
  status: 'ACTIVA' | 'COMPLETADA' | 'FALLIDA' | 'IGNORADA';
  complications: string;
  rewards: Partial<Supplies> & { xp?: number; reputation?: number; unlocksVehicleId?: string };
  consequenceText: string;
  alternativeOptions?: {
    id: string;
    label: string;
    description: string;
    cost?: Partial<Supplies>;
  }[];
}

export interface WorldObstacle {
  id: string;
  type:
    | 'HEDGEROW'
    | 'FOREST'
    | 'BUILDING'
    | 'RUIN'
    | 'TRENCH'
    | 'RIVER'
    | 'BRIDGE'
    | 'SANDBAG'
    | 'CRATER';
  x: number;
  y: number;
  w: number;
  h: number;
  blocksMovement: boolean;
  blocksSight: boolean;
  providesCover: boolean;
  label?: string;
}

export interface WorldPOI {
  id: string;
  name: string;
  type:
    | 'SUPPLY_CACHE'
    | 'ABANDONED_VEHICLE'
    | 'RADIO_RELAY'
    | 'FRENCH_FARM'
    | 'FIELD_HOSPITAL'
    | 'SABOTAGE_TARGET'
    | 'RHINE_CHECKPOINT';
  x: number;
  y: number;
  sectorId: number;
  discovered: boolean;
  interacted: boolean;
  description: string;
  suppliesAvailable?: Partial<Supplies>;
  vehicleType?: 'KUBELWAGEN' | 'SDKFZ251' | 'OPEL_BLITZ';
  requiresRepair?: boolean;
  repaired?: boolean;
}

export interface EnemyUnit {
  id: string;
  name: string;
  type: 'PATROL' | 'GARRISON' | 'CHECKPOINT';
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  patrolRadius: number;
  hp: number;
  maxHp: number;
  troopCount: number;
  alertState: 'UNAWARE' | 'SUSPICIOUS' | 'COMBAT' | 'NEUTRALIZED' | 'EVADED';
  angle: number;
  lastShotTime: number;
  canNegotiate?: boolean;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fromAlly: boolean;
  damage: number;
  ttl: number;
}

export interface FloatingEffect {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  ttl: number;
}

export interface Protagonist {
  name: string;
  rank: string;
  age: number;
  unit: string;
  bio: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  physicalState: 'ESTABLE' | 'FATIGADO' | 'HERIDO' | 'EXHAUSTO';
  xp: number;
  commandLevel: number;
  reputation: number; // 0-100
  groupMorale: number; // 0-100
  maxCarryWeight: number;
  inventory: EquipmentItem[];
  activeVehicleId: string | null;
  combatStance: 'DEFENSIVE_FIRE' | 'STEALTH_HOLD_FIRE';
  rationPolicy: 'COMPLETA' | 'NORMAL' | 'EMERGENCIA';
  marchPace: 'NORMAL' | 'FORZADA' | 'SIGILO';
}

export interface CampaignState {
  version: number;
  dateTime: string; // e.g., "6 Jun 1944 - 08:30"
  minutesElapsed: number;
  currentSectorId: number;
  protagonist: Protagonist;
  soldiers: Soldier[];
  detachments: Detachment[];
  supplies: Supplies;
  missions: Mission[];
  pois: WorldPOI[];
  enemies: EnemyUnit[];
  radioLog: RadioMessage[];
  eventHistory: { id: string; time: string; text: string; category: 'MANDO' | 'COMBATE' | 'RADIO' | 'SUMINISTROS' | 'DECISION' }[];
  exploredCells: string[]; // "gx,gy" grid coordinates for Fog of War
  radioRangeMeters: number;
  mainRadioBroken: boolean;
  victoryAchieved: boolean;
  defeatReason: string | null;
}
