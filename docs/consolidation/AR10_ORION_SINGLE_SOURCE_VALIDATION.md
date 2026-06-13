# AR10 Orion Single Source Validation

Validation date: 2026-06-12

## Result

The GitHub repository is now the single-source candidate for AR10 Orion.

## Checks

- `python -m compileall src tests`: PASS
- `node --check src\ui_cockpit\assets\orion_cockpit.js`: PASS
- Smoke server on `http://127.0.0.1:8971/api/status`: PASS
- Execution scan: no enabled real/demo execution found.

## Smoke response

```json
{
  "service": "AR10 Orion Cockpit",
  "ok": true,
  "mode": "READ_ONLY",
  "shadow_assisted": true,
  "real_orders_enabled": false,
  "live_enabled": false,
  "demo_orders_enabled": false,
  "broker_actions": "blocked",
  "copy_secrets": false,
  "copy_large_databases": false,
  "fail_closed": true
}
```

## Execution boundary

- financial_execution: false
- trade_execution: false
- order_send: false
- authenticated_broker: false

## Quarantine

The previous GitHub/RAR state was moved to:

`C:\Users\mv\Documents\_AR10_LEGACY_SAFE_QUARANTINE\GITHUB_AR10_ORION_PRE_SINGLE_SOURCE_20260612_205053`

No old project was deleted permanently.
