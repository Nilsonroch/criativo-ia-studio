export async function handler(event) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  function json(statusCode, payload) {
    return {
      statusCode,
      headers: corsHeaders,
      body: JSON.stringify(payload),
    };
  }

  async function parseResponseSafely(response) {
    const rawText = await response.text();
    try {
      return {
        ok: true,
        data: JSON.parse(rawText),
        rawText,
      };
    } catch {
      return {
        ok: false,
        data: null,
        rawText,
      };
    }
  }

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, { error: "Método não permitido." });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return json(500, {
        error: "A variável OPENAI_API_KEY não foi configurada no Netlify.",
      });
    }

    const body = JSON.parse(event.body || "{}");
    const {
      tema,
      descricao,
      objetivo,
      estilo,
      formato,
      observacoes,
      imageBase64,
      mimeType,
      headline,
      textoArte,
      direcaoVisual,
    } = body;

    if (!tema || !descricao) {
      return json(400, {
        error: "Os campos tema e descricao são obrigatórios.",
      });
    }

    const sizeMap = {
      "1080x1080": "1024x1024",
      "1080x1350": "1024x1536",
      "1080x1920": "1024x1536",
    };

    const imageSize = sizeMap[formato] || "1024x1536";

    let imageInsights = "";

    // Analisa a imagem enviada, se existir.
    // Se falhar, seguimos sem travar a geração da arte.
    if (imageBase64 && mimeType) {
      try {
        const analysisPrompt = `
Analise esta imagem enviada pelo usuário para servir como referência de criativo publicitário.

Retorne em JSON válido com esta estrutura:
{
  "resumoVisual": "...",
  "elementosImportantes": ["...", "..."],
  "paletaOuClima": "...",
  "composicaoSugerida": "...",
  "textoSeguroNaArte": "..."
}

Instruções:
- descreva os elementos principais da imagem
- identifique produto, cenário, clima visual e possíveis focos
- sugira como transformar isso em um post profissional para Instagram
- não invente detalhes ausentes
- responda apenas com JSON válido
`;

        const analysisResponse = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            input: [
              {
                role: "user",
                content: [
                  {
                    type: "input_text",
                    text: analysisPrompt,
                  },
                  {
                    type: "input_image",
                    image_url: `data:${mimeType};base64,${imageBase64}`,
                  },
                ],
              },
            ],
          }),
        });

        const parsedAnalysisResponse = await parseResponseSafely(analysisResponse);

        if (!analysisResponse.ok) {
          console.error("Erro na análise da imagem:", parsedAnalysisResponse.rawText);
        } else if (parsedAnalysisResponse.ok && parsedAnalysisResponse.data) {
          const analysisData = parsedAnalysisResponse.data;

          let parsedAnalysis = null;

          try {
            parsedAnalysis = JSON.parse(analysisData?.output_text || "{}");
          } catch {
            parsedAnalysis = {
              resumoVisual: analysisData?.output_text || "",
              elementosImportantes: [],
              paletaOuClima: "",
              composicaoSugerida: "",
              textoSeguroNaArte: "",
            };
          }

          imageInsights = `
Referência visual extraída da imagem enviada:
- Resumo visual: ${parsedAnalysis?.resumoVisual || "não informado"}
- Elementos importantes: ${(parsedAnalysis?.elementosImportantes || []).join(", ") || "não informado"}
- Paleta ou clima: ${parsedAnalysis?.paletaOuClima || "não informado"}
- Composição sugerida: ${parsedAnalysis?.composicaoSugerida || "não informado"}
- Texto seguro na arte: ${parsedAnalysis?.textoSeguroNaArte || "não informado"}
`;
        }
      } catch (analysisError) {
        console.error("Falha ao analisar imagem enviada:", analysisError);
      }
    }

    const visualPrompt = `
Crie uma arte publicitária profissional para Instagram com base nestas instruções.

Tema/produto: ${tema}
Objetivo: ${objetivo || "não informado"}
Estilo: ${estilo || "não informado"}
Formato: ${formato || "1080x1350"}
Descrição do criativo: ${descricao}
Observações adicionais: ${observacoes || "nenhuma"}
Headline obrigatória na arte: ${headline || "Criativo impactante"}
Texto curto obrigatório na arte: ${textoArte || "Mensagem principal do post"}
Direção visual sugerida: ${direcaoVisual || "Composição forte, moderna e orientada a conversão"}

${imageInsights}

Requisitos:
- criar uma arte publicitária profissional pronta para Instagram
- hierarquia visual clara
- headline em destaque
- texto complementar curto
- composição elegante e publicitária
- manter legibilidade
- evitar excesso de texto
- imagem final deve parecer um criativo de campanha real
- respeitar o estilo pedido pelo usuário
- se houver referência visual da imagem enviada, usar apenas como inspiração visual e conceitual
- preservar coerência com o tema informado
`;

    const payload = {
      model: "gpt-image-1",
      prompt: visualPrompt,
      size: imageSize,
      output_format: "png",
      quality: "medium",
    };

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const parsedImageResponse = await parseResponseSafely(response);

    if (!response.ok) {
      console.error("Erro da OpenAI ao gerar arte:", parsedImageResponse.rawText);

      if (parsedImageResponse.ok && parsedImageResponse.data) {
        return json(response.status, {
          error:
            parsedImageResponse.data?.error?.message ||
            "Erro ao gerar a arte com a OpenAI.",
          raw: parsedImageResponse.data,
        });
      }

      return json(response.status, {
        error: "A OpenAI retornou uma resposta inválida ao gerar a arte.",
        raw: parsedImageResponse.rawText,
      });
    }

    if (!parsedImageResponse.ok || !parsedImageResponse.data) {
      console.error("Resposta não-JSON da Images API:", parsedImageResponse.rawText);
      return json(500, {
        error: "A resposta da OpenAI para geração de imagem não veio em JSON válido.",
        raw: parsedImageResponse.rawText,
      });
    }

    const data = parsedImageResponse.data;
    const imageBase64Result = data?.data?.[0]?.b64_json || null;

    if (!imageBase64Result) {
      console.error("Sem b64_json na resposta da Images API:", data);
      return json(500, {
        error: "A OpenAI não retornou a imagem gerada.",
        raw: data,
      });
    }

    return json(200, {
      ok: true,
      imageBase64: imageBase64Result,
      mimeType: "image/png",
    });
  } catch (error) {
    console.error("Erro interno na função gerar-arte:", error);
    return json(500, {
      error: error.message || "Erro interno inesperado.",
    });
  }
}
