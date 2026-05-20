require("dotenv").config();

const express = require("express");
const cors = require("cors");

const {
  GoogleGenerativeAI
} = require("@google/generative-ai");

const app = express();

app.use(cors());

app.use(express.json({
  limit: "10mb"
}));

const genAI = new GoogleGenerativeAI(
  process.env.GEMINI_API_KEY
);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash"
});

app.get("/", (req, res) => {

  res.send("Luma API online 🌙");

});

app.post("/api/chat", async (req, res) => {

  try {

    const {
      message,
      mood
    } = req.body;

    const prompt = `
Você é Luma.

Uma IA acolhedora focada em:
- saúde
- emagrecimento
- motivação
- apoio emocional

Humor:
${mood || "não informado"}

Mensagem:
${message}

Responda de forma acolhedora.
`;

    const result =
      await model.generateContent(prompt);

    const response =
      result.response.text();

    res.json({
      reply: response
    });

  } catch (error) {

    console.log(error);

    res.status(500).json({
      reply:
        "A Luma encontrou um problema 🌙"
    });

  }

});

const PORT =
  process.env.PORT || 3000;

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Luma API online na porta ${PORT}`
    );

  }
);
