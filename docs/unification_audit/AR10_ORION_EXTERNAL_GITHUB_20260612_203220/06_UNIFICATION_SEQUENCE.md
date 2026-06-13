# Plano de Consolidacao Sem Versoes Paralelas

## Trilha unica

CURRENT oficial: C:\Users\mv\Documents\PROJETO_AR10_ORION\ar10_orion_ecosystem

Fonte externa auditada: C:\Users\mv\Documents\GitHub\AR10-ORION

## Politica

- Uma unica aplicacao ativa.
- Uma unica porta oficial: 8970.
- Uma unica shell visual: AR10 ORION COCKPIT.
- GitHub/RAR vira apenas fonte externa arquivada ou branch de estudo.
- Toda importacao deve passar por candidate_staging e manifestos.

## Ordem tecnica sugerida

1. Corrigir encoding antes de qualquer port.
2. Corrigir sintaxe externa somente em staging, se for necessario usar trechos.
3. Converter gateways externos para contratos gateway_status() READ_ONLY, ou descartar.
4. Transformar DataService externo em proposta futura de websocket, nao substituir agora.
5. Importar health/resource/gating/governance como modulos internos pequenos.
6. Expor esses sinais no /api/orion/telemetry oficial.
7. Atualizar UI oficial sem criar outro painel.
8. Gerar pacote AR10_ORION_OFFICIAL_UNIFIED_CANDIDATE.

## Resultado esperado

Uma versao oficial: Orion atual + melhores conceitos externos, sem duplicidade e sem execucao.
