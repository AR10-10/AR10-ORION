# Meta Llama WebLLM Route — viabilidade honesta no iPad/Safari

Documento técnico de apoio a
`AR10_CYBORG_2_FINAL_IPAD_ONE_LINK_SIRIFORM_LLAMA_DEPLOY_V1`. Cobre a
análise de viabilidade de rodar um modelo de linguagem da família
**Meta Llama** dentro do runtime PWA do iPad/Safari, e por que esta
versão não embute nenhum modelo (`status: FUTURE` em todo o roadmap).

Fonte de dados estruturada: `ipad_runtime/pack/manifest.models.json`
(schema versionado, lido em runtime por `js/app.js` para preencher os
campos de status — nenhum número abaixo é decorativo, todos vêm do mesmo
manifesto que o código consulta).

## Nome correto da família

**"Meta Llama"** é o nome oficial da família de modelos da Meta AI — não
"Llama" genérico nem "LLaMA" (grafia antiga, pré-Llama 2). Este documento
e o manifesto usam sempre "Meta Llama" ou "Llama N" (com número de
geração) para evitar ambiguidade.

## Realismo por variante — família Llama 4

| Variante | Papel nesta análise | Status |
|---|---|---|
| **Llama 4 Scout** | Candidato mais realista para iPad/Safari entre os modelos Llama 4 — ainda exige quantização agressiva e download incremental para caber em armazenamento de navegador | `FUTURE` |
| **Llama 4 Maverick** | Referência de capacidade superior; tamanho normalmente incompatível com execução on-device em iPad mesmo quantizado — citado para não subestimar a família, não como meta de entrega nesta rota | `FUTURE` |
| **Llama 4 Behemoth** | Modelo professor (teacher) usado pela Meta para destilar os modelos menores da família — citado apenas como referência de proveniência, nunca como candidato a rodar no iPad | `REFERENCE_ONLY` |

Nenhuma variante está embutida nesta versão. O motivo é tamanho de
modelo incompatível com armazenamento confiável em Safari/iPadOS sem um
passo explícito de download/consentimento do usuário — esse passo ainda
não está implementado.

## Arquitetura de camadas (engines candidatos)

| Engine | Modelo-alvo | Tamanho estimado | Aceleração | Status |
|---|---|---|---|---|
| **WebLLM/MLC-LLM** | Meta Llama (variante a definir, Scout como candidato realista) | 700–4000 MB (depende da variante/quantização) | WebGPU quando disponível; fallback WASM/CPU | `FUTURE` |
| **Transformers.js** | Modelo compacto ONNX/WebGPU (a definir) | 20–300 MB | WebGPU/WASM via ONNX Runtime | `FUTURE` |
| **ONNX Runtime Web** | A definir | Varia por modelo | WebGPU/WASM | `FUTURE` |

### Cadeia de fallback declarada

```
WebLLM/MLC-LLM (WebGPU)
  → WebLLM/MLC-LLM (WASM/CPU)
    → modelo menor da mesma família
      → FALLBACK_TEXT_ONLY (sem modelo, só respostas pré-definidas do Siriform)
```

O último elo (`FALLBACK_TEXT_ONLY`) é o que está **ativo hoje**: todas as
respostas do Siriform (voz e texto) já vêm de lógica determinística em
`app.js`/`siriform.js`, sem nenhum modelo de linguagem — o que garante
que o painel funciona por completo mesmo que nenhuma camada de IA acima
jamais seja instalada.

## Por que não embutir o modelo nesta versão (honestidade de engenharia)

1. **Tamanho**: mesmo a variante mais compacta (Llama 4 Scout,
   quantizada) fica na faixa de centenas de MB a poucos GB — incompatível
   com um `.ar10pack` base que precisa caber em download único, rápido,
   sem fricção, no fluxo "um link, um toque".
2. **Armazenamento do Safari/iPadOS**: OPFS/IndexedDB em Safari têm
   limites e políticas de eviction que variam por versão de iOS/iPadOS;
   gravar gigabytes sem consentimento explícito do usuário seria um
   comportamento abusivo e não confiável (o navegador pode simplesmente
   apagar o cache sob pressão de espaço).
