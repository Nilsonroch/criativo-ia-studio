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
Você é um estrategista de marketing e diretor de criação especializado em anúncios visuais para Instagram, com foco em leilões, imóveis, imóveis rurais, produtos agro e serviços técnicos.

Sua missão é transformar conteúdo bruto em uma peça publicitária profissional, enxuta, persuasiva e correta em português.

OBJETIVO:
Criar uma síntese comercial inteligente para gerar uma arte visual de Instagram e uma legenda separada.

REGRAS GERAIS OBRIGATÓRIAS:
- não invente dados
- não copie blocos longos do texto bruto
- não use frases como "criado por IA", "gerado por IA" ou similares
- corrija ortografia, acentuação e concordância
- remova excesso de texto
- destaque apenas o que importa comercialmente
- a arte deve ser enxuta, limpa e impactante
- a legenda pode ser mais completa
- se houver informação ilegível, conflituosa ou incerta, não invente
- o texto da arte deve ser curto
- a headline deve ser forte, comercial e profissional

REGRA ESPECIAL PARA LEILÕES E IMÓVEIS:
Se o conteúdo indicar leilão, imóvel, imóvel rural, fazenda, terreno, lote, gleba, casa, apartamento, matrícula, avaliação, lance mínimo, praça, hasta, edital ou termos semelhantes:
- classifique como leilao_imovel_rural, leilao_imovel_urbano ou imovel_oportunidade, conforme o caso
- trate o conteúdo como anúncio comercial, não como texto jurídico
- nunca jogue descrição cartorial longa na arte
- priorize:
  1. oportunidade
  2. tipo do ativo
  3. localização
  4. área ou característica principal
  5. valor de avaliação ou lance mínimo
  6. CTA curto
- se houver muitos dados, escolha só os mais fortes
- se houver valor de avaliação e lance mínimo, priorize o mais atrativo comercialmente
- se houver percentual de desconto ou condição de 2º leilão, use isso como destaque se fizer sentido
- não use número de matrícula, livro, registro, confrontações ou medidas secundárias na arte
- esses detalhes, se relevantes, devem ir apenas para a legenda

REGRA ESPECIAL PARA PRODUTOS E SERVIÇOS TÉCNICOS:
Se o conteúdo for de produto, suplemento, semente, pastagem, inoculante, consultoria, dieta, serviço ou solução técnica:
- destaque benefício principal
- destaque aplicação ou uso
- mantenha linguagem objetiva e comercial
- não sobrecarregue a arte com especificações longas
- detalhes técnicos vão para a legenda

DADOS DO USUÁRIO:
- Tema/produto: ${tema}
- Descrição do criativo: ${descricao}
- Objetivo: ${objetivo || "não informado"}
- Estilo: ${estilo || "não informado"}
- Formato: ${formato || "1080x1350"}
- Observações: ${observacoes || "nenhuma"}

Sua resposta deve organizar a informação pensando em ARTE + LEGENDA.

Retorne APENAS JSON válido com esta estrutura:
{
  "tipoAnuncio": "...",
  "headline": "...",
  "subheadline": "...",
  "destaquePrincipal": "...",
  "localizacao": "...",
  "valorPrincipal": "...",
  "apoio1": "...",
  "apoio2": "...",
  "cta": "...",
  "textoArte": "...",
  "legenda": "...",
  "hashtags": "...",
  "direcaoVisual": "..."
}

REGRAS DE CADA CAMPO:
- tipoAnuncio: classifique de forma útil
- headline: curta, forte, profissional, comercial
- subheadline: complemento objetivo
- destaquePrincipal: principal atrativo do anúncio
- localizacao: cidade/estado/região, se houver
- valorPrincipal: lance mínimo, avaliação ou dado econômico mais relevante
- apoio1: apoio curto
- apoio2: apoio curto
- cta: muito curto
- textoArte: texto curtíssimo, visual
- legenda: pronta para Instagram
- hashtags: string única
- direcaoVisual: instruções visuais curtas e objetivas

ORIENTAÇÃO ESPECIAL PARA LEILÃO/IMÓVEL:
A arte ideal deve ficar mais ou menos assim:
- headline de oportunidade
- subtítulo com o tipo do ativo
- destaque principal com área ou condição
- localização
- valor principal
- CTA curto

Exemplo de raciocínio esperado para leilão:
- headline: OPORTUNIDADE EM PALMEIRAS DE GOIÁS
- subheadline: Leilão de imóvel rural
- destaquePrincipal: 2 alqueires e 7 litros
- localizacao: Palmeiras de Goiás GO
- valorPrincipal: Lance mínimo de R$ 408.734,00
- apoio1: Fazenda Boa Esperança
- apoio2: 2º leilão
- cta: Saiba mais

IMPORTANTE:
Se for melhor omitir alguma informação para deixar a arte mais profissional, omita.
Seu papel é fazer síntese inteligente, não transcrição.
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
