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
      subheadline,
      destaquePrincipal,
      localizacao,
      valorPrincipal,
      cta,
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

    if (imageBase64 && mimeType) {
      try {
        const analysisPrompt = `
Analise esta imagem enviada pelo usuário como referência visual para um post publicitário de Instagram.

Retorne APENAS JSON válido com esta estrutura:
{
  "resumoVisual": "...",
  "elementosImportantes": ["...", "..."],
  "climaVisual": "...",
  "composicaoSugerida": "...",
  "restricoesVisuais": ["...", "..."]
}

REGRAS:
- descreva apenas o que realmente aparece
- não invente texto, marcas, datas ou números não visíveis
- identifique cenário, produto, fundo, clima visual e foco principal
- sugira composição visual para um anúncio profissional
- se a imagem estiver confusa, diga isso de forma curta
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
              climaVisual: "",
              composicaoSugerida: "",
              restricoesVisuais: [],
            };
          }

          imageInsights = `
Referência visual da imagem enviada:
- Resumo visual: ${parsedAnalysis?.resumoVisual || "não informado"}
- Elementos importantes: ${(parsedAnalysis?.elementosImportantes || []).join(", ") || "não informado"}
- Clima visual: ${parsedAnalysis?.climaVisual || "não informado"}
- Composição sugerida: ${parsedAnalysis?.composicaoSugerida || "não informado"}
- Restrições visuais: ${(parsedAnalysis?.restricoesVisuais || []).join(", ") || "nenhuma"}
`;
        }
      } catch (analysisError) {
        console.error("Falha ao analisar imagem enviada:", analysisError);
      }
    }

    const visualPrompt = `
Crie uma arte publicitária profissional para Instagram.

Dados do anúncio:
- Tema/produto: ${tema}
- Objetivo: ${objetivo || "não informado"}
- Estilo: ${estilo || "não informado"}
- Formato: ${formato || "1080x1350"}
- Headline principal: ${headline || ""}
- Subheadline: ${subheadline || ""}
- Destaque principal: ${destaquePrincipal || textoArte || ""}
- Localização: ${localizacao || ""}
- Valor principal: ${valorPrincipal || ""}
- CTA: ${cta || ""}
- Observações adicionais: ${observacoes || "nenhuma"}
- Direção visual sugerida: ${direcaoVisual || ""}

Descrição complementar:
${descricao}

${imageInsights}

REGRAS OBRIGATÓRIAS:
- criar uma arte enxuta, elegante, profissional e persuasiva
- não escrever "criado por IA", "gerado com IA" ou frases similares
- não inserir parágrafos longos
- não copiar texto bruto de edital, descrição jurídica, matrícula ou bloco técnico
- usar apenas as informações essenciais para vender a ideia principal
- manter ortografia correta em português
- destacar headline e no máximo 2 ou 3 informações fortes
- evitar excesso de texto
- evitar informação irrelevante ou sem relação comercial
- não inventar números, datas ou localidades
- se algum dado estiver incerto, omitir esse dado da arte
- parecer um anúncio profissional real de Instagram
- priorizar contraste, legibilidade e hierarquia visual
- se houver imagem enviada, usar apenas como inspiração visual/conceitual, sem tentar reproduzir texto da imagem original

ESTRUTURA VISUAL ESPERADA:
- headline forte
- subtítulo curto, se fizer sentido
- 1 destaque principal
- localização ou contexto curto
- valor principal, se houver
- CTA curto, se houver

A arte deve ficar limpa, sofisticada e pronta para postagem.
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
