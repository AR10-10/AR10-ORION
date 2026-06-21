# Safari Assisted Edge Layer (NOT_WIRED)

Codinome interno: `AR10_CYBORG_SAFARI_EDGE_LAYER_SCAFFOLD_V1`.

**Status: `NOT_WIRED`.** Mesmas garantias dos demais scaffolds desta pasta:
sem `package.json`, sem build, sem import por `ipad_runtime/`, sem presença
em `.github/workflows/deploy-ipad-pwa.yml`. Nenhum hint, captura ou UI deste
contrato existe hoje no app real.

## O que isto é (e o que não é)

`ipad_runtime/js/feature-detect.js` já sonda capacidades do Safari/iPadOS
(storage, instalação como PWA). Isto é diferente: é o contrato para um
mecanismo opcional de o usuário trazer contexto extra para dentro do app —
por Share Sheet, colar explícito do clipboard, ou nota manual — para ajudar
a leitura humana, **nunca** para alimentar preço, sinal, risk-gate ou
execução.

Não é:
- um scraper de outras abas do Safari (impossível dentro do sandbox de um
  PWA, e indesejável mesmo que fosse possível);
- uma fonte de dado de mercado (`ipad_runtime/js/real-data/registry.js`
  continua sendo a única fronteira de conectores reais);
- um sinal de trading de qualquer tipo.

## Por que `CONTEXT_ONLY` e não um modo novo

`ipad_runtime/js/core/data-mode-labels.js` já declara o vocabulário fechado
de "que tipo de dado é este" e já inclui `CONTEXT_ONLY` —
`'SÓ CONTEXTO — NÃO É SINAL DE MERCADO'` — exatamente para este caso. Por
isso `types.ts` fixa `EdgeHint.data_mode` como o literal `'CONTEXT_ONLY'`
(não um `string` livre): qualquer implementação real reaproveita o
vocabulário existente em vez de inventar um quinto/sexto modo paralelo.

## Conteúdo

```
safari-edge-layer/
├── README.md   este arquivo
└── types.ts    EdgeHintSource, EdgeHint, EdgeHintAdvisoryPolicy
```

## O que falta para isto deixar de ser scaffold (Tier 3 — não iniciado)

Em adição aos 5 itens já listados em [`../README.md`](../README.md):

1. Decidir a UI real de captura (botão "Adicionar contexto", handler de
   Web Share Target, ou campo de nota manual) — hoje nenhum existe em
   `ipad_runtime/index.html`.
2. Implementar o armazenamento local do hint (provavelmente
   `ipad_runtime/js/memory/`, mesmo padrão de `event-log.js`) — hoje
   `EdgeHint` é só forma.
3. Implementar a renderização do hint com o badge `CONTEXT_ONLY` já
   existente (`badgeClassFor('CONTEXT_ONLY')` em `data-mode-labels.js`) —
   garantindo que ele nunca apareça ao lado de um card `REAL`/`PAPER` sem o
   badge visualmente distinto.
4. Auditar, no código real (não só no tipo), que nenhum hint chega a
   `risk-gate.js` ou a qualquer caminho de ordem — `EdgeHintAdvisoryPolicy`
   só documenta a intenção, não impõe nada em runtime ainda.

Nenhum destes itens está implementado. Nenhuma captura, armazenamento ou
exibição de hint existe neste código.
