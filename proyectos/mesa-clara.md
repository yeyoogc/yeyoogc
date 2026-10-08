# Mesa Clara · Reparto de cuentas con cálculo en céntimos

Mesa Clara es una app de iPhone para resolver un problema cotidiano: al compartir platos, repartir la cuenta a partes iguales puede hacer que alguien pague por consumos ajenos y que los céntimos no cuadren. La app permite añadir personas, desglosar el ticket por conceptos y marcar quién consumió cada uno. Presenta cuánto corresponde a cada persona y permite compartir el resultado desde iOS.

El cálculo usa céntimos enteros. Divide cada concepto entre sus consumidores y rota los céntimos sobrantes entre ellos. Un extra opcional, como propina o servicio, se reparte según el consumo asignado a cada persona; los céntimos residuales se entregan por orden de fracción mayor. El modelo de cálculo está separado en un módulo Swift Package y la interfaz está construida con SwiftUI.

La privacidad por diseño se aprecia en el código revisado: los datos de la cuenta viven en estado de la vista, no se guardan en una cuenta ni en almacenamiento persistente, y el reparto se comparte mediante la hoja del sistema. Esto describe el código inspeccionado, no constituye una auditoría exhaustiva ni una garantía absoluta.

Mesa Clara está publicada en la App Store. Apple muestra la versión 1.0.0 con fecha de lanzamiento del 4 de octubre de 2026, comprobada el 8 de octubre. El proyecto contiene cuatro pruebas unitarias y la documentación registra dos pruebas UI aprobadas; no se ejecutaron nuevas pruebas durante esta revisión.

[Ver Mesa Clara en la App Store](https://apps.apple.com/es/app/mesa-clara-divide-cuentas/id6818203298)
