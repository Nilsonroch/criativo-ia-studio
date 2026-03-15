export async function handler(event) {
  const corsHeaders = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: "Método não permitido." }),
    };
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "A variável OPENAI_API_KEY não foi configurada no Netlify.",
        }),
      };
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
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "Os campos tema e descricao são obrigatórios.",
        }),
      };
    }

    const sizeMap = {
      "1080x1080": "1024x1024",
      "1080x1350": "1024x1536",
      "1080x1920": "1024x1536",
    };

    const imageSize = sizeMap[formato] || "1024x1536";

    let imageInsights = "";

    // 1) Se houver imagem enviada, primeiro analisamos essa imagem com a Responses API
    if (imageBase64 && mimeType) {
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

      const analysisData = await analysisResponse.json();

      if (!analysisResponse.ok) {
        return {
          statusCode: analysisResponse.status,
          headers: corsHeaders,
          body: JSON.stringify({
            error: analysisData?.error?.message || "Erro ao analisar a imagem enviada.",
            raw: analysisData,
          }),
        };
      }

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

    // 2) Agora geramos a arte final a partir do prompt
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
- criar um post visualmente profissional, pronto para Instagram
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
      size: imageSize,
      output_format: "png",
      prompt: visualPrompt,
    };

    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error?.message || "Erro ao gerar a arte com a OpenAI.",
          raw: data,
        }),
      };
    }

    const imageBase64Result = data?.data?.[0]?.b64_json || null;

    if (!imageBase64Result) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: "A OpenAI não retornou a imagem gerada.",
          raw: data,
        }),
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        imageBase64: imageBase64Result,
        mimeType: "image/png",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: error.message || "Erro interno inesperado.",
      }),
    };
  }
}
