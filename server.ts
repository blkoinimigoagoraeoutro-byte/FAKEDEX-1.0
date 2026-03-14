import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const db = new Database("pokedex.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS pokemon (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nome TEXT NOT NULL,
    tipos TEXT NOT NULL,
    hp INTEGER,
    attack INTEGER,
    defense INTEGER,
    descricao TEXT,
    image_url TEXT
  )
`);

// Seed initial data if empty
const count = db.prepare("SELECT COUNT(*) as count FROM pokemon").get() as any;
if (count.count === 0) {
  const initialPokemons = [
    {
      nome: "Bulbasaur",
      tipos: ["Grass", "Poison"],
      status: { hp: 45, attack: 49, defense: 49 },
      descricao: "Há uma semente de planta em suas costas desde o dia em que este Pokémon nasceu. A semente cresce lentamente."
    },
    {
      nome: "Charmander",
      tipos: ["Fire"],
      status: { hp: 39, attack: 52, defense: 43 },
      descricao: "Tem uma preferência por coisas quentes. Quando chove, diz-se que o vapor jorra da ponta de sua cauda."
    },
    {
      nome: "Squirtle",
      tipos: ["Water"],
      status: { hp: 44, attack: 48, defense: 65 },
      descricao: "Após o nascimento, suas costas incham e endurecem em uma concha. Ele espalha espuma poderosamente de sua boca."
    }
  ];

  const insert = db.prepare("INSERT INTO pokemon (nome, tipos, hp, attack, defense, descricao) VALUES (?, ?, ?, ?, ?, ?)");
  initialPokemons.forEach(p => {
    insert.run(p.nome, JSON.stringify(p.tipos), p.status.hp, p.status.attack, p.status.defense, p.descricao);
  });
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;

  // Helper to get full pokedex data
  const getPokedexData = () => {
    const rows = db.prepare("SELECT * FROM pokemon").all();
    const formatted = rows.map((row: any) => ({
      id: row.id,
      nome: row.nome,
      tipos: JSON.parse(row.tipos),
      status: {
        hp: row.hp,
        attack: row.attack,
        defense: row.defense
      },
      descricao: row.descricao,
      image_url: row.image_url
    }));
    return {
      total_count: formatted.length,
      pokedex_data: formatted
    };
  };

  // API Routes
  app.get("/api/pokemon", (req, res) => {
    res.json(getPokedexData());
  });

  app.post("/api/pokemon", (req, res) => {
    const { nome, tipos, status, descricao, image_url } = req.body;
    const info = db.prepare(
      "INSERT INTO pokemon (nome, tipos, hp, attack, defense, descricao, image_url) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(nome, JSON.stringify(tipos), status.hp, status.attack, status.defense, descricao, image_url);
    
    const newPokemon = {
      id: Number(info.lastInsertRowid),
      nome,
      tipos,
      status,
      descricao,
      image_url
    };

    res.json({
      action: "CLOSE_MODAL",
      status: "SUCCESS",
      message: "Pokémon cadastrado com sucesso!",
      new_pokemon: newPokemon,
      updated_pokedex: getPokedexData().pokedex_data
    });
  });

  app.put("/api/pokemon/:id", (req, res) => {
    const { id } = req.params;
    const { nome, tipos, status, descricao, image_url } = req.body;
    db.prepare(
      "UPDATE pokemon SET nome = ?, tipos = ?, hp = ?, attack = ?, defense = ?, descricao = ?, image_url = ? WHERE id = ?"
    ).run(nome, JSON.stringify(tipos), status.hp, status.attack, status.defense, descricao, image_url, id);
    
    const updatedPokemon = {
      id: Number(id),
      nome,
      tipos,
      status,
      descricao,
      image_url
    };

    res.json({
      action: "CLOSE_MODAL",
      status: "SUCCESS",
      message: "Pokémon atualizado com sucesso!",
      new_pokemon: updatedPokemon,
      updated_pokedex: getPokedexData().pokedex_data
    });
  });

  app.delete("/api/pokemon/:id", (req, res) => {
    const { id } = req.params;
    db.prepare("DELETE FROM pokemon WHERE id = ?").run(id);
    res.json(getPokedexData());
  });

  // AI Image Analysis Route
  app.post("/api/ai/analyze-image", async (req, res) => {
    const { image } = req.body; // base64 image data
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType: "image/png",
                  data: image.split(",")[1]
                }
              },
              {
                text: "Analise esta imagem de Pokémon. Identifique o Pokémon, extraia cores predominantes e características físicas. Retorne apenas JSON no formato: { \"nome\": \"string\", \"tipos\": [\"string\"], \"status\": { \"hp\": number, \"attack\": number, \"defense\": number }, \"descricao_ia\": \"string detalhada baseada na visão\", \"image_status\": \"processada\" }"
              }
            ]
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              nome: { type: Type.STRING },
              tipos: { type: Type.ARRAY, items: { type: Type.STRING } },
              status: {
                type: Type.OBJECT,
                properties: {
                  hp: { type: Type.NUMBER },
                  attack: { type: Type.NUMBER },
                  defense: { type: Type.NUMBER }
                },
                required: ["hp", "attack", "defense"]
              },
              descricao_ia: { type: Type.STRING },
              image_status: { type: Type.STRING }
            },
            required: ["nome", "tipos", "status", "descricao_ia", "image_status"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao analisar imagem" });
    }
  });

  // AI Suggestion Route
  app.post("/api/ai/suggest", async (req, res) => {
    const { nome } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Sugira os atributos e tipos para o Pokémon "${nome}" com base no lore oficial. Retorne apenas JSON no formato: { "tipos": ["Tipo1", "Tipo2"], "status": { "hp": number, "attack": number, "defense": number }, "descricao": "string curta" }`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              tipos: { type: Type.ARRAY, items: { type: Type.STRING } },
              status: {
                type: Type.OBJECT,
                properties: {
                  hp: { type: Type.NUMBER },
                  attack: { type: Type.NUMBER },
                  defense: { type: Type.NUMBER }
                },
                required: ["hp", "attack", "defense"]
              },
              descricao: { type: Type.STRING }
            },
            required: ["tipos", "status", "descricao"]
          }
        }
      });
      res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: "Erro ao consultar IA" });
    }
  });

  // AI Lore/Details Route
  app.post("/api/ai/details", async (req, res) => {
    const { nome } = req.body;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Como um especialista em Pokémon, forneça uma descrição detalhada, fraquezas e curiosidades para o Pokémon "${nome}".`,
      });
      res.json({ text: response.text });
    } catch (error) {
      res.status(500).json({ error: "Erro ao consultar IA" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
