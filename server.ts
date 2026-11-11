import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "1mb" }));

  // Check Gemini service availability
  app.get("/api/gemini/status", async (_req, res) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        return res.json({
          available: false,
          model: "gemini-3.8-flash",
          mode: "RESPALDO_LOCAL",
          message: "Servicio en modo narrativo táctico local de respaldo.",
        });
      }
      return res.json({
        available: true,
        model: "gemini-3.8-flash",
        mode: "GEMINI_ACTIVO",
        message: "Enlace narrativo con Gemini 3.8 Flash operativo en el servidor.",
      });
    } catch (error) {
      return res.status(500).json({
        available: false,
        model: "gemini-3.8-flash",
        mode: "ERROR_CONEXION",
        message: error instanceof Error ? error.message : "Error de conexión",
      });
    }
  });

  // Dynamic NPC Dialogue endpoint
  app.post("/api/gemini/npc-dialogue", async (req, res) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({
          error: "SERVICIO_NO_DISPONIBLE",
          message: "Usando motor narrativo local de respaldo.",
        });
      }

      const {
        npc,
        protagonist,
        campaignContext,
        playerMessage,
        interactionType,
      } = req.body;

      const systemInstruction = `Eres un motor narrativo histórico para el videojuego táctico 2D "El Largo Camino a Casa", ambientado en Normandía y Francia en junio de 1944 tras el Día D.
Interpretas al personaje militar: ${npc.name} (${npc.rank}, especialidad: ${npc.specialty}).
Rasgos de personalidad: ${npc.personality}.
Motivación personal: ${npc.motivation || "Regresar con vida junto a su unidad"}.
Salud actual del NPC: ${npc.hp}/${npc.maxHp} (${npc.status}). Moral del NPC: ${npc.morale}/100.
Relación de confianza con el protagonista (Hauptmann ${protagonist.name}): ${npc.trust}/100.
Memoria acumulada del NPC: ${(npc.memories || []).join(" | ") || "Recién reagrupado tras el desembarco"}.

HECHOS ESTRICTOS DEL JUEGO (PROHIBIDO INVENTAR DATOS FUERA DE ESTOS HECHOS):
- Sector actual: ${campaignContext.sectorName} (${campaignContext.dateStr}).
- Salud del Hauptmann: ${protagonist.hp}/${protagonist.maxHp}, Reputación de mando: ${protagonist.reputation}/100.
- Suministros de la columna: Comida ${campaignContext.supplies.food}, Agua ${campaignContext.supplies.water}, Munición ${campaignContext.supplies.ammo}, Material Médico ${campaignContext.supplies.meds}, Combustible ${campaignContext.supplies.fuel}, Baterías de radio ${campaignContext.supplies.batteries}%.
- Integrantes en la columna principal: ${campaignContext.mainSquadCount} soldados. Destacamentos independientes activos: ${campaignContext.detachmentCount}.
- Misión principal activa: ${campaignContext.activeMissionTitle}.

REGLAS:
1. Responde en español, con tono militar verosímil de 1944, acorde a tu personalidad, rango y estado de moral.
2. Sé conciso (2 a 4 frases máximo). Si tu moral o salud es baja, o si faltan suministros reales, menciónalo.
3. No inventes objetos, bajas ni posiciones que no estén en los hechos estrictos.
4. Si el jugador pide consejo o propone una orden, puedes sugerir una acción táctica válida ('FOLLOW', 'HOLD', 'SCOUT', 'SEARCH_SURVIVORS', 'GATHER_SUPPLIES', 'HEAL', 'NONE').`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `Tipo de interacción: ${interactionType || "CONVERSACION_PRESENCIAL"}.
Mensaje o consulta del Hauptmann ${protagonist.name}: "${playerMessage}"`,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reply: {
                type: Type.STRING,
                description: "Respuesta verbal en primera persona del soldado u oficial.",
              },
              tone: {
                type: Type.STRING,
                description: "Tono emocional breve (ej. Firme, Nervioso, Preocupado, Leal, Discrepante).",
              },
              suggestedOrder: {
                type: Type.STRING,
                description: "Orden táctica sugerida opcional: FOLLOW, HOLD, SCOUT, SEARCH_SURVIVORS, GATHER_SUPPLIES, HEAL, o NONE.",
              },
              memoryNote: {
                type: Type.STRING,
                description: "Resumen de 1 línea de lo hablado para guardar en la memoria del NPC.",
              },
            },
            required: ["reply", "tone", "suggestedOrder", "memoryNote"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Respuesta vacía del modelo.");
      }

      const parsed = JSON.parse(text);
      return res.json(parsed);
    } catch (error) {
      return res.status(500).json({
        error: "FALLO_API",
        message: error instanceof Error ? error.message : "Error al generar diálogo",
      });
    }
  });

  // Dynamic Radio Report endpoint
  app.post("/api/gemini/radio-report", async (req, res) => {
    try {
      const ai = getGenAIClient();
      if (!ai) {
        return res.status(503).json({
          error: "SERVICIO_NO_DISPONIBLE",
          message: "Usando redactor de radio local.",
        });
      }

      const { detachment, signalQuality, accumulatedEvents, isReconnected } = req.body;

      const systemInstruction = `Eres el operador de radio del destacamento "${detachment.name}" comandado por ${detachment.leaderName} en Normandía, junio de 1944.
Redacta una transmisión militar por radio breve (máximo 2-3 frases) dirigida al Hauptmann von Falken ("Águila Uno").
Calidad de señal: ${signalQuality}%. ${signalQuality < 55 ? "Incluye ligeras interferencias estáticas como '...kzzzt...' entre palabras." : ""}
${isReconnected ? "IMPORTANTE: Acabas de restablecer contacto tras estar incomunicado. Resume los eventos acumulados." : ""}
HECHOS REALES DEL DESTACAMENTO (no inventes otros):
- Posición: Sector ${detachment.sectorName} (${Math.round(detachment.x)}, ${Math.round(detachment.y)})
- Efectivos: ${detachment.memberCount} hombres | Moral: ${detachment.morale}%
- Orden actual: ${detachment.orderLabel}
- Suministros del grupo: Raciones ${detachment.supplies.food}, Munición ${detachment.supplies.ammo}
- Eventos recientes: ${(accumulatedEvents || []).join("; ") || "Sin novedades de combate."}`;

      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: "Transmite el informe de situación (SITREP) por radio ahora.",
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              transmission: {
                type: Type.STRING,
                description: "Texto de la transmisión por radio.",
              },
              urgency: {
                type: Type.STRING,
                description: "ROUTINE, PRIORITY, o DISTRESS",
              },
            },
            required: ["transmission", "urgency"],
          },
        },
      });

      const text = response.text;
      if (!text) {
        throw new Error("Respuesta vacía del modelo.");
      }

      return res.json(JSON.parse(text));
    } catch (error) {
      return res.status(500).json({
        error: "FALLO_API",
        message: error instanceof Error ? error.message : "Error en transmisión de radio",
      });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
