# AR10 CYBORG — rodando local no seu PC (Windows)

> Guia real pra clonar, rodar e sincronizar o AR10 no seu computador, sem
> depender do link publicado (GitHub Pages). Documentação apenas — nenhuma
> lógica de negócio foi alterada pra este guia existir (CLAUDE.md, regra
> não-negociável: mudanças de comportamento nunca se misturam com
> configuração de ambiente).

O terminal (`ipad_runtime/ramber-ui/`) é uma SPA React/Vite 100%
client-side: zero backend, zero banco de dados, zero variável de ambiente
sensível. Tudo que ele precisa é buscar dado público real (Binance/MEXC/
Bybit/OKX, endpoints públicos, sem chave) direto do seu navegador. Rodar
"local" e rodar "no link publicado" são o mesmo código, só a origem HTTP
muda.

---

## 1. Pré-requisitos reais

| Componente | Necessário | Observação real |
|---|---|---|
| Git | Sim | Qualquer versão recente do [git-scm.com](https://git-scm.com/download/win) |
| Node.js | Sim — **20 LTS ou 22** | Vite 6 exige `^18.0.0 \|\| ^20.0.0 \|\| >=22.0.0` (confirmado em `node_modules/vite/package.json`); o workflow oficial de deploy usa Node 22 — mesma versão é a aposta mais segura |
| Rust/Cargo | **Não** | O motor Rust→WASM (`cyborg_quant_core`) já vem **compilado e versionado** em `ipad_runtime/wasm/*.wasm` — você só consome o binário, nunca precisa compilar |
| VS Code | Opcional | Qualquer editor serve; é só conveniência |
| CPU/RAM/GPU | Ver seção 5 | Nenhum dos três exige configuração — explicado abaixo |

Os números de hardware do pedido original (4+ cores, 8+ GB RAM, GPU
dedicada) são uma faixa razoável pra rodar Chrome/Edge com um terminal
Canvas-heavy confortavelmente — mas não são um requisito **desta
aplicação**: ela roda em qualquer PC que rode um navegador moderno.

---

## 2. Clonar e instalar

PowerShell ou cmd, no PC:

```powershell
git clone https://github.com/AR10-10/AR10-ORION.git
cd AR10-ORION\ipad_runtime\ramber-ui
npm install --include=dev
```

O `--include=dev` importa: se o Windows tiver `NODE_ENV=production` setado
globalmente, um `npm install` puro pula as devDependencies (Vite,
TypeScript, Vitest, Tailwind) e nada funciona depois. Já documentado em
`ipad_runtime/README.md` — repetido aqui porque é o erro mais provável de
quem faz isso pela primeira vez.

---

## 3. Rodar em desenvolvimento (`localhost`)

```powershell
npm run dev
```

Abre em `http://localhost:5173/` (porta padrão do Vite — o projeto não
sobrescreve). Salvar qualquer arquivo em `src/` recarrega a página sozinho
(HMR). `vite.config.ts` já libera (`server.fs.allow`) o import direto de
`ipad_runtime/js/**` e `ipad_runtime/src/research/**` — os motores reais
que o terminal usa — então `npm run dev` funciona igual em qualquer
máquina, sem passo extra.

---

## 4. Build de produção local

```powershell
npm run build      # gera ipad_runtime/ramber-ui/dist/
npm run preview    # serve dist/ localmente, pra conferir o build
```

**Limitação real já conhecida** (mesma nota em `ipad_runtime/README.md`):
`vite preview` serve só `dist/`, mas o Web Worker do WASM
(`workers/quant-worker.js`) é um *sibling* do build publicado — em preview
local isso aparece como "CICLO DE ANÁLISE · FALHOU". É esperado nesse
modo específico; no site publicado (ou com `dist/` copiado pra dentro de
`ipad_runtime/`, do jeito que o workflow de deploy faz) o worker resolve
normalmente.

---

## 5. CPU, RAM e GPU — o que já é automático (nada pra configurar)

O pedido original queria "configurar o AR10 pra usar CPU multi-core, RAM e
GPU". Auditei os 3 pontos contra o código real antes de inventar qualquer
flag — nenhum dos três precisa de configuração nova:

- **CPU multi-core**: o app já roda cálculo pesado fora da main thread via
  Web Workers reais (`workers/quant-worker.js` pro motor WASM,
  `orderflow-heatmap-worker.ts`, `conviction-cyclone-worker.ts`, `llm-
  worker.ts`) — Regra de Ouro 6 do CLAUDE.md ("Main Thread sagrada").
  O sistema operacional/navegador já distribui esses Workers pelos núcleos
  disponíveis sozinho; um PC com mais núcleos automaticamente executa essa
  mesma arquitetura mais rápido, sem nenhuma flag de build.
- **RAM**: é uma SPA client-side "Local-First" por decisão de arquitetura
  (CLAUDE.md) — todo o estado vivo (candles, snapshots, store Zustand)
  já mora na memória do próprio processo do navegador. Não existe (nem
  faria sentido criar) uma segunda camada de cache "fora do browser": mais
  RAM no PC vira automaticamente mais fôlego pro navegador, de novo sem
  configuração no app.
- **GPU**: o gráfico principal e todos os overlays desenham em **Canvas
  2D** (`lightweight-charts` + os 15 plugins de canvas do projeto) — zero
  WebGL neste código hoje. Navegadores modernos (Chrome/Edge no Windows)
  já compõem Canvas 2D com aceleração de GPU por conta própria via
  DirectX/ANGLE; não há nenhum toggle na aplicação pra "ligar" isso. Trocar
  o motor de desenho pra WebGL seria uma reescrita real e grande da camada
  de gráfico inteira — fora do escopo de um guia de ambiente, e não pedido
  aqui.

Em resumo: **rodar num PC melhor já entrega o ganho de hardware
automaticamente**, porque a arquitetura (Workers + Canvas 2D) já delega
essas decisões pro navegador/SO. Não há build "otimizado pra hardware
local" separado do build de produção normal.

---

## 6. Sincronizar com o GitHub

```powershell
# Trazer o que mudou
git pull origin <branch>

# Depois de editar algo
git add .
git commit -m "sua mensagem"
git push origin <branch>
```

A linha de desenvolvimento ativa deste projeto hoje é a branch
`claude/eloquent-cannon-qyt86y` (ver `README.md` da raiz) — troque
`<branch>` por ela ou por `main`, dependendo de onde você quiser
trabalhar. Nenhuma credencial de exchange nunca entra em nenhum commit
(READ_ONLY por design, ver seção 8) — só o token/SSH key do GitHub, que o
`git` do Windows já pede na hora de configurar (`git config
--global user.name/user.email`, e um login único via navegador ou PAT na
primeira operação remota).

---

## 7. `.gitignore` — já auditado, nada precisou mudar

Conferido antes de escrever este guia: o `.gitignore` da raiz já exclui
corretamente `ipad_runtime/ramber-ui/node_modules/` e
`ipad_runtime/ramber-ui/dist/` (build gerado, nunca versionado), além de
credenciais e caches Python/Rust. Não havia nada errado pra corrigir.

---

## 8. App desktop (Electron/Tauri) — não construído, fora de escopo

O pedido original citava isso como opcional ("se necessário"). Não existe
hoje. Não construí — seria uma mudança de arquitetura real (empacotar a
SPA num runtime nativo), não uma configuração de ambiente. Se você quiser
isso especificamente, é um pedido próprio.

---

## 9. Segurança — por que não há segredo nenhum pra configurar

READ_ONLY / FAIL_CLOSED sempre (CLAUDE.md, regra não-negociável): nenhuma
chave de API de exchange, nenhuma credencial, nenhuma execução de ordem
existe neste código, local ou publicado. Todo dado vem de endpoint público
sem autenticação. Não há `.env` pra preencher.

---

## 10. Onde ler mais

- [`README.md`](README.md) — visão geral do monorepo e link publicado.
- [`ipad_runtime/README.md`](ipad_runtime/README.md) — arquitetura
  completa do terminal (o que cada pasta faz).
- [`docs/DEPLOY_GUIDE.md`](docs/DEPLOY_GUIDE.md) — as 3 rotas de deploy
  (GitHub Pages, Cloudflare/Netlify/Vercel, teste estático local) — use
  isto se o objetivo for publicar, não só rodar local.
- [`CLAUDE.md`](CLAUDE.md) — as regras permanentes do projeto (Regras de
  Ouro, LEI 24, disciplina de trabalho).
