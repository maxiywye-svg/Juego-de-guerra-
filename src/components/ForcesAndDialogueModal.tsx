import React, { useState } from 'react';
import {
  CampaignState,
  DetachmentOrderType,
  Soldier,
} from '../game/types';
import { getSectorAt } from '../game/initialData';
import { requestNPCDialogue } from '../game/aiService';
import { ORDER_LABELS } from './StrategicMapModal';
import {
  HeartPulse,
  MessageSquare,
  PlusCircle,
  Radio,
  Send,
  Shield,
  Users,
  X,
} from 'lucide-react';

interface ForcesAndDialogueModalProps {
  state: CampaignState;
  initialTab?: 'SOLDADOS' | 'DESTACAMENTOS' | 'DIALOGO';
  initialSoldierId?: string | null;
  onClose: () => void;
  onHealSoldier: (soldierId: string) => void;
  onCreateDetachment: (
    name: string,
    memberIds: string[],
    food: number,
    ammo: number,
    initialOrder: DetachmentOrderType
  ) => void;
  onMergeDetachment: (detachmentId: string) => void;
  onIssueDetachmentOrder: (
    detachmentId: string,
    order: DetachmentOrderType
  ) => void;
  onRecordSoldierMemory: (
    soldierId: string,
    memoryNote: string,
    trustDelta: number
  ) => void;
}

