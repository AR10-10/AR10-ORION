# AR10 Orion Access and Desktop Operation

## Official root

`C:\Users\mv\Documents\GitHub\AR10-ORION`

This is the only active working root.

## Desktop shortcuts

Created on the Windows Desktop:

- `AR10 ORION - INICIAR CASA.lnk`
- `AR10 ORION - PARAR.lnk`
- `AR10 ORION - PAINEL LOCAL.url`
- `AR10 ORION - LINK IPAD.url`

## Start flow

The start shortcut runs:

`INICIAR_AR10_ORION_CASA.ps1`

It does the following:

1. Stops any older listener on `127.0.0.1:8970`.
2. Starts the AR10 Orion server from the GitHub root.
3. Starts `tools\cloudflared.exe`.
4. Saves the temporary tunnel URL to `runtime\TUNNEL_URL.txt`.
5. Updates `runtime\AR10_ORION_IPAD.url`.
6. Updates the Desktop link `AR10 ORION - LINK IPAD.url`.

## Current tested local endpoint

`http://127.0.0.1:8970/api/status`

Status:

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

## Current tested temporary tunnel

The active URL is written at runtime, not committed:

`runtime\TUNNEL_URL.txt`

Last validation in this setup returned:

- Panel HTTP status: `200`
- Title: `AR10 Orion Cockpit`
- `/api/status`: `READ_ONLY`

## Domain plan

The current link is a Cloudflare Quick Tunnel (`https://*.trycloudflare.com`).

When a domain is purchased, replace the temporary tunnel with a Cloudflare Named Tunnel and keep the local server at home on `127.0.0.1:8970`.

## Stop flow

Use:

`PARAR_AR10_ORION_CASA.ps1`

It stops the server PID, tunnel PID and any remaining listener on port `8970`.
