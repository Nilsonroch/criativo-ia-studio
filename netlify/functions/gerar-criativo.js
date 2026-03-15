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

  function extractStructuredOutput(apiData) {
    if (!apiData || !Array.isArray(apiData.output)) return null;

    for (const item of apiData.output) {
      if (!Array.isArray(item.content)) continue;

      for (const content of item.content) {
        if (content?.type === "output_text" && typeof content.text === "string") {
          try {
            return JSON.parse(content.text);
          } catch {
            return null;
          }
        }
      }
    }

    return null;
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
    } = body;

    if (!tema || !descricao) {
      return json(400, {
        error: "Os campos tema e descricao são obrigatórios.",
      });
    }

    const instructions = `
Você é um estrategista de marketing e diretor de criação especializado em anúncios visuais para Instagram.

Sua missão é transformar conteúdo bruto em uma peça publicitária profissional, enxuta, persuasiva e correta em português.

TAREFAS:
1. identificar o tipo de anúncio
2. extrair apenas as informações mais relevantes
3. corrigir ortografia, acentuação e concordância
4. remover excesso de texto
5. separar o que vai na arte do que vai para a legenda
6. gerar uma estrutura comercial forte e organizada

REGRAS OBRIGATÓRIAS:
- não invente dados
- não copie blocos longos de texto bruto
- não use frases como "criado por IA", "gerado por IA" ou similares
- priorize síntese inteligente
- a arte deve ser limpa, comercial e visualmente profissional
- observações secundárias devem ir para a legenda, não para a arte
- se houver conflito de datas, valores ou texto ilegível, não invente; omita da arte
- headline curta, forte e profissional
- texto da arte curto
- legenda pode ser mais completa
- organize a informação de modo adequado ao tipo do anúncio

CLASSIFIQUE, quando possível, em algo como:
- leilao_imovel_rural
- leilao_imovel_urbano
- produto_agro
- sementes_pastagem
- precatorio
- servico_tecnico
- institucional
- promocional
- outro

DADOS DO USUÁRIO:
- Tema/produto: ${tema}
- Descrição do criativo: ${descricao}
- Objetivo: ${objetivo || "não informado"}
- Estilo: ${estilo || "não informado"}
- Formato: ${formato || "1080x1350"}
- Observações: ${observacoes || "nenhuma"}

ORIENTAÇÃO DE SAÍDA:
- headline: comercial, curta e impactante
- subheadline: complemento objetivo
- destaquePrincipal: principal atrativo
- localizacao: cidade/estado/região se relevante
- valorPrincipal: valor, lance mínimo ou dado econômico mais forte
- apoio1 e apoio2: informações curtas de apoio
- cta: muito curto
- textoArte: texto curtíssimo de apoio para uso visual
- legenda: pronta para Instagram
- hashtags: string única
- direcaoVisual: instruções visuais objetivas para a arte

IMPORTANTE:
A arte final deve ter pouco texto. Seu trabalho aqui é sintetizar.
`;

    const input = [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: instructions,
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
        text: {
          format: {
            type: "json_schema",
            name: "criativo_instagram_schema",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                tipoAnuncio: { type: "string" },
                headline: { type: "string" },
                subheadline: { type: "string" },
                destaquePrincipal: { type: "string" },
                localizacao: { type: "string" },
                valorPrincipal: { type: "string" },
                apoio1: { type: "string" },
                apoio2: { type: "string" },
                cta: { type: "string" },
                textoArte: { type: "string" },
                legenda: { type: "string" },
                hashtags: { type: "string" },
                direcaoVisual: { type: "string" }
              },
              required: [
                "tipoAnuncio",
                "headline",
                "subheadline",
                "destaquePrincipal",
                "localizacao",
                "valorPrincipal",
                "apoio1",
                "apoio2",
                "cta",
                "textoArte",
                "legenda",
                "hashtags",
                "direcaoVisual"
              ]
            }
          }
        }
      }),
    });

    const parsed = await parseResponseSafely(response);

    if (!response.ok) {
      console.error("Erro da OpenAI em gerar-criativo:", parsed.rawText);

      if (parsed.ok && parsed.data) {
        return json(response.status, {
          error: parsed.data?.error?.message || "Erro ao consultar a OpenAI.",
          raw: parsed.data,
        });
      }

      return json(response.status, {
        error: "A OpenAI retornou uma resposta inválida em gerar-criativo.",
        raw: parsed.rawText,
      });
    }

    if (!parsed.ok || !parsed.data) {
      console.error("Resposta não-JSON da Responses API:", parsed.rawText);
      return json(500, {
        error: "A resposta da OpenAI em gerar-criativo não veio em JSON válido.",
        raw: parsed.rawText,
      });
    }

    const result = extractStructuredOutput(parsed.data);

    if (!result) {
      console.error("Falha ao extrair JSON estruturado:", parsed.data);
      return json(500, {
        error: "A OpenAI respondeu, mas o conteúdo estruturado não pôde ser lido.",
        raw: parsed.data,
      });
    }

    return json(200, {
      ok: true,
      result,
    });
  } catch (error) {
    console.error("Erro interno na função gerar-criativo:", error);
    return json(500, {
      error: error.message || "Erro interno inesperado.",
    });
  }
}
