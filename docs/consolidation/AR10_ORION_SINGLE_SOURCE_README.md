# AR10 Orion Single Source

This repository is now the intended single source for AR10 Orion.

## Canonical decision

- Final repository: `C:\Users\mv\Documents\GitHub\AR10-ORION`
- Functional base imported from: `C:\Users\mv\Documents\PROJETO_AR10_ORION\ar10_orion_ecosystem`
- Previous GitHub/RAR content moved to safe quarantine.
- Legacy projects remain mining sources only until selected modules are ported.

## Operating mode

- READ_ONLY: true
- SHADOW_ASSISTIDO: true
- real_orders_enabled: false
- live_enabled: false
- demo_orders_enabled: false
- order_send: false

## Mining sources

- `AR10_PRO`: guardrails, Price Truth, Shadow memory, Guardian, evidence discipline.
- `OMEGA/Mega`: premium UI, event bus, KAN/challenger ideas, signal governance, public context and share/export flows.
- `AR10_PRO_ARQUIVO_EXTERNO`: history, rollback reports and evidence.

## Never copy raw

- secrets
- broker credentials
- full sqlite databases
- logs
- caches
- `.venv`
- generated runtime artifacts

## Deletion gate

No old project should be deleted directly. The safe sequence is:

1. Port useful modules into this repo.
2. Validate local panel and iPad tunnel.
3. Generate SHA256 manifest and release zip.
4. Move old projects to `_AR10_LEGACY_SAFE_QUARANTINE`.
5. Delete permanently only after a separate human command.
