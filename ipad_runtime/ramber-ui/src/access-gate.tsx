import { useState, type FormEvent, type ReactNode } from "react";
import { verifyPassword } from "./access-gate-crypto";
import { APP_SEAL } from "./version";

// access-gate.tsx — Cortina de acesso do AR10 CYBORG (pedido do Operador:
// "uma senha fácil pra ninguém acessar sem querer" quando o link circula).
//
// HONESTIDADE DELIBERADA — isto NÃO é segurança real: este é um site
// estático (GitHub Pages), sem backend e sem sessão de servidor. Qualquer
// pessoa com as ferramentas de desenvolvedor do navegador pode ler
// ACCESS_HASH e testar senhas offline, ou simplesmente executar
// `localStorage.setItem(...)` no console para se autodesbloquear — nada
// aqui resiste a quem sabe abrir o DevTools. O que este portão resolve de
// verdade é exatamente o pedido original: impedir que quem RECEBE o link
// abra o painel "sem querer" sem a senha combinada. Não é uma trava
// contra um atacante — é uma cortina contra abertura acidental.
const UNLOCK_KEY = "ar10cyborg_access_unlocked";

// Hash SHA-256 da senha do portão — a senha em texto puro não aparece em
// lugar nenhum deste arquivo, nem mesmo em comentário. Exportado só para a
// suíte de testes comparar contra vetores conhecidos; nenhum código de
// produção importa isto além deste próprio arquivo.
export const ACCESS_HASH = "3042de482c22b006f33bddc0ca7d819fd0bd334d3afc381a233cabfd18ce4b10";

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

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
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
