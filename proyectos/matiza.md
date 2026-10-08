# Matiza · Prototipo de edición fotográfica con máscaras locales

Los ajustes globales de una fotografía no siempre bastan: a veces se quiere aclarar una zona, suavizar otra o trabajar solo sobre el cielo. Matiza es un prototipo de editor fotográfico para iOS que explora ese control local mediante máscaras, junto con herramientas de ajuste y exportación.

La aplicación usa SwiftUI para la interfaz, Core Image para componer ajustes y Metal para el motor de pincel. La separación aparece en módulos dedicados a máscaras, renderizado, modelo de edición y vistas. El diseño documentado conserva los trazos como fuente editable de una máscara y emplea una textura de trabajo como caché; así, pintar no obliga a mantener la imagen completa a resolución original como mapa de máscara.

El proyecto también investiga fuentes automáticas de máscara y filtros de refinado. Que una API del sistema participe en ese flujo no significa por sí solo que el prototipo incorpore un producto de IA terminado. El repositorio documenta una arquitectura y objetivos de calidad, no resultados de rendimiento verificados en esta revisión.

Matiza sigue en fase de prototipo. La documentación identifica trabajo pendiente, entre ello probar la importación RAW con archivos reales y medir el pincel en un dispositivo con herramientas de rendimiento. Por eso, el caso presenta decisiones y una dirección técnica, sin prometer velocidad, compatibilidad amplia ni calidad final. La siguiente etapa es cerrar esas pruebas, afinar la interacción y validar el flujo completo de edición y exportación en dispositivos reales.
