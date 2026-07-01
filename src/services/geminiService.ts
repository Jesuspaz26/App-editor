import { GoogleGenAI, Type } from "@google/genai";
import { GeneratedScript, Inspiration, VideoProject, LanguagePattern, SEOMetadata } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const extractJSON = (text: string) => {
  try {
    // Try clean parse first
    return JSON.parse(text.trim());
  } catch (e) {
    // Attempt to find JSON block using regex if it's wrapped in markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (innerError) {
        console.error("Malformed JSON detected:", jsonMatch[0]);
        throw new Error("Falha ao processar resposta da IA. O formato retornado é inválido.");
      }
    }
    console.error("AI Response was not JSON:", text);
    throw new Error("A IA não retornou um formato de dados válido.");
  }
};

export const analyzeScriptForVideo = async (script: string): Promise<VideoProject> => {
  const model = "gemini-3-flash-preview"; 
  const prompt = `
    Analise o seguinte roteiro e divida-o em cenas curtas para um vídeo dinâmico.
    O roteiro deve ser COMPLETAMENTE coberto pelas cenas, sem pular nenhuma parte do texto original.
    Para cada cena, forneça:
    1. O trecho exato do texto (narração).
    2. A duração necessária para ler esse trecho de forma natural (calcule aproximadamente 130 palavras por minuto ou 2.2 palavras por segundo).
    3. Uma palavra-chave de busca em INGLÊS focada em STORYTELLING VISUAL (V2.1) para bancos de imagens (Pexels/Pixabay). 
    DETALHES DO PROMPT (EXTREMA IMPORTÂNCIA): 
    - SINCRONIA E COBERTURA: Cada palavra do roteiro deve estar presente em alguma das cenas, na ordem correta.
    - STORYTELLING VISUAL: Transforme ideias abstratas em imagens concretas. Meta: Se o texto fala de "estratégia", a busca deve ser "chess piece king falling" ou "person planning on whiteboard".
    - Foque no ASSUNTO e na AÇÃO: Descreva QUEM está na cena e O QUE está fazendo de forma direta.
    - EVITE RUÍDO TÉCNICO: Não use termos como "8k", "high detail" ou "ultra-realistic" na palavra-chave de busca. Use apenas descrições visuais.
    - Exemplo de busca eficiente: "person typing on laptop in cozy cafe", "businessman walking in street slow motion", "nature landscape drone shot sunset".
    - Seja específico, mas mantenha a busca baseada em palavras que um fotógrafo usaria para taggear um vídeo.

    ROTEIRO:
    "${script}"

    SAÍDA (Responda APENAS em JSON):
    {
      "scenes": [
        {
          "text": "Texto da narração...",
          "duration": 5.5,
          "visualQuery": "person walking in park sunset"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  duration: { type: Type.NUMBER },
                  visualQuery: { type: Type.STRING }
                },
                required: ["text", "duration", "visualQuery"]
              }
            }
          },
          required: ["scenes"]
        }
      }
    });

    const parsed = extractJSON(response.text || "{}");
    return {
      id: crypto.randomUUID(),
      originalScript: script,
      scenes: parsed.scenes || [],
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch (error) {
    console.error("Erro ao analisar roteiro:", error);
    throw new Error("Falha ao analisar roteiro. O modelo pode estar com alta demanda, tente novamente em instantes.");
  }
};

export const analyzeScriptForClassification = async (script: string): Promise<{ niche: string; style: string }> => {
  const model = "gemini-3-flash-preview";
  const prompt = `
    Você é um analista de conteúdo sênior v2.1.
    Analise o seguinte roteiro de vídeo e identifique o Nicho e o Estilo predominantes.
    
    CRITÉRIOS v2.1:
    - Nicho: Deve ser direto (Ex: Psicologia Humana, Marketing e Storytelling, Notícias, Curiosidades).
    - Estilo: Deve descrever a narrativa (Ex: Narrativa Dramática, Storytelling Educativo, Vlog Casual, Documentário Profissional).
    
    ROTEIRO:
    ${script}
    
    Responda APENAS um JSON no formato:
    {
      "niche": "Nome do Nicho",
      "style": "Nome do Estilo/Tom"
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            niche: { type: Type.STRING },
            style: { type: Type.STRING }
          },
          required: ["niche", "style"]
        }
      }
    });

    const text = response.text || "{}";
    return extractJSON(text);
  } catch (error) {
    console.error("Erro ao classificar roteiro:", error);
    return { niche: "Geral", style: "Informativo" };
  }
};

