import React, { useState } from 'react';
import {
  CampaignState,
  DetachmentOrderType,
} from '../game/types';
import { SECTORS, WORLD_HEIGHT, WORLD_OBSTACLES, WORLD_WIDTH } from '../game/initialData';
import { Crosshair, MapPin, Radio, ShieldAlert, Users, X } from 'lucide-react';

interface StrategicMapModalProps {
  state: CampaignState;
  onClose: () => void;
  onIssueDetachmentOrder: (
    detachmentId: string,
    order: DetachmentOrderType,
    targetX?: number,
    targetY?: number
  ) => void;
}

export const ORDER_LABELS: Record<DetachmentOrderType, string> = {
  FOLLOW: '1. Seguir a la columna principal',
  HOLD: '2. Esperar en posición defensiva',
  SCOUT: '3. Explorar zona seleccionada',
  SEARCH_SURVIVORS: '4. Buscar supervivientes',
  GATHER_SUPPLIES: '5. Recuperar suministros',
  ESCORT_VEHICLE: '6. Escoltar vehículo',
  COMPLETE_MISSION: '7. Completar misión disponible',
  RETURN_MAIN: '8. Regresar al grupo principal',
  RENDEZVOUS: '9. Reunirse con otro destacamento',
  REPORT_STATUS: '10. Informar de su situación',
};

