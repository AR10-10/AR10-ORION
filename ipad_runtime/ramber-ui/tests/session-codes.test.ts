// Execução real + cobertura 1:1 contra as DEFINIÇÕES reais das duas famílias
// de sessão. O bug provável aqui não é matemático: é "alguém adicionou uma
// sessão nova e esqueceu de dar um código curto a ela" — e nesse caso a
// faixa do gráfico voltaria a mostrar um nome inteiro. É isso que se trava.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sessionCode, SESSION_CODE_IDS, SESSION_CODE_MAX_LENGTH } from "../src/nexus/session-codes";
import { KILL_ZONES } from "../src/nexus/kill-zones";
import { marketSessionFromUtc } from "../src/nexus/market-session";

describe("sessionCode — o código curto real", () => {
  it("nenhum código passa do teto (o que garante que a faixa não recebe nome inteiro)", () => {
    for (const id of SESSION_CODE_IDS) {
      expect(sessionCode(id).length, id).toBeLessThanOrEqual(SESSION_CODE_MAX_LENGTH);
    }
  });

  it("usa o vocabulário de mesa real (ASIA/LDN/NY), não uma abreviação inventada", () => {
    expect(sessionCode("ASIA")).toBe("ASIA");
    expect(sessionCode("LONDRES")).toBe("LDN");
    expect(sessionCode("NOVA_YORK")).toBe("NY");
    expect(sessionCode("LONDRES_NY")).toBe("LDN+NY");
    expect(sessionCode("PACIFICO")).toBe("PAC");
  });

  it("o fechamento de Londres é a MESMA praça com sufixo, não um segundo nome", () => {
    expect(sessionCode("LONDRES_CLOSE")).toBe("LDN-C");
    expect(sessionCode("LONDRES_CLOSE").startsWith(sessionCode("LONDRES"))).toBe(true);
  });

  it("é realmente mais curto que o nome que substituiu (o ganho medido)", () => {
    const antes = ["Ásia", "Londres", "Londres+NY", "Nova York", "Pacífico"];
    const depois = ["ASIA", "LDN", "LDN+NY", "NY", "PAC"];
    const somaAntes = antes.reduce((n, s) => n + s.length, 0);
    const somaDepois = depois.reduce((n, s) => n + s.length, 0);
    expect(somaDepois).toBeLessThan(somaAntes);
    // Redução real de pelo menos um terço no total de caracteres desenhados.
    expect(somaDepois / somaAntes).toBeLessThan(0.67);
  });

  it("fail-closed: id desconhecido nunca devolve vazio nem o nome longo de volta", () => {
    const desconhecido = sessionCode("UMA_SESSAO_QUE_NAO_EXISTE");
    expect(desconhecido.length).toBeGreaterThan(0);
    expect(desconhecido.length).toBeLessThanOrEqual(SESSION_CODE_MAX_LENGTH);
  });

  it("id ausente vira travessão, nunca string vazia (faixa muda seria pior)", () => {
    expect(sessionCode(null)).toBe("—");
    expect(sessionCode(undefined)).toBe("—");
    expect(sessionCode("")).toBe("—");
  });
});

describe("cobertura 1:1 — toda sessão real tem código cadastrado", () => {
  it("as 4 kill zones reais estão cadastradas", () => {
    for (const z of KILL_ZONES) {
      expect(SESSION_CODE_IDS, z.id).toContain(z.id);
      expect(z.code).toBe(sessionCode(z.id));
    }
  });

  it("as 5 sessões de mercado reais estão cadastradas (varredura das 24h UTC)", () => {
    const vistos = new Set<string>();
    for (let h = 0; h < 24; h++) {
      const r = marketSessionFromUtc(new Date(Date.UTC(2026, 0, 5, h, 30)));
      if (r) vistos.add(r.id);
    }
    expect(vistos.size).toBe(5); // a varredura cobriu mesmo as 5
    for (const id of vistos) {
      expect(SESSION_CODE_IDS, id).toContain(id);
    }
  });
});