export const generateSEOMetadata = async (content: string): Promise<SEOMetadata & { timestamps: string }> => {
  const model = "gemini-2.0-flash";
  const prompt = `
    Você é um especialista em YouTube SEO Nível Sênior (v2.1).
    Sua tarefa é analisar o roteiro ou ideia abaixo e extrair o máximo potencial de busca seguindo os fundamentos do YouTube SEO.

    CONTEÚDO PARA ANÁLISE:
    "${content}"

    REQUISITOS AVANÇADOS (v2.1):
    1. Títulos Magnéticos: Crie 5 títulos com as palavras-chave estratégicas NO INÍCIO do título. Use gatilhos de curiosidade.
    2. Descrição Estratégica: Comece com as 2 primeiras frases contendo a palavra-chave principal. Inclua um resumo envolvente, CTAs claros e variações linguísticas (sinônimos) para aumentar o alcance sem parecer spam.
    3. Mecanismo de SEO (Palavras-Chave): Identifique Keywords Primárias (amplas), Secundárias (médias) e Long-tail (nicho).
    4. Timestamps (Capítulos): Baseado no roteiro fornecido, sugira timestamps (00:00 - Título) para criar capítulos no vídeo, facilitando o recurso "Key Moments" do Google.
    5. Hashtags: Liste 10 hashtags sendo as 3 primeiras as mais amplas e as restantes focadas em nicho.
    6. Thumbnail Prompt: Crie um prompt de thumbnail hyper-detalhado focado em cores vibrantes, alto contraste e texto de impacto.

    IMPORTANTE: Responda APENAS em JSON. Texto em português, prompts de imagem em inglês.
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titles: { type: Type.ARRAY, items: { type: Type.STRING } },
            description: { type: Type.STRING },
            hashtags: { type: Type.ARRAY, items: { type: Type.STRING } },
            keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            thumbnailPrompt: { type: Type.STRING },
            timestamps: { type: Type.STRING }
          },
          required: ["titles", "description", "hashtags", "keywords", "thumbnailPrompt", "timestamps"]
        }
      }
    });

    return extractJSON(response.text || "{}");
  } catch (error) {
    console.error("Erro ao gerar SEO:", error);
    throw new Error("Falha ao gerar metadados de SEO. Tente novamente.");
  }
};

export const generateScriptAI = async (
  idea: string,
  niche: string,
  wordCount: number | 'manual',
  format: '16:9' | '9:16',
  inspirations: Inspiration[],
  languagePatterns: LanguagePattern[],
  style?: string,
  advancedMode?: boolean,
  targetLanguage: 'pt' | 'es' = 'pt',
  imageStyle?: 'A' | 'B' | 'C'
): Promise<GeneratedScript> => {
  const matchedInspirations = inspirations.filter(i => i.niche === niche);
  
  const relevantInspirations = matchedInspirations.length > 0 
    ? matchedInspirations.map(i => `[ESTRUTURA DE SUCESSO DO NICHO ${niche}]:\n${i.content}`).join("\n\n---\n\n")
    : "Não há inspirações específicas para este nicho ainda.";

  const matchedPatterns = languagePatterns.filter(p => p.niche === niche);
  const relevantPatterns = matchedPatterns.length > 0
    ? matchedPatterns.map(p => `[PADRÃO DE LINGUAGEM ${p.style}]:\n${p.content}`).join("\n\n---\n\n")
    : "Não há padrões de linguagem específicos para este nicho ainda.";

  let visualStylePrompt = "";
  if (imageStyle === 'A') {
    visualStylePrompt = `
    FASE 6: REQUISITO DE CONSISTÊNCIA VISUAL DE IMAGENS (Opção A - Estilo Cartoon 2D Vetorial)
    Todas as descrições de imagens (campo "imagePrompt" de cada cena) DEVEM seguir rigorosamente esta fórmula e termos técnicos em inglês:
    [CENA OU PERSONAGEM FAZENDO ALGO], flat 2D vector cartoon illustration, clean bold outlines, vibrant flat colors, minimalist solid background, highly cohesive style, cheerful adventure mood. No text, no letters, no photorealism.
    Exemplo: "An astronaut cartoon character looking through a telescope at a glowing red planet, flat 2D vector cartoon illustration, clean bold outlines, vibrant flat colors, minimalist cosmic background, highly cohesive style, cheerful adventure mood. No text, no letters, no photorealism."
    `;
  } else if (imageStyle === 'B') {
    visualStylePrompt = `
    FASE 6: REQUISITO DE CONSISTÊNCIA VISUAL DE IMAGENS (Opção B - Estilo Cartoon 3D Volumétrico / Pixar)
    Todas as descrições de imagens (campo "imagePrompt" de cada cena) DEVEM seguir rigorosamente esta fórmula e termos técnicos em inglês:
    [CENA OU PERSONAGEM FAZENDO ALGO], 3D render in Disney Pixar style, cute character design, soft volumetric studio lighting, rich smooth textures, clay material, vibrant saturated colors, detailed beautiful background, highly consistent style. No text, no photorealism.
    Exemplo: "A cute lion cartoon character wearing laboratory glasses and looking at a glowing green chemical potion, 3D render in Disney Pixar style, soft volumetric studio lighting, rich smooth textures, clay material, vibrant saturated colors, detailed physics lab background, highly consistent style. No text, no photorealism."
    `;
  } else if (imageStyle === 'C') {
    visualStylePrompt = `
    FASE 6: REQUISITO DE CONSISTÊNCIA VISUAL DE IMAGENS (Opção C - Estilo Ilustração Infantil Flat / Fábulas)
    Todas as descrições de imagens (campo "imagePrompt" de cada cena) DEVEM seguir rigorosamente esta fórmula e termos técnicos em inglês:
    [CENA OU PERSONAGEM FAZENDO ALGO], clean 2D vector illustration style, pastel colors, soft textured shading, charming narrative picture book aesthetic, cozy whimsical lighting, cute character design. No text, no photorealism.
    Exemplo: "A little cute girl with red hair walking with a small friendly baby wolf, clean 2D vector illustration style, pastel colors, soft textured shading, charming narrative picture book aesthetic, cozy whimsical forest lighting, cute character design. No text, no photorealism."
    `;
  }

  const prompt = `
    VOCÊ É UM ESPECIALISTA EM VÍDEOS VIRAIS (RETENÇÃO, IMPACTO EMOCIONAL E ALTA TAXA DE CLIQUES).
    Sua missão é criar um sistema inteligente que decide, analisa, aprende e otimiza conteúdo viral.

    IDIOMA OBRIGATÓRIO DO ROTEIRO: "${targetLanguage === 'pt' ? 'PORTUGUÊS (BRASIL)' : 'ESPANHOL'}" (Escreva TODO o roteiro e narração IMPECAVELMENTE neste idioma).
    NICHO ALVO: "${niche}"
    ESTILO SELECIONADO: "${style || 'Livre'}"
    MODO AGRESSIVO DE VIRALIZAÇÃO: ${advancedMode ? 'ATIVADO (PRIORIZE MÁXIMA RETENÇÃO E EMOÇÃO IMPACTANTE)' : 'DESATIVADO'}
    
    [BASE DE TREINAMENTO E LINGUAGEM]:
    Abaixo estão roteiros e padrões de linguagem de sucesso já validados.
    QUANDO ALGUM ROTEIRO FOR ADICIONADO AQUI, FAÇA UMA SÍNTESE DO CONTEÚDO para extrair as melhores informações, estruturas e ganchos. Use essa síntese para compor o novo roteiro. DESTA FORMA, EVITAMOS MUITAS PARTES GENÉRICAS e garantimos a mesma qualidade e inteligência.
    ${relevantInspirations}
    
    ${relevantPatterns}
    
    IDEIA BASE: "${idea || 'Escolha um tema viral e relevante você mesmo'}"
    
    DIRETRIZES DE LINGUAGEM E TOM (CONVERSA DIRETA COM O PÚBLICO):
    - PENSAMENTO HUMANO: Aja e pense como um ser humano ao construir a narrativa. Crie uma história envolvente, com fluidez e empatia, relacionando fatos de forma natural.
    - SEM GÍRIAS: A linguagem deve ser casual e natural, MAS TOTALMENTE LIVRE DE GÍRIAS. Mantenha um vocabulário acessível, limpo, respeitoso e inteligente.
    - DIÁLOGO ATIVO COM O ESPECTADOR: O texto deve ser estruturado explicitamente como uma CONVERSA direta com quem está assistindo. Fale diretamente com a pessoa ("você sabe como é...", "você já percebeu que...", "imagina você nessa situação...").
    - EXTREMA NATURALIDADE: O texto deve fluir de forma absurdamente orgânica. Escreva como se estivesse batendo um papo frente a frente com o público, faça perguntas retóricas e as responda, simulando um diálogo real. Nada de frases perfeitamente redondas ou acadêmicas.
    - TOM INTIMISTA: Fale como se estivesse contando o maior segredo do mundo exclusivamente para a pessoa do outro lado da tela. Use expressões de ligação naturais ("o mais interessante é...", "mas pensa comigo...", "olha só essa parte").
    - RITMO LÍQUIDO (TRANSIÇÕES INVISÍVEIS): ELimine completamente blocos rígidos, listas do tipo "primeiro motivo", "segundo ponto", "em resumo" ou "para concluir". Uma frase deve derreter na outra. Entrelace os fatos como uma teia.
    - PROIBIDO CLICHÊS DE RETENÇÃO: Nunca comece com "Imagine xyz" ou "E se eu te disser que". Não use "Fica até o final" ou "Você não vai acreditar". A retenção deve vir pela história magnética e detalhes viscerais, não por truques baratos.
    - HISTÓRIAS E DETALHES VISCERAIS: Em vez de afirmar coisas, conte causos, mostre cenas descritivas ("Eu lembro quando...", "Pensa na seguinte cena...", "O cheiro lá era de..."). Apele pros sentidos.

    FASE 1: ANÁLISE DE DECISÃO E FILTRO DE VALOR
    O tema é bom? Se sim, como transformá-lo numa conversa de bar fascinante, que deixa as pessoas de boca aberta?

    FASE 2: MOTOR DE SCORE VIRAL (VISÃO HUMANA)
    Avalie o potencial de retenção real. Pergunte-se: "Isso soa autêntico ou parece um robô lendo um artigo da Wikipedia?".

    FASE 3: GERAÇÃO DE ROTEIRO (ESTRUTURA APRIMORADA)
    Todo roteiro DEVE ser estruturado na seguinte ordem:
    1. Desenvolvimento Hipnótico (Coração do Vídeo): Elabore MELHOR as histórias. Traga muito contexto, mergulhe profundamente nas minucias através de causos, descrições vívidas e reviravoltas suaves. Não seja superficial; aprofunde a narrativa criando arcos dramáticos (início, meio e ápice do problema). Cada frase deve ser o gancho da próxima, expandindo a história como um novelo sendo desenrolado.
    2. Final Curto: A conclusão deve ser ágil, concisa e inesperada. O final não avisa que é o final, não enrole. Apenas entregue o "payoff", resolva a tensão principal em poucas palavras ou solte uma última frase de reflexão que deixe o público atordoado.
    
    FASE 4: OTIMIZAÇÃO PARA CLONAGEM DE VOZ (LMNT TTS)
    Prepare absolutamente TODO o texto ('fullText' e o campo 'text' das 'scenes') para ser narrado com a engine hiper-realista da IA LMNT (app.lmnt.com):
    - PONTUAÇÃO CONTÍNUA E SEM PAUSAS: O LMNT TTS é sensível a pontuações e acaba fazendo pausas muito longas ou estranhas. É ABSOLUTAMENTE PROIBIDO o uso de reticências (...) e exclamações duplas (!!). Use pouquíssimas vírgulas. Prefira frases curtas e diretas terminadas em ponto final. A fluidez deve vir das palavras e não da pontuação.
    - DIÇÃO ABSOLUTA (ESCREVA COMO SE FALA): Escreva os números e cifrões sempre por extenso! Troque "1994" por "mil novecentos e noventa e quatro". Troque "100%" por "cem por cento". Troque "R$50" por "cinquenta reais". Siglas complexas devem ser fonetizadas ("C B F" ao invés de "CBF").
    - SEM CAIXA ALTA: NUNCA use palavras em MAIÚSCULAS para dar ênfase, pois a IA LMNT não as reproduz corretamente. Escreva todo o texto em caixa baixa (apenas a primeira letra da frase em maiúscula).
    - LIMPEZA DE TEXTO PARA ALGORITMOS LMNT: NENHUM símbolo ou abreviação! Elimine coisas como "etc", "&", "+", "vs", "/", "-", "*". Escreva "e outras coisas", "e", "mais", "versus". Símbolos quebram a imersão e causam "gaguejos" no TTS.

    FASE 5: ANÁLISE TÉCNICA
    Eleve o fator "Segredo de Estado", "Intimidade" e "Riqueza Narrativa" das histórias contadas.

    ${visualStylePrompt}

    ESTRUTURA DO ROTEIRO (${format === '16:9' ? 'VÍDEO LONGO 16:9' : 'VÍDEO CURTO 9:16'}):
    Comprimento desejado: Aproximadamente ${wordCount === 'manual' || typeof wordCount !== 'number' ? (format === '16:9' ? '500' : '150') : wordCount} palavras.
    ${typeof wordCount === 'number' && wordCount >= 2000 ? 'IMPORTANTE: Este é um vídeo EXTREMAMENTE LONGO (Documentário/Investigação). Apele para uma NARRATIVA IMENSAMENTE RICA, detalhando origens, bastidores obscuros e ramificações. NÃO ENROLE, apenas vá MAIS FUNDO nos detalhes.' : ''}
    ${typeof wordCount === 'number' && wordCount >= 2500 ? 'REQUISITO CRÍTICO DE EXTEENSÃO: O texto DEVE exceder 15.000 caracteres de puro STORYTELLING ENVOLVENTE. Crie mini-arcos narrativos dentro do vídeo. Expanda as explicações criando quase um podcast visual!' : ''}
    ${typeof wordCount === 'number' && wordCount >= 2000 ? 'OTIMIZAÇÃO DO JSON: Para garantir a extensão massiva, agrupe as "scenes" em longos blocos lógicos de 1 a 2 minutos no roteiro. O array "scenes" não deve ter dezenas de cenas minúsculas, mas blocos ENORMES e imersivos para liberar tokens para o texto!' : ''}

    SAÍDA (Responda APENAS em JSON com a seguinte estrutura):
    {
      "title": "Título Magnético do Vídeo",
      "fullText": "Texto completo do roteiro em português",
      "decision": {
        "worthProducing": true/false,
        "reason": "Por que vale ou não a pena?",
        "improvements": "Como levar esse tema para o próximo nível"
      },
      "viralScore": 85,
      "viralClassification": "Alto",
      "viralAnalysis": {
        "curiosity": 9,
        "emotion": 8,
        "conflict": 7,
        "surprise": 8,
        "trend": 9,
        "justification": "Explicação detalhada dos pontos de score"
      },
      "idealCut": "Onde fazer o corte mais impactante",
      "emotionalPeak": "Ponto de maior carga emocional do vídeo",
      "thumbnailSuggestions": ["Sugestão 1: Descrição visual", "Sugestão 2: Descrição visual"],
      "thumbnailPrompt": "A detailed DALL-E 3 style prompt for a high-CTR thumbnail",
      "scenes": [
        {
          "startTime": "00:00:00,000",
          "endTime": "00:00:05,500",
          "text": "Texto da cena",
          "imagePrompt": "Visual prompt for image generation"
        }
      ]
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        maxOutputTokens: 8192,
        temperature: 0.7,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            fullText: { type: Type.STRING },
            decision: {
              type: Type.OBJECT,
              properties: {
                worthProducing: { type: Type.BOOLEAN },
                reason: { type: Type.STRING },
                improvements: { type: Type.STRING }
              },
              required: ["worthProducing", "reason", "improvements"]
            },
            viralScore: { type: Type.NUMBER },
            viralClassification: { type: Type.STRING },
            viralAnalysis: {
              type: Type.OBJECT,
              properties: {
                curiosity: { type: Type.NUMBER },
                emotion: { type: Type.NUMBER },
                conflict: { type: Type.NUMBER },
                surprise: { type: Type.NUMBER },
                trend: { type: Type.NUMBER },
                justification: { type: Type.STRING }
              },
              required: ["curiosity", "emotion", "conflict", "surprise", "trend", "justification"]
            },
            idealCut: { type: Type.STRING },
            emotionalPeak: { type: Type.STRING },
            thumbnailSuggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
            thumbnailPrompt: { type: Type.STRING },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING },
                  text: { type: Type.STRING },
                  imagePrompt: { type: Type.STRING }
                },
                required: ["startTime", "endTime", "text", "imagePrompt"]
              }
            }
          },
          required: [
            "title", "fullText", "decision", "viralScore", "viralClassification", 
            "viralAnalysis", "idealCut", "emotionalPeak", 
            "thumbnailSuggestions", "thumbnailPrompt", "scenes"
          ]
        }
      }
    });

    const text = response.text || "";
    const parsed = extractJSON(text);

    return {
      ...parsed,
      id: crypto.randomUUID(),
      niche,
      wordCount,
      format,
      contentType: style || 'Nenhum',
      advancedMode: !!advancedMode,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
  } catch (error) {
    console.error("Erro ao gerar roteiro:", error);
    throw new Error("Falha ao gerar roteiro viral. Verifique sua conexão e tente novamente.");
  }
};
