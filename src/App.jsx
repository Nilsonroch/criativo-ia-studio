import React, { useMemo, useRef, useState } from "react";
import {
  Upload,
  Sparkles,
  Image as ImageIcon,
  Wand2,
  FileImage,
  MessageSquareText,
  Copy,
  Download,
  RefreshCw,
} from "lucide-react";

const formatos = [
  { value: "1080x1080", label: "Quadrado 1080 x 1080" },
  { value: "1080x1350", label: "Retrato 1080 x 1350" },
  { value: "1080x1920", label: "Story 1080 x 1920" },
];

const estilos = [
  { value: "comercial", label: "Comercial" },
  { value: "tecnico", label: "Técnico" },
  { value: "agressivo", label: "Agressivo" },
  { value: "institucional", label: "Institucional" },
  { value: "premium", label: "Premium" },
];

const objetivos = [
  { value: "vender", label: "Vender produto" },
  { value: "captar", label: "Captar contatos" },
  { value: "autoridade", label: "Gerar autoridade" },
  { value: "engajamento", label: "Aumentar engajamento" },
  { value: "institucional", label: "Fortalecer marca" },
];

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function parseApiResponse(response) {
  const rawText = await response.text();
  const contentType = response.headers.get("content-type") || "";

  let data = null;
  let isJson = false;

  if (contentType.includes("application/json")) {
    try {
      data = JSON.parse(rawText);
      isJson = true;
    } catch {
      data = null;
      isJson = false;
    }
  }

  return {
    ok: response.ok,
    status: response.status,
    contentType,
    rawText,
    data,
    isJson,
  };
}

function buildApiError(label, parsed) {
  if (parsed.isJson && parsed.data) {
    return (
      parsed.data?.error ||
      parsed.data?.raw?.error?.message ||
      `${label} falhou com status ${parsed.status}.`
    );
  }

  if (parsed.rawText && parsed.rawText.trim().startsWith("<")) {
    return `${label} retornou HTML em vez de JSON. Verifique se a function do Netlify está publicada corretamente.`;
  }

  return `${label} falhou com status ${parsed.status}.`;
}

function getCanvasStyle(formato) {
  if (formato === "1080x1080") return { aspectRatio: "1 / 1" };
  if (formato === "1080x1920") return { aspectRatio: "9 / 16" };
  return { aspectRatio: "4 / 5" };
}

function getLayoutByTipo(tipo) {
  if (!tipo) {
    return {
      headlineClass: "text-[11%] leading-[0.95]",
      subClass: "text-[4.2%] leading-tight",
      mainClass: "text-[8.5%] leading-[0.95]",
      metaClass: "text-[3.8%] leading-tight",
      valueClass: "text-[5.2%] leading-tight",
      ctaClass: "text-[3.8%] leading-tight",
    };
  }

  if (tipo.includes("leilao") || tipo.includes("imovel")) {
    return {
      headlineClass: "text-[10.5%] leading-[0.92]",
      subClass: "text-[4.1%] leading-tight",
      mainClass: "text-[9.2%] leading-[0.92]",
      metaClass: "text-[3.7%] leading-tight",
      valueClass: "text-[5.6%] leading-tight",
      ctaClass: "text-[3.9%] leading-tight",
    };
  }

  if (tipo.includes("produto") || tipo.includes("agro")) {
    return {
      headlineClass: "text-[10%] leading-[0.95]",
      subClass: "text-[4.2%] leading-tight",
      mainClass: "text-[7.8%] leading-[0.95]",
      metaClass: "text-[3.8%] leading-tight",
      valueClass: "text-[4.8%] leading-tight",
      ctaClass: "text-[3.8%] leading-tight",
    };
  }

  return {
    headlineClass: "text-[11%] leading-[0.95]",
    subClass: "text-[4.2%] leading-tight",
    mainClass: "text-[8.5%] leading-[0.95]",
    metaClass: "text-[3.8%] leading-tight",
    valueClass: "text-[5.2%] leading-tight",
    ctaClass: "text-[3.8%] leading-tight",
  };
}

