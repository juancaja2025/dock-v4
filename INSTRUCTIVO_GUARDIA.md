# Instructivo para Guardia — OCASA Dock Manager

Guía paso a paso para usar la aplicación desde la **cabina de garita**. Tu rol es registrar el ingreso y egreso de vehículos, entregar el QR al chofer y consultar el historial cuando lo necesites.

---

## 1. Acceso a la aplicación

1. Abrí el navegador en la computadora (o tablet) de la garita.
2. Ingresá a la URL de la app y agregá al final `/garita-registro`.
   - Ejemplo: `https://<dominio-ocasa>/garita-registro`
3. Vas a ver la pantalla **Acceso Garita** con el logo de OCASA.

### Login

- **Email**: tu usuario de garita (por ejemplo `guardia@ocasa.com`).
- **Contraseña**: la que te entregó el responsable.
- Tocá **Ingresar** (o presioná Enter).

Si las credenciales son correctas, arriba a la izquierda vas a ver tu nombre con el ícono 🛡️. Si hay error, aparece un cartel rojo por unos segundos — revisá email/contraseña.

---

## 2. Panel principal

Una vez dentro, la pantalla se divide en:

- **Encabezado**: logo, título "Registro de Garita" y tu nombre de guardia.
- **KPIs** (tres tarjetas superiores):
  - **En predio**: cuántos vehículos hay adentro ahora.
  - **Ingresos hoy**: cuántos registraste en el día.
  - **Egresos hoy**: cuántos salieron en el día.
- **Pestañas**: `Ingreso`, `Egreso`, `Historial`.

Los KPIs se actualizan automáticamente cada 10 segundos, así que no hace falta recargar.

---

## 3. Registrar un INGRESO

Esta es la operación más frecuente. Estás en la pestaña **Ingreso**.

### Paso 1 — Patente del tractor

1. Pedile al chofer la **patente del tractor** (camión).
2. Cargala en el campo **PATENTE TRACTOR**. Se escribe en mayúsculas automáticamente.
3. Cuando salgas del campo (Tab o clic afuera), la app hace dos búsquedas automáticas:
   - **Verifica duplicados**: si esa patente ya está en predio.
   - **Busca viajes programados para hoy** en la planilla de viajes.

### Paso 2 — Interpretar el cartel que aparece

Según el resultado de la búsqueda, vas a ver uno de estos carteles:

| Cartel | Qué significa | Qué hacer |
|---|---|---|
| 🔵 "Vehículo ya registrado por el chofer" | El chofer se pre-registró desde su celular | La app completa lo que ya cargó. Solo completá los datos faltantes de garita |
| 🔴 "Vehículo ya registrado en predio por garita" | La patente está adentro sin haber salido | **No registres de nuevo.** Primero hay que darle egreso |
| 🟢 "✅ X viaje(s) encontrado(s) para hoy — Nave: PLX" | Hay viajes programados para esa patente | La app autocompleta transportista y nave. Verificá con el chofer |
| 🟡 "Sin viajes programados para hoy" | No hay coincidencias en la planilla | Completá todos los campos a mano |

Si hay **varios viajes**, aparece una lista abajo con cada viaje y su nave. Confirmá con el chofer a cuál corresponde.

### Paso 3 — Completar los datos del ingreso

Campos **obligatorios** (marcados con `*`):

- **PATENTE TRACTOR** — ya cargada.
- **TRANSPORTISTA** — escribí para filtrar la lista; tocá el que corresponde. Si no está, elegí "Otros".
- **NOMBRE Y APELLIDO DEL CHOFER** — nombre completo.
- **ENTRA VACÍO O CON CARGA** — elegí "Vacío" o "Con carga" en el desplegable.

Campos **opcionales pero recomendados**:

- **DNI CHOFER** y **CELULAR** — útiles para contactarlo.
- **PATENTE SEMI** — patente del acoplado/semi.
- **N° CONTENEDOR** y **PRECINTO** — si viene contenedor.
- **NAVE** — `PL2` o `PL3` (o "Sin asignar" si no sabés todavía).
- **VIAJE HDR** — número de viaje (si lo trae el chofer o lo trajo la búsqueda automática).
- **OBSERVACIONES DE INGRESO** — cualquier nota (faltante de documentación, demora, etc.).

### Paso 4 — Confirmar y entregar el QR

