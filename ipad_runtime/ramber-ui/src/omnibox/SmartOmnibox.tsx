import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { fetchBinanceUsdtSymbols, partitionCryptoSymbols, type BinanceUsdtSymbol } from "./binance-symbols";
import { TRADFI_ASSETS, TRADFI_CATEGORY_LABELS, TRADFI_CATEGORY_ORDER, type TradFiAsset } from "./tradfi-assets";

// SmartOmnibox.tsx — Overhaul Cross-Market (Missão 2, diretriz 1): busca
// categorizada multi-mercado no cabeçalho, substituindo o seletor fixo de
// 5 moedas como forma PRIMÁRIA de trocar de ativo. Duas fontes, uma UI:
//   CRYPTO / MEME COINS — reais, buscados uma vez da Binance ao abrir
//     (diretriz 2), filtrados no cliente pela digitação.
//   ÍNDICES / AÇÕES / COMMODITIES / FOREX — taxonomia TradFi hardcoded
//     (diretriz 3), sempre disponível, nunca dispara rede.
// Fail-closed embutido: se o fetch da Binance falhar, as seções
// CRYPTO/MEME mostram um aviso honesto — nunca uma lista velha ou
// inventada; as seções TradFi continuam funcionando normalmente (são
// dados estáticos, não dependem de rede).
export function SmartOmnibox({
  selectedLabel,
  onSelectCrypto,
  onSelectTradFi,
}: {
  selectedLabel: string;
  onSelectCrypto: (baseAsset: string) => void;
  onSelectTradFi: (asset: TradFiAsset) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cryptoSymbols, setCryptoSymbols] = useState<BinanceUsdtSymbol[] | null>(null); // null = ainda não carregado
  const [loadFailed, setLoadFailed] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Carrega a lista real uma única vez, no primeiro momento em que o
  // Omnibox é aberto — não no mount do app inteiro (evita uma chamada de
  // rede que o Operador pode nunca precisar nesta sessão).
  useEffect(() => {
    if (!open || cryptoSymbols !== null) return;
    let cancelled = false;
    fetchBinanceUsdtSymbols().then((list) => {
      if (cancelled) return;
      setLoadFailed(list.length === 0);
      setCryptoSymbols(list);
    });
    return () => {
      cancelled = true;
    };
  }, [open, cryptoSymbols]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const { crypto, meme } = useMemo(() => partitionCryptoSymbols(cryptoSymbols ?? []), [cryptoSymbols]);

  const q = query.trim().toUpperCase();
  const textMatches = (text: string) => q.length === 0 || text.toUpperCase().includes(q);

  const filteredCrypto = useMemo(
    () => crypto.filter((s) => textMatches(s.baseAsset)).slice(0, 40),
    [crypto, q],
  );
  const filteredMeme = useMemo(
    () => meme.filter((s) => textMatches(s.baseAsset)).slice(0, 40),
    [meme, q],
  );
  const filteredTradFiByCategory = useMemo(() => {
    const map = new Map<string, TradFiAsset[]>();
    for (const a of TRADFI_ASSETS) {
      if (!textMatches(a.symbol) && !textMatches(a.name)) continue;
      const arr = map.get(a.category) ?? [];
      arr.push(a);
      map.set(a.category, arr);
    }
    return map;
  }, [q]);

  function selectCrypto(baseAsset: string) {
    onSelectCrypto(baseAsset);
    setOpen(false);
    setQuery("");
  }
  function selectTradFi(asset: TradFiAsset) {
    onSelectTradFi(asset);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={boxRef} className="relative">
      {/* Diretriz V-MAX item 7: gatilho "SÍMBOLO ▼" — o ícone de busca sai
          do header (a busca real continua no input dentro do dropdown
          abaixo); o chevron comunica "toque para trocar", padrão de
          qualquer plataforma profissional. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-[#00f0ff30] bg-[#00f0ff08] text-[#a0f0ff] text-[0.55rem] md:text-[0.6rem] font-bold tracking-wider hover:bg-[#00f0ff15] transition-colors whitespace-nowrap"
      >
        <span className="max-w-[110px] truncate">{selectedLabel}</span>
        <span className="text-[0.5rem] text-[#00f0ff]/70 shrink-0">▼</span>
      </button>

      {open && (
        // BUGFIX (Diretriz 3): `.cyber-panel` (index.css) define
        // `overflow: hidden` — como essa regra vem DEPOIS das utilidades
        // do Tailwind no CSS compilado, ela vencia a cascata sobre
        // `overflow-y-auto` (mesma especificidade, mesma propriedade), e
        // a lista comprida de resultados não rolava nem com o dedo nem
        // com o mouse. Mesmo padrão de bug já documentado no wrapper
        // Widget() (`!fixed !inset-2` no modo maximizado) — correção
        // idêntica aqui: `!overflow-y-auto` força a vitória na cascata.
        //
        // BUGFIX (relatado pelo Operador — "corta na parte de cima ao
        // abrir o ativo"): a MESMA classe `.cyber-panel` também define
        // `position: relative`, vencendo pelo mesmo motivo de cascata
        // sobre o `absolute` do Tailwind. Com o dropdown preso em fluxo
        // normal (em vez de posicionado fora do fluxo), ele empurra a
        // altura do wrapper pai para ~750px; esse wrapper vive dentro de
        // um contêiner flex com altura fixa (`h-[70%]`) e
        // `items-center`, que centraliza verticalmente a caixa
        // gigante — resultado real medido: o botão de gatilho renderiza
        // a ~350px ACIMA do viewport (invisível/cortado). Correção
        // idêntica ao bug de overflow: `!absolute` força a vitória.
        <div className="!absolute top-full left-0 mt-1.5 w-[300px] max-h-[70vh] !overflow-y-auto scrollbar-hide cyber-panel bg-[#010308]/98 z-50 p-2">
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: BTC, PEPE, AAPL, XAUUSD..."
            className="w-full bg-[#020610] border border-[#00f0ff20] rounded px-2 py-1.5 text-[0.6rem] text-[#a0f0ff] mb-2 focus:outline-none focus:border-[#00f0ff60]"
          />

          {/* Master Panel handoff: fonte agora é Futures USDT-M Perpétuo
              primeiro (Diretriz 2), Spot só como fallback automático (ver
              binance-symbols.ts) — o título não afirma mais "Spot" fixo, e
              cada item usa s.market real (nunca um rótulo independente da
              fonte que de fato respondeu). */}
          <OmniboxSection title="Cripto · Binance (Tempo Real)">
            {cryptoSymbols === null ? (
              <OmniboxNote text="AGUARDANDO..." />
            ) : loadFailed ? (
              <OmniboxNote text="SEM_CONEXAO_BINANCE" tone="warn" />
            ) : filteredCrypto.length === 0 ? (
              <OmniboxNote text="Nenhum resultado" />
            ) : (
              filteredCrypto.map((s) => (
                <OmniboxItem
                  key={s.symbol}
                  label={s.baseAsset}
                  sub={s.market === "perp" ? "USDT-M · Perp" : "USDT · Spot"}
                  onClick={() => selectCrypto(s.baseAsset)}
                />
              ))
            )}
          </OmniboxSection>

          <OmniboxSection title="Meme Coins (Binance, Tempo Real)">
            {cryptoSymbols === null ? (
              <OmniboxNote text="AGUARDANDO..." />
            ) : loadFailed ? (
              <OmniboxNote text="SEM_CONEXAO_BINANCE" tone="warn" />
            ) : filteredMeme.length === 0 ? (
              <OmniboxNote text="Nenhum resultado" />
            ) : (
              filteredMeme.map((s) => (
                <OmniboxItem
                  key={s.symbol}
                  label={s.baseAsset}
                  sub={s.market === "perp" ? "USDT-M · Perp" : "USDT · Spot"}
                  onClick={() => selectCrypto(s.baseAsset)}
                />
              ))
            )}
          </OmniboxSection>

          {TRADFI_CATEGORY_ORDER.map((cat) => {
            const items = filteredTradFiByCategory.get(cat) ?? [];
            if (items.length === 0) return null;
            return (
              <OmniboxSection key={cat} title={TRADFI_CATEGORY_LABELS[cat]}>
                {items.map((a) => (
                  <OmniboxItem key={a.symbol} label={a.symbol} sub={a.name} onClick={() => selectTradFi(a)} accent />
                ))}
              </OmniboxSection>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OmniboxSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="text-[0.45rem] tracking-[0.2em] text-[#8ab4f8]/60 font-bold uppercase px-2 py-1 border-b border-[#8ab4f8]/10">
        {title}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function OmniboxNote({ text, tone = "muted" }: { text: string; tone?: "muted" | "warn" }) {
  return (
    <div className={`text-[0.55rem] px-2 py-1.5 ${tone === "warn" ? "text-[#ff0055]/70" : "text-[#8ab4f8]/50"}`}>{text}</div>
  );
}

function OmniboxItem({
  label,
  sub,
  onClick,
  accent = false,
}: {
  label: string;
  sub: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-between px-2 py-1.5 rounded text-left hover:bg-[#00f0ff10] transition-colors"
    >
      <span className={`text-[0.6rem] font-bold ${accent ? "text-[#b026ff]" : "text-[#a0f0ff]"}`}>{label}</span>
      <span className="text-[0.5rem] text-[#8ab4f8]/50 truncate max-w-[140px]">{sub}</span>
    </button>
  );
}