3. **WebGPU ainda não é universal** em todas as versões de Safari/iPadOS
   suportadas — sem ele, inferência cai para WASM/CPU, ordens de
   magnitude mais lenta para um modelo desse porte.
4. **Consentimento explícito**: baixar múltiplos GB pela rede do usuário
   exige uma confirmação clara (custo de dados, tempo, espaço) — esse
   fluxo de download incremental sob demanda ainda não foi implementado.

## Plano de entrega declarado (quando implementado)

Download opcional sob demanda para **OPFS**, fora do `.ar10pack` base,
com confirmação explícita do usuário e verificação **SHA-256 por shard**
— mesma filosofia de integridade já usada pelo `.ar10pack` atual
(`js/pack-manager.js`), apenas aplicada a um payload maior e opcional.

## Perfis de processamento (já existem na UI, reaproveitados)

O seletor **Light/Balanced/Heavy** do card de Replay já existe e altera
de fato a janela SMA/EMA do motor WASM hoje. O mesmo seletor também
atualiza o campo `st-llama-profile` no painel Meta Llama — não é um
segundo toggle redundante, é a preferência de perfil que **já existe na
UI** sendo refletida no roadmap de Llama, exatamente como documentado em
`processing_profiles` do manifesto:

| Perfil | Significado para Llama (quando implementado) |
|---|---|
| `light` | Modelo mais compacto/mais quantizado disponível, menor uso de memória, resposta mais rápida e menos precisa |
| `balanced` | Equilíbrio entre tamanho de modelo e qualidade de resposta |
| `heavy` | Modelo maior disponível dentro do limite de armazenamento aceito pelo usuário, mais lento, resposta mais detalhada |

## Campos de status no painel "Meta Llama / WebLLM"

| Campo | Valor atual | Significado |
|---|---|---|
| `st-llama-layer` | `FUTURE` | Nenhuma camada de Llama ativa nesta versão |
| `st-llama-profile` | `LIGHT`/`BALANCED`/`HEAVY` | Espelha o perfil de processamento escolhido no card de Replay |
| `st-llama-runtime` | `FUTURE` | Nenhum runtime de inferência (WebLLM/Transformers.js/ONNX) ativo |
| `st-llama-webgpu` | `AVAILABLE`/`UNAVAILABLE` | Sondagem real de WebGPU neste Safari (mesma sonda do Feature Detection) |
| `st-webllm`, `st-transformers`, `st-onnx` | `FUTURE` | Os três engines candidatos, todos roadmap |

## O que Meta Llama PODE fazer aqui, quando implementado

- Explicar o conteúdo do `AnalysisFrame` em linguagem natural (PT-BR).
- Resumir o resultado de um replay BTC/USDT.
- Interpretar comandos de voz/texto em português e mapear para uma
  intenção seria — **a mesma lista de comandos permitidos** do Siriform
  Voice (ver `docs/SIRIFORM_VOICE_AND_NATIVE_COMPANION_ROUTE.md`), nunca uma
  lista nova.
- Responder no idioma do usuário sobre o que cada card do painel
  significa.
- Gerar relatórios descritivos a partir de dados locais.
- Explicar rótulos como "Rota A Long / Rota B Short / Rota C Esperar"
  quando esses rótulos existirem em um `AnalysisFrame`, como **leitura
  descritiva** — nunca como ordem.

## O que Meta Llama NUNCA vai fazer aqui (sem exceção)

- Executar ordem de compra ou venda.
- Abrir ou fechar posição.
- Usar API secret ou qualquer chave privada.
- Operar conta real.
- Contornar READ_ONLY ou FAIL_CLOSED sob qualquer comando, de voz ou de
  texto.

Esta lista é idêntica, palavra por palavra, a `capabilities_never` em
`pack/manifest.models.json` — o código e este documento descrevem a
mesma fonte de verdade.
