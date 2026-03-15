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
      headline,
      subheadline,
      destaquePrincipal,
      localizacao,
      valorPrincipal,
      apoio1,
      apoio2,
      cta,
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

    const visualPrompt = `
Crie uma arte publicitária profissional para Instagram, limpa, elegante e comercial.

Tema: ${tema}
Estilo: ${estilo || "comercial"}

Use apenas o essencial:
- Headline: ${headline || ""}
- Subheadline: ${subheadline || ""}
- Destaque principal: ${destaquePrincipal || ""}
- Localização: ${localizacao || ""}
- Valor principal: ${valorPrincipal || ""}
- Apoio 1: ${apoio1 || ""}
- Apoio 2: ${apoio2 || ""}
- CTA: ${cta || ""}
- Direção visual: ${direcaoVisual || ""}
- Contexto complementar: ${descricao}

Regras obrigatórias:
- não escrever "criado por IA" ou "gerado por IA"
- não usar texto excessivo
- manter ortografia correta em português
- arte visualmente profissional
- hierarquia visual forte
- headline em destaque
- no máximo 2 ou 3 informações curtas de apoio
- não inventar valores, datas ou localidades
- visual pronto para postagem no Instagram
`;

    const openaiResponse = await fetch("https://api.openai.com/v1/images/generations", {
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

    const rawText = await openaiResponse.text();

    let data = null;
    try {
      data = JSON.parse(rawText);
    } catch {
      return reply(502, {
        error: "A OpenAI retornou resposta não JSON na geração da arte.",
        raw: rawText,
      });
    }

    if (!openaiResponse.ok) {
      return reply(openaiResponse.status, {
        error: data?.error?.message || "Erro ao gerar a arte com a OpenAI.",
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
        mimeType: "image/png",
      });
    }

    if (url) {
      return reply(200, {
        ok: true,
        imageUrl: url,
      });
    }

    return reply(500, {
      error: "A função gerar-arte não retornou a imagem gerada.",
      raw: data,
    });
  } catch (error) {
    console.error("Erro interno em gerar-arte:", error);
    return reply(500, {
      error: error.message || "Erro interno inesperado.",
    });
  }
}
