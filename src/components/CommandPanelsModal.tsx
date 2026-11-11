import React, { useState } from 'react';
import { CampaignState } from '../game/types';
import {
  Backpack,
  BatteryCharging,
  ClipboardList,
  Compass,
  Radio,
  Wrench,
  X,
} from 'lucide-react';

interface CommandPanelsModalProps {
  state: CampaignState;
  initialView: 'RADIO' | 'INVENTARIO' | 'MISIONES';
  onClose: () => void;
  onRepairMainRadio: () => void;
  onRequestAllSitrep: () => void;
  onUseProtagonistMedkit: () => void;
  onUseProtagonistRation: () => void;
  onRepairEquipmentItem: (itemId: string) => void;
  onChangeRationPolicy: (policy: 'COMPLETA' | 'NORMAL' | 'EMERGENCIA') => void;
  onChangeMarchPace: (pace: 'NORMAL' | 'FORZADA' | 'SIGILO') => void;
}

export const CommandPanelsModal: React.FC<CommandPanelsModalProps> = ({
  state,
  initialView,
  onClose,
  onRepairMainRadio,
  onRequestAllSitrep,
  onUseProtagonistMedkit,
  onUseProtagonistRation,
  onRepairEquipmentItem,
  onChangeRationPolicy,
  onChangeMarchPace,
}) => {
  const [view, setView] = useState<'RADIO' | 'INVENTARIO' | 'MISIONES'>(
    initialView
  );

  const p = state.protagonist;
  const totalWeight = p.inventory
    .reduce((acc, it) => acc + it.weight, 0)
    .toFixed(1);
  const hasRadioOperator = state.soldiers.some(
    (s) =>
      s.detachmentId === 'MAIN' &&
      s.specialty === 'RADIO' &&
      s.status !== 'CAIDO'
  );

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-lg w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950">
          <h2 className="text-lg font-bold tracking-wide text-amber-400 font-display">
             Intendencia, Comunicaciones por Radio y Diario de Campaña
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-100 bg-stone-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Sub-nav */}
        <div className="flex items-center gap-2 px-4 py-2 bg-stone-950/70 border-b border-stone-800">
          <button
            onClick={() => setView('INVENTARIO')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              view === 'INVENTARIO'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Inventario y Suministros
          </button>
          <button
            onClick={() => setView('RADIO')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              view === 'RADIO'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Central de Radio ({state.radioLog.length})
          </button>
          <button
            onClick={() => setView('MISIONES')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              view === 'MISIONES'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Misiones e Historial
          </button>
        </div>

        {/* View 1: INVENTARIO Y SUMINISTROS */}
        {view === 'INVENTARIO' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Protagonist Status & Personal Gear */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <div className="border-b border-stone-800 pb-2">
                <h3 className="text-sm font-bold text-amber-400">
                  {p.rank} {p.name} · Estado y Equipo Personal
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">{p.bio}</p>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs font-mono bg-stone-900 p-2.5 rounded border border-stone-800">
                <div>Salud: {Math.round(p.hp)}/{p.maxHp} ({p.physicalState})</div>
                <div>Resistencia: {Math.round(p.stamina)}/{p.maxStamina}</div>
                <div>Reputación: {p.reputation}/100</div>
                <div>Moral Grupo: {p.groupMorale}/100</div>
                <div>Nivel de Mando: {p.commandLevel} (XP {p.xp})</div>
                <div>Carga: {totalWeight}/{p.maxCarryWeight} kg</div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  disabled={p.hp >= p.maxHp || state.supplies.meds <= 0}
                  onClick={onUseProtagonistMedkit}
                  className="flex-1 py-1.5 px-3 bg-emerald-700 hover:bg-emerald-600 disabled:bg-stone-800 disabled:text-stone-500 text-white rounded text-xs font-semibold"
                >
                  Usar Botiquín (+35 HP)
                </button>
                <button
                  disabled={p.stamina >= p.maxStamina || state.supplies.food <= 0}
                  onClick={onUseProtagonistRation}
                  className="flex-1 py-1.5 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 disabled:text-stone-500 text-stone-950 rounded text-xs font-semibold"
                >
                  Consumir Ración (+45 Stamina)
                </button>
              </div>

              <h4 className="text-xs font-bold text-stone-300 pt-1">
                Equipamiento Histórico (1944):
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {p.inventory.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded bg-stone-900 border border-stone-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-stone-100">
                        {item.name}{' '}
                        <span className="font-mono text-[11px] text-stone-400">
                          ({item.weight} kg · Estado {item.durability}%)
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-400">
                        {item.description}
                      </div>
                      <div className="text-[11px] text-amber-400/90 mt-0.5">
                        {item.effectText}
                      </div>
                    </div>
                    {item.durability < 90 && (
                      <button
                        disabled={state.supplies.spareParts <= 0}
                        onClick={() => onRepairEquipmentItem(item.id)}
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 disabled:opacity-40 rounded text-[11px] font-semibold shrink-0"
                      >
                        Reparar
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Column Shared Military Supplies & Policies */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-4">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2 border-b border-stone-800 pb-2">
                <Backpack className="w-4 h-4" />
                Intendencia y Suministros de la Columna
              </h3>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Comida (Raciones):</span>
                  <span className="font-mono font-bold text-stone-100">
                    {state.supplies.food} u.
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Agua (Cantimploras):</span>
                  <span className="font-mono font-bold text-stone-100">
                    {state.supplies.water} u.
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Munición (Cartuchos):</span>
                  <span className="font-mono font-bold text-amber-400">
                    {state.supplies.ammo} proj.
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Material Médico:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {state.supplies.meds} bot.
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Combustible:</span>
                  <span className="font-mono font-bold text-stone-100">
                    {state.supplies.fuel} L
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Baterías de Radio:</span>
                  <span className="font-mono font-bold text-sky-400">
                    {Math.round(state.supplies.batteries)}%
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Herramientas:</span>
                  <span className="font-mono font-bold text-stone-100">
                    {state.supplies.tools} u.
                  </span>
                </div>
                <div className="p-2.5 bg-stone-900 rounded border border-stone-800 flex justify-between">
                  <span className="text-stone-400">Piezas de Repuesto:</span>
                  <span className="font-mono font-bold text-stone-100">
                    {state.supplies.spareParts} u.
                  </span>
                </div>
              </div>

              {/* Ration distribution & March Pace */}
              <div className="space-y-3 pt-2 border-t border-stone-800">
                <div>
                  <label className="text-xs text-stone-400 block mb-1.5">
                    Política de Reparto de Raciones:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['COMPLETA', 'NORMAL', 'EMERGENCIA'] as const).map((pol) => (
                      <button
                        key={pol}
                        onClick={() => onChangeRationPolicy(pol)}
                        className={`py-1.5 px-2 rounded text-xs font-semibold border ${
                          p.rationPolicy === pol
                            ? 'bg-amber-600 text-stone-950 border-amber-500'
                            : 'bg-stone-900 text-stone-300 border-stone-700'
                        }`}
                      >
                        {pol}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs text-stone-400 block mb-1.5">
                    Ritmo de Marcha de la Columna:
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {(['NORMAL', 'FORZADA', 'SIGILO'] as const).map((pace) => (
                      <button
                        key={pace}
                        onClick={() => onChangeMarchPace(pace)}
                        className={`py-1.5 px-2 rounded text-xs font-semibold border ${
                          p.marchPace === pace
                            ? 'bg-sky-600 text-white border-sky-400'
                            : 'bg-stone-900 text-stone-300 border-stone-700'
                        }`}
                      >
                        {pace}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-2.5 bg-stone-900/80 rounded border border-stone-800 text-xs text-stone-400">
                  Vehículo Activo de la Columna:{' '}
                  <strong className="text-amber-400">
                    {p.activeVehicleId === 'KUBELWAGEN'
                      ? 'Kübelwagen Typ 82 (+Velocidad, consume combustible)'
                      : p.activeVehicleId === 'SDKFZ251'
                      ? 'Semioruga Blindado Sd.Kfz. 251 (+Protección y Velocidad)'
                      : 'Desplazamiento a pie'}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View 2: RADIO Y COMUNICACIONES */}
        {view === 'RADIO' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <Radio className="w-4 h-4" />
                Estado del Equipo Transmisor Torn.Eb
              </h3>

              <div className="space-y-2 text-xs font-mono bg-stone-900 p-3 rounded border border-stone-800">
                <div className="flex justify-between">
                  <span className="text-stone-400">Estado Técnico:</span>
                  <span
                    className={
                      state.mainRadioBroken ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'
                    }
                  >
                    {state.mainRadioBroken ? 'AVERÍA DE VÁLVULA' : 'OPERATIVO'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Carga Acumulador:</span>
                  <span className="text-sky-400">
                    {Math.round(state.supplies.batteries)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Alcance Efectivo:</span>
                  <span className="text-stone-100">
                    {state.mainRadioBroken || state.supplies.batteries <= 0
                      ? '0 m'
                      : `${state.radioRangeMeters} m`}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-400">Operador Funkmeister:</span>
                  <span className="text-stone-200">
                    {hasRadioOperator ? 'Presente (100%)' : 'Ausente (-50% alcance)'}
                  </span>
                </div>
              </div>

              {state.mainRadioBroken && (
                <button
                  disabled={
                    state.supplies.tools <= 0 || state.supplies.spareParts <= 0
                  }
                  onClick={onRepairMainRadio}
                  className="w-full py-2 px-3 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 text-stone-950 font-semibold rounded text-xs flex items-center justify-center gap-1.5"
                >
                  <Wrench className="w-4 h-4" />
                  Reparar Radio (1 Herramienta + 1 Repuesto)
                </button>
              )}

              <button
                disabled={
                  state.mainRadioBroken ||
                  state.supplies.batteries <= 0 ||
                  state.detachments.length === 0
                }
                onClick={onRequestAllSitrep}
                className="w-full py-2 px-3 bg-sky-600 hover:bg-sky-500 disabled:bg-stone-800 disabled:text-stone-500 text-white font-semibold rounded text-xs flex items-center justify-center gap-1.5"
              >
                <BatteryCharging className="w-4 h-4" />
                Solicitar SITREP por Radio a Destacamentos (-2% Batería)
              </button>

              <p className="text-[11px] text-stone-400 leading-relaxed">
                Los destacamentos fuera de alcance continuarán ejecutando su última orden válida. Al recuperar el contacto por radio, transmitirán automáticamente un informe acumulado con sus hallazgos o bajas.
              </p>
            </div>

            <div className="lg:col-span-2 bg-stone-950 border border-stone-800 rounded-lg p-4 flex flex-col">
              <h3 className="text-sm font-bold text-stone-200 border-b border-stone-800 pb-2 mb-3">
                Registro de Transmisiones y Partes de Radio
              </h3>
              <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[60vh] pr-1">
                {state.radioLog.map((msg) => (
                  <div
                    key={msg.id}
                    className="p-3 rounded bg-stone-900 border border-stone-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-mono text-[11px]">
                      <span className="text-amber-400 font-bold">
                        [{msg.timestamp}] {msg.senderCallsign} ({msg.senderName})
                      </span>
                      <span className="text-stone-400">
                        Canal: {msg.channel} · Señal: {msg.signalQuality}% ·{' '}
                        {msg.urgency}
                      </span>
                    </div>
                    <p className="text-stone-200 leading-relaxed font-mono">
                      "{msg.text}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* View 3: MISIONES E HISTORIAL */}
        {view === 'MISIONES' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2 border-b border-stone-800 pb-2">
                <Compass className="w-4 h-4" />
                Objetivos de Campaña (Normandía — Rin)
              </h3>
              <div className="space-y-2.5 max-h-[62vh] overflow-y-auto pr-1">
                {state.missions.map((m) => (
                  <div
                    key={m.id}
                    className={`p-3 rounded border text-xs space-y-1 ${
                      m.status === 'COMPLETADA'
                        ? 'bg-emerald-950/30 border-emerald-800/60'
                        : 'bg-stone-900 border-stone-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-stone-100">
                        {m.title}
                      </span>
                      <span className="font-mono text-[11px] text-amber-400">
                        {m.type} · {m.status}
                      </span>
                    </div>
                    <p className="text-stone-400">{m.context}</p>
                    <p className="text-stone-200 font-medium">
                      Objetivo: {m.objective}
                    </p>
                    <p className="text-[11px] text-stone-400 font-mono">
                      Sector {m.sectorId} · Coordenadas: ({m.x}, {m.y})
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2 border-b border-stone-800 pb-2">
                <ClipboardList className="w-4 h-4 text-sky-400" />
                Historial Cronológico de la Campaña
              </h3>
              <div className="space-y-2 max-h-[62vh] overflow-y-auto pr-1">
                {state.eventHistory.map((ev) => (
                  <div
                    key={ev.id}
                    className="p-2.5 bg-stone-900 border border-stone-800 rounded text-xs"
                  >
                    <div className="text-[11px] font-mono text-amber-400">
                      {ev.time} · {ev.category}
                    </div>
                    <div className="text-stone-200 mt-0.5">{ev.text}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
