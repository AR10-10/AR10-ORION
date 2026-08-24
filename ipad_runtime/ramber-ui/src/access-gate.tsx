import { useState, type FormEvent, type ReactNode } from "react";
import { verifyPassword } from "./access-gate-crypto";
import { APP_SEAL } from "./version";

// access-gate.tsx — Cortina de acesso do AR10 CYBORG.
//
// ═══ O QUE ESTE PORTÃO É, E O QUE ELE NÃO É ═══
//
// Ele NÃO é a trava de acesso do sistema. A trava real é de HOSPEDAGEM
// (Cloudflare Access — ver docs/ACESSO_PRIVADO.md): autenticação por
// e-mail, feita no servidor, antes de qualquer byte do app sair para o
// navegador. Este portão é uma segunda camada, e só resolve o pedido
// original: impedir que quem já passou pela hospedagem e recebeu o link
// abra o painel "sem querer".
//
// Num site estático não existe portão de verdade no cliente: quem abre o
// DevTools lê o hash do bundle, testa senhas offline, ou simplesmente roda
// `localStorage.setItem(...)` no console. Isto está escrito aqui de
// propósito para nenhuma sessão futura tratar esta cortina como se fosse
// segurança.
//
// ═══ POR QUE O HASH SAIU DO CÓDIGO-FONTE ═══
//
// Ele era um literal neste arquivo, num repositório PÚBLICO — e a senha em
// texto puro ainda estava, por extenso, no arquivo de teste. Agora o hash
// vem de `VITE_ACCESS_HASH`, injetado no build a partir de um segredo do
// repositório, e nunca é versionado.
//
// LIMITE REAL, dito sem rodeio: o Vite inlina variáveis `VITE_*` no bundle
// publicado. O hash SAI do código-fonte, mas continua legível no JavaScript
// servido — isso é inevitável em site estático e não há truque que mude.
// O que muda é que ele deixa de estar no repositório, e a senha em texto
// puro deixa de existir em qualquer lugar versionado.
const UNLOCK_KEY = "ar10cyborg_access_unlocked";

/**
 * Valida e normaliza o hash vindo do ambiente de build.
 *
 * FAIL-CLOSED (constituição do projeto): sem um hash SHA-256 válido, devolve
 * `null` — e um `null` NUNCA destrava o painel. Um build sem o segredo
 * configurado produz um app que ninguém abre, e isso é deliberado: a falha
 * segura de um portão é ficar fechado, nunca ficar aberto.
 *
 * Função pura e exportada para ser testável de verdade (o valor de
 * `import.meta.env` é resolvido na carga do módulo, então testar só a
 * constante não exercitaria nenhuma das formas de entrada inválida).
 */
export function resolveAccessHash(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const limpo = raw.trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(limpo) ? limpo : null;
}

/** Hash SHA-256 da senha do portão, vindo do build. `null` = não
 *  configurado, e o portão permanece fechado. */
export const ACCESS_HASH: string | null = resolveAccessHash(
  (import.meta as unknown as { env?: Record<string, unknown> }).env?.VITE_ACCESS_HASH,
);

function readUnlocked(): boolean {
  try {
    return localStorage.getItem(UNLOCK_KEY) === "1";
  } catch {
    return false; // Safari privado etc.: sem storage, sempre pede senha
  }
}

export function AccessGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState(readUnlocked);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  if (unlocked) return <>{children}</>;

  // Build sem o segredo configurado: o portão fica fechado e DIZ por quê.
  // Mostrar um campo de senha que nunca aceita nada seria mentir para quem
  // está na frente da tela — e esconderia um erro de configuração de deploy
  // atrás de um "senha incorreta" que nunca vai deixar de aparecer.
  if (ACCESS_HASH === null) {
    return (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#010205] px-6">
        <div className="cyber-panel w-full max-w-xs px-6 py-8 flex flex-col items-center gap-3 text-center">
          <div className="text-[#00f0ff] font-black tracking-[0.2em] text-sm drop-shadow-[0_0_5px_#00f0ff]">
            AR10 CYBORG
          </div>
          <div className="text-[#ff0055] text-[0.6rem] tracking-widest uppercase">Acesso não configurado</div>
          <div className="text-[#8ab4f8]/60 text-[0.55rem] leading-relaxed">
            Este build saiu sem <span className="text-[#a0f0ff]">VITE_ACCESS_HASH</span>. O portão permanece fechado
            até o segredo ser definido no deploy.
          </div>
          <div className="text-[#8ab4f8]/30 text-[0.5rem]">{APP_SEAL}</div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (ACCESS_HASH === null) return; // fail-closed: sem hash real, nunca destrava
    setChecking(true);
    const ok = await verifyPassword(password, ACCESS_HASH);
    setChecking(false);
    if (ok) {
      try {
        localStorage.setItem(UNLOCK_KEY, "1");
      } catch {
        /* sem storage: desbloqueia só para esta sessão em memória */
      }
      setUnlocked(true);
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-[#010205] px-6">
      <form onSubmit={handleSubmit} className="cyber-panel w-full max-w-xs px-6 py-8 flex flex-col items-center gap-4">
        <div className="text-center">
          <div className="text-[#00f0ff] font-black tracking-[0.2em] text-sm drop-shadow-[0_0_5px_#00f0ff]">
            AR10 CYBORG
          </div>
          <div className="text-[#8ab4f8]/60 text-[0.6rem] tracking-widest mt-1 uppercase">Acesso Restrito</div>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            if (error) setError(false);
          }}
          placeholder="Senha de acesso"
          className="w-full bg-[#010308] border border-[#8ab4f8]/20 rounded px-3 py-2 text-center text-[#a0f0ff] text-sm tracking-widest focus:outline-none focus:border-[#00f0ff]/60"
        />
        {error ? <div className="text-[#ff0055] text-[0.6rem] tracking-wide uppercase">Senha incorreta</div> : null}
        <button
          type="submit"
          disabled={checking || password.length === 0}
          className="w-full bg-[#00f0ff]/10 border border-[#00f0ff]/40 rounded px-3 py-2 text-[#00f0ff] text-xs font-bold tracking-wide uppercase disabled:opacity-40"
        >
          {checking ? "Verificando…" : "Entrar"}
        </button>
        <div className="text-[#8ab4f8]/30 text-[0.5rem] text-center">{APP_SEAL}</div>
      </form>
    </div>
  );
}