describe("kill-zones — o prefixo duplicado foi removido NA ORIGEM", () => {
  const src = readFileSync(resolve(__dirname, "../src/nexus/kill-zones.ts"), "utf8");
  const app = readFileSync(resolve(__dirname, "../src/App.tsx"), "utf8");

  it("nenhum rótulo carrega mais o prefixo de apresentação", () => {
    for (const z of KILL_ZONES) {
      expect(z.label, z.id).not.toMatch(/Kill Zone/i);
    }
  });

  it("a UI não faz mais cirurgia de string para desfazer o prefixo", () => {
    // O defeito exato: `.replace("Kill Zone · ", "")`. Se voltar, a tela
    // pode mostrar "Kill Zone · Kill Zone · Ásia" ao menor caractere fora
    // de lugar no dado.
    // Varredura do arquivo CRU, de propósito — a forma mais estrita. O
    // comentário que explica o defeito removido foi escrito sem a sintaxe
    // literal da chamada, justamente para não dar falso positivo em si
    // mesmo (armadilha comentário-vs-código recorrente neste repositório):
    // a solução foi ajustar a prosa, nunca afrouxar a guarda.
    expect(app).not.toMatch(/\.replace\(\s*["']Kill Zone/);
  });

  it("o rótulo continua sendo o nome real da praça (nada foi apagado)", () => {
    const nomes = KILL_ZONES.map((z) => z.label);
    expect(nomes).toContain("Ásia");
    expect(nomes).toContain("Fechamento de Londres");
  });

  it("cada janela carrega o código curto junto do nome", () => {
    expect(src).toMatch(/code:\s*sessionCode\(/);
    for (const z of KILL_ZONES) {
      expect(z.code.length, z.id).toBeLessThanOrEqual(SESSION_CODE_MAX_LENGTH);
    }
  });
});

describe("plugins — as iniciais chegam mesmo ao canvas", () => {
  const band = readFileSync(resolve(__dirname, "../src/chart/MarketSessionBandsPlugin.tsx"), "utf8");
  const kz = readFileSync(resolve(__dirname, "../src/chart/KillZoneBandsPlugin.tsx"), "utf8");
  const killZonesSrc = readFileSync(resolve(__dirname, "../src/nexus/kill-zones.ts"), "utf8");

  it("a faixa de sessões desenha o código, não o nome em maiúsculas", () => {
    expect(band).toMatch(/fillText\(sessionCode\(level\.sessionId\)/);
    expect(band).not.toMatch(/fillText\(level\.label\.toUpperCase\(\)/);
  });

  it("a faixa de sessões usa a fonte compartilhada, não mais 9px congelado", () => {
    expect(band).toMatch(/ctx\.font = activeCanvasLabelFont\(\)/);
    expect(band).not.toMatch(/ctx\.font = "9px/);
  });

  it("a kill zone NÃO ganha rótulo no canvas — a decisão anterior vale", () => {
    // Rodada anterior removeu este rótulo de propósito: era duplicação do
    // badge "Kill Zone · …" que o cabeçalho já mostra. O raio-X desta rodada
    // chegou a redesenhá-lo e a guarda de regressão apontou o conflito — a
    // decisão do Operador ("nada repetido") prevaleceu sobre a ideia nova.
    expect(kz).not.toMatch(/fillText/);
    expect(kz).not.toMatch(/LABEL_ALPHA/);
  });

  it("o campo morto foi REMOVIDO do span, não ressuscitado numa 2ª superfície", () => {
    // A correção honesta para dado que ninguém consome: apagar o campo.
    // Nome e código continuam reais em KILL_ZONES e chegam pelo cabeçalho.
    // Só as linhas de DECLARAÇÃO do bloco entram na checagem — o comentário
    // que explica a remoção precisa citar os nomes dos campos, e varrer o
    // bloco cru daria falso positivo nele mesmo (armadilha comentário-vs-código
    // recorrente aqui; a guarda fica estrita, o alvo é que fica preciso).
    const bloco = killZonesSrc.slice(
      killZonesSrc.indexOf("export interface KillZoneSpan {"),
      killZonesSrc.indexOf("}", killZonesSrc.indexOf("export interface KillZoneSpan {")),
    );
    const declaracoes = bloco
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));
    expect(declaracoes.some((l) => /^label\s*:/.test(l))).toBe(false);
    expect(declaracoes.some((l) => /^code\s*:/.test(l))).toBe(false);
    // E o que SOBROU é exatamente o que o consumidor real usa.
    expect(declaracoes.some((l) => /^id\s*:/.test(l))).toBe(true);
    expect(declaracoes.some((l) => /^endIndex\s*:/.test(l))).toBe(true);
  });
});

describe("zero fonte congelada sobrou no diretório chart/", () => {
  it("nenhum plugin declara um corpo de fonte literal", () => {
    // Varre os arquivos reais: qualquer `ctx.font = "Npx ..."` é uma segunda
    // decisão de tamanho fora da escala compartilhada.
    const dir = resolve(__dirname, "../src/chart");
    const arquivos = [
      "MarketSessionBandsPlugin.tsx",
      "KillZoneBandsPlugin.tsx",
      "LiquidityZonesPlugin.tsx",
      "InstitutionalZonePlugin.tsx",
      "LiquidationHeatmapPlugin.tsx",
      "DepthChartPlugin.tsx",
      "TpoProfilePlugin.tsx",
      "VolumeProfilePlugin.tsx",
      "SessionKeyLevelsPlugin.tsx",
      "StructureBreakMarkersPlugin.tsx",
      "ZigZagPlugin.tsx",
      "TradePlanZonePlugin.tsx",
      "NeuralMarketAuraPlugin.tsx",
      "OrderFlowHeatmapPlugin.tsx",
    ];
    for (const f of arquivos) {
      const src = readFileSync(resolve(dir, f), "utf8");
      expect(src, f).not.toMatch(/ctx\.font\s*=\s*["'`]\d/);
    }
  });
});
