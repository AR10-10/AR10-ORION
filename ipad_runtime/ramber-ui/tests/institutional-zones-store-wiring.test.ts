// institutional-zones-store-wiring.test.ts — Carta Branca (Evidence Fusion
// Engine): achado real de auditoria — computeInstitutionalZones já era
// calculado há várias rodadas dentro de EnhancedChart_110_Percent.tsx
// (useMemo local, só para o gráfico), mas nunca tinha ganhado uma fatia
// própria na store, ao contrário de todo outro motor real deste app.
// Trava os 4 lugares reais (state → actions → defaults → seletor, mesma
// convenção documentada no cabeçalho de unified-snapshot-store.ts) + o
// ponto de publicação no gráfico (zero segundo cálculo). A agregação real
// que consome isto tem execução própria em evidence-fusion.test.ts.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(resolve(here, rel), 'utf8');

describe('unified-snapshot-store.ts: institutionalZones nos 4 lugares reais (§3 Motores Quant)', () => {
  it('state interface declara o campo real', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('institutionalZones: InstitutionalZone[];');
  });

  it('action real de escrita', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('setInstitutionalZones: (zones: InstitutionalZone[]) => void;');
    expect(s).toContain('setInstitutionalZones: (zones) => set((s) => { s.institutionalZones = zones; }),');
  });

  it('default real: lista vazia honesta, nunca null/undefined implícito', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('institutionalZones: [],');
  });

  it('seletor atômico real com fallback estável (mesmo padrão de EMPTY_HARMONIC_HITS)', () => {
    const s = read('../src/store/unified-snapshot-store.ts');
    expect(s).toContain('const EMPTY_INSTITUTIONAL_ZONES: InstitutionalZone[] = [];');
    expect(s).toContain('export const useInstitutionalZonesSnapshot = (): InstitutionalZone[] =>');
    expect(s).toContain('useUnifiedSnapshotStore((s) => s.institutionalZones ?? EMPTY_INSTITUTIONAL_ZONES);');
  });
});

describe('EnhancedChart_110_Percent.tsx: publica o MESMO array já computado — zero segundo cálculo', () => {
  it('o useEffect de publicação vem logo após o useMemo real de computeInstitutionalZones, mesma variável', () => {
    const c = read('../src/chart/EnhancedChart_110_Percent.tsx');
    const memoIdx = c.indexOf('const institutionalZones = useMemo(() => computeInstitutionalZones(institutionalZoneInput), [institutionalZoneInput]);');
    expect(memoIdx, 'useMemo real não encontrado').toBeGreaterThan(-1);
    const block = c.slice(memoIdx, memoIdx + 900);
    expect(block).toContain('useUnifiedSnapshotStore.getState().setInstitutionalZones(institutionalZones);');
    expect(block).toContain('}, [institutionalZones]);');
  });

  it('importa useUnifiedSnapshotStore (zero segunda instância de store)', () => {
    const c = read('../src/chart/EnhancedChart_110_Percent.tsx');
    expect(c).toContain('import { useOrderflowHistory, useVolumeProfileSnapshot, useUnifiedSnapshotStore } from "../store/unified-snapshot-store";');
  });
});
