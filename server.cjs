require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

app.get("/", (req, res) => {
  res.send("Luma API online 🌙");
});

/* CHAT DA LUMA */
app.post("/api/chat", async (req, res) => {
  try {
    const { message, mood, totalCalorias, totalAgua } = req.body;

    const prompt = `
Você é a Luma, uma IA acolhedora de jornada saudável.

Contexto do usuário:
Humor: ${mood || "não informado"}
Calorias consumidas hoje: ${totalCalorias || 0} kcal
Água consumida hoje: ${totalAgua || 0} ml

Mensagem do usuário:
${message}

Responda em português do Brasil, de forma humana, leve, acolhedora e objetiva.
`;

    const result = await model.generateContent(prompt);
    const reply = result.response.text();

    res.json({ reply });
  } catch (error) {
    console.error("Erro no chat:", error);

    res.status(500).json({
      reply: "A Luma encontrou um problema 🌙"
    });
  }
});

/* ESTIMATIVA DE CALORIAS */
app.post("/api/estimar-caloria", async (req, res) => {
  try {
    const { alimento } = req.body;

    if (!alimento) {
      return res.json({ kcal: 0 });
    }

    const prompt = `
Você é uma IA nutricional.

Estime as calorias aproximadas deste alimento/refeição:
"${alimento}"

Responda SOMENTE com um número inteiro.
Não escreva kcal.
Não explique.
Exemplo:
320
`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const match = text.match(/\d+/);
    const kcal = match ? parseInt(match[0]) : 0;

    res.json({ kcal });
  } catch (error) {
    console.error("Erro ao estimar calorias:", error);

    res.json({ kcal: 0 });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Luma API online na porta ${PORT}`);
});
