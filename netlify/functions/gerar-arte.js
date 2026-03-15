export async function handler(event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  const reply = (statusCode, body) => ({
    statusCode,
    headers,
    body: JSON.stringify(body),
  });

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return reply(405, { error: "Método não permitido." });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return reply(500, {
        error: "A variável OPENAI_API_KEY não foi configurada no Netlify.",
      });
    }

    let body = {};
    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return reply(400, { error: "JSON inválido no corpo da requisição." });
    }

    const {
      tema,
      descricao,
      estilo,
      formato,
      tipoAnuncio,
      direcaoVisual,
    } = body;

    if (!tema || !descricao) {
      return reply(400, {
        error: "Os campos tema e descricao são obrigatórios.",
      });
    }

    const sizeMap = {
      "1080x1080": "1024x1024",
      "1080x1350": "1024x1536",
      "1080x1920": "1024x1536",
    };

    const imageSize = sizeMap[formato] || "1024x1536";

    const prompt = `
Crie apenas o FUNDO VISUAL de uma arte publicitária profissional para Instagram.

Tema: ${tema}
Tipo de anúncio: ${tipoAnuncio || "geral"}
Estilo: ${estilo || "comercial"}
Direção visual: ${direcaoVisual || "visual limpo e profissional"}
Contexto: ${descricao}

REGRAS OBRIGATÓRIAS:
- NÃO escrever nenhum texto na imagem
- NÃO inserir letras, números, logotipos, marcas d'água ou tipografia
- criar apenas o background e a composição visual
- deixar áreas limpas para sobreposição de texto depois
- composição elegante, publicitária e profissional
- contraste suficiente para texto branco ou claro por cima
- visual pronto para post de Instagram
- se for imóvel, leilão, fazenda ou terra, usar cenário compatível e sofisticado
- se for produto agro, usar composição limpa, técnica e comercial
- evitar poluição visual
- evitar elementos confusos no centro
- priorizar legibilidade futura do layout
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size: imageSize,
        output_format: "webp",
      }),
    });

    const rawText = await openaiResponse.text();

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return reply(502, {
        error: "A OpenAI retornou resposta não JSON na geração do fundo.",
        raw: rawText,
      });
    }

    if (!openaiResponse.ok) {
      return reply(openaiResponse.status, {
        error: data?.error?.message || "Erro ao gerar o fundo com a OpenAI.",
        raw: data,
      });
    }

    const first = Array.isArray(data?.data) ? data.data[0] : null;
    const b64 = first?.b64_json || null;
    const url = first?.url || null;

    if (b64) {
      return reply(200, {
        ok: true,
        imageBase64: b64,
        mimeType: "image/webp",
      });
    }

    if (url) {
      return reply(200, {
        ok: true,
        imageUrl: url,
      });
    }

    return reply(500, {
      error: "A função gerar-arte não retornou o fundo gerado.",
      raw: data,
    });
  } catch (error) {
    console.error("Erro interno em gerar-arte:", error);
    return reply(500, {
      error: error.message || "Erro interno inesperado.",
    });
  }
}
