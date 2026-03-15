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

    const prompt = `
Você é um diretor de criação especializado em marketing para Instagram.

Crie um conceito de criativo com base nos dados abaixo:
- Tema/produto: ${tema}
- Descrição do criativo: ${descricao}
- Objetivo: ${objetivo || "não informado"}
- Estilo: ${estilo || "não informado"}
- Formato: ${formato || "1080x1350"}
- Observações: ${observacoes || "nenhuma"}

Sua resposta deve ser estritamente em JSON com esta estrutura:
{
  "headline": "...",
  "textoArte": "...",
  "legenda": "...",
  "hashtags": "...",
  "direcaoVisual": "..."
}

A headline deve ser forte e publicitária.
O textoArte deve ser curto.
A legenda deve ser pronta para Instagram.
As hashtags devem vir em uma única string.
A direção visual deve explicar como a arte deve ser montada.
`;

    const input = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: prompt,
          },
        ],
      },
    ];

    if (imageBase64 && mimeType) {
      input[0].content.push({
        type: "input_image",
        image_url: `data:${mimeType};base64,${imageBase64}`,
      });
    }

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        statusCode: response.status,
        headers: corsHeaders,
        body: JSON.stringify({
          error: data?.error?.message || "Erro ao consultar a OpenAI.",
          raw: data,
        }),
      };
    }

    const textOutput = data?.output_text || "";

    let parsed;
    try {
      parsed = JSON.parse(textOutput);
    } catch {
      parsed = {
        headline: "Criativo gerado com IA",
        textoArte: textOutput,
        legenda: textOutput,
        hashtags: "#Instagram #Marketing #IA",
        direcaoVisual: "Resposta retornada fora de JSON estruturado.",
      };
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        ok: true,
        result: parsed,
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
