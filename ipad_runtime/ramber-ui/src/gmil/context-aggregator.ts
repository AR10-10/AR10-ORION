// context-aggregator.ts — agregação por categoria (Fase E / V15 Cap. 6:
// "Saídas: Context Score, Institutional Bias, Macro Bias, Liquidity
// Bias"). Função pura sobre as MESMAS linhas de provedor que o snapshot já
// carrega — nenhuma coleta própria, nenhum estado.
//
// LEI 04 (inviolável): os quatro vieses são calculados com a MESMA função
// computeConsensus do consenso global — média ponderada real, sample_size
// reportado, null quando não há entrada utilizável. Nenhuma segunda
// matemática de consenso; este arquivo só decide QUAIS provedores entram
// em cada viés (particionamento por categoria), nunca COMO combiná-los.
//
// Mapeamento categoria → viés (documentado, não implícito):
//   contextScore      TODAS as categorias — é o consenso global existente,
//                     agora com o nome que a Constituição usa.
//   institutionalBias DERIVATIVES + ONCHAIN — posicionamento de players
//                     alavancados/institucionais. Hoje: 1 provedor real
//                     (derivatives_positioning); ONCHAIN sem fonte keyless
//                     (gancho honesto — entra sozinho quando existir).
//   macroBias         MACRO — DXY/Treasuries/calendário. Zero provedores
//                     hoje => score null SEMPRE (nunca um neutro
//                     fabricado); a UI mostra AGUARDANDO FONTE.
//   liquidityBias     BLOCKCHAIN — agregados de amplitude/liquidez do
//                     mercado como um todo (hoje: coingecko_global, market
//                     cap/volume 24h). Sentimento e atenção ficam DE FORA
//                     dos vieses institucional/macro/liquidez de
//                     propósito: humor de multidão não é fluxo
//                     institucional.
import { computeConsensus, type ConsensusInput, type ConsensusResult } from './consensus-engine';
import type { ProviderCategory } from './types';

export interface CategorizedConsensusInput extends ConsensusInput {
  category: ProviderCategory;
}

export interface ContextBiases {
  contextScore: ConsensusResult;
  institutionalBias: ConsensusResult;
  macroBias: ConsensusResult;
  liquidityBias: ConsensusResult;
}

export const BIAS_CATEGORY_MAP = Object.freeze({
  institutionalBias: Object.freeze(['DERIVATIVES', 'ONCHAIN'] as ProviderCategory[]),
  macroBias: Object.freeze(['MACRO'] as ProviderCategory[]),
  liquidityBias: Object.freeze(['BLOCKCHAIN'] as ProviderCategory[]),
});

function consensusFor(inputs: CategorizedConsensusInput[], categories: readonly ProviderCategory[]): ConsensusResult {
  return computeConsensus(inputs.filter((i) => categories.includes(i.category)));
}

export function aggregateContextBiases(inputs: CategorizedConsensusInput[]): ContextBiases {
  return {
    contextScore: computeConsensus(inputs),
    institutionalBias: consensusFor(inputs, BIAS_CATEGORY_MAP.institutionalBias),
    macroBias: consensusFor(inputs, BIAS_CATEGORY_MAP.macroBias),
    liquidityBias: consensusFor(inputs, BIAS_CATEGORY_MAP.liquidityBias),
  };
}
