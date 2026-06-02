// Preload mínimo — Civilmar ERP usa Supabase directamente desde el renderer
// No se necesita exponer APIs de Node al renderer
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('civilmarApp', {
  platform: process.platform,
  version:  process.env.npm_package_version || '0.1.0',
})
