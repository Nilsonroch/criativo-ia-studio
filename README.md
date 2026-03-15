# Criativo IA Studio

Aplicativo para gerar criativos prontos para Instagram com React + Vite + Netlify Functions + OpenAI.

## O que este projeto faz
- recebe imagem base
- recebe briefing do criativo
- gera copy com IA
- gera arte final com IA
- permite baixar a arte pronta
- permite copiar a legenda pronta

## Como usar localmente
```bash
npm install
npm run dev
```

## Como publicar no Netlify
1. Suba esta pasta inteira para um repositório no GitHub.
2. No Netlify, clique em **Add new site** > **Import an existing project**.
3. Conecte o repositório.
4. Use:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Em **Site configuration** > **Environment variables**, crie:
   - `OPENAI_API_KEY`
6. Faça o deploy.

## Estrutura principal
- `src/App.jsx` interface principal
- `netlify/functions/gerar-criativo.js` gera headline, legenda e direção visual
- `netlify/functions/gerar-arte.js` gera a arte final em PNG

## Observação importante
A parte de geração da imagem depende do endpoint e dos recursos habilitados para sua chave da OpenAI. Caso a API retorne erro de compatibilidade em `gerar-arte.js`, o fluxo visual precisará ser ajustado conforme a disponibilidade da sua conta.
