# Aligera · Revisión y limpieza de la fototeca en iPhone

Encontrar qué ocupa espacio en una fototeca puede ser difícil, y borrar o comprimir archivos sin una vista previa puede dar lugar a sorpresas. Aligera es una aplicación nativa para iPhone pensada para ayudar a revisar vídeos grandes, fotos pesadas y duplicados desde una interfaz guiada.

La aplicación está construida con SwiftUI y usa las APIs de Apple para acceder a la fototeca, analizar elementos y preparar versiones comprimidas. El código separa el servicio de fototeca, la detección de duplicados, la compresión y las vistas. Para los duplicados combina una comparación exacta basada en características del archivo con una evaluación de similitud visual; la persona puede revisar los grupos antes de decidir qué conservar.

Una decisión importante es mostrar una previsualización de la compresión y evitar sustituir un archivo cuando el resultado no sea más pequeño. El flujo contempla guardar primero una copia comprimida y agrupar el borrado de originales tras una confirmación del sistema. La aplicación también comunica que los elementos eliminados pueden permanecer en “Eliminados recientemente”, por lo que recuperar espacio de inmediato requiere vaciar ese álbum.

El repositorio incluye guía de usuario y material de preparación de la ficha y capturas. La consulta oficial de Apple del 8 de octubre de 2026 confirma que Aligera está disponible en la App Store en la versión 2.0. La fecha inicial de lanzamiento registrada es el 15 de septiembre de 2026.

La publicación es un resultado verificable de distribución. No acredita por sí sola la calidad de la compresión, la recuperación de archivos ni un rendimiento determinado; esas propiedades requieren pruebas específicas. Este caso describe el código y el estado público comprobados, sin presentar objetivos pendientes como resultados medidos.

[Ver Aligera en la App Store](https://apps.apple.com/es/app/aligera/id6807391194)
