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
      tipoAnuncio,
      headline,
      subheadline,
      destaquePrincipal,
      localizacao,
      valorPrincipal,
      apoio1,
      apoio2,
      cta,
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

    if (imageBase64 && mimeType) {
      try {
        const analysisPrompt = `
Analise esta imagem enviada pelo usuário como referência visual para um anúncio de Instagram.

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
- não invente números, marcas, datas ou textos
- identifique cenário, produto, fundo, foco principal e clima visual
- sugira apenas direções visuais úteis para uma arte publicitária
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
            const outputItems = analysisData?.output || [];
            let text = "";

            for (const item of outputItems) {
              if (!Array.isArray(item.content)) continue;
              for (const content of item.content) {
                if (content?.type === "output_text" && typeof content.text === "string") {
                  text += content.text;
                }
              }
            }

            parsedAnalysis = JSON.parse(text || "{}");
          } catch {
            parsedAnalysis = {
              resumoVisual: "",
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

TIPO DE ANÚNCIO:
${tipoAnuncio || "geral"}

INFORMAÇÕES PRINCIPAIS DA PEÇA:
- Headline: ${headline || ""}
- Subheadline: ${subheadline || ""}
- Destaque principal: ${destaquePrincipal || textoArte || ""}
- Localização: ${localizacao || ""}
- Valor principal: ${valorPrincipal || ""}
- Apoio 1: ${apoio1 || ""}
- Apoio 2: ${apoio2 || ""}
- CTA: ${cta || ""}
- Tema/produto: ${tema}
- Objetivo: ${objetivo || "não informado"}
- Estilo: ${estilo || "não informado"}
- Formato: ${formato || "1080x1350"}
- Observações: ${observacoes || "nenhuma"}
- Direção visual: ${direcaoVisual || ""}

DESCRIÇÃO COMPLEMENTAR:
${descricao}

${imageInsights}

REGRAS OBRIGATÓRIAS:
- criar uma arte enxuta, elegante, profissional e persuasiva
- não escrever "criado por IA", "gerado por IA" ou frases parecidas
- não copiar texto bruto de edital, matrícula, laudo, observação técnica ou bloco jurídico
- não usar parágrafos longos
- usar apenas informações essenciais
- manter ortografia correta em português
- destacar headline e no máximo 2 ou 3 blocos de apoio
- evitar excesso de texto
- evitar poluição visual
- não inventar datas, números, valores ou localidades
- se algum dado estiver incerto, omitir esse dado da arte
- parecer um anúncio profissional real de Instagram
- priorizar contraste, legibilidade e hierarquia visual
- se houver imagem enviada, usar apenas como referência visual e conceitual
- nunca inserir observações irrelevantes na arte

ESTRUTURA VISUAL ESPERADA:
- headline principal forte
- subheadline curta, se fizer sentido
- um destaque principal
- um bloco curto de localização ou contexto
- um bloco curto de valor, se houver
- CTA curto, se houver

ESTILO VISUAL:
- sofisticado
- limpo
- comercial
- com hierarquia clara
- pronto para postagem
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