export const StrategicMapModal: React.FC<StrategicMapModalProps> = ({
  state,
  onClose,
  onIssueDetachmentOrder,
}) => {
  const [selectedDetId, setSelectedDetId] = useState<string | null>(
    state.detachments[0]?.id || null
  );
  const [selectedOrder, setSelectedOrder] = useState<DetachmentOrderType>('SCOUT');
  const [targetCoords, setTargetCoords] = useState<{ x: number; y: number }>({
    x: Math.round(state.protagonist.x + 200),
    y: Math.round(state.protagonist.y),
  });

  const selectedDet = state.detachments.find((d) => d.id === selectedDetId) || null;
  const exploredSet = new Set(state.exploredCells);

  const handleMapClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const relY = (e.clientY - rect.top) / rect.height;
    const wx = Math.max(40, Math.min(WORLD_WIDTH - 40, Math.round(relX * WORLD_WIDTH)));
    const wy = Math.max(40, Math.min(WORLD_HEIGHT - 40, Math.round(relY * WORLD_HEIGHT)));
    setTargetCoords({ x: wx, y: wy });
  };

  const canCommandSelected =
    selectedDet &&
    (selectedDet.inRadioContact ||
      Math.hypot(
        selectedDet.x - state.protagonist.x,
        selectedDet.y - state.protagonist.y
      ) < 150);

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950">
          <div>
            <h2 className="text-lg font-bold tracking-wide text-amber-400 font-display">
              Mapa Estratégico de Operaciones · Normandía al Rin (1944)
            </h2>
            <p className="text-xs text-stone-400">
              Toque cualquier punto del mapa para fijar coordenadas tácticas ({targetCoords.x}, {targetCoords.y})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-100 bg-stone-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-3 gap-4 p-4">
          {/* Interactive SVG Tactical Map */}
          <div className="lg:col-span-2 flex flex-col gap-2">
            <div className="relative w-full aspect-[4/3] bg-stone-950 border border-stone-700 rounded overflow-hidden">
              <svg
                viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`}
                className="w-full h-full cursor-crosshair"
                onClick={handleMapClick}
              >
                {/* Sectors background */}
                {SECTORS.map((sec) => (
                  <g key={sec.id}>
                    <rect
                      x={sec.bounds.x}
                      y={sec.bounds.y}
                      width={sec.bounds.w}
                      height={sec.bounds.h}
                      fill={sec.id % 2 === 0 ? '#1c221b' : '#22281f'}
                      stroke="#44403c"
                      strokeWidth={6}
                    />
                    <text
                      x={sec.bounds.x + 40}
                      y={sec.bounds.y + 65}
                      fill="rgba(231,229,228,0.35)"
                      fontSize="48"
                      fontWeight="bold"
                    >
                      S{sec.id}: {sec.name}
                    </text>
                  </g>
                ))}

                {/* Main Road Path */}
                <polyline
                  points="180,180 500,520 505,1525 510,1880 1380,1580 1520,560 1820,1780 2080,1780 2580,620 2940,2120"
                  fill="none"
                  stroke="#57534e"
                  strokeWidth={28}
                  strokeDasharray="30,15"
                />

                {/* Rivers & Bridges */}
                {WORLD_OBSTACLES.filter(
                  (o) => o.type === 'RIVER' || o.type === 'BRIDGE'
                ).map((o) => (
                  <rect
                    key={o.id}
                    x={o.x}
                    y={o.y}
                    width={o.w}
                    height={o.h}
                    fill={o.type === 'RIVER' ? '#1d4ed8' : '#d6d3d1'}
                    opacity={0.65}
                  />
                ))}

                {/* Radio Range Circle */}
                {!state.mainRadioBroken && state.supplies.batteries > 0 && (
                  <circle
                    cx={state.protagonist.x}
                    cy={state.protagonist.y}
                    r={state.radioRangeMeters}
                    fill="rgba(56, 189, 248, 0.05)"
                    stroke="#38bdf8"
                    strokeWidth={6}
                    strokeDasharray="24,18"
                  />
                )}

                {/* Active Missions */}
                {state.missions
                  .filter((m) => m.status === 'ACTIVA')
                  .map((m) => (
                    <g key={m.id}>
                      <circle
                        cx={m.x}
                        cy={m.y}
                        r={52}
                        fill="rgba(245, 158, 11, 0.15)"
                        stroke={m.type === 'PRINCIPAL' ? '#f59e0b' : '#38bdf8'}
                        strokeWidth={8}
                      />
                      <text
                        x={m.x}
                        y={m.y - 65}
                        fill="#fde68a"
                        fontSize="36"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        ★ {m.title}
                      </text>
                    </g>
                  ))}

                {/* Discovered POIs */}
                {state.pois
                  .filter((poi) => poi.discovered)
                  .map((poi) => (
                    <g key={poi.id}>
                      <rect
                        x={poi.x - 22}
                        y={poi.y - 22}
                        width={44}
                        height={44}
                        fill={poi.interacted ? '#57534e' : '#eab308'}
                        stroke="#1c1917"
                        strokeWidth={5}
                      />
                      <text
                        x={poi.x}
                        y={poi.y + 52}
                        fill="#d6d3d1"
                        fontSize="30"
                        textAnchor="middle"
                      >
                        {poi.name}
                      </text>
                    </g>
                  ))}

                {/* Detachments: Live vs Last Known Position */}
                {state.detachments.map((det) => {
                  const displayX = det.inRadioContact ? det.x : det.lastKnownX;
                  const displayY = det.inRadioContact ? det.y : det.lastKnownY;
                  return (
                    <g
                      key={det.id}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        setSelectedDetId(det.id);
                      }}
                      className="cursor-pointer"
                    >
                      <circle
                        cx={displayX}
                        cy={displayY}
                        r={38}
                        fill={det.inRadioContact ? '#0284c7' : '#78716c'}
                        stroke={selectedDetId === det.id ? '#facc15' : '#e0f2fe'}
                        strokeWidth={8}
                        strokeDasharray={det.inRadioContact ? undefined : '12,8'}
                      />
                      <text
                        x={displayX}
                        y={displayY - 50}
                        fill={det.inRadioContact ? '#7dd3fc' : '#fdba74'}
                        fontSize="34"
                        textAnchor="middle"
                        fontWeight="bold"
                      >
                        {det.callsign}{' '}
                        {det.inRadioContact
                          ? '(EN VIVO)'
                          : `(ÚLT. POS. ${det.lastContactTimestamp})`}
                      </text>
                    </g>
                  );
                })}

                {/* Protagonist Marker */}
                <g>
                  <circle
                    cx={state.protagonist.x}
                    cy={state.protagonist.y}
                    r={42}
                    fill="#16a34a"
                    stroke="#fef08a"
                    strokeWidth={10}
                  />
                  <text
                    x={state.protagonist.x}
                    y={state.protagonist.y - 56}
                    fill="#fef08a"
                    fontSize="38"
                    textAnchor="middle"
                    fontWeight="bold"
                  >
                    Hptm. von Falken
                  </text>
                </g>

                {/* Target Crosshair */}
                <g>
                  <circle
                    cx={targetCoords.x}
                    cy={targetCoords.y}
                    r={32}
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth={7}
                  />
                  <line
                    x1={targetCoords.x - 48}
                    y1={targetCoords.y}
                    x2={targetCoords.x + 48}
                    y2={targetCoords.y}
                    stroke="#ef4444"
                    strokeWidth={6}
                  />
                  <line
                    x1={targetCoords.x}
                    y1={targetCoords.y - 48}
                    x2={targetCoords.x}
                    y2={targetCoords.y + 48}
                    stroke="#ef4444"
                    strokeWidth={6}
                  />
                </g>

                {/* Fog of War Overlay on unexplored 200x200 cells */}
                {Array.from({ length: 16 }).map((_, gx) =>
                  Array.from({ length: 12 }).map((__, gy) => {
                    const key = `${gx},${gy}`;
                    if (exploredSet.has(key)) return null;
                    return (
                      <rect
                        key={key}
                        x={gx * 200}
                        y={gy * 200}
                        width={200}
                        height={200}
                        fill="rgba(12, 10, 9, 0.58)"
                      />
                    );
                  })
                )}
              </svg>
            </div>

            {/* Map Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-stone-300 bg-stone-950/80 px-3 py-2 rounded border border-stone-800">
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-green-600 border border-yellow-200" />
                Columna Principal (Hauptmann)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-sky-600 border border-sky-100" />
                Destacamento en Contacto
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full bg-stone-500 border border-dashed border-amber-300" />
                Última Posición Conocida (Sin Radio)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 rounded-full border-2 border-amber-500" />
                Objetivo de Misión
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block w-3 h-3 bg-yellow-500" />
                Depósito / Punto de Interés
              </span>
            </div>
          </div>

          {/* Right Panel: Detachment Order Dispatch from Map */}
          <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 flex flex-col justify-between gap-3">
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-stone-200 flex items-center gap-2 border-b border-stone-800 pb-2">
                <Radio className="w-4 h-4 text-sky-400" />
                Mando Estratégico de Destacamentos
              </h3>

              {state.detachments.length === 0 ? (
                <div className="text-xs text-stone-400 p-3 bg-stone-900 rounded border border-stone-800">
                  No hay destacamentos independientes desplegados actualmente. Puedes dividir tu columna desde el panel <strong>Destacamentos</strong> para enviar grupos a explorar, buscar supervivientes o recuperar suministros.
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-xs text-stone-400 block">
                    Seleccionar Destacamento:
                  </label>
                  <div className="space-y-1.5">
                    {state.detachments.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedDetId(d.id)}
                        className={`w-full text-left p-2 rounded border text-xs transition-colors ${
                          selectedDetId === d.id
                            ? 'bg-stone-800 border-amber-500 text-stone-100'
                            : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span>
                            {d.callsign} · {d.name}
                          </span>
                          <span className="font-mono text-[11px]">
                            {d.inRadioContact
                              ? `SEÑAL ${d.signalQuality}%`
                              : 'INCOMUNICADO'}
                          </span>
                        </div>
                        <div className="text-[11px] text-stone-400 mt-0.5">
                          Efectivos: {d.memberIds.length} · Moral: {d.morale}% · Raciones: {d.supplies.food}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedDet && (
                <div className="space-y-2.5 pt-2 border-t border-stone-800">
                  <div className="text-xs text-stone-300 flex items-center gap-1.5">
                    <Crosshair className="w-4 h-4 text-red-400" />
                    Coordenada Objetivo en Mapa:{' '}
                    <span className="font-mono text-amber-400">
                      ({targetCoords.x}, {targetCoords.y})
                    </span>
                  </div>

                  <div>
                    <label className="text-xs text-stone-400 block mb-1">
                      Asignar Orden Táctica:
                    </label>
                    <select
                      value={selectedOrder}
                      onChange={(e) =>
                        setSelectedOrder(e.target.value as DetachmentOrderType)
                      }
                      className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-2 text-xs text-stone-100"
                    >
                      {(Object.keys(ORDER_LABELS) as DetachmentOrderType[]).map(
                        (k) => (
                          <option key={k} value={k}>
                            {ORDER_LABELS[k]}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  {!canCommandSelected && (
                    <div className="p-2 bg-red-950/50 border border-red-800/60 rounded text-xs text-red-200 flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                      <span>
                        Destacamento fuera de alcance de radio o sin operador/batería. No puedes transmitir órdenes a distancia hasta restablecer contacto o acercarte físicamente.
                      </span>
                    </div>
                  )}

                  <button
                    disabled={!canCommandSelected}
                    onClick={() =>
                      onIssueDetachmentOrder(
                        selectedDet.id,
                        selectedOrder,
                        targetCoords.x,
                        targetCoords.y
                      )
                    }
                    className={`w-full py-2.5 px-4 rounded font-semibold text-xs transition-colors ${
                      canCommandSelected
                        ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 cursor-pointer'
                        : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                    }`}
                  >
                    Transmitir Orden a {selectedDet.callsign}
                  </button>
                </div>
              )}
            </div>

            {/* Sector Summary */}
            <div className="border-t border-stone-800 pt-3 text-xs text-stone-400 space-y-1">
              <div className="flex items-center justify-between">
                <span>Alcance actual de radio:</span>
                <span className="font-mono text-stone-200">
                  {state.mainRadioBroken ? '0m (AVERIADA)' : `${state.radioRangeMeters}m`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Batería de acumuladores:</span>
                <span className="font-mono text-stone-200">
                  {Math.round(state.supplies.batteries)}%
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Zonas exploradas:</span>
                <span className="font-mono text-stone-200">
                  {state.exploredCells.length} / 192 cuadrantes
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
