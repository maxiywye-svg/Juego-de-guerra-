import { Detachment, Protagonist, Soldier, Supplies } from './types';

export interface NPCDialogueResponse {
  reply: string;
  tone: string;
  suggestedOrder: string;
  memoryNote: string;
  source: 'GEMINI' | 'RESPALDO_LOCAL';
}

export interface RadioReportResponse {
  transmission: string;
  urgency: 'ROUTINE' | 'PRIORITY' | 'DISTRESS';
  source: 'GEMINI' | 'RESPALDO_LOCAL';
}

let activeRequestCount = 0;

export async function checkGeminiServiceStatus(): Promise<{
  available: boolean;
  model: string;
  mode: string;
  message: string;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch('/api/gemini/status', { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error('Estado HTTP ' + res.status);
    return await res.json();
  } catch {
    return {
      available: false,
      model: 'gemini-3.8-flash',
      mode: 'RESPALDO_LOCAL',
      message: 'Modo táctico autónomo activo con diálogos locales de respaldo.',
    };
  }
}

export function generateLocalFallbackDialogue(
  npc: Soldier,
  protagonist: Protagonist,
  supplies: Supplies,
  sectorName: string,
  playerMessage: string
): NPCDialogueResponse {
  const q = playerMessage.toLowerCase();
  let reply = '';
  let tone = 'Firme';
  let suggestedOrder = 'NONE';

  const lowFood = supplies.food < 15;
  const lowAmmo = supplies.ammo < 40;
  const lowMeds = supplies.meds < 2;
  const lowBattery = supplies.batteries < 30;

  if (npc.specialty === 'OFICIAL') {
    tone = npc.morale < 55 ? 'Preocupado' : 'Disciplinado';
    if (q.includes('estado') || q.includes('informe')) {
      reply = `Herr Hauptmann, nos encontramos en ${sectorName}. Mi salud está al ${npc.hp}% y la moral de la tropa se mantiene en ${protagonist.groupMorale}%. ${
        lowFood
          ? 'Debemos racionar los víveres de inmediato o buscar suministros.'
          : 'Los hombres están listos para marchar hacia el este.'
      }`;
      suggestedOrder = lowFood ? 'GATHER_SUPPLIES' : 'FOLLOW';
    } else if (q.includes('consejo') || q.includes('opini') || q.includes('orden')) {
      if (protagonist.reputation < 55) {
        tone = 'Discrepante';
        reply = `Con el debido respeto, Hauptmann von Falken, hemos asumido demasiados riesgos últimamente. Sugiero evitar enfrentamientos frontales y asegurar suministros antes de cruzar el siguiente puente.`;
        suggestedOrder = 'SCOUT';
      } else {
        reply = `Señor, sugiero destacar un grupo ligero de exploración mientras el grueso de la columna avanza cubierto por los setos de ${sectorName}.`;
        suggestedOrder = 'SCOUT';
      }
    } else {
      reply = `A sus órdenes, Herr Hauptmann. En ${sectorName} cada cruce puede ocultar paracaidistas aliados; mantendré a los hombres en formación.`;
    }
  } else if (npc.specialty === 'SANITARIO') {
    tone = lowMeds || npc.hp < 70 ? 'Urgente' : 'Sereno';
    if (q.includes('herido') || q.includes('salud') || q.includes('médic') || q.includes('estado')) {
      reply = `Herr Hauptmann, nos quedan ${supplies.meds} botiquines sanitarios en la reserva. ${
        lowMeds
          ? 'Si sufrimos otro tiroteo sin reponer vendas y morfina, no podré estabilizar a las bajas.'
          : 'Tengo las vendas listas; atenderé a cualquier soldado que caiga por debajo del 80% de salud.'
      }`;
      suggestedOrder = lowMeds ? 'GATHER_SUPPLIES' : 'HEAL';
    } else {
      reply = `Mi prioridad son los heridos de la columna, señor. En ${sectorName} el cansancio empieza a notarse; no fuerce la marcha si no es imprescindible.`;
    }
  } else if (npc.specialty === 'RADIO') {
    tone = lowBattery ? 'Inquieto' : 'Metódico';
    reply = `Informe técnico desde ${sectorName}, Herr Hauptmann: los acumuladores de radio están al ${Math.round(
      supplies.batteries
    )}%. ${
      lowBattery
        ? 'Necesitamos baterías o una estación de relevo pronto, o perderemos el enlace con los destacamentos alejados.'
        : 'La frecuencia de campaña está limpia dentro del radio de alcance.'
    }`;
    suggestedOrder = lowBattery ? 'GATHER_SUPPLIES' : 'NONE';
  } else if (npc.specialty === 'CONDUCTOR') {
    tone = 'Pragmático';
    reply = `Herr Hauptmann, disponemos de ${supplies.fuel} litros de combustible y ${supplies.tools} juegos de herramientas. ${
      protagonist.activeVehicleId
        ? 'El motor responde bien, pero vigile el consumo en las cuestas.'
        : 'Si encontramos un Kübelwagen o un semioruga Sd.Kfz. 251 abandonado, puedo ponerlo en marcha.'
    }`;
    suggestedOrder = 'ESCORT_VEHICLE';
  } else if (npc.specialty === 'INGENIERO') {
    tone = 'Resuelto';
    reply = `En ${sectorName} los puentes y pasos son la clave, señor. Contamos con ${supplies.tools} herramientas y ${supplies.spareParts} piezas de repuesto para reparaciones o sabotajes tácticos.`;
    suggestedOrder = 'COMPLETE_MISSION';
  } else if (npc.specialty === 'EXPLORADOR') {
    tone = 'Observador';
    reply = `He observado el terreno en ${sectorName}, Herr Hauptmann. Si cambiamos a postura de sigilo y aprovechamos los bosques y trincheras, podemos esquivar a las patrullas sin gastar los ${supplies.ammo} cartuchos que nos quedan.`;
    suggestedOrder = 'SCOUT';
  } else {
    // INFANTERIA (e.g. young Gefreiter Weber)
    tone = npc.morale < 65 ? 'Nervioso' : 'Leal';
    reply = `¡Señor! Estamos en ${sectorName}. Nos quedan ${supplies.ammo} proyectiles y ${supplies.food} raciones. ${
      lowAmmo
        ? 'Andamos escasos de munición, Herr Hauptmann... espero que no nos tiendan una emboscada.'
        : 'Con usted al mando, confío en que lograremos llegar hasta el Rin.'
    }`;
    suggestedOrder = 'FOLLOW';
  }

  return {
    reply,
    tone,
    suggestedOrder,
    memoryNote: `Conversó con el Hauptmann en ${sectorName} sobre: "${playerMessage.slice(0, 40)}"`,
    source: 'RESPALDO_LOCAL',
  };
}

export async function requestNPCDialogue(params: {
  npc: Soldier;
  protagonist: Protagonist;
  supplies: Supplies;
  sectorName: string;
  dateStr: string;
  mainSquadCount: number;
  detachmentCount: number;
  activeMissionTitle: string;
  playerMessage: string;
  interactionType?: string;
}): Promise<NPCDialogueResponse> {
  if (activeRequestCount >= 2) {
    return generateLocalFallbackDialogue(
      params.npc,
      params.protagonist,
      params.supplies,
      params.sectorName,
      params.playerMessage
    );
  }

  activeRequestCount++;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);

    const response = await fetch('/api/gemini/npc-dialogue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        npc: params.npc,
        protagonist: params.protagonist,
        campaignContext: {
          sectorName: params.sectorName,
          dateStr: params.dateStr,
          supplies: params.supplies,
          mainSquadCount: params.mainSquadCount,
          detachmentCount: params.detachmentCount,
          activeMissionTitle: params.activeMissionTitle,
        },
        playerMessage: params.playerMessage,
        interactionType: params.interactionType || 'CONVERSACION_PRESENCIAL',
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error('Status ' + response.status);
    }

    const data = await response.json();
    if (!data || typeof data.reply !== 'string') {
      throw new Error('Formato inválido');
    }

    return {
      reply: data.reply,
      tone: data.tone || 'Firme',
      suggestedOrder: data.suggestedOrder || 'NONE',
      memoryNote:
        data.memoryNote ||
        `Habló con el Hauptmann en ${params.sectorName}: "${params.playerMessage.slice(0, 35)}"`,
      source: 'GEMINI',
    };
  } catch {
    return generateLocalFallbackDialogue(
      params.npc,
      params.protagonist,
      params.supplies,
      params.sectorName,
      params.playerMessage
    );
  } finally {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
  }
}

