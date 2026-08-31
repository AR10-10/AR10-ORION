# Promotion Checklist — PASS técnico → PASS operacional

Critérios formais de aceitação para `AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1`,
e o que falta para destravar o próximo nível.

## PASS técnico (o que esta entrega cobre e já está marcado)

- [x] Painel consolidado (18 cards, Nebula Core / Siriform Avatar).
- [x] Direção visual de referência incorporada — ver nota de
      transparência no handoff canônico (nenhuma imagem foi efetivamente
      anexada nesta sessão; a descrição textual da missão foi usada como
      direção de design).
- [x] Nome do projeto/repo verificado: nenhum nome incoerente encontrado;
      nome do sub-produto iPad alinhado nos arquivos do próprio
      sub-produto (`manifest.webmanifest`, `<title>`, `README.md`).
- [x] HTML canônico criado
      (`docs/AR10_CYBORG_2_PANEL_DEPLOY_AND_REPOSITORY_ALIGNMENT_V1.html`).
- [x] `.ar10pack` existente e verificado (`sha256sum -c` confere).
- [x] Estrutura organizada (`docs/`, `evidence_outbox/` adicionados sem
      quebrar `ipad_runtime/`).
- [x] Regras de segurança intactas (CSP restritiva, sem `eval()`, sem
      rota de rede sensível, badges permanentes, DecisionFrame
      `STUB CONTROLLED`).

→ **PASS TÉCNICO: confirmado.**

## PASS operacional (o que falta — depende de uma ação humana fora desta sessão)

- [ ] Link HTTPS real publicado.
- [ ] Abre no Safari do iPad físico.
- [ ] Mostra `READ_ONLY`/`FAIL_CLOSED` em produção (deveria funcionar
      identicamente ao ambiente local, já que não há diferença de
      configuração entre os dois — mas não foi observado em produção
      nesta sessão por falta do link).
- [ ] Painel premium visível em produção.
- [ ] Permite testar o runtime ponta-a-ponta em produção.

→ **PASS OPERACIONAL: ainda HOLD.** Ação necessária para destravar,
nessa ordem:

1. Um humano com permissão de **admin** do repositório
   `AR10-10/AR10-ORION` abre
   `https://github.com/AR10-10/AR10-ORION/settings/pages` e troca
   **Source** para **"GitHub Actions"** (ver `docs/GITHUB_PAGES_FIX.md`
   para o porquê isso não pode ser feito por nenhum token de Action).
2. Reexecutar o workflow `deploy-ipad-pwa.yml` (push novo ou
   `workflow_dispatch`).
3. Confirmar `https://ar10-10.github.io/AR10-ORION/` responde 200.
4. Rodar o checklist de `docs/IPAD_DIRECT_GUIDE.md` num iPad real.
5. Só então promover este item de `HOLD` para `PASS` no próximo relatório.

## Critério de não-regressão (válido em qualquer promoção futura)

Nenhuma promoção deste HOLD para PASS pode remover ou esconder:
`READ_ONLY`, `FAIL_CLOSED`, `Execution Lock: ACTIVE`,
`Private Keys: DISABLED`, `Live Trading: BLOCKED`, o rótulo
`STUB CONTROLLED` do DecisionFrame, ou o rótulo `FUTURE` dos cards de
WebLLM/Transformers/ONNX. Se algum desses desaparecer do painel em
qualquer entrega futura, trate como regressão de segurança, não como
"limpeza de UI".
