require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.warn("⚠️ GEMINI_API_KEY não encontrada no ambiente.");
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || "SEM_CHAVE");

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

/* =========================================================
   BANCO LOCAL DE CALORIAS
========================================================= */

const localCalories = {
  arroz: 130,
  "arroz branco": 130,
  "arroz integral": 124,
  feijao: 90,
  "feijão": 90,
  frango: 180,
  "filé de frango": 180,
  ovo: 90,
  banana: 90,
  maca: 70,
  "maçã": 70,
  pao: 140,
  "pão": 140,
  "pão francês": 140,
  tapioca: 150,
  salada: 30,
  carne: 250,
  "carne bovina": 250,
  peixe: 180,
  batata: 120,
  "batata doce": 130,
  leite: 120,
  cafe: 10,
  "café": 10,
  "café com leite": 80,
  iogurte: 120,
  aveia: 110,
  queijo: 100,
  "queijo branco": 90,
  macarrao: 220,
  "macarrão": 220,
  sopa: 150,
  omelete: 170
};

const calorieCache = new Map();

/* =========================================================
   HELPERS
========================================================= */

function normalizeText(text = "") {
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function onlyNumber(text = "") {
  const match = String(text).match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

function estimateLocalCalories(foodText = "") {
  const normalized = normalizeText(foodText);

  if (!normalized) return 0;

  let total = 0;
  let found = false;

  Object.entries(localCalories).forEach(([food, kcal]) => {
    const normalizedFood = normalizeText(food);

    if (normalized.includes(normalizedFood)) {
      total += kcal;
      found = true;
    }
  });

  if (found) return total;

  return 0;
}

function fallbackSmartCalories(foodText = "") {
  const normalized = normalizeText(foodText);

  if (!normalized) return 0;

  if (normalized.includes("pizza")) return 320;
  if (normalized.includes("hamburguer") || normalized.includes("hamburger")) return 650;
  if (normalized.includes("lanche")) return 500;
  if (normalized.includes("pastel")) return 350;
  if (normalized.includes("coxinha")) return 280;
  if (normalized.includes("salgado")) return 300;
  if (normalized.includes("bolo")) return 280;
  if (normalized.includes("chocolate")) return 160;
  if (normalized.includes("refrigerante")) return 140;
  if (normalized.includes("suco")) return 120;
  if (normalized.includes("acai") || normalized.includes("açai")) return 400;

  return 220;
}

function isQuotaError(error) {
  const message = String(error?.message || "");
  const status = error?.status || error?.statusCode;

  return (
    status === 429 ||
    message.includes("429") ||
    message.toLowerCase().includes("too many requests") ||
    message.toLowerCase().includes("quota")
  );
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/", (req, res) => {
  res.send("🌙 Luma API online");
});

/* =========================================================
   CHAT DA LUMA
========================================================= */

app.post("/api/chat", async (req, res) => {
  try {
    const {
      message,
      mood = "não informado",
      totalCalorias = 0,
      totalAgua = 0
    } = req.body || {};

    if (!message) {
      return res.json({
        reply: "Me conta melhor o que você precisa hoje 🌙"
      });
    }

    const prompt = `
Você é a Luma, uma IA acolhedora de jornada saudável.

Contexto do usuário:
Humor: ${mood}
Calorias consumidas hoje: ${totalCalorias} kcal
Água consumida hoje: ${totalAgua} ml

Mensagem do usuário:
${message}

Responda em português do Brasil.
Seja humana, leve, acolhedora, objetiva e motivadora.
Evite respostas longas.
`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    return res.json({
      reply: reply || "Estou aqui com você 🌙"
    });
  } catch (error) {
    console.error("Erro no chat:", error);

    if (isQuotaError(error)) {
      return res.status(200).json({
        reply:
          "Minha conexão de IA ficou sobrecarregada agora 🌙 Tenta de novo em alguns instantes. Enquanto isso, continue registrando sua jornada."
      });
    }

    return res.status(200).json({
      reply:
        "A Luma encontrou uma instabilidade agora 🌙 Mas já estou aqui com você."
    });
  }
});

/* =========================================================
   ESTIMATIVA DE CALORIAS
========================================================= */

app.post("/api/estimar-caloria", async (req, res) => {
  const { alimento } = req.body || {};

  if (!alimento) {
    return res.json({
      kcal: 0,
      source: "empty"
    });
  }

  const normalized = normalizeText(alimento);

  if (calorieCache.has(normalized)) {
    return res.json({
      kcal: calorieCache.get(normalized),
      source: "cache"
    });
  }

  const localKcal = estimateLocalCalories(alimento);

  if (localKcal > 0) {
    calorieCache.set(normalized, localKcal);

    return res.json({
      kcal: localKcal,
      source: "local"
    });
  }

  try {
    const prompt = `
Você é uma IA nutricional.

Estime as calorias aproximadas deste alimento ou refeição:
"${alimento}"

Responda SOMENTE com um número inteiro.
Não escreva kcal.
Não explique.
Exemplo:
320
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const kcal = onlyNumber(text) || fallbackSmartCalories(alimento);

    calorieCache.set(normalized, kcal);

    return res.json({
      kcal,
      source: "gemini"
    });
  } catch (error) {
    console.error("Erro ao estimar calorias:", error);

    const fallbackKcal = fallbackSmartCalories(alimento);

    calorieCache.set(normalized, fallbackKcal);

    if (isQuotaError(error)) {
      return res.status(200).json({
        kcal: fallbackKcal,
        source: "fallback_quota",
        warning: "Quota Gemini excedida. Valor aproximado por fallback."
      });
    }

    return res.status(200).json({
      kcal: fallbackKcal,
      source: "fallback_error",
      warning: "Erro na IA. Valor aproximado por fallback."
    });
  }
});

/* =========================================================
   START
========================================================= */

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🌙 Luma API online na porta ${PORT}`);
});
