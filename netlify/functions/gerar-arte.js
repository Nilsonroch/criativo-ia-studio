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

    const visualPrompt = `
Crie uma arte publicitária profissional para Instagram, limpa, elegante e comercial.

Tema: ${tema}
Estilo: ${estilo || "comercial"}

Informações principais:
- Headline: ${headline || ""}
- Subheadline: ${subheadline || ""}
- Destaque principal: ${destaquePrincipal || ""}
- Localização: ${localizacao || ""}
- Valor principal: ${valorPrincipal || ""}
- Apoio 1: ${apoio1 || ""}
- Apoio 2: ${apoio2 || ""}
- CTA: ${cta || ""}
- Direção visual: ${direcaoVisual || ""}
- Contexto: ${descricao}

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
    const imageBase64Result = data?.data?.[0]?.b64_json || null;

    if (!imageBase64Result) {
      console.error("Sem b64_json na resposta da Images API:", data);
      return json(500, {
        error: "A função gerar-arte não retornou a imagem gerada.",
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
