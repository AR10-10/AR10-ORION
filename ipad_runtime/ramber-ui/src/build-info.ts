// build-info.ts — Ordem P0 (RUNTIME PARITY, 2026-09-07): identidade do
// COMMIT real por trás deste build.
//
// version.ts (APP_SEAL) já prova QUAL VERSÃO SEMÂNTICA está no ar, mas
// duas builds da MESMA versão semântica (dois commits reais sem bump de
// v15.0.0-GODTIER — o caso comum entre releases) mostrariam exatamente o
// mesmo selo: o Operador não teria como provar QUAL delas está de fato
// publicada. BUILD_COMMIT fecha essa lacuna — identidade única por commit
// real, nunca escrita à mão: injetada em tempo de build (vite.config.ts,
// via `git rev-parse HEAD` no momento exato do `vite build`), então dois
// commits reais nunca podem colidir no mesmo valor.
//
// Fail-closed: fora de um build real (dev sem git, ambiente sem .git),
// `__AR10_BUILD_COMMIT__` fica "unknown" — nunca um SHA fabricado.
declare const __AR10_BUILD_COMMIT__: string;

export const BUILD_COMMIT: string =
  typeof __AR10_BUILD_COMMIT__ === "string" && __AR10_BUILD_COMMIT__.length > 0
    ? __AR10_BUILD_COMMIT__
    : "unknown";

export const BUILD_COMMIT_SHORT: string = BUILD_COMMIT === "unknown" ? "unknown" : BUILD_COMMIT.slice(0, 12);
