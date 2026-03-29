import express from "express";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || "";

const supabase = createClient(supabaseUrl, supabaseSecretKey);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  const PORT = 3000;

  // API Routes
  app.get("/api/pokemon", async (req, res) => {
    const { data, error } = await supabase
      .from('pokemons')
      .select('*')
      .order('id', { ascending: true });
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ pokedex_data: data });
  });

  app.post("/api/pokemon", async (req, res) => {
    const { nome, tipos, status, descricao, image_url } = req.body;
    const safeStatus = status || { hp: 50, attack: 50, defense: 50 };
    
    let finalImageUrl = image_url;

    // Handle image upload to Supabase Storage if it's base64
    if (image_url && image_url.startsWith('data:image')) {
      try {
        const base64Data = image_url.split(',')[1];
        const buffer = Buffer.from(base64Data, 'base64');
        const fileName = `${Date.now()}-${nome.toLowerCase()}.png`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('pokemon-images')
          .upload(fileName, buffer, {
            contentType: 'image/png',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('pokemon-images')
          .getPublicUrl(fileName);
        
        finalImageUrl = publicUrlData.publicUrl;
      } catch (error: any) {
        console.error("Storage Error:", error);
        return res.status(500).json({ error: "Erro no upload da imagem: " + error.message });
      }
    }

    const { data, error } = await supabase
      .from('pokemons')
      .insert([{
        nome,
        tipos,
        hp: safeStatus.hp,
        attack: safeStatus.attack,
        defense: safeStatus.defense,
        descricao,
        image_url: finalImageUrl
      }])
      .select();

    if (error) return res.status(500).json({ error: error.message });

    res.json({
      action: "CLOSE_MODAL",
      status: "SUCCESS",
      message: "Pokémon cadastrado com sucesso!",
      new_pokemon: data[0]
    });
  });

  app.put("/api/pokemon/:id", async (req, res) => {
    const { id } = req.params;
    const { nome, tipos, status, descricao, image_url } = req.body;
    const safeStatus = status || { hp: 50, attack: 50, defense: 50 };
    
    const { data, error } = await supabase
      .from('pokemons')
      .update({
        nome,
        tipos,
        hp: safeStatus.hp,
        attack: safeStatus.attack,
        defense: safeStatus.defense,
        descricao,
        image_url
      })
      .eq('id', id)
      .select();

    if (error) return res.status(500).json({ error: error.message });
    res.json({
      action: "CLOSE_MODAL",
      status: "SUCCESS",
      message: "Pokémon atualizado com sucesso!",
      new_pokemon: data[0]
    });
  });

  app.delete("/api/pokemon/:id", async (req, res) => {
    const { id } = req.params;
    const { error } = await supabase
      .from('pokemons')
      .delete()
      .eq('id', id);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json({ status: "SUCCESS" });
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
                text: "Identifique o Pokémon nesta imagem. Retorne APENAS JSON: { \"nome\": \"string\", \"tipos\": [\"string\"], \"status\": { \"hp\": 50, \"attack\": 50, \"defense\": 50 }, \"descricao_ia\": \"Pokémon identificado via visão computacional.\", \"image_status\": \"ok\" }. Use valores padrão 50 para status."
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
