// a11y-wiring.test.ts — padrão-no-código-fonte da rodada de acessibilidade
// (pedido do Operador: "acessibilidade... 110%... sincronizado contigo em
// tempo real"). A matemática pura já tem sua própria suíte de execução
// real (a11y-live-announcements.test.ts) — aqui o bug mais provável é
// "esqueceram de conectar A com B" (fiação real com App.tsx/index.css).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const appTsx = readFileSync(resolve(here, '../src/App.tsx'), 'utf8');
const liveRegion = readFileSync(resolve(here, '../src/a11y/LiveRegionAnnouncer.tsx'), 'utf8');
const indexCss = readFileSync(resolve(here, '../src/index.css'), 'utf8');
const neuralAura = readFileSync(resolve(here, '../src/chart/NeuralMarketAuraPlugin.tsx'), 'utf8');

describe('App.tsx monta o LiveRegionAnnouncer de verdade, nunca só importa', () => {
  it('importa LiveRegionAnnouncer de ./a11y/LiveRegionAnnouncer', () => {
    expect(appTsx).toContain('import { LiveRegionAnnouncer } from "./a11y/LiveRegionAnnouncer";');
  });

  it('computa announcerDirection com a MESMA fórmula LEI 24 de CoreSignalBadge/ChartWidget — nunca a direção bruta do engine', () => {
    const idx = appTsx.indexOf('const announcerDirection: "LONG" | "SHORT" | null = useMemo(() => {');
    expect(idx, 'announcerDirection não encontrado').toBeGreaterThan(-1);
    const block = appTsx.slice(idx, idx + 400);
    expect(block).toContain('const dir = engine?.direction ?? null;');
    expect(block).toContain('expectancyFilter?.show === false');
    expect(block).toContain('return suppressed ? null : dir;');
  });

  it('renderiza <LiveRegionAnnouncer direction={announcerDirection} wsLive={wsLive} /> real no JSX, não só definido', () => {
    expect(appTsx).toContain('<LiveRegionAnnouncer direction={announcerDirection} wsLive={wsLive} />');
  });
});

describe('LiveRegionAnnouncer.tsx — região aria-live real, desacoplada de App.tsx', () => {
  it('aria-live=polite + aria-atomic=true + sr-only — nunca assertive (best practice: assertive só pra alerta genuinamente crítico)', () => {
    expect(liveRegion).toContain('aria-live="polite"');
    expect(liveRegion).toContain('aria-atomic="true"');
    expect(liveRegion).toContain('sr-only');
    expect(liveRegion).not.toContain('aria-live="assertive"');
  });

  it('recebe direction/wsLive por PROP — zero import de App.tsx (mesma arquitetura desacoplada de voice/VoiceControlWidget.tsx)', () => {
    expect(liveRegion).not.toMatch(/from ["']\.\.\/App["']/);
    expect(liveRegion).not.toContain('useContext');
    expect(liveRegion).toContain('direction: FusedDirection;');
    expect(liveRegion).toContain('wsLive: boolean;');
  });

  it('usa o módulo puro buildLiveAnnouncement — nunca uma segunda lógica de anúncio inline', () => {
    expect(liveRegion).toContain('import { buildLiveAnnouncement, type FusedDirection, type LiveAnnouncementState } from "../nexus/a11y-live-announcements";');
    expect(liveRegion).toContain('buildLiveAnnouncement(previousRef.current, current)');
  });
});

describe('index.css — foco de teclado sempre visível (WCAG 2.4.7)', () => {
  it(':focus-visible existe com outline real e !important (rede de segurança sobre outline-none já existente)', () => {
    const idx = indexCss.indexOf(':focus-visible {');
    expect(idx, ':focus-visible não encontrado').toBeGreaterThan(-1);
    const block = indexCss.slice(idx, idx + 150);
    expect(block).toContain('outline: 2px solid #00f0ff !important;');
    expect(block).toContain('outline-offset: 2px;');
  });
});

describe('Confirmação de regressão: Ciclone de Convicção continua respeitando prefers-reduced-motion (achado do audit desta rodada: já era real, não uma correção nova)', () => {
  it('decideRenderer só tenta o Worker quando NÃO há preferência por movimento reduzido', () => {
    expect(neuralAura).toContain('if (supportsOffscreenWorker() && !prefersReducedMotion()) {');
  });
});
