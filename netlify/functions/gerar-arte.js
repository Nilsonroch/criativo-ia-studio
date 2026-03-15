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

  function extractOutputText(apiData) {
    if (!apiData || !Array.isArray(apiData.output)) return "";

    const texts = [];

    for (const item of apiData.output) {
      if (!Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content.text === "string") {
          texts.push(content.text);
        }
      }
    }

    return texts.join("\n").trim();
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
                  { type: "input_text", text: analysisPrompt },
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
          let parsedAnalysis = {
            resumoVisual: "",
            elementosImportantes: [],
            climaVisual: "",
            composicaoSugerida: "",
            restricoesVisuais: [],
          };

          try {
            const outputText = extractOutputText(parsedAnalysisResponse.data);
            if (outputText) parsedAnalysis = JSON.parse(outputText);
          } catch (e) {
            console.error("Falha ao converter análise da imagem em JSON:", e);
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
`;

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt: visualPrompt,
        size: imageSize,
        output_format: "png",
      }),
    });

    const parsed = await parseResponseSafely(response);

    if (!response.ok) {
      console.error("Erro da OpenAI ao gerar arte:", parsed.rawText);

      if (parsed.ok && parsed.data) {
        return json(response.status, {
          error: parsed.data?.error?.message || "Erro ao gerar a arte com a OpenAI.",
          raw: parsed.data,
        });
      }

      return json(response.status, {
        error: "A OpenAI retornou uma resposta inválida ao gerar a arte.",
        raw: parsed.rawText,
      });
    }

    if (!parsed.ok || !parsed.data) {
      console.error("Resposta não-JSON da Images API:", parsed.rawText);
      return json(500, {
        error: "A resposta da OpenAI para geração de imagem não veio em JSON válido.",
        raw: parsed.rawText,
      });
    }

    const data = parsed.data;
    const firstImage = Array.isArray(data?.data) ? data.data[0] : null;
    const imageBase64Result = firstImage?.b64_json || null;
    const imageUrl = firstImage?.url || null;

    if (imageBase64Result) {
      return json(200, {
        ok: true,
        imageBase64: imageBase64Result,
        mimeType: "image/png",
      });
    }

    if (imageUrl) {
      return json(200, {
        ok: true,
        imageUrl,
      });
    }

    console.error("Resposta sem b64_json e sem url:", data);
    return json(500, {
      error: "A função gerar-arte não retornou a imagem gerada.",
      raw: data,
    });
  } catch (error) {
    console.error("Erro interno na função gerar-arte:", error);
    return json(500, {
      error: error.message || "Erro interno inesperado.",
    });
  }
}