export const ForcesAndDialogueModal: React.FC<ForcesAndDialogueModalProps> = ({
  state,
  initialTab = 'SOLDADOS',
  initialSoldierId = null,
  onClose,
  onHealSoldier,
  onCreateDetachment,
  onMergeDetachment,
  onIssueDetachmentOrder,
  onRecordSoldierMemory,
}) => {
  const recruitedSoldiers = state.soldiers.filter(
    (s) => s.detachmentId !== 'DISPERSED' && s.status !== 'CAIDO'
  );
  const mainSquadSoldiers = recruitedSoldiers.filter(
    (s) => s.detachmentId === 'MAIN'
  );

  const [activeTab, setActiveTab] = useState<
    'SOLDADOS' | 'DESTACAMENTOS' | 'DIALOGO'
  >(initialTab);
  const [selectedSoldierId, setSelectedSoldierId] = useState<string>(
    initialSoldierId || recruitedSoldiers[0]?.id || ''
  );

  // Detachment creation state
  const [newDetName, setNewDetName] = useState('Grupo Kampfgruppe B');
  const [selectedForNewDet, setSelectedForNewDet] = useState<string[]>([]);
  const [allocFood, setAllocFood] = useState(8);
  const [allocAmmo, setAllocAmmo] = useState(30);
  const [initialOrder, setInitialOrder] =
    useState<DetachmentOrderType>('SCOUT');

  // Dialogue state
  const [chatInput, setChatInput] = useState('');
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [chatHistory, setChatHistory] = useState<
    {
      speaker: string;
      text: string;
      tone?: string;
      suggestedOrder?: string;
      source?: string;
    }[]
  >([]);

  const selectedSoldier: Soldier | undefined = recruitedSoldiers.find(
    (s) => s.id === selectedSoldierId
  );

  const toggleSelectForDet = (id: string) => {
    setSelectedForNewDet((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSendDialogue = async (promptText: string) => {
    if (!selectedSoldier || !promptText.trim() || isLoadingAI) return;
    const msg = promptText.trim();
    setChatInput('');
    setChatHistory((prev) => [
      ...prev,
      { speaker: `Hauptmann ${state.protagonist.name}`, text: msg },
    ]);
    setIsLoadingAI(true);

    const sector = getSectorAt(state.protagonist.x, state.protagonist.y);
    const activeMission =
      state.missions.find((m) => m.status === 'ACTIVA')?.title ||
      'Repliegue hacia el Rin';

    const res = await requestNPCDialogue({
      npc: selectedSoldier,
      protagonist: state.protagonist,
      supplies: state.supplies,
      sectorName: sector.name,
      dateStr: state.dateTime,
      mainSquadCount: mainSquadSoldiers.length,
      detachmentCount: state.detachments.length,
      activeMissionTitle: activeMission,
      playerMessage: msg,
      interactionType:
        selectedSoldier.detachmentId === 'MAIN'
          ? 'CONVERSACION_PRESENCIAL'
          : 'ENLACE_RADIO',
    });

    setChatHistory((prev) => [
      ...prev,
      {
        speaker: `${selectedSoldier.rank} ${selectedSoldier.name}`,
        text: res.reply,
        tone: res.tone,
        suggestedOrder: res.suggestedOrder,
        source: res.source,
      },
    ]);
    onRecordSoldierMemory(selectedSoldier.id, res.memoryNote, 2);
    setIsLoadingAI(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/90 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="bg-stone-900 border border-stone-700 rounded-lg w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800 bg-stone-950">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold tracking-wide text-amber-400 font-display">
              Mando de Tropas, Destacamentos y Diálogo Táctico
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-100 bg-stone-800 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 px-4 py-2 bg-stone-950/70 border-b border-stone-800">
          <button
            onClick={() => setActiveTab('SOLDADOS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'SOLDADOS'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Efectivos de la Columna ({recruitedSoldiers.length})
          </button>
          <button
            onClick={() => setActiveTab('DESTACAMENTOS')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'DESTACAMENTOS'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            División y Destacamentos ({state.detachments.length})
          </button>
          <button
            onClick={() => setActiveTab('DIALOGO')}
            className={`px-3 py-1.5 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'DIALOGO'
                ? 'bg-amber-600 text-stone-950'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            Conversar con Subordinado (IA)
          </button>
        </div>

        {/* Tab 1: SOLDADOS */}
        {activeTab === 'SOLDADOS' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
            {recruitedSoldiers.map((sol) => (
              <div
                key={sol.id}
                className="bg-stone-950 border border-stone-800 rounded-lg p-3 flex flex-col justify-between gap-2"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-stone-100">
                      {sol.rank} {sol.name}
                    </span>
                    <span className="text-xs text-amber-400 font-mono">
                      {sol.specialty} ·{' '}
                      {sol.detachmentId === 'MAIN'
                        ? 'Columna Principal'
                        : `Destacamento`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-1">{sol.personality}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-mono text-stone-300">
                    <span>
                      Salud: {sol.hp}/{sol.maxHp}
                    </span>
                    <span>·</span>
                    <span>Moral: {sol.morale}%</span>
                    <span>·</span>
                    <span>Confianza: {sol.trust}%</span>
                    <span>·</span>
                    <span>XP: {sol.xp}</span>
                  </div>
                  <div className="mt-1.5 text-[11px] text-stone-400">
                    Equipo: {sol.equipment.join(' · ')}
                  </div>
                  {sol.memories.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-stone-500 italic">
                      Último recuerdo: "{sol.memories[sol.memories.length - 1]}"
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-stone-800">
                  <button
                    onClick={() => {
                      setSelectedSoldierId(sol.id);
                      setActiveTab('DIALOGO');
                    }}
                    className="flex-1 py-1.5 px-3 bg-stone-800 hover:bg-stone-700 text-stone-100 rounded text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    Hablar con {sol.name.split(' ')[0]}
                  </button>
                  <button
                    disabled={sol.hp >= sol.maxHp || state.supplies.meds <= 0}
                    onClick={() => onHealSoldier(sol.id)}
                    className={`py-1.5 px-3 rounded text-xs font-semibold flex items-center gap-1 ${
                      sol.hp < sol.maxHp && state.supplies.meds > 0
                        ? 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
                        : 'bg-stone-900 text-stone-600 cursor-not-allowed'
                    }`}
                  >
                    <HeartPulse className="w-3.5 h-3.5" />
                    Curar (1 Botiquín)
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 2: DESTACAMENTOS */}
        {activeTab === 'DESTACAMENTOS' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Left: Create New Detachment */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center gap-2">
                <PlusCircle className="w-4 h-4" />
                Dividir Fuerza: Crear Nuevo Destacamento
              </h3>
              <p className="text-xs text-stone-400">
                Selecciona soldados de la Columna Principal para formar un grupo autónomo. Si incluyes un Operador de Radio (o equipo), podrán recibir órdenes a distancia.
              </p>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  Nombre del Destacamento:
                </label>
                <input
                  type="text"
                  value={newDetName}
                  onChange={(e) => setNewDetName(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-100"
                />
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  Seleccionar Integrantes ({selectedForNewDet.length} elegidos):
                </label>
                <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                  {mainSquadSoldiers.map((sol) => (
                    <label
                      key={sol.id}
                      className="flex items-center justify-between p-2 rounded bg-stone-900 border border-stone-800 text-xs cursor-pointer hover:bg-stone-800/60"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedForNewDet.includes(sol.id)}
                          onChange={() => toggleSelectForDet(sol.id)}
                        />
                        <span className="font-semibold text-stone-200">
                          {sol.rank} {sol.name}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-amber-400">
                        {sol.specialty} · HP {sol.hp}%
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-400 block mb-1">
                    Raciones asignadas (Máx {state.supplies.food}):
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={Math.max(2, state.supplies.food)}
                    value={allocFood}
                    onChange={(e) => setAllocFood(Number(e.target.value))}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-100 font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-stone-400 block mb-1">
                    Munición asignada (Máx {state.supplies.ammo}):
                  </label>
                  <input
                    type="number"
                    min={10}
                    max={Math.max(10, state.supplies.ammo)}
                    value={allocAmmo}
                    onChange={(e) => setAllocAmmo(Number(e.target.value))}
                    className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-100 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-stone-400 block mb-1">
                  Orden Táctica Inicial:
                </label>
                <select
                  value={initialOrder}
                  onChange={(e) =>
                    setInitialOrder(e.target.value as DetachmentOrderType)
                  }
                  className="w-full bg-stone-900 border border-stone-700 rounded px-2.5 py-1.5 text-xs text-stone-100"
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

              <button
                disabled={selectedForNewDet.length === 0}
                onClick={() => {
                  onCreateDetachment(
                    newDetName,
                    selectedForNewDet,
                    allocFood,
                    allocAmmo,
                    initialOrder
                  );
                  setSelectedForNewDet([]);
                }}
                className={`w-full py-2 px-4 rounded font-semibold text-xs transition-colors ${
                  selectedForNewDet.length > 0
                    ? 'bg-amber-600 hover:bg-amber-500 text-stone-950 cursor-pointer'
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                }`}
              >
                Desplegar Destacamento ({selectedForNewDet.length} soldados)
              </button>
            </div>

            {/* Right: Active Detachments List */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-4 space-y-3">
              <h3 className="text-sm font-bold text-sky-400 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Destacamentos Operativos ({state.detachments.length})
              </h3>

              {state.detachments.length === 0 ? (
                <div className="text-xs text-stone-400 p-4 bg-stone-900 rounded border border-stone-800">
                  Todos tus efectivos marchan actualmente unidos en la Columna Principal junto al Hauptmann von Falken.
                </div>
              ) : (
                <div className="space-y-3">
                  {state.detachments.map((det) => {
                    const dist = Math.round(
                      Math.hypot(
                        det.x - state.protagonist.x,
                        det.y - state.protagonist.y
                      )
                    );
                    const canCommand = det.inRadioContact || dist < 160;
                    const leader = state.soldiers.find(
                      (s) => s.id === det.leaderId
                    );

                    return (
                      <div
                        key={det.id}
                        className="p-3 bg-stone-900 border border-stone-800 rounded-lg space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs text-stone-100">
                            {det.callsign} · {det.name}
                          </span>
                          <span className="font-mono text-[11px] text-sky-400">
                            {det.inRadioContact
                              ? `EN RADIO (${det.signalQuality}%)`
                              : `SIN SEÑAL · Dist: ${dist}m`}
                          </span>
                        </div>

                        <div className="text-xs text-stone-300">
                          Al mando: {leader ? `${leader.rank} ${leader.name}` : 'Suboficial'} · Efectivos: {det.memberIds.length} · Moral: {det.morale}%
                        </div>
                        <div className="text-[11px] font-mono text-stone-400">
                          Suministros: Raciones {det.supplies.food} · Munición {det.supplies.ammo} · Orden actual: {ORDER_LABELS[det.order]}
                        </div>
                        <div className="text-[11px] text-amber-200/90 bg-stone-950 p-2 rounded border border-stone-800">
                          Último informe: {det.situationReport}
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <select
                            disabled={!canCommand}
                            value={det.order}
                            onChange={(e) =>
                              onIssueDetachmentOrder(
                                det.id,
                                e.target.value as DetachmentOrderType
                              )
                            }
                            className="flex-1 bg-stone-950 border border-stone-700 rounded px-2 py-1.5 text-xs text-stone-100"
                          >
                            {(
                              Object.keys(ORDER_LABELS) as DetachmentOrderType[]
                            ).map((k) => (
                              <option key={k} value={k}>
                                {ORDER_LABELS[k]}
                              </option>
                            ))}
                          </select>

                          <button
                            disabled={dist > 220}
                            onClick={() => onMergeDetachment(det.id)}
                            title="Debes estar a menos de 220m para reintegrar el destacamento"
                            className={`px-3 py-1.5 rounded text-xs font-semibold ${
                              dist <= 220
                                ? 'bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer'
                                : 'bg-stone-800 text-stone-500 cursor-not-allowed'
                            }`}
                          >
                            Fusionar ({dist}m)
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 3: DIALOGO IA CON SUBORDINADOS */}
        {activeTab === 'DIALOGO' && (
          <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Left: Choose Soldier */}
            <div className="bg-stone-950 border border-stone-800 rounded-lg p-3 space-y-2 overflow-y-auto max-h-[65vh]">
              <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider">
                Seleccionar Interlocutor
              </h3>
              {recruitedSoldiers.map((sol) => (
                <button
                  key={sol.id}
                  onClick={() => setSelectedSoldierId(sol.id)}
                  className={`w-full text-left p-2.5 rounded border text-xs transition-colors ${
                    selectedSoldierId === sol.id
                      ? 'bg-stone-800 border-amber-500 text-stone-100'
                      : 'bg-stone-900 border-stone-800 text-stone-300 hover:bg-stone-800/50'
                  }`}
                >
                  <div className="font-bold">
                    {sol.rank} {sol.name}
                  </div>
                  <div className="text-[11px] text-stone-400">
                    {sol.specialty} · Moral {sol.morale}% · Confianza {sol.trust}%
                  </div>
                </button>
              ))}
            </div>

            {/* Right: Conversation Window */}
            <div className="lg:col-span-2 bg-stone-950 border border-stone-800 rounded-lg p-4 flex flex-col justify-between min-h-[380px]">
              {selectedSoldier ? (
                <>
                  <div className="border-b border-stone-800 pb-3 mb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-base font-bold text-amber-400">
                          {selectedSoldier.rank} {selectedSoldier.name} ({selectedSoldier.specialty})
                        </h3>
                        <p className="text-xs text-stone-400">
                          {selectedSoldier.personality}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-stone-400">
                        Salud {selectedSoldier.hp}% · Moral {selectedSoldier.morale}%
                      </span>
                    </div>
                  </div>

                  {/* Conversation log */}
                  <div className="flex-1 overflow-y-auto space-y-2.5 max-h-60 pr-1 my-2">
                    {chatHistory.length === 0 ? (
                      <div className="text-xs text-stone-400 p-3 bg-stone-900/70 rounded border border-stone-800">
                        Inicia una conversación con {selectedSoldier.rank} {selectedSoldier.name}. Sus respuestas tienen en cuenta su personalidad, memoria acumulada, suministros reales de la columna y situación táctica del sector.
                      </div>
                    ) : (
                      chatHistory.map((item, idx) => (
                        <div
                          key={idx}
                          className={`p-2.5 rounded border text-xs ${
                            item.speaker.startsWith('Hauptmann')
                              ? 'bg-stone-900 border-stone-700 text-stone-200 ml-6'
                              : 'bg-stone-900/90 border-amber-800/60 text-stone-100 mr-6'
                          }`}
                        >
                          <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold mb-1">
                            <span>{item.speaker}</span>
                            {item.tone && (
                              <span className="font-mono text-stone-400">
                                Tono: {item.tone} · Motor: {item.source}
                              </span>
                            )}
                          </div>
                          <p className="leading-relaxed">{item.text}</p>
                        </div>
                      ))
                    )}
                    {isLoadingAI && (
                      <div className="text-xs text-amber-400 font-mono animate-pulse">
                        {selectedSoldier.rank} {selectedSoldier.name} está evaluando la situación táctica...
                      </div>
                    )}
                  </div>

                  {/* Quick tactical prompts + Free input */}
                  <div className="space-y-2 pt-3 border-t border-stone-800">
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() =>
                          handleSendDialogue(
                            'Informe de su estado físico, moral y situación del pelotón.'
                          )
                        }
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-[11px] text-stone-200"
                      >
                        Pedir informe de estado
                      </button>
                      <button
                        onClick={() =>
                          handleSendDialogue(
                            '¿Qué alternativa táctica aconseja en este sector según nuestros suministros?'
                          )
                        }
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-[11px] text-stone-200"
                      >
                        Pedir consejo táctico
                      </button>
                      <button
                        onClick={() =>
                          handleSendDialogue(
                            '¿Necesita suministros médicos, munición o descanso?'
                          )
                        }
                        className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 rounded text-[11px] text-stone-200"
                      >
                        Consultar necesidades
                      </button>
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendDialogue(chatInput);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder={`Hablar con ${selectedSoldier.rank} ${selectedSoldier.name}...`}
                        className="flex-1 bg-stone-900 border border-stone-700 rounded px-3 py-2 text-xs text-stone-100"
                      />
                      <button
                        type="submit"
                        disabled={isLoadingAI || !chatInput.trim()}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-stone-800 text-stone-950 font-semibold rounded text-xs flex items-center gap-1.5"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Enviar
                      </button>
                    </form>
                  </div>
                </>
              ) : (
                <div className="text-xs text-stone-400">
                  Selecciona un soldado para conversar.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
