// terminal-field-priority.test.ts — Ordem 3 "TERMINAL — VISUAL +
// INFORMATIONAL INTEGRITY": execução real da hierarquia de campos e da
// regra "NUNCA esconder Entry/Invalidation/Targets", mesmo espírito de
// density-tier.test.ts.
import { describe, it, expect } from 'vitest';
import {
  TERMINAL_FIELD_PRIORITY,
  isTerminalFieldAlwaysVisible,
  resolveVisibleTerminalFieldTiers,
  type TerminalFieldTier,
} from '../src/nexus/terminal-field-priority';

describe('TERMINAL_FIELD_PRIORITY: ordem literal do texto do Operador', () => {
  it('os 7 tiers na ordem exata pedida — DECISION > PRICE > TRADE_PLAN > INVALIDATION > TARGETS > ESSENTIAL_EVIDENCE > SECONDARY_INFORMATION', () => {
    expect(TERMINAL_FIELD_PRIORITY).toEqual([
      'DECISION',
      'PRICE',
      'TRADE_PLAN',
      'INVALIDATION',
      'TARGETS',
      'ESSENTIAL_EVIDENCE',
      'SECONDARY_INFORMATION',
    ]);
  });
});

describe('isTerminalFieldAlwaysVisible: as 5 tiers centrais nunca somem (regra "NUNCA" do texto)', () => {
  it.each<[TerminalFieldTier, boolean]>([
    ['DECISION', true],
    ['PRICE', true],
    ['TRADE_PLAN', true],
    ['INVALIDATION', true],
    ['TARGETS', true],
    ['ESSENTIAL_EVIDENCE', false],
    ['SECONDARY_INFORMATION', false],
  ])('%s → sempre visível: %s', (tier, expected) => {
    expect(isTerminalFieldAlwaysVisible(tier)).toBe(expected);
  });
});

describe('resolveVisibleTerminalFieldTiers: progressive disclosure só ativa em COMPACT', () => {
  it('COMPACT esconde ESSENTIAL_EVIDENCE/SECONDARY_INFORMATION, mantém os 5 centrais', () => {
    expect(resolveVisibleTerminalFieldTiers('COMPACT')).toEqual([
      'DECISION', 'PRICE', 'TRADE_PLAN', 'INVALIDATION', 'TARGETS',
    ]);
  });

  it('STANDARD mostra os 7 tiers', () => {
    expect(resolveVisibleTerminalFieldTiers('STANDARD')).toEqual(TERMINAL_FIELD_PRIORITY);
  });

  it('EXPANDED mostra os 7 tiers', () => {
    expect(resolveVisibleTerminalFieldTiers('EXPANDED')).toEqual(TERMINAL_FIELD_PRIORITY);
  });

  it('nunca muta TERMINAL_FIELD_PRIORITY (pureza: cada chamada devolve um array novo)', () => {
    const before = [...TERMINAL_FIELD_PRIORITY];
    resolveVisibleTerminalFieldTiers('COMPACT');
    resolveVisibleTerminalFieldTiers('STANDARD');
    resolveVisibleTerminalFieldTiers('EXPANDED');
    expect(TERMINAL_FIELD_PRIORITY).toEqual(before);
  });

  it('a saída de COMPACT é sempre um subconjunto em ORDEM da lista completa, nunca reordenada', () => {
    const visible = resolveVisibleTerminalFieldTiers('COMPACT');
    const indices = visible.map((tier) => TERMINAL_FIELD_PRIORITY.indexOf(tier));
    const sorted = [...indices].sort((a, b) => a - b);
    expect(indices).toEqual(sorted);
  });
});
