Iconos PWA / Apple (IronTrack)
================================

Archivos esperados en esta carpeta:
- icon-192.png   → 192×192 (Android / favicon pequeño)
- icon-512.png   → 512×512 (Android splash / instalación)
- apple-touch-icon.png → 180×180 recomendado (iOS; puede usarse 192×192)

Estado actual:
Los PNG presentes son copia provisional del master en assets/IronTrack-app-icon-1024.png
para que manifest e index.html resuelvan sin 404. Conviene reemplazarlos por exportaciones
exactas desde Figma / Asset Catalog (misma identidad visual, tamaños nativos, peso optimizado).

Tras reemplazar:
- npm run build
- Probar "Añadir a pantalla de inicio" en Android / iOS.
