import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

// Helper functions for Pexels and Pixabay server-side searches
async function searchPexelsVideosServer(query: string, orientation: string, minDuration: number, maxDuration: number, key: string) {
  if (!key) return [];
  try {
    const url = new URL("https://api.pexels.com/videos/search");
    url.searchParams.append("query", query);
    url.searchParams.append("orientation", orientation || "landscape");
    url.searchParams.append("per_page", "10");
    if (minDuration > 0) url.searchParams.append("min_duration", minDuration.toString());
    if (maxDuration > 0) url.searchParams.append("max_duration", maxDuration.toString());

    const resp = await fetch(url.toString(), { headers: { Authorization: key } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.videos || [];
  } catch (e) {
    return [];
  }
}

async function searchPexelsPhotosServer(query: string, orientation: string, color: string, key: string) {
  if (!key) return [];
  try {
    const url = new URL("https://api.pexels.com/v1/search");
    url.searchParams.append("query", query);
    url.searchParams.append("orientation", orientation || "landscape");
    url.searchParams.append("per_page", "10");
    if (color && color.trim()) url.searchParams.append("color", color);

    const resp = await fetch(url.toString(), { headers: { Authorization: key } });
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.photos || [];
  } catch (e) {
    return [];
  }
}

async function searchPixabayVideosServer(query: string, orientation: string, minDuration: number, key: string) {
  if (!key) return [];
  try {
    const pixabayOrientation = orientation === 'portrait' ? 'vertical' : 'horizontal';
    const url = new URL("https://pixabay.com/api/videos/");
    url.searchParams.append("key", key);
    url.searchParams.append("q", query);
    url.searchParams.append("safesearch", "true");
    url.searchParams.append("per_page", "10");
    url.searchParams.append("orientation", pixabayOrientation);
    if (minDuration > 0) url.searchParams.append("min_duration", minDuration.toString());

    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.hits || [];
  } catch (e) {
    return [];
  }
}

async function searchPixabayPhotosServer(query: string, orientation: string, color: string, key: string) {
  if (!key) return [];
  try {
    const pixabayOrientation = orientation === 'portrait' ? 'vertical' : 'horizontal';
    const url = new URL("https://pixabay.com/api/");
    url.searchParams.append("key", key);
    url.searchParams.append("q", query);
    url.searchParams.append("safesearch", "true");
    url.searchParams.append("per_page", "10");
    url.searchParams.append("orientation", pixabayOrientation);
    if (color && color.trim()) url.searchParams.append("colors", color);

    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json();
    return data.hits || [];
  } catch (e) {
    return [];
  }
}

// Proxy for Pixabay
app.get("/api/pixabay", async (req, res) => {
  const { q, type, key, format } = req.query;
  const pixabayKey = (key as string) || process.env.PIXABAY_API_KEY || process.env.VITE_PIXABAY_API_KEY;
  
  if (!pixabayKey) return res.status(400).json({ error: "Pixabay API Key missing" });

  try {
    const endpoint = type === 'video' ? 'videos' : '';
    const orientation = format === '9:16' ? 'vertical' : 'horizontal';
    const url = `https://pixabay.com/api/${endpoint}/?key=${pixabayKey}&q=${encodeURIComponent(q as string)}&safesearch=true&per_page=10&orientation=${orientation}`;
    const response = await fetch(url);
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Pixabay fetch failed" });
  }
});

// Proxy for Pexels
app.get("/api/pexels", async (req, res) => {
  const { q, type, key, format } = req.query;
  const pexelsKey = (key as string) || process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY;

  if (!pexelsKey) return res.status(400).json({ error: "Pexels API Key missing" });

  try {
    const endpoint = type === 'video' ? 'videos/search' : 'search';
    const orientation = format === '9:16' ? 'portrait' : 'landscape';
    const url = `https://api.pexels.com/v1/${endpoint}?query=${encodeURIComponent(q as string)}&per_page=10&orientation=${orientation}`;
    const response = await fetch(url, {
      headers: { Authorization: pexelsKey }
    });
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Pexels fetch failed" });
  }
});

// Proxy for downloading any asset (to avoid CORS in ZIP generation)
app.get("/api/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("URL missing");

  try {
    const response = await fetch(url as string);
    const contentType = response.headers.get("content-type");
    if (contentType) res.setHeader("Content-Type", contentType);
    
    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (e) {
    console.error("Proxy error:", e);
    res.status(500).send("Proxy fetch failed");
  }
});

// Smart Search Video and Image via Gemini
app.post("/api/smart-search", async (req, res) => {
  const { text, type, format, source, pexelsKey, pixabayKey, deepaiKey, imageStyle } = req.body;
  
  const pKey = (pexelsKey as string) || process.env.PEXELS_API_KEY || process.env.VITE_PEXELS_API_KEY || "";
  const pixKey = (pixabayKey as string) || process.env.PIXABAY_API_KEY || process.env.VITE_PIXABAY_API_KEY || "";
  const dpKey = (deepaiKey as string) || process.env.DEEPAI_API_KEY || process.env.VITE_DEEPAI_API_KEY || "";
  const geminiApiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
  
  const orientation = format === '9:16' ? 'portrait' : 'landscape';

  let geminiParams = {
    pexels_video_query: text || "",
    pexels_photo_query: text || "",
    pixabay_video_query: text || "",
    pixabay_photo_query: text || "",
    deepai_prompt: text || "",
    orientation: orientation,
    color: "",
    min_duration: 0,
    max_duration: 0
  };

  const isKeyValid = (key: string) => {
    return typeof key === "string" && key.trim() !== "" && key.startsWith("AIzaSy");
  };

  // 1. Call Gemini to translate and optimize search terms
  try {
    if (isKeyValid(geminiApiKey)) {
      const { GoogleGenAI, Type } = await import("@google/genai");
      const ai = new GoogleGenAI({
        apiKey: geminiApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const geminiResp = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Interprete este trecho de roteiro para sugerir termos de busca inteligentes para as APIs de mídia: "${text}"`,
        config: {
          systemInstruction: `Você é um assistente especializado em transformar trechos de roteiro audiovisual em buscas eficientes ou gerações de conteúdo nos bancos do Pexels, Pixabay e gerador DeepAI.

Para cada trecho de roteiro recebido, você deve:
- Analisar o contexto visual, emocional, ambiente, ação e objetos descritos.
- Gerar um JSON com as seguintes chaves:
  "pexels_video_query": string com termos de busca otimizada para a API de vídeos do Pexels (palavras em inglês, separadas por espaços, focadas no conteúdo visual).
  "pexels_photo_query": string similar para fotos no Pexels.
  "pixabay_video_query": string para a API de vídeos do Pixabay (também em inglês).
  "pixabay_photo_query": string para fotos no Pixabay.
  "deepai_prompt": string com um prompt de geração de imagem ou vídeo altamente descritivo, foto-realista e cinematográfico em inglês para o DeepAI (focado no enquadramento, humor psicológico, iluminação dramática e riqueza de detalhes).
  "orientation": sugestão de orientação: "landscape" ou "portrait".
  "color": cor predominante sugerida ou vazio se não relevante.
  "min_duration": duração mínima sugerida para vídeos, em segundos (número inteiro). Deixe 0 se não for relevante.
  "max_duration": duração máxima sugerida (número inteiro). Deixe 0 se não for relevante.

Regras:
- Use sempre termos e prompts em inglês, pois as APIs funcionam melhor com inglês.
- Prefira palavras-chave curtas para busca, mas para o "deepai_prompt" crie algo rico em detalhes, artístico e cinematográfico.
- Se o roteiro mencionar clima, luz ou atmosfera, inclua termos como "golden hour", "dramatic sky", "rainy", etc.
- Se não houver informação suficiente, use valores neutros (orientation: "${orientation}", color: "", min_duration: 0, max_duration: 0).`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              pexels_video_query: { type: Type.STRING },
              pexels_photo_query: { type: Type.STRING },
              pixabay_video_query: { type: Type.STRING },
              pixabay_photo_query: { type: Type.STRING },
              deepai_prompt: { type: Type.STRING },
              orientation: { type: Type.STRING },
              color: { type: Type.STRING },
              min_duration: { type: Type.INTEGER },
              max_duration: { type: Type.INTEGER }
            },
            required: [
              "pexels_video_query", "pexels_photo_query", "pixabay_video_query", "pixabay_photo_query",
              "deepai_prompt", "orientation", "color", "min_duration", "max_duration"
            ]
          }
        }
      });

      if (geminiResp.text) {
        const parsed = JSON.parse(geminiResp.text.trim());
        geminiParams = { ...geminiParams, ...parsed };
      }
    } else {
      console.warn("GEMINI_API_KEY environment variable is not defined or invalid");
    }

    if (imageStyle) {
      let suffix = "";
      if (imageStyle === 'A') {
        suffix = ", flat 2D vector cartoon illustration, clean bold outlines, vibrant flat colors, minimalist solid background, highly cohesive style, cheerful adventure mood. No text, no letters, no photorealism.";
      } else if (imageStyle === 'B') {
        suffix = ", 3D render in Disney Pixar style, cute character design, soft volumetric studio lighting, rich smooth textures, clay material, vibrant saturated colors, detailed beautiful background, highly consistent style. No text, no photorealism.";
      } else if (imageStyle === 'C') {
        suffix = ", clean 2D vector illustration style, pastel colors, soft textured shading, charming narrative picture book aesthetic, cozy whimsical lighting, cute character design. No text, no photorealism.";
      }
      if (suffix) {
        geminiParams.deepai_prompt = `${geminiParams.deepai_prompt}${suffix}`;
      }
    }
  } catch (e) {
    console.warn("Gemini smart query generation fell back to regular text:", e instanceof Error ? e.message : e);
  }

  let assetUrl: string | null = null;
  const selectedType = type || 'image';

  const pexels_query = selectedType === 'video' ? geminiParams.pexels_video_query : geminiParams.pexels_photo_query;
  const pixabay_query = selectedType === 'video' ? geminiParams.pixabay_video_query : geminiParams.pixabay_photo_query;

  const targetOrientation = geminiParams.orientation || orientation;
  const targetColor = geminiParams.color || "";
  const minDur = geminiParams.min_duration || 0;
  const maxDur = geminiParams.max_duration || 0;

  try {
    if (source === 'deepai') {
      if (dpKey && dpKey.trim() !== "" && dpKey !== "undefined" && dpKey !== "null") {
        const endpoint = selectedType === 'video' ? 'text2video' : 'text2image';
        const deepai_url = `https://api.deepai.org/api/${endpoint}`;
        const params = new URLSearchParams();
        params.append("text", geminiParams.deepai_prompt);
        
        try {
          const response = await fetch(deepai_url, {
            method: 'POST',
            headers: {
              'api-key': dpKey
            },
            body: params
          });
          if (response.ok) {
            const data = await response.json();
            assetUrl = data.output_url || null;
          } else {
            const errTxt = await response.text();
            console.warn("DeepAI Smart Search fallback triggered. Status:", response.status, errTxt);
          }
        } catch (fetchErr: any) {
          console.warn("DeepAI Smart Search fetch exception:", fetchErr?.message || fetchErr);
        }
      } else {
        console.warn("Skipping DeepAI Smart Search: API key is not configured or invalid.");
      }
    }

    if (!assetUrl && (source === 'pexels' || source === 'hybrid')) {
      if (selectedType === 'video') {
        const vids = await searchPexelsVideosServer(pexels_query, targetOrientation, minDur, maxDur, pKey);
        if (vids.length > 0) {
          const maxResults = Math.min(vids.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          const v = vids[randomIndex];
          const hd_file = v.video_files?.find((f: any) => f.quality === 'hd');
          assetUrl = hd_file?.link || v.video_files?.[0]?.link || null;
        }
      } else {
        const photos = await searchPexelsPhotosServer(pexels_query, targetOrientation, targetColor, pKey);
        if (photos.length > 0) {
          const maxResults = Math.min(photos.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          assetUrl = photos[randomIndex]?.src?.large2x || null;
        }
      }
    }

    if (!assetUrl && (source === 'pixabay' || source === 'hybrid')) {
      if (selectedType === 'video') {
        const vids = await searchPixabayVideosServer(pixabay_query, targetOrientation, minDur, pixKey);
        if (vids.length > 0) {
          const maxResults = Math.min(vids.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          const selected = vids[randomIndex];
          assetUrl = selected.videos?.medium?.url || selected.videos?.small?.url || null;
        }
      } else {
        const photos = await searchPixabayPhotosServer(pixabay_query, targetOrientation, targetColor, pixKey);
        if (photos.length > 0) {
          const maxResults = Math.min(photos.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          assetUrl = photos[randomIndex]?.webformatURL || null;
        }
      }
    }
    
    // Secondary fallback without stringent filters (color, duration)
    if (!assetUrl && (source === 'pexels' || source === 'hybrid')) {
       if (selectedType === 'video') {
         const vids = await searchPexelsVideosServer(pexels_query, targetOrientation, 0, 0, pKey);
         if (vids.length > 0) {
           const maxResults = Math.min(vids.length, 5);
           const randomIndex = Math.floor(Math.random() * maxResults);
           const v = vids[randomIndex];
           const hd_file = v.video_files?.find((f: any) => f.quality === 'hd');
           assetUrl = hd_file?.link || v.video_files?.[0]?.link || null;
         }
       } else {
         const photos = await searchPexelsPhotosServer(pexels_query, targetOrientation, "", pKey);
         if (photos.length > 0) {
           const maxResults = Math.min(photos.length, 5);
           const randomIndex = Math.floor(Math.random() * maxResults);
           assetUrl = photos[randomIndex]?.src?.large2x || null;
         }
       }
    }

    if (!assetUrl && (source === 'pixabay' || source === 'hybrid')) {
       if (selectedType === 'video') {
         const vids = await searchPixabayVideosServer(pixabay_query, targetOrientation, 0, pixKey);
         if (vids.length > 0) {
           const maxResults = Math.min(vids.length, 5);
           const randomIndex = Math.floor(Math.random() * maxResults);
           const selected = vids[randomIndex];
           assetUrl = selected.videos?.medium?.url || selected.videos?.small?.url || null;
         }
       } else {
         const photos = await searchPixabayPhotosServer(pixabay_query, targetOrientation, "", pixKey);
         if (photos.length > 0) {
           const maxResults = Math.min(photos.length, 5);
           const randomIndex = Math.floor(Math.random() * maxResults);
           assetUrl = photos[randomIndex]?.webformatURL || null;
         }
       }
    }
  } catch (err) {
    console.warn("Asset query fetch fallback handled:", err);
  }

  res.json({
    success: true,
    params: geminiParams,
    assetUrl: assetUrl
  });
});

// Proxy for DeepAI
app.post("/api/deepai", async (req, res) => {
  const { text, type, key } = req.body;
  const deepaiKey = (key as string) || process.env.DEEPAI_API_KEY || process.env.VITE_DEEPAI_API_KEY || "";

  if (!deepaiKey) {
    return res.status(400).json({ error: "Chave da API do DeepAI não fornecida." });
  }

  try {
    const endpoint = type === 'video' ? 'text2video' : 'text2image';
    const url = `https://api.deepai.org/api/${endpoint}`;

    const params = new URLSearchParams();
    params.append("text", text || "cinematic style scenery, psychology theme");

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'api-key': deepaiKey
      },
      body: params
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ error: `DeepAI error: ${errorText}` });
    }

    const data = await response.json();
    res.json(data);
  } catch (e) {
    console.warn("DeepAI fetch exception occurred:", e);
    res.status(500).json({ error: "Erro ao gerar mídia no DeepAI." });
  }
});

export { app };