export async function requestRadioReport(params: {
  detachment: Detachment;
  leaderName: string;
  sectorName: string;
  orderLabel: string;
  signalQuality: number;
  accumulatedEvents: string[];
  isReconnected: boolean;
}): Promise<RadioReportResponse> {
  const fallback = (): RadioReportResponse => {
    const staticNoise = params.signalQuality < 55 ? '...kzzzt... ' : '';
    const eventsSummary =
      params.accumulatedEvents.length > 0
        ? `Novedades acumuladas: ${params.accumulatedEvents.slice(-2).join(' · ')}.`
        : 'Sin bajas que lamentar en el sector.';
    const prefix = params.isReconnected
      ? `[ENLACE RESTABLECIDO] ¡Aquí ${params.detachment.callsign} (${params.leaderName})! Recuperamos señal con Águila Uno. `
      : `Aquí ${params.detachment.callsign} al mando de ${params.leaderName}. `;

    return {
      transmission: `${prefix}${staticNoise}Posición en ${params.sectorName} (${Math.round(
        params.detachment.x
      )}, ${Math.round(params.detachment.y)}). Orden: ${params.orderLabel}. Efectivos: ${
        params.detachment.memberIds.length
      } hombres, moral ${params.detachment.morale}%, raciones ${
        params.detachment.supplies.food
      }. ${eventsSummary} Cambio.`,
      urgency:
        params.detachment.morale < 45 || params.detachment.supplies.food <= 2
          ? 'DISTRESS'
          : params.isReconnected
          ? 'PRIORITY'
          : 'ROUTINE',
      source: 'RESPALDO_LOCAL',
    };
  };

  if (activeRequestCount >= 2) {
    return fallback();
  }

  activeRequestCount++;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('/api/gemini/radio-report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        detachment: {
          name: params.detachment.name,
          leaderName: params.leaderName,
          sectorName: params.sectorName,
          x: params.detachment.x,
          y: params.detachment.y,
          memberCount: params.detachment.memberIds.length,
          morale: params.detachment.morale,
          orderLabel: params.orderLabel,
          supplies: params.detachment.supplies,
        },
        signalQuality: params.signalQuality,
        accumulatedEvents: params.accumulatedEvents,
        isReconnected: params.isReconnected,
      }),
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error('Error radio report');
    const data = await res.json();
    if (!data || typeof data.transmission !== 'string') throw new Error('Invalid JSON');
    return {
      transmission: data.transmission,
      urgency: data.urgency || 'ROUTINE',
      source: 'GEMINI',
    };
  } catch {
    return fallback();
  } finally {
    activeRequestCount = Math.max(0, activeRequestCount - 1);
  }
}
