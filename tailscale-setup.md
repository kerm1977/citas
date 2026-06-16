# Tailscale Funnel — Exposición pública del servidor

## ¿Qué es Tailscale Funnel?
Permite exponer el servidor Node.js local a Internet público sin necesidad de DNS ni firewall.

## Requisitos
- Cuenta en https://tailscale.com (gratuita)
- Tailscale instalado: https://tailscale.com/download
- Habilitar Funnel en tu cuenta: https://login.tailscale.com/admin/dns → Enable HTTPS

## Pasos

### 1. Instalar Tailscale (Windows)
```
winget install Tailscale.Tailscale
```

### 2. Autenticarse
```
tailscale up
```

### 3. Iniciar el servidor de la app
```
npm start
```
(corre en http://localhost:3000)

### 4. Exponer con Funnel
```
tailscale funnel 3000
```
Tailscale genera una URL pública tipo:
`https://<tu-maquina>.<tu-tailnet>.ts.net`

### 5. Acceder desde cualquier lugar
Comparte esa URL. Solo funciona mientras el servidor esté corriendo.

## Script de inicio rápido (PowerShell)
```powershell
Start-Process "tailscale" -ArgumentList "funnel 3000"
Start-Sleep 2
node C:\Users\MINIOS\CascadeProjects\chat-app\server.js
```

## Notas de seguridad
- El tráfico Tailscale Funnel usa HTTPS/TLS automático.
- Para producción permanente considera un VPS + Nginx + Let's Encrypt.
- Variables de entorno: copia `.env.example` a `.env` y personaliza las claves.
