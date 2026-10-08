# BaseSport · Plataforma digital para el deporte base

En muchos entornos de deporte base, la actividad de deportistas, clubes y profesionales se reparte entre canales y herramientas desconectados. BaseSport, un proyecto de un equipo fundador de tres personas en el que participo como cofundador y en desarrollo de producto, explora cómo reunir esa comunidad en una experiencia móvil: el proyecto combina una aplicación Flutter con servicios de backend y una web complementaria.

El producto contempla áreas como perfiles y acceso, publicaciones, notificaciones, chat, directorio de profesionales, perfiles de club y gamificación. En el código observado, la aplicación organiza estas áreas por funcionalidades y separa presentación, proveedores de estado y repositorios de datos. Flutter, Riverpod, GoRouter y Supabase conforman la base técnica.

Entre las decisiones que guían el desarrollo están encapsular las operaciones de datos en repositorios, centralizar errores y validaciones, y tratar el borrado de cuenta como un flujo con fases. El registro incorpora información de edad, una parte del producto que aún requiere validación antes de ampliar el acceso.

La documentación local registra que la beta interna llegó a TestFlight como Build 5 el 7 de octubre de 2026. Ese registro deja pendiente la prueba física final en dispositivo; esta presentación describe una beta interna, sin afirmar un lanzamiento público en App Store. Ese estado permite describirlo como una beta en validación, no como un servicio público ya consolidado. La siguiente etapa es contrastar los flujos principales con usuarios y completar las verificaciones pendientes antes de ampliar el acceso.