1. Tocá **Registrar Ingreso**. El botón pasa a "⏳ Procesando...".
2. Si hay un dato obligatorio faltante, aparece un cartel rojo indicando cuál completar.
3. Si todo está OK, se abre automáticamente una **ventana con un código QR**.

#### Qué hacer con el QR

- **Mostrale el QR al chofer** para que lo escanee con la cámara de su celular.
- Al escanearlo, el chofer podrá seguir en vivo el estado de su turno (espera, dársena asignada, atracado, etc.) sin volver a preguntarte.
- Si el chofer no puede escanear, tocá **Imprimir QR** — se abre el diálogo de impresión.
- Cuando termina, tocá **Registrar otro ingreso** para cerrar la ventana y dejar el cursor listo para la siguiente patente.

El formulario queda **limpio automáticamente** después de cada registro.

---

## 4. Registrar un EGRESO

Cuando el chofer viene a retirarse del predio, pasá a la pestaña **Egreso**.

### Paso 1 — Buscar la patente

1. Ingresá la **patente del tractor** que sale.
2. Tocá **Buscar** (o presioná Enter).

### Paso 2 — Revisar la ficha que aparece

Si la patente está en predio, se muestra:

- Patente, transportista, chofer.
- **Tiempo en predio** (ej: "2h 15m").
- Estado actual del turno.
- Hora de ingreso.

### ⚠️ Alerta de TACOS DE GOMA

Si el vehículo recibió tacos de goma y **no los devolvió**, aparece un cartel rojo destacado:

> ⚠️ ATENCIÓN: El chofer debe devolver los TACOS DE GOMA antes de salir del predio.

**No autorices la salida** hasta que el chofer entregue los tacos. Una vez devueltos, el sistema deja de mostrar la alerta.

### Paso 3 — Observaciones y confirmar

1. Si hay algo a anotar (demora, incidente, faltante), cargalo en **OBSERVACIONES DE EGRESO**.
2. Tocá **Confirmar Egreso**.
3. Aparece un mensaje verde abajo con la patente y el tiempo total en predio. El formulario se limpia para el próximo egreso.

Si la patente **no aparece**, el cartel dice "No se encontró vehículo activo con patente XXX". Verificá que la patente esté bien escrita o consultá si ya egresó.

---

## 5. Consultar el HISTORIAL

Pestaña **Historial** — útil para buscar un registro pasado o auditar el día.

- Arriba hay tres botones de rango: **Hoy**, **7 días**, **30 días**. Por defecto muestra 7 días.
- Debajo, un buscador por patente (filtra en vivo).
- La tabla muestra: Fecha, Patente, Semi, Chofer, Empresa, Nave, Estado, Observaciones.
- **Tocá una fila** para ver el detalle completo del turno:
  - Datos del chofer (DNI, celular), contenedor, precinto.
  - **Línea de tiempo** del turno: ingreso → asignación de dársena → atracado → desatracado → egreso.
  - Observaciones de ingreso y egreso.

---

## 6. Recomendaciones y buenas prácticas

1. **Siempre esperá el cartel** después de cargar la patente antes de seguir — te evita duplicar registros o pasar por alto un viaje programado.
2. **No cierres la sesión** mientras haya movimiento; los KPIs se actualizan solos.
3. **Si el chofer ya se pre-registró** (cartel azul), no cambies los datos que él cargó salvo que estén mal. Solo completá lo que falte.
4. **Controlá la alerta de tacos** en cada egreso. Es una protección para el predio.
5. **Usá las observaciones** para dejar constancia de cualquier anomalía (documentación faltante, demoras, daños observados). Queda registrado en el historial.
6. **Problemas comunes**:
   - *"Error de conexión"*: verificá internet y reintentá. El dato no se pierde; volvés a tocar el botón.
   - *Botón bloqueado en "⏳ Procesando..."*: esperá unos segundos; si queda trabado, recargá la página y volvé a cargar.
   - *No encuentra la patente para egresar*: revisá guiones/espacios; la búsqueda respeta el formato exacto que se cargó al ingreso.

---

## 7. Resumen de tu flujo diario

```
LOGIN  →  INGRESO (patente → autocheck → datos → QR al chofer)
                                                        │
                                                        ▼
                                     (el chofer circula por el predio)
                                                        │
                                                        ▼
           EGRESO (buscar patente → verificar tacos → confirmar)
                                                        │
                                                        ▼
                        HISTORIAL (consulta/auditoría cuando haga falta)
```

Cualquier duda con la app, avisá al responsable de OCASA. Gracias por tu trabajo en garita. 🛡️
