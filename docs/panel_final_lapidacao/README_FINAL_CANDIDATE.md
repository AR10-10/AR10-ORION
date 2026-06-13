# AR10 Orion Cockpit - Final Candidate

Generated: 2026-06-12 19:05 BRT

## Scope

This candidate keeps a single official application shell for `AR10 ORION COCKPIT`.

- official_shell_count: 1
- official_web_route_count: 1
- active_tab_count: 1
- tab_button_count: 6
- tab_page_count: 6
- vision_field_count: 1
- system_projector_count: 1
- duplicate_window_count: 0
- parallel_app_count: 0
- iframe_count: 0

## Runtime

- Local URL: `http://127.0.0.1:8970`
- Private tunnel: `https://often-badge-hygiene-oldest.trycloudflare.com`
- Mode: `READ_ONLY`
- Shadow assisted: `true`
- Real orders: `false`
- Demo orders: `false`
- Broker actions: `blocked`
- Fail closed: `true`

## Visual QA Evidence

- `runtime/orion_cockpit_luxury_v11_overview_final.png`
- `runtime/orion_cockpit_luxury_v11_market_final.png`
- `runtime/orion_cockpit_luxury_v11_ipad_landscape_final3.png`
- `runtime/orion_cockpit_luxury_v11_ipad_portrait_final.png`
- `runtime/orion_cockpit_projector_v10_overview.png`
- `runtime/orion_cockpit_projector_v10_ipad_landscape.png`
- `runtime/orion_cockpit_projector_v10_ipad_portrait.png`
- `runtime/orion_cockpit_vision_v8_overview.png`
- `runtime/orion_cockpit_vision_v8_ipad_landscape.png`
- `runtime/orion_cockpit_vision_v8_ipad_portrait.png`
- `runtime/orion_cockpit_final_tabs_v7_overview.png`
- `runtime/orion_cockpit_final_tabs_v7_market.png`
- `runtime/orion_cockpit_final_tabs_v7_micro.png`
- `runtime/orion_cockpit_final_tabs_v7_risk.png`
- `runtime/orion_cockpit_final_tabs_v7_memory.png`
- `runtime/orion_cockpit_final_tabs_v7_deep.png`
- `runtime/orion_cockpit_final_tabs_v7_ipad_landscape.png`
- `runtime/orion_cockpit_final_tabs_v7_ipad_portrait.png`
- `runtime/orion_cockpit_final_tabs_v7_market_ipad_landscape.png`

## Validation

- `node --check src\ui_cockpit\assets\orion_cockpit.js`: PASS
- `python -m compileall src tests`: PASS
- `curl http://127.0.0.1:8970/`: HTTP 200
- `curl https://often-badge-hygiene-oldest.trycloudflare.com/`: HTTP 200
- `curl https://often-badge-hygiene-oldest.trycloudflare.com/api/status`: READ_ONLY and blocked execution confirmed
- `rg "order_send\s*\(|mt5\.order_send\s*\(" src config tests`: no execution calls found
- Palette audit: PASS. Visual code uses only `#00FF9D`, `#FF3E52`, `#00F2FF`, `#FFB800`, `#000000`, and neutral alpha grayscale.
- Shell integrity: `official_shell_count=1`, `active_tab_count=1`, `active_page_count=1`, `duplicate_window_count=0`, `iframe_count=0`
- Visual capture engine: Microsoft Edge headless, no new package dependency installed

## Package

- Manifest: `MANIFESTO_SHA256_AR10_ORION_ECOSYSTEM.json`
- Final ZIP and SHA256 are recorded in the final operator handoff and can be rechecked with `Get-FileHash`.

## Notes

- The panel uses public/runtime data only.
- The `Cerebro Vivo` tab now includes the `Projetor do Sistema` blueprint layer with operational crown, adaptive behavior, core cognition, sensory roots, vector brain, circuit flow, and runtime telemetry.
- `luxury-v11` replaces the previous rough glass theme with a black absolute cockpit surface, 20px glass blur, one-pixel neutral borders, lower-brightness text, and four-color institutional status palette.
- Missing private L2, liquidation, authenticated broker, and execution data are displayed honestly as `INDISPONIVEL`, `SEM DADO`, `WARMUP`, `STALE`, or `REPORT BLOCKED`.
- External legacy project labels are sanitized in the UI to preserve Orion identity while retaining reuse provenance in the underlying reuse matrix.
- No promotion gate was crossed. This is the current final candidate package for human review.