export default function App() {
  const [imagem, setImagem] = useState(null);
  const [tema, setTema] = useState("");
  const [descricao, setDescricao] = useState("");
  const [objetivo, setObjetivo] = useState("vender");
  const [estilo, setEstilo] = useState("comercial");
  const [formato, setFormato] = useState("1080x1350");
  const [observacoes, setObservacoes] = useState("");
  const [carregandoCopy, setCarregandoCopy] = useState(false);
  const [carregandoArte, setCarregandoArte] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState(false);
  const [baixando, setBaixando] = useState(false);

  const cardRef = useRef(null);

  const previewImage = useMemo(() => {
    if (!imagem) return null;
    return URL.createObjectURL(imagem);
  }, [imagem]);

  const layout = getLayoutByTipo(resultado?.tipoAnuncio);

  function handleImagemChange(event) {
    const file = event.target.files?.[0] || null;
    setImagem(file);
  }

  async function gerarCriativoCompleto() {
    setErro("");

    if (!descricao.trim()) {
      setErro("Descreva o criativo que você quer gerar.");
      return;
    }

    if (!tema.trim()) {
      setErro("Informe o produto, tema ou assunto do post.");
      return;
    }

    let imageBase64 = null;
    let mimeType = null;

    try {
      if (imagem) {
        imageBase64 = await fileToBase64(imagem);
        mimeType = imagem.type || "image/png";
      }

      setCarregandoCopy(true);

      const copyResponse = await fetch("/.netlify/functions/gerar-criativo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tema,
          descricao,
          objetivo,
          estilo,
          formato,
          observacoes,
          imageBase64,
          mimeType,
        }),
      });

      const copyParsed = await parseApiResponse(copyResponse);

      if (!copyParsed.ok) {
        console.error("Erro gerar-criativo:", copyParsed);
        throw new Error(buildApiError("A função gerar-criativo", copyParsed));
      }

      if (!copyParsed.isJson || !copyParsed.data) {
        console.error("Resposta inválida de gerar-criativo:", copyParsed);
        throw new Error("A função gerar-criativo não retornou JSON válido.");
      }

      const draft = copyParsed.data?.result;

      if (!draft) {
        console.error("Sem result em gerar-criativo:", copyParsed.data);
        throw new Error("A função gerar-criativo não retornou o conteúdo esperado.");
      }

      setResultado({ ...draft, imagemGeradaUrl: null });

      setCarregandoCopy(false);
      setCarregandoArte(true);

      const arteResponse = await fetch("/.netlify/functions/gerar-arte", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tema,
          descricao,
          objetivo,
          estilo,
          formato,
          observacoes,
          imageBase64,
          mimeType,
          tipoAnuncio: draft.tipoAnuncio,
          headline: draft.headline,
          subheadline: draft.subheadline,
          destaquePrincipal: draft.destaquePrincipal,
          localizacao: draft.localizacao,
          valorPrincipal: draft.valorPrincipal,
          apoio1: draft.apoio1,
          apoio2: draft.apoio2,
          cta: draft.cta,
          textoArte: draft.textoArte,
          direcaoVisual: draft.direcaoVisual,
        }),
      });

      const arteParsed = await parseApiResponse(arteResponse);

      if (!arteParsed.ok) {
        console.error("Erro gerar-arte:", arteParsed);
        throw new Error(buildApiError("A função gerar-arte", arteParsed));
      }

      if (!arteParsed.isJson || !arteParsed.data) {
        console.error("Resposta inválida de gerar-arte:", arteParsed);
        throw new Error("A função gerar-arte não retornou JSON válido.");
      }

      const arteData = arteParsed.data;

      let finalImageUrl = null;

      if (arteData?.imageBase64) {
        finalImageUrl = `data:${arteData.mimeType || "image/webp"};base64,${arteData.imageBase64}`;
      } else if (arteData?.imageUrl) {
        finalImageUrl = arteData.imageUrl;
      }

      if (!finalImageUrl) {
        console.error("Sem imagem em gerar-arte:", arteData);
        throw new Error(
          arteData?.error || "A função gerar-arte não retornou a imagem gerada."
        );
      }

      setResultado({
        ...draft,
        imagemGeradaUrl: finalImageUrl,
      });
    } catch (e) {
      console.error("Erro geral no fluxo do criativo:", e);
      setErro(e.message || "Não foi possível gerar o criativo agora.");
    } finally {
      setCarregandoCopy(false);
      setCarregandoArte(false);
    }
  }

  async function copiarLegenda() {
    if (!resultado?.legenda) return;
    await navigator.clipboard.writeText(resultado.legenda);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  async function baixarArteGerada() {
    if (!cardRef.current || !resultado?.imagemGeradaUrl) return;

    setBaixando(true);

    try {
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        pixelRatio: 2,
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${(tema || "criativo-ia").toLowerCase().replace(/\s+/g, "-")}.png`;
      link.click();
    } catch (e) {
      console.error("Erro ao baixar arte final:", e);
      setErro("Não foi possível exportar a arte final.");
    } finally {
      setBaixando(false);
    }
  }

  const gerando = carregandoCopy || carregandoArte;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-slate-900 via-slate-900 to-red-950 p-6 shadow-2xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                <Sparkles className="h-4 w-4" /> Criativo IA Studio
              </div>
              <h1 className="text-3xl font-black leading-tight sm:text-4xl lg:text-5xl">
                Gere artes prontas para Instagram com inteligência artificial.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                A IA gera o fundo visual e o app aplica o texto correto por cima, com ortografia, hierarquia e proporção controladas.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Entrada</p>
                <p className="mt-2 text-sm font-semibold">Imagem + briefing</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Processo</p>
                <p className="mt-2 text-sm font-semibold">Síntese + fundo IA</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Saída</p>
                <p className="mt-2 text-sm font-semibold">Arte final com texto correto</p>
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-6 xl:grid-cols-[460px_1fr]">
          <section className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm">
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-2xl bg-red-600 p-3 text-white">
                <Wand2 className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Configurar criativo</h2>
                <p className="text-sm text-slate-400">A IA vai sintetizar os dados e gerar o fundo da peça.</p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-200">
                  <Upload className="h-4 w-4" /> Imagem base
                </label>
                <label className="flex cursor-pointer items-center justify-center rounded-2xl border border-dashed border-white/15 bg-slate-900/60 px-4 py-8 text-center transition hover:border-red-400/50 hover:bg-slate-900">
                  <input type="file" accept="image/*" className="hidden" onChange={handleImagemChange} />
                  <div>
                    <p className="text-sm font-semibold text-white">Clique para enviar uma imagem</p>
                    <p className="mt-2 text-xs text-slate-400">Use foto do produto, referência visual ou imagem tema</p>
                    {imagem ? <p className="mt-3 text-xs text-emerald-300">Arquivo selecionado: {imagem.name}</p> : null}
                  </div>
                </label>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">Produto, tema ou assunto</label>
                <input
                  value={tema}
                  onChange={(e) => setTema(e.target.value)}
                  placeholder="Ex.: inoculante para silagem, leilão de imóvel, venda de precatório"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">Descrição do criativo</label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  rows={6}
                  placeholder="Descreva o post desejado, o tom, o que deve aparecer, a chamada principal e o objetivo da publicação."
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Objetivo</label>
                  <select
                    value={objetivo}
                    onChange={(e) => setObjetivo(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                  >
                    {objetivos.map((item) => (
                      <option key={item.value} value={item.value} className="text-black">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-slate-200">Estilo</label>
                  <select
                    value={estilo}
                    onChange={(e) => setEstilo(e.target.value)}
                    className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                  >
                    {estilos.map((item) => (
                      <option key={item.value} value={item.value} className="text-black">
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">Formato</label>
                <select
                  value={formato}
                  onChange={(e) => setFormato(e.target.value)}
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                >
                  {formatos.map((item) => (
                    <option key={item.value} value={item.value} className="text-black">
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-200">Observações adicionais</label>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={3}
                  placeholder="Ex.: destacar logo, reforçar urgência, usar identidade visual da marca, dar foco ao produto"
                  className="w-full rounded-2xl border border-white/10 bg-slate-900/70 px-4 py-3 text-sm text-white outline-none transition focus:border-red-400"
                />
              </div>

              {erro ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
                  {erro}
                </div>
              ) : null}

              <button
                onClick={gerarCriativoCompleto}
                disabled={gerando}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-red-600 px-5 py-4 text-sm font-bold text-white transition hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {gerando ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {carregandoCopy
                  ? "Gerando síntese com IA..."
                  : carregandoArte
                    ? "Gerando fundo com IA..."
                    : "Gerar Criativo Completo"}
              </button>
            </div>
          </section>

          <section className="space-y-6">
            <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-slate-800 p-3 text-white">
                  <FileImage className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Resultado do criativo</h2>
                  <p className="text-sm text-slate-400">O fundo vem da IA e o texto final é aplicado com precisão pelo app.</p>
                </div>
              </div>

              <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
                <div className="overflow-hidden rounded-[28px] border border-white/10 bg-slate-900/80">
                  <div className="p-4">
                    <div
                      ref={cardRef}
                      className="relative w-full overflow-hidden rounded-[22px] bg-slate-900"
                      style={getCanvasStyle(formato)}
                    >
                      {resultado?.imagemGeradaUrl ? (
                        <img
                          src={resultado.imagemGeradaUrl}
                          alt="Fundo gerado"
                          className="absolute inset-0 h-full w-full object-cover"
                          crossOrigin="anonymous"
                        />
                      ) : previewImage ? (
                        <img
                          src={previewImage}
                          alt="Imagem base"
                          className="absolute inset-0 h-full w-full object-cover opacity-80"
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-red-950" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/55" />

                      <div className="relative flex h-full flex-col justify-between p-[7%] text-white">
                        <div className="space-y-[2.4%]">
                          <div className={`font-black uppercase tracking-tight drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.headlineClass}`}>
                            {resultado?.headline || "HEADLINE"}
                          </div>

                          {resultado?.subheadline ? (
                            <div className={`max-w-[88%] font-semibold text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.subClass}`}>
                              {resultado.subheadline}
                            </div>
                          ) : null}
                        </div>

                        <div className="space-y-[3.5%]">
                          {resultado?.destaquePrincipal ? (
                            <div className={`max-w-[82%] font-black uppercase leading-[0.95] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.mainClass}`}>
                              {resultado.destaquePrincipal}
                            </div>
                          ) : null}

                          <div className="space-y-[1.8%]">
                            {resultado?.localizacao ? (
                              <div className={`font-semibold text-white/95 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.metaClass}`}>
                                {resultado.localizacao}
                              </div>
                            ) : null}

                            {resultado?.apoio1 ? (
                              <div className={`font-medium text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.metaClass}`}>
                                {resultado.apoio1}
                              </div>
                            ) : null}

                            {resultado?.apoio2 ? (
                              <div className={`font-medium text-white/90 drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.metaClass}`}>
                                {resultado.apoio2}
                              </div>
                            ) : null}
                          </div>

                          {resultado?.valorPrincipal ? (
                            <div className={`inline-block max-w-[90%] rounded-2xl bg-black/35 px-[3.2%] py-[2.2%] font-black text-white backdrop-blur-[2px] drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.valueClass}`}>
                              {resultado.valorPrincipal}
                            </div>
                          ) : null}

                          {resultado?.cta ? (
                            <div className={`inline-block rounded-full border border-white/30 bg-white/10 px-[3.2%] py-[1.7%] font-bold uppercase tracking-[0.08em] text-white backdrop-blur-sm drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)] ${layout.ctaClass}`}>
                              {resultado.cta}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-4">
                    <button
                      onClick={baixarArteGerada}
                      disabled={!resultado?.imagemGeradaUrl || baixando}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Download className="h-4 w-4" />
                      {baixando ? "Exportando..." : "Baixar arte pronta"}
                    </button>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Tipo de anúncio</p>
                    <p className="mt-2 text-sm font-semibold text-slate-200">
                      {resultado?.tipoAnuncio || "Será identificado pela IA"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Headline</p>
                    <p className="mt-2 text-lg font-bold text-white">
                      {resultado?.headline || "A headline gerada pela IA aparecerá aqui."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Subheadline</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">
                      {resultado?.subheadline || "Complemento curto da headline."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Destaque principal</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">
                      {resultado?.destaquePrincipal || resultado?.textoArte || "O principal destaque do anúncio aparecerá aqui."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Localização</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">
                      {resultado?.localizacao || "A localização relevante aparecerá aqui."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Valor principal</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">
                      {resultado?.valorPrincipal || "O valor mais importante aparecerá aqui."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Apoios</p>
                    <div className="mt-2 space-y-2 text-sm leading-7 text-slate-200">
                      <p>{resultado?.apoio1 || "Informação complementar 1"}</p>
                      <p>{resultado?.apoio2 || "Informação complementar 2"}</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">CTA</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200">
                      {resultado?.cta || "Chamada para ação"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Direção visual</p>
                    <p className="mt-2 text-sm leading-7 text-slate-200 whitespace-pre-line">
                      {resultado?.direcaoVisual || "A IA vai sugerir composição, estilo, hierarquia e construção do post."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <MessageSquareText className="h-4 w-4 text-slate-300" />
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Legenda</p>
                      </div>
                      <button
                        onClick={copiarLegenda}
                        disabled={!resultado?.legenda}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Copy className="h-3.5 w-3.5" /> {copiado ? "Copiado" : "Copiar"}
                      </button>
                    </div>
                    <p className="text-sm leading-7 text-slate-200 whitespace-pre-line">
                      {resultado?.legenda || "A legenda pronta para Instagram será exibida aqui."}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-dashed border-white/10 bg-black/20 p-4 text-sm text-slate-400">
                    {resultado ? (
                      <div className="space-y-2">
                        <p><span className="font-semibold text-slate-200">Formato:</span> {formato}</p>
                        <p><span className="font-semibold text-slate-200">Estilo:</span> {estilo}</p>
                        <p><span className="font-semibold text-slate-200">Objetivo:</span> {objetivo}</p>
                        <p><span className="font-semibold text-slate-200">Hashtags:</span> {resultado?.hashtags}</p>
                      </div>
                    ) : (
                      <p>Envie uma imagem e um briefing para a IA gerar o primeiro criativo completo.</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
