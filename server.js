const express = require('express');
const { Pool } = require('pg');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/public', express.static(path.join(__dirname, 'public')));

// ===================== BASE DE DATOS POSTGRESQL =====================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/dock',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  allowExitOnIdle: true
});

pool.on('error', (err) => {
  console.error('⚠️ DB pool error — conexión eliminada:', err.message);
});

// Helper: ejecuta queries dentro de una transacción explícita
async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Inicializar tabla
async function initDB() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS turnos (
        id SERIAL PRIMARY KEY,
        turno_id VARCHAR(20) UNIQUE NOT NULL,
        truck VARCHAR(20) NOT NULL,
        carrier VARCHAR(100) DEFAULT 'Por asignar',
        type VARCHAR(20) DEFAULT 'INBOUND',
        warehouse VARCHAR(50) DEFAULT '',
        dock VARCHAR(10) DEFAULT '',
        status VARCHAR(30) DEFAULT 'ESPERANDO_ASIGNACION',
        ts_entrada TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ts_asignacion TIMESTAMP,
        ts_atracado TIMESTAMP,
        ts_desatracado TIMESTAMP,
        ts_egreso TIMESTAMP
      )
    `);
    console.log('✅ Base de datos inicializada');
  } catch (err) {
    console.error('❌ Error inicializando DB:', err);
  }
}

initDB();

// ===================== COLORES OCASA (Manual de marca) =====================
const colors = {
  primary: '#0099A8',      // CALYPSO - color central
  primaryDark: '#056572',  // Teal oscuro - secundario (max 5%)
  primaryLight: 'rgba(0,153,168,0.08)',
  primaryMedium: 'rgba(0,153,168,0.15)',
  green: '#8fbf4c',        // Verde - secundario (max 5%)
  orange: '#ffab40',       // Naranja - secundario (max 5%)
  light: '#efefef',        // Gris claro
  dark: '#1a1a2e',
  darkBlue: '#16213e',
  white: '#ffffff',
  black: '#000000',
  // Tema claro (alineado a manual: CALYPSO + blanco + negro)
  bg: '#f5f7fa',
  bgCard: '#ffffff',
  bgCardHover: '#f0f9fa',
  textPrimary: '#1a1a2e',
  textSecondary: '#5a6478',
  textMuted: '#8c95a6',
  border: '#e2e8f0',
  borderLight: '#f0f0f0',
  shadow: 'rgba(0,0,0,0.06)',
  shadowHover: 'rgba(0,153,168,0.12)',
};

// ===================== LOGO BASE64 =====================
const fs = require('fs');
let logoSrc = '';
try {
  const logoPath = path.join(__dirname, 'public', 'logo.png');
  const logoBuffer = fs.readFileSync(logoPath);
  logoSrc = 'data:image/png;base64,' + logoBuffer.toString('base64');
} catch(e) {
  console.log('Logo no encontrado, usando texto');
  logoSrc = '';
}

// ===================== ESTILOS CSS COMPARTIDOS =====================
// Google Fonts link para incluir en cada página
const fontLink = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">';

const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: ${colors.bg};
    min-height: 100vh;
    color: ${colors.textPrimary};
  }
  .container { max-width: 500px; margin: 0 auto; padding: 20px; }
  .container-wide { max-width: 960px; margin: 0 auto; padding: 20px; }
  .logo { height: 40px; margin-bottom: 16px; }
  .logo-large { height: 60px; margin-bottom: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; color: ${colors.textPrimary}; font-weight: 700; }
  h2 { font-size: 20px; margin-bottom: 12px; color: ${colors.textPrimary}; font-weight: 600; }
  .subtitle { color: ${colors.textSecondary}; margin-bottom: 24px; }
  .card {
    background: ${colors.bgCard};
    border-radius: 16px;
    padding: 20px;
    margin-bottom: 16px;
    border: 1px solid ${colors.border};
    box-shadow: 0 1px 3px ${colors.shadow};
  }
  .btn {
    display: block; width: 100%; padding: 16px; border: none; border-radius: 12px;
    font-family: 'Montserrat', sans-serif;
    font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 12px;
    transition: transform 0.2s, box-shadow 0.2s;
    text-decoration: none; text-align: center;
  }
  .btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px ${colors.shadowHover}; }
  .btn:active { transform: translateY(0); }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
  .btn-primary { background: ${colors.primary}; color: white; }
  .btn-primary:hover { background: ${colors.primaryDark}; }
  .btn-green { background: ${colors.green}; color: white; }
  .btn-orange { background: ${colors.orange}; color: ${colors.textPrimary}; }
  input, select {
    width: 100%; padding: 16px; border: 2px solid ${colors.border};
    border-radius: 12px; font-size: 16px; font-family: 'Montserrat', sans-serif;
    background: ${colors.bgCard};
    color: ${colors.textPrimary}; margin-bottom: 8px; min-height: 52px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  input::placeholder { color: ${colors.textMuted}; }
  input:focus, select:focus { outline: none; border-color: ${colors.primary}; box-shadow: 0 0 0 3px rgba(0,153,168,0.12); }
  select option { background: ${colors.bgCard}; color: ${colors.textPrimary}; padding: 12px; font-size: 16px; }
  select option:disabled { color: ${colors.textMuted}; }
  .error { background: #fef2f2; color: #dc2626; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #fecaca; font-weight: 500; }
  .success { background: #f0fdf4; color: #16a34a; padding: 12px; border-radius: 8px; margin-bottom: 16px; border: 1px solid #bbf7d0; font-weight: 500; }
  .icon-circle {
    width: 80px; height: 80px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 40px; margin: 0 auto 16px;
  }
  .icon-primary { background: ${colors.primaryLight}; }
  .icon-green { background: rgba(143,191,76,0.12); }
  .icon-orange { background: rgba(255,171,64,0.12); }
  .badge {
    display: inline-block; padding: 4px 12px; border-radius: 20px;
    font-size: 11px; font-weight: 600; margin-left: 8px; letter-spacing: 0.3px;
  }
  .badge-yellow { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .badge-primary { background: rgba(0,153,168,0.08); color: ${colors.primary}; border: 1px solid rgba(0,153,168,0.2); }
  .badge-green { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .badge-orange { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .badge-dark { background: ${colors.light}; color: ${colors.textSecondary}; border: 1px solid ${colors.border}; }
  .turno-card {
    background: ${colors.bgCard}; border-radius: 12px;
    padding: 16px; margin-bottom: 12px;
    display: flex; justify-content: space-between; align-items: center;
    cursor: pointer; transition: all 0.2s;
    border: 1px solid ${colors.border};
    box-shadow: 0 1px 2px ${colors.shadow};
  }
  .turno-card:hover { border-color: ${colors.primary}; box-shadow: 0 2px 8px ${colors.shadowHover}; background: ${colors.bgCardHover}; }
  .turno-info h3 { font-size: 16px; margin-bottom: 4px; font-weight: 600; }
  .turno-info p { color: ${colors.textSecondary}; font-size: 13px; }
  .turno-meta { text-align: right; }
  .turno-meta .time { color: ${colors.textMuted}; font-size: 13px; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .kpi {
    background: ${colors.bgCard}; border-radius: 12px; padding: 20px; text-align: center;
    border: 1px solid ${colors.border}; box-shadow: 0 1px 2px ${colors.shadow};
  }
  .kpi-value { font-size: 36px; font-weight: 700; color: ${colors.primary}; }
  .kpi-label { color: ${colors.textMuted}; font-size: 13px; margin-top: 4px; font-weight: 500; }
  .dock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 8px; margin-top: 16px; }
  .dock {
    padding: 12px 8px; border-radius: 8px; text-align: center;
    font-weight: 600; font-size: 14px;
  }
  .dock-free { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
  .dock-occupied { background: #fffbeb; color: #d97706; border: 1px solid #fde68a; }
  .warehouse { margin-bottom: 24px; }
  .warehouse h3 { margin-bottom: 12px; color: ${colors.textSecondary}; font-weight: 600; }
  .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .tab {
    flex: 1; padding: 12px; border-radius: 8px; border: 2px solid ${colors.border};
    background: ${colors.bgCard}; color: ${colors.textSecondary}; cursor: pointer;
    font-family: 'Montserrat', sans-serif; font-weight: 600; transition: all 0.2s;
  }
  .tab:hover { border-color: ${colors.primary}; color: ${colors.primary}; }
  .tab.active { background: ${colors.primary}; color: white; border-color: ${colors.primary}; }
  .timeline { margin-top: 20px; }
  .timeline-item {
    display: flex; align-items: center; padding: 16px 0;
    border-left: 2px solid ${colors.border};
    margin-left: 12px; padding-left: 24px; position: relative;
  }
  .timeline-item::before {
    content: ''; position: absolute; left: -7px; width: 12px; height: 12px;
    border-radius: 50%; background: ${colors.border};
  }
  .timeline-item.done::before { background: ${colors.primary}; }
  .timeline-item.current::before { background: ${colors.primary}; box-shadow: 0 0 0 4px rgba(0,153,168,0.2); }
  .timeline-time { color: ${colors.textMuted}; font-size: 13px; width: 100px; font-weight: 500; }
  .timeline-text { flex: 1; font-weight: 500; }
  .modal-overlay {
    display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 1000; backdrop-filter: blur(4px);
    justify-content: center; align-items: center; padding: 20px;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: ${colors.bgCard}; border-radius: 16px; padding: 24px;
    max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;
    border: 1px solid ${colors.border}; box-shadow: 0 20px 60px rgba(0,0,0,0.15);
  }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .modal-close {
    background: ${colors.light}; border: none; color: ${colors.textSecondary}; font-size: 20px;
    cursor: pointer; padding: 4px 10px; border-radius: 8px; transition: background 0.2s;
  }
  .modal-close:hover { background: ${colors.border}; color: ${colors.textPrimary}; }
  .header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 24px; padding-bottom: 16px;
    border-bottom: 1px solid ${colors.border};
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .assign-row { display: flex; gap: 8px; margin-top: 12px; align-items: stretch; }
  .assign-row select {
    flex: 2; margin: 0; padding: 16px; font-size: 16px; font-weight: 600;
    min-height: 56px; min-width: 0;
  }
  .assign-row button { flex: 1; margin: 0; padding: 16px 12px; min-height: 56px; font-size: 14px; white-space: nowrap; }
  .refresh-notice {
    text-align: center; color: ${colors.textMuted}; font-size: 13px;
    margin-top: 20px;
  }
  .toast { position: fixed; top: 20px; right: 20px; padding: 14px 20px; border-radius: 10px; font-weight: 500; font-size: 14px; z-index: 2000; transform: translateY(-20px); opacity: 0; transition: all 0.3s; pointer-events: none; }
  .toast.show { transform: translateY(0); opacity: 1; }
  .toast-success { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .toast-error { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
  .time-badge { font-size: 11px; color: ${colors.textMuted}; font-weight: 500; white-space: nowrap; }
  .time-badge.warning { color: #d97706; }
  .time-badge.danger { color: #dc2626; font-weight: 600; }

  /* Dashboard KPIs */
  .nav-tab-dashboard { background: rgba(0,153,168,0.06); border-color: ${colors.primary}; color: ${colors.primary}; }
  .nav-tab-dashboard.active { background: ${colors.primaryDark}; color: white; border-color: ${colors.primaryDark}; }
  .date-range-bar { display: flex; gap: 8px; margin-bottom: 20px; align-items: center; flex-wrap: wrap; }
  .range-btn {
    padding: 8px 16px; border: 1px solid ${colors.border}; border-radius: 8px;
    background: ${colors.bgCard}; color: ${colors.textSecondary}; font-family: 'Montserrat', sans-serif;
    font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;
  }
  .range-btn:hover { border-color: ${colors.primary}; color: ${colors.primary}; }
  .range-btn.active { background: ${colors.primary}; color: white; border-color: ${colors.primary}; }
  .dash-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
  .dash-section {
    background: ${colors.bgCard}; border-radius: 12px; padding: 20px;
    border: 1px solid ${colors.border}; box-shadow: 0 1px 2px ${colors.shadow};
  }
  .dash-section h3 { font-size: 14px; color: ${colors.textSecondary}; margin: 0 0 16px 0; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
  .dash-full { grid-column: 1 / -1; }
  .bar-row { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .bar-label { width: 100px; font-size: 12px; color: ${colors.textSecondary}; text-align: right; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .bar-track { flex: 1; height: 24px; background: ${colors.light}; border-radius: 6px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 6px; transition: width 0.4s ease; min-width: 2px; }
  .bar-fill-primary { background: ${colors.primary}; }
  .bar-fill-green { background: ${colors.green}; }
  .bar-fill-orange { background: ${colors.orange}; }
  .bar-value { width: 50px; font-size: 12px; font-weight: 600; color: ${colors.textPrimary}; }
  .hour-chart { display: flex; align-items: flex-end; gap: 2px; height: 120px; padding-top: 8px; }
  .hour-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .hour-bar { width: 100%; background: ${colors.primary}; border-radius: 3px 3px 0 0; transition: height 0.4s ease; min-width: 6px; cursor: pointer; position: relative; }
  .hour-bar:hover { background: ${colors.primaryDark}; }
  .hour-label { font-size: 9px; text-align: center; color: ${colors.textMuted}; margin-top: 4px; }
  .hour-bar-tooltip { display: none; position: absolute; top: -24px; left: 50%; transform: translateX(-50%); background: ${colors.dark}; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
  .hour-bar:hover .hour-bar-tooltip { display: block; }
  .trend-chart { display: flex; align-items: flex-end; gap: 3px; height: 120px; padding-top: 8px; }
  .trend-bar-wrap { flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end; }
  .trend-bar { width: 100%; background: ${colors.primary}; border-radius: 3px 3px 0 0; transition: height 0.4s ease; cursor: pointer; position: relative; }
  .trend-bar:hover { background: ${colors.primaryDark}; }
  .trend-label { font-size: 8px; text-align: center; color: ${colors.textMuted}; margin-top: 4px; }
  .trend-bar-tooltip { display: none; position: absolute; top: -24px; left: 50%; transform: translateX(-50%); background: ${colors.dark}; color: white; font-size: 11px; padding: 2px 6px; border-radius: 4px; white-space: nowrap; }
  .trend-bar:hover .trend-bar-tooltip { display: block; }
  .kpi-subtitle { font-size: 11px; color: ${colors.textMuted}; margin-top: 2px; }
  .dash-empty { text-align: center; padding: 40px 20px; color: ${colors.textMuted}; font-size: 14px; }

  @media (max-width: 600px) {
    .grid-2 { grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .kpi { padding: 14px; }
    .kpi-value { font-size: 28px; }
    .container-wide { padding: 12px; }
    .dash-grid { grid-template-columns: 1fr; }
    .bar-label { width: 70px; }
    .hour-chart, .trend-chart { height: 80px; }
  }
`;

// ===================== FUNCIONES HELPER =====================
async function generarId() {
  const result = await pool.query("SELECT turno_id FROM turnos ORDER BY id DESC LIMIT 1");
  if (result.rows.length === 0) {
    return 'TRN-0001';
  }
  const lastId = result.rows[0].turno_id;
  const num = parseInt(lastId.split('-')[1]) + 1;
  return 'TRN-' + String(num).padStart(4, '0');
}

function formatTime(date) {
  if (!date) return '--:--';
  return new Date(date).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(date) {
  if (!date) return '--:--';
  return new Date(date).toLocaleString('es-AR', { 
    day: '2-digit', month: '2-digit', 
    hour: '2-digit', minute: '2-digit' 
  });
}

// ===================== RUTAS API =====================

// Registrar entrada
app.post('/api/entrada', async (req, res) => {
  const { truck, carrier, tripNumber, warehouse, operation } = req.body;
  if (!truck) return res.json({ success: false, error: 'Patente requerida' });
  if (!carrier) return res.json({ success: false, error: 'Seleccioná un transportista' });
  if (!warehouse) return res.json({ success: false, error: 'Seleccioná la nave' });
  if (!operation) return res.json({ success: false, error: 'Seleccioná el tipo de operación' });
  
  try {
    // Buscar turno activo existente con mismo truck + trip_number
    const existing = await pool.query(
      "SELECT * FROM turnos WHERE truck = $1 AND (trip_number = $2 OR (trip_number IS NULL AND $2 IS NULL)) AND status != 'EGRESADO'",
      [truck.toUpperCase(), tripNumber || null]
    );

    if (existing.rows.length > 0) {
      return res.json({ success: true, id: existing.rows[0].turno_id, existing: true });
    }
    
    // Crear nuevo turno
    const turnoId = await generarId();
    await pool.query(
      `INSERT INTO turnos (turno_id, truck, carrier, trip_number, warehouse, operation, type, status, ts_entrada) 
       VALUES ($1, $2, $3, $4, $5, $6, 'INBOUND', 'ESPERANDO_ASIGNACION', CURRENT_TIMESTAMP)`,
      [turnoId, truck.toUpperCase(), carrier, tripNumber || null, warehouse, operation]
    );
    
    res.json({ success: true, id: turnoId, existing: false });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Registrar múltiples viajes para la misma patente
app.post('/api/entrada-multiple', async (req, res) => {
  const { truck, carrier, operation, trips } = req.body;
  if (!truck) return res.json({ success: false, error: 'Patente requerida' });
  if (!carrier) return res.json({ success: false, error: 'Seleccioná un transportista' });
  if (!operation) return res.json({ success: false, error: 'Seleccioná el tipo de operación' });
  if (!trips || !Array.isArray(trips) || trips.length === 0) {
    return res.json({ success: false, error: 'No hay viajes para registrar' });
  }

  try {
    const created = [];
    const skipped = [];

    for (const trip of trips) {
      const tripNumber = trip.tripNumber || null;
      const warehouse = trip.warehouse || '';

      // Verificar si ya existe turno con mismo truck + trip_number
      const existing = await pool.query(
        "SELECT turno_id FROM turnos WHERE truck = $1 AND trip_number = $2 AND status != 'EGRESADO'",
        [truck.toUpperCase(), tripNumber]
      );

      if (existing.rows.length > 0) {
        skipped.push({ turnoId: existing.rows[0].turno_id, tripNumber });
        continue;
      }

      const turnoId = await generarId();
      await pool.query(
        `INSERT INTO turnos (turno_id, truck, carrier, trip_number, warehouse, operation, type, status, ts_entrada)
         VALUES ($1, $2, $3, $4, $5, $6, 'INBOUND', 'ESPERANDO_ASIGNACION', CURRENT_TIMESTAMP)`,
        [turnoId, truck.toUpperCase(), carrier, tripNumber, warehouse, operation]
      );
      created.push(turnoId);
    }

    const firstId = created.length > 0 ? created[0] : (skipped.length > 0 ? skipped[0].turnoId : null);
    res.json({ success: true, created, skipped, firstId, patente: truck.toUpperCase() });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Obtener turnos activos por patente
app.get('/api/turnos-by-patente/:patente', async (req, res) => {
  try {
    const patente = (req.params.patente || '').toUpperCase().replace(/[-\s]/g, '');
    const result = await pool.query(
      "SELECT * FROM turnos WHERE truck = $1 AND status != 'EGRESADO' ORDER BY ts_entrada DESC",
      [patente]
    );
    res.json({ success: true, turnos: result.rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: err.message });
  }
});

// Obtener turno por ID
app.get('/api/turno/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM turnos WHERE turno_id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.json({ success: false, error: 'Turno no encontrado' });
    }
    res.json({ success: true, turno: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Obtener todos los turnos
app.get('/api/turnos', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM turnos ORDER BY ts_entrada DESC');
    res.json({ success: true, turnos: result.rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Asignar dársena
app.post('/api/asignar', async (req, res) => {
  const { turnoId, dock, warehouse } = req.body;

  try {
    const result = await withTransaction(async (client) => {
      const turno = await client.query('SELECT * FROM turnos WHERE turno_id = $1 FOR UPDATE', [turnoId]);
      if (turno.rows.length === 0) {
        return { success: false, error: 'Turno no encontrado' };
      }

      const t = turno.rows[0];

      // Idempotente: si ya está asignado a la misma dársena, éxito (evita error por doble-click)
      if (t.status === 'DARSENA_ASIGNADA' && t.dock === dock) {
        return { success: true };
      }

      if (t.status !== 'ESPERANDO_ASIGNACION') {
        return { success: false, error: 'El turno ya tiene dársena asignada (' + t.dock + '). Refrescá la pantalla.' };
      }

      // Verificar que el dock no esté ocupado
      const dockCheck = await client.query(
        "SELECT truck FROM turnos WHERE dock = $1 AND status NOT IN ('EGRESADO', 'DESATRACADO') AND turno_id != $2",
        [dock, turnoId]
      );
      if (dockCheck.rows.length > 0) {
        return { success: false, error: 'Esa dársena ya está ocupada por ' + dockCheck.rows[0].truck };
      }

      await client.query(
        `UPDATE turnos SET dock = $1, warehouse = $2, status = 'DARSENA_ASIGNADA', ts_asignacion = CURRENT_TIMESTAMP
         WHERE turno_id = $3`,
        [dock, warehouse, turnoId]
      );

      return { success: true };
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/asignar:', err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Reasignar dársena (después de desatracar)
app.post('/api/reasignar', async (req, res) => {
  const { turnoId, dock, warehouse } = req.body;
  try {
    const result = await withTransaction(async (client) => {
      const dockCheck = await client.query(
        "SELECT truck FROM turnos WHERE dock = $1 AND status NOT IN ('EGRESADO', 'DESATRACADO')",
        [dock]
      );
      if (dockCheck.rows.length > 0) {
        return { success: false, error: 'Esa dársena ya está ocupada por ' + dockCheck.rows[0].truck };
      }

      await client.query(
        `UPDATE turnos SET dock = $1, warehouse = $2, status = 'DARSENA_ASIGNADA', ts_asignacion = CURRENT_TIMESTAMP, ts_atracado = NULL, ts_desatracado = NULL WHERE turno_id = $3`,
        [dock, warehouse, turnoId]
      );
      return { success: true };
    });

    res.json(result);
  } catch(e) {
    console.error('Error en /api/reasignar:', e);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Atraque automático (escanear QR de dársena)
app.post('/api/dock/:dockId', async (req, res) => {
  const dockId = req.params.dockId;

  try {
    const result = await withTransaction(async (client) => {
      const turno = await client.query(
        "SELECT * FROM turnos WHERE dock = $1 AND status NOT IN ('EGRESADO', 'DESATRACADO') FOR UPDATE",
        [dockId]
      );

      if (turno.rows.length === 0) {
        return { success: false, error: 'No hay ningún camión asignado a esta dársena' };
      }

      const t = turno.rows[0];

      if (t.status === 'DARSENA_ASIGNADA') {
        await client.query(
          "UPDATE turnos SET status = 'ATRACADO', ts_atracado = CURRENT_TIMESTAMP WHERE turno_id = $1",
          [t.turno_id]
        );
        return { success: true, action: 'atracado', truck: t.truck };
      } else if (t.status === 'ATRACADO') {
        await client.query(
          "UPDATE turnos SET status = 'DESATRACADO', dock = '', ts_desatracado = CURRENT_TIMESTAMP WHERE turno_id = $1",
          [t.turno_id]
        );
        // Buscar turno hermano con dársena asignada (flujo multi-nave)
        let nextDock = null;
        const siblings = await client.query(
          "SELECT * FROM turnos WHERE truck = $1 AND turno_id != $2 AND status IN ('DARSENA_ASIGNADA', 'ESPERANDO_ASIGNACION') ORDER BY status ASC LIMIT 1",
          [t.truck, t.turno_id]
        );
        if (siblings.rows.length > 0) {
          const s = siblings.rows[0];
          nextDock = { dock: s.dock || null, warehouse: s.warehouse, tripNumber: s.trip_number, turnoId: s.turno_id };
        }
        return { success: true, action: 'desatracado', truck: t.truck, nextDock };
      } else {
        return { success: false, error: 'Estado no válido: ' + t.status };
      }
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/dock:', err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Registrar salida
app.post('/api/salida', async (req, res) => {
  const { truck } = req.body;

  try {
    const result = await withTransaction(async (client) => {
      const turno = await client.query(
        "SELECT * FROM turnos WHERE truck = $1 AND status = 'DESATRACADO' FOR UPDATE",
        [truck.toUpperCase()]
      );

      if (turno.rows.length === 0) {
        return { success: false, error: 'No se encontró un turno desatracado para esa patente' };
      }

      await client.query(
        "UPDATE turnos SET status = 'EGRESADO', ts_egreso = CURRENT_TIMESTAMP WHERE turno_id = $1",
        [turno.rows[0].turno_id]
      );

      return { success: true, turno: turno.rows[0] };
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/salida:', err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// ===================== API GARITA: LOGIN =====================
app.post('/api/garita/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.json({ success: false, error: 'Email y contraseña requeridos' });
    const result = await pool.query(
      'SELECT nombre, email FROM garita_usuarios WHERE email=$1 AND password=$2 AND activo=true',
      [email.trim().toLowerCase(), password]
    );
    if (result.rows.length === 0) return res.json({ success: false, error: 'Credenciales inválidas' });
    res.json({ success: true, nombre: result.rows[0].nombre, email: result.rows[0].email });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// ===================== API GARITA: CHECK DUPLICADO =====================
app.get('/api/garita/check-duplicado/:patente', async (req, res) => {
  try {
    const patente = req.params.patente.toUpperCase().trim();
    const result = await pool.query(
      "SELECT * FROM turnos WHERE UPPER(truck)=$1 AND status != 'EGRESADO' ORDER BY ts_entrada DESC",
      [patente]
    );
    if (result.rows.length === 0) return res.json({ exists: false });
    res.json({
      exists: true,
      turnos: result.rows,
      registrado_por: result.rows[0].registrado_por || 'driver'
    });
  } catch (err) {
    console.error(err);
    res.json({ exists: false, error: 'Error de base de datos' });
  }
});

// ===================== API GARITA: ENTRADA =====================
app.post('/api/garita/entrada', async (req, res) => {
  try {
    const { truck, carrier, chofer, dni_chofer, celular_chofer, patente_semi,
            contenedor, precinto, warehouse, obs_ingreso, viaje_hdr, carga_estado } = req.body;

    if (!truck || !carrier || !chofer) {
      return res.json({ success: false, error: 'Patente, transportista y chofer son requeridos' });
    }

    const patenteUpper = truck.toUpperCase().trim();

    const result = await withTransaction(async (client) => {
      // Check duplicado
      const existing = await client.query(
        "SELECT * FROM turnos WHERE UPPER(truck)=$1 AND status != 'EGRESADO' ORDER BY ts_entrada DESC LIMIT 1",
        [patenteUpper]
      );

      if (existing.rows.length > 0) {
        const turno = existing.rows[0];
        if ((turno.registrado_por || 'driver') === 'driver') {
          await client.query(
            `UPDATE turnos SET chofer=$1, dni_chofer=$2, celular_chofer=$3, patente_semi=$4,
             contenedor=$5, precinto=$6, obs_ingreso=$7, registrado_por='guardia', carga_estado=$9
             WHERE id=$8`,
            [chofer, dni_chofer || null, celular_chofer || null, patente_semi ? patente_semi.toUpperCase() : null,
             contenedor || null, precinto || null, obs_ingreso || null, turno.id, carga_estado || 'VACIO']
          );
          return { success: true, turno_id: turno.turno_id, enriched: true };
        } else {
          return { success: false, error: 'Vehículo ya registrado en predio por garita' };
        }
      }

      const countResult = await client.query('SELECT COUNT(*) FROM turnos');
      const turnoId = 'TRN-' + String(parseInt(countResult.rows[0].count) + 1).padStart(4, '0');

      await client.query(
        `INSERT INTO turnos (turno_id, truck, carrier, chofer, dni_chofer, celular_chofer, patente_semi,
          contenedor, precinto, warehouse, obs_ingreso, trip_number, operation, type, status, ts_entrada, registrado_por, carga_estado)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'Descarga','INBOUND','ESPERANDO_ASIGNACION',CURRENT_TIMESTAMP,'guardia',$13)`,
        [turnoId, patenteUpper, carrier, chofer, dni_chofer || null, celular_chofer || null,
         patente_semi ? patente_semi.toUpperCase() : null, contenedor || null, precinto || null,
         warehouse || '', obs_ingreso || null, viaje_hdr || null, carga_estado || 'VACIO']
      );

      return { success: true, turno_id: turnoId, enriched: false };
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/garita/entrada:', err);
    res.json({ success: false, error: 'Error de base de datos: ' + err.message });
  }
});

// ===================== API GARITA: SALIDA =====================
app.post('/api/garita/salida', async (req, res) => {
  try {
    const { truck, obs_egreso } = req.body;
    if (!truck) return res.json({ success: false, error: 'Patente requerida' });

    const patenteUpper = truck.toUpperCase().trim();

    const result = await withTransaction(async (client) => {
      const existing = await client.query(
        "SELECT * FROM turnos WHERE UPPER(truck)=$1 AND status != 'EGRESADO' ORDER BY ts_entrada DESC LIMIT 1 FOR UPDATE",
        [patenteUpper]
      );

      if (existing.rows.length === 0) {
        return { success: false, error: 'No se encontró vehículo activo con esa patente' };
      }

      const turno = existing.rows[0];
      await client.query(
        "UPDATE turnos SET status='EGRESADO', ts_egreso=CURRENT_TIMESTAMP, obs_egreso=$1 WHERE id=$2",
        [obs_egreso || null, turno.id]
      );

      const updated = await client.query('SELECT * FROM turnos WHERE id=$1', [turno.id]);
      return { success: true, turno: updated.rows[0] };
    });

    res.json(result);
  } catch (err) {
    console.error('Error en /api/garita/salida:', err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// ===================== API GARITA: HISTORIAL =====================
app.get('/api/garita/historial', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const result = await pool.query(
      `SELECT * FROM turnos WHERE ts_entrada > NOW() - INTERVAL '${days} days' ORDER BY ts_entrada DESC`
    );
    res.json({ success: true, turnos: result.rows });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// ===================== BUSCAR PATENTE EN GOOGLE SHEETS =====================
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1QwWUe34Yn0BnTfb8WckxzDRmEKJfuATPse9g76VM3n8/gviz/tq?tqx=out:csv';

let sheetCache = { data: null, ts: 0 };

// Helper: verifica si una fecha del sheet corresponde a hoy (timezone Argentina)
function isToday(fechaStr) {
  if (!fechaStr) return false;
  let day, month, year;
  const clean = fechaStr.trim();
  if (clean.includes('/')) {
    const parts = clean.split('/');
    day = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    year = parseInt(parts[2], 10);
    if (year < 100) year += 2000;
  } else if (clean.includes('-')) {
    const parts = clean.split('-');
    if (parts[0].length === 4) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      day = parseInt(parts[2], 10);
    } else {
      day = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
      year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
    }
  } else {
    return false;
  }
  if (isNaN(day) || isNaN(month) || isNaN(year)) return false;
  const now = new Date();
  const ar = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));
  return ar.getDate() === day && (ar.getMonth() + 1) === month && ar.getFullYear() === year;
}

// Helper: mapea deposito del sheet a warehouse válido (PL2/PL3)
const VALID_WAREHOUSES = ['PL2', 'PL3'];
function mapDeposito(deposito) {
  const upper = (deposito || '').toUpperCase().trim();
  return VALID_WAREHOUSES.includes(upper) ? upper : null;
}

async function fetchSheetData() {
  // Cache por 5 minutos
  if (sheetCache.data && (Date.now() - sheetCache.ts) < 300000) {
    return sheetCache.data;
  }
  try {
    const response = await fetch(GOOGLE_SHEET_CSV_URL);
    const csvText = await response.text();
    const rows = parseCSV(csvText);
    sheetCache = { data: rows, ts: Date.now() };
    return rows;
  } catch (err) {
    console.error('Error fetching Google Sheet:', err.message);
    return sheetCache.data || [];
  }
}

function parseCSV(text) {
  const lines = text.split('\n');
  if (lines.length < 2) return [];

  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase().replace(/"/g, ''));
  const results = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = (values[idx] || '').replace(/^"|"$/g, '').trim();
    });
    results.push(row);
  }
  return results;
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

app.get('/api/buscar-patente/:patente', async (req, res) => {
  try {
    const patente = (req.params.patente || '').toUpperCase().replace(/[-\s]/g, '');
    if (!patente || patente.length < 5) {
      return res.json({ found: false });
    }

    const rows = await fetchSheetData();
    // Filtrar: misma patente + fecha de hoy
    const matches = rows.filter(r => {
      const sheetPatente = (r.patente || '').toUpperCase().replace(/[-\s]/g, '');
      return sheetPatente === patente && isToday(r.fecha);
    });

    if (matches.length > 0) {
      const trips = matches
        .map(m => {
          const tripNumber = m['numero de viaje'] || m['viaje'] || m['numero_de_viaje'] || '';
          const transporte = m['transporte'] || m['transportista'] || '';
          const deposito = (m['deposito'] || m['destino'] || '').toUpperCase().trim();
          const warehouse = mapDeposito(deposito);
          return { tripNumber, transporte, deposito, warehouse };
        })
        .filter(t => t.warehouse); // Solo PL2 y PL3
      if (trips.length > 0) {
        res.json({ found: true, trips, patente });
      } else {
        res.json({ found: false });
      }
    } else {
      res.json({ found: false });
    }
  } catch (err) {
    console.error('Error buscando patente:', err);
    res.json({ found: false, error: 'Error de consulta' });
  }
});

// ==================== DASHBOARD STATS ====================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const range = req.query.range || 'today';
    let fromDate, toDate;
    const now = new Date();
    const arNow = new Date(now.toLocaleString('en-US', { timeZone: 'America/Argentina/Buenos_Aires' }));

    if (range === 'custom') {
      fromDate = req.query.from || arNow.toISOString().slice(0, 10);
      toDate = req.query.to || arNow.toISOString().slice(0, 10);
      // toDate inclusive: add 1 day
      const td = new Date(toDate);
      td.setDate(td.getDate() + 1);
      toDate = td.toISOString().slice(0, 10);
    } else if (range === 'week') {
      const dayOfWeek = arNow.getDay() || 7; // lunes=1
      const monday = new Date(arNow);
      monday.setDate(arNow.getDate() - dayOfWeek + 1);
      fromDate = monday.toISOString().slice(0, 10);
      const tomorrow = new Date(arNow);
      tomorrow.setDate(arNow.getDate() + 1);
      toDate = tomorrow.toISOString().slice(0, 10);
    } else if (range === 'month') {
      fromDate = arNow.toISOString().slice(0, 8) + '01';
      const tomorrow = new Date(arNow);
      tomorrow.setDate(arNow.getDate() + 1);
      toDate = tomorrow.toISOString().slice(0, 10);
    } else {
      // today
      fromDate = arNow.toISOString().slice(0, 10);
      const tomorrow = new Date(arNow);
      tomorrow.setDate(arNow.getDate() + 1);
      toDate = tomorrow.toISOString().slice(0, 10);
    }

    // Query 1: Promedios generales
    const avgResult = await pool.query(
      `SELECT
        AVG(EXTRACT(EPOCH FROM (ts_egreso - ts_entrada))) AS avg_predio,
        AVG(EXTRACT(EPOCH FROM (ts_desatracado - ts_atracado))) AS avg_atraque,
        AVG(EXTRACT(EPOCH FROM (ts_asignacion - ts_entrada))) AS avg_espera,
        COUNT(*) AS total
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= $1 AND ts_entrada < $2`,
      [fromDate, toDate]
    );

    // Query 2: Por operación
    const byOp = await pool.query(
      `SELECT operation, COUNT(*) AS count,
        AVG(EXTRACT(EPOCH FROM (ts_egreso - ts_entrada))) AS avg_predio
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= $1 AND ts_entrada < $2
      GROUP BY operation ORDER BY count DESC`,
      [fromDate, toDate]
    );

    // Query 3: Por nave
    const byWh = await pool.query(
      `SELECT warehouse, COUNT(*) AS count,
        AVG(EXTRACT(EPOCH FROM (ts_egreso - ts_entrada))) AS avg_predio
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= $1 AND ts_entrada < $2
      GROUP BY warehouse ORDER BY count DESC`,
      [fromDate, toDate]
    );

    // Query 4: Top 10 transportistas
    const byCarrier = await pool.query(
      `SELECT carrier, COUNT(*) AS count,
        AVG(EXTRACT(EPOCH FROM (ts_egreso - ts_entrada))) AS avg_predio
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= $1 AND ts_entrada < $2
      GROUP BY carrier ORDER BY count DESC LIMIT 10`,
      [fromDate, toDate]
    );

    // Query 5: Distribución horaria
    const byHour = await pool.query(
      `SELECT EXTRACT(HOUR FROM ts_entrada) AS hour, COUNT(*) AS count
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= $1 AND ts_entrada < $2
      GROUP BY hour ORDER BY hour`,
      [fromDate, toDate]
    );

    // Query 6: Tendencia diaria (últimos 30 días)
    const dailyTrend = await pool.query(
      `SELECT DATE(ts_entrada) AS day, COUNT(*) AS count
      FROM turnos
      WHERE ts_egreso IS NOT NULL AND ts_entrada >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY day ORDER BY day`
    );

    const avg = avgResult.rows[0] || {};
    res.json({
      success: true,
      stats: {
        avgPredio: parseFloat(avg.avg_predio) || 0,
        avgAtraque: parseFloat(avg.avg_atraque) || 0,
        avgEspera: parseFloat(avg.avg_espera) || 0,
        totalCompleted: parseInt(avg.total) || 0,
        byOperation: byOp.rows.map(r => ({ operation: r.operation || 'Sin tipo', count: parseInt(r.count), avgPredio: parseFloat(r.avg_predio) || 0 })),
        byWarehouse: byWh.rows.map(r => ({ warehouse: r.warehouse || 'Sin nave', count: parseInt(r.count), avgPredio: parseFloat(r.avg_predio) || 0 })),
        byCarrier: byCarrier.rows.map(r => ({ carrier: r.carrier || 'Sin asignar', count: parseInt(r.count), avgPredio: parseFloat(r.avg_predio) || 0 })),
        byHour: byHour.rows.map(r => ({ hour: parseInt(r.hour), count: parseInt(r.count) })),
        dailyTrend: dailyTrend.rows.map(r => ({ day: r.day, count: parseInt(r.count) }))
      },
      range, fromDate, toDate
    });
  } catch (err) {
    console.error('Error dashboard stats:', err);
    res.json({ success: false, error: 'Error de consulta' });
  }
});

// ===================== PÁGINAS HTML =====================

// Página raíz - redirige a entrada
app.get('/', (req, res) => {
  res.redirect('/entrada');
});

// ==================== PÁGINA ENTRADA (CHOFERES) ====================
app.get('/entrada', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Registro de Ingreso - OCASA</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="text-align:center; padding-top:80px;">
        <img src="${logoSrc}" alt="OCASA" class="logo-large">
        <div class="icon-circle icon-primary" style="margin:0 auto 24px;">🛡️</div>
        <h1>Registro por Garita</h1>
        <p class="subtitle" style="margin-bottom:32px;">El registro de ingreso es realizado por el guardia de seguridad.<br>Dirigite a la cabina de garita para que te registren.</p>
        <div class="card" style="background:rgba(0,153,168,0.06); border:1px solid rgba(0,153,168,0.2);">
          <p style="color:${colors.textSecondary}; font-size:15px; margin:0;">
            Una vez registrado, el guardia te entregará un <strong>código QR</strong><br>que podés escanear para seguir el estado de tu turno.
          </p>
        </div>
      </div>
    </body></html>
  `);
});

// LEGACY HANDLER (conservado por compatibilidad, no accesible)
if (false) {
  const carriers = [
    "Acaricia Transporte Logan","Adrian Servicio","Alfa Omega","Americantec","Andesmar","Andreani","Apicol","ASPELEYTER","Avaltrans","AYG Trucks",
    "Bahia SRL","Balboa","Bataglia","Beira Mar","Bessone","Better Catering","Biopak","BL Puerto y Logística","Blanca Luna","Brouclean","Bulonera Central","Bulonera Pacheco",
    "Camila Duarte","Cantarini","CASA Thames","CBC Group","CFA Fumigación","Ciari","Cimes","CISA","CLSA","Comercial Ñandubay","Container Leasing","CORREO Urbano","Cruz del Sur","CST Transporte",
    "DATULI","Del Valle","DHL","Don Antonio","Don Gumer","DPD","Duro",
    "Enviopack","EPSA","Erbas","EURO Packaging","Expreso Oro Negro",
    "Failde","FAILE","Flecha Lok","FM Transporte","FRATI","Fravega","FIS Logística",
    "Gabcin","Gentile","Grabet","Grasso","Grupo GLI","Grupo Luro","Grupo Silco","Guevara Fletes",
    "HDL Transporte","HECA","HFL","HIMP A","Hornero",
    "IAFRATELLI","IFLOW","Impresur","Internavegación","INTERMEDIO","Id Group",
    "Joaquin","JM Yaya e Hijos","Juarez",
    "La Sevillanita","La Tablada","LEO Trucks","Lir","Loginter","Logística del Valle","Logística Giménez","Logística Integral Romano","Logística Soria","Logitech","Lomas del Mirador","LTN","Luisito","Lugone","Ludamany",
    "Marra e Hijos","Marino","MARIANO","Maringa","MAV","Meli (Mercado Libre)","MICHELIN (Mantenimiento)","Mirtrans","Moova","Moreiro","Multarys Traslados",
    "Nahuel Remolques","Navarro","NB Cargo","Newsan","Nieva","Norlog","Norte",
    "OCA","OCASA","Oliveri Transporte","Onetrade","Oro Negro","Oriente Elevadores",
    "Pabile","Paganini","PANGEA","Parra","Pavile","PEF","PLK Group","Promei","Provenzano","PYTEL",
    "QX",
    "Ragazzi","Reyna Isabel","Romano","Ruta 21 DPD",
    "Saff","Sainz","SERVINTAR","SERVITRAN","SIARI","Sipe","Spineta","STC","SUMAR Servicio Industrial",
    "Técnica Lift","Techin","TGC Autoelevadores","Thames","Toledo","Transporte del Valle","Transporte Grasso","Transporte Juarez","Transporte Norte","Transporte Trejo","Tronador",
    "Unibrick","Unión Logística","Unitrans","Urbano Logística",
    "Vega","VOLKOV","Vento",
    "Webpack","WBL",
    "Otros"
  ];
  const carrierOptions = carriers.map(c => `<option value="${c}">${c}</option>`).join('');
  
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Entrada - OCASA Dock Manager</title>
      <style>${styles}
        select, input[type="text"] { padding: 16px; font-size: 18px; min-height: 56px; }
        label { display: block; text-align: left; color: ${colors.textMuted}; font-size: 14px; margin-bottom: 4px; margin-top: 12px; font-weight: 600; }
        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .video-container { position: relative; width: 100%; padding-bottom: 56.25%; margin: 16px 0; border-radius: 12px; overflow: hidden; }
        .video-container iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none; }
        .induccion { background: rgba(0,153,168,0.1); border: 1px solid ${colors.primary}; border-radius: 12px; padding: 16px; margin-bottom: 20px; text-align: left; }
        .induccion h3 { margin: 0 0 12px 0; color: ${colors.primary}; }
        .induccion ul { margin: 0; padding-left: 20px; }
        .induccion li { margin-bottom: 8px; font-size: 14px; color: ${colors.textSecondary}; }
        .induccion strong { color: ${colors.primary}; }
        .field-error { border-color: #dc2626 !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.1) !important; }
        .field-error-msg { color: #dc2626; font-size: 12px; font-weight: 500; margin: -4px 0 8px 0; text-align: left; display: none; }
      </style>
    </head><body>
      <div class="container" style="text-align: center; padding-top: 40px;">
        <img src="${logoSrc}" alt="OCASA" class="logo-large">
        <div class="icon-circle icon-primary">🚛</div>
        <h1>Registro de Ingreso</h1>
        <p class="subtitle">Mirá el video y completá los datos</p>
        
        <div class="induccion">
          <div onclick="toggleVideo()" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0;">📋 Video de inducción y puntos importantes</h3>
            <span id="toggleIcon" style="font-size:20px; transition: transform 0.3s;">▼</span>
          </div>
          <div id="videoSection" style="display:none; margin-top:12px;">
            <div class="video-container">
              <iframe src="https://drive.google.com/file/d/10wY5huXmtAHToymtkXURu54lB_Subpxh/preview" allow="autoplay" title="Video de inducción de seguridad"></iframe>
            </div>

            <h3>📌 Puntos importantes:</h3>
            <ul>
              <li>El <strong>número de viaje es opcional</strong>, pero si lo tenés, ingresalo.</li>
              <li>Si <strong>no sabés a qué nave ir</strong> (PL2 o PL3), consultá con la guardia.</li>
              <li><strong>NO cierres esta página</strong> después de registrarte. Podés minimizarla.</li>
              <li><strong>Todas las instrucciones</strong> (a qué dársena ir, cuándo atracar) te llegan por acá.</li>
              <li>Usá <strong>zapatos de seguridad</strong> y <strong>chaleco reflectivo</strong> en todo momento.</li>
            </ul>
          </div>
        </div>
        
        <div id="error" class="error" style="display:none;"></div>
        <div id="success" class="success" style="display:none;"></div>
        
        <div class="card">
          <label>PATENTE *</label>
          <input type="text" id="truck" placeholder="Ej: AA-123-BB" maxlength="10"
                 style="text-transform: uppercase; font-family: monospace; font-size: 24px; text-align: center;">
          <div id="patenteStatus" style="display:none; font-size:12px; margin:-4px 0 8px 0; padding:6px 12px; border-radius:6px; text-align:left;"></div>

          <!-- Panel viajes encontrados (oculto por defecto) -->
          <div id="tripsFound" style="display:none; margin-bottom:12px;">
            <label>VIAJES ENCONTRADOS PARA HOY</label>
            <div id="tripsList"></div>
          </div>

          <label>TRANSPORTISTA *</label>
          <div style="position: relative;">
            <input type="text" id="carrierSearch" placeholder="Escribí para buscar transportista..." autocomplete="off"
                   style="font-size: 16px;">
            <input type="hidden" id="carrier" value="">
            <div id="carrierDropdown" style="display:none; position:absolute; top:100%; left:0; right:0; z-index:100;
                 background:${colors.bgCard}; border:1px solid ${colors.border}; border-top:none; border-radius:0 0 12px 12px;
                 max-height:200px; overflow-y:auto; box-shadow: 0 8px 24px ${colors.shadow};"></div>
          </div>

          <div id="manualFields">
            <label>N° DE VIAJE (opcional)</label>
            <input type="text" id="tripNumber" placeholder="Ej: 123456" maxlength="20">

            <div class="row-2">
              <div>
                <label>DESTINO *</label>
                <select id="warehouse">
                  <option value="" disabled selected>Nave...</option>
                  <option value="PL2">PL2</option>
                  <option value="PL3">PL3</option>
                </select>
              </div>
              <div>
                <label>OPERACIÓN *</label>
                <select id="operation">
                  <option value="" disabled selected>Tipo...</option>
                  <option value="Descarga">Descarga</option>
                  <option value="Colecta">Colecta</option>
                  <option value="Carga">Carga</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Operación visible en modo multi-viaje -->
          <div id="multiOperation" style="display:none;">
            <label>OPERACIÓN *</label>
            <select id="operationMulti">
              <option value="" disabled selected>Tipo...</option>
              <option value="Descarga">Descarga</option>
              <option value="Colecta">Colecta</option>
              <option value="Carga">Carga</option>
            </select>
          </div>
          
          <button class="btn btn-primary" onclick="registrar()" id="btnSubmit" style="margin-top: 16px;">
            🚛 Registrar Ingreso
          </button>
        </div>
      </div>
      
      <script>
        // Toggle video inducción
        function toggleVideo() {
          const section = document.getElementById('videoSection');
          const icon = document.getElementById('toggleIcon');
          if (section.style.display === 'none') {
            section.style.display = 'block';
            icon.style.transform = 'rotate(180deg)';
          } else {
            section.style.display = 'none';
            icon.style.transform = 'rotate(0)';
          }
        }

        // Combobox transportistas
        const allCarriers = ${JSON.stringify(carriers)};
        const searchInput = document.getElementById('carrierSearch');
        const carrierHidden = document.getElementById('carrier');
        const dropdown = document.getElementById('carrierDropdown');

        searchInput.addEventListener('input', function() {
          const val = this.value.toLowerCase();
          carrierHidden.value = '';
          if (val.length === 0) { dropdown.style.display = 'none'; return; }
          const matches = allCarriers.filter(c => c.toLowerCase().includes(val));
          if (matches.length === 0) {
            dropdown.innerHTML = '<div style="padding:12px; color:${colors.textMuted}; font-size:14px;">Sin resultados</div>';
          } else {
            dropdown.innerHTML = matches.map(c =>
              '<div style="padding:10px 16px; cursor:pointer; font-size:14px; transition: background 0.15s;" ' +
              'onmouseover="this.style.background=\\'${colors.bgCardHover}\\'" ' +
              'onmouseout="this.style.background=\\'transparent\\'" ' +
              'onclick="selectCarrier(\\'' + c.replace(/'/g, "\\\\'") + '\\')">' + c + '</div>'
            ).join('');
          }
          dropdown.style.display = 'block';
        });

        searchInput.addEventListener('focus', function() {
          if (this.value.length > 0) dropdown.style.display = 'block';
        });

        document.addEventListener('click', function(e) {
          if (!e.target.closest('#carrierSearch') && !e.target.closest('#carrierDropdown')) {
            dropdown.style.display = 'none';
          }
        });

        function selectCarrier(name) {
          searchInput.value = name;
          carrierHidden.value = name;
          dropdown.style.display = 'none';
        }

        document.getElementById('truck').addEventListener('keyup', function(e) {
          this.value = this.value.toUpperCase();
        });

        // Auto-búsqueda de patente en Google Sheets (multi-viaje)
        let patenteSearchTimeout = null;
        window._foundTrips = null;

        function setMultiTripMode(trips) {
          window._foundTrips = trips;
          document.getElementById('manualFields').style.display = 'none';
          document.getElementById('multiOperation').style.display = 'block';
          document.getElementById('tripsFound').style.display = 'block';

          let html = '';
          trips.forEach((trip, idx) => {
            const naveBadge = trip.warehouse || trip.deposito || '?';
            const isValid = ['PL2','PL3'].includes((trip.warehouse || '').toUpperCase());
            const badgeColor = isValid ? '#16a34a' : '#d97706';
            const badgeBg = isValid ? '#f0fdf4' : '#fffbeb';
            const badgeBorder = isValid ? '#bbf7d0' : '#fde68a';
            html += '<div style="display:flex; align-items:center; gap:10px; padding:10px 14px; background:' + badgeBg + '; border:1px solid ' + badgeBorder + '; border-radius:8px; margin-bottom:6px;">';
            html += '<span style="font-size:18px;">📦</span>';
            html += '<div style="flex:1; text-align:left;">';
            html += '<div style="font-weight:600; font-size:14px;">Viaje ' + (trip.tripNumber || 'S/N') + '</div>';
            html += '<div style="font-size:12px; color:${colors.textMuted};">' + (trip.transporte || '') + '</div>';
            html += '</div>';
            html += '<span style="background:' + badgeBg + '; color:' + badgeColor + '; border:1px solid ' + badgeBorder + '; padding:4px 10px; border-radius:6px; font-weight:700; font-size:13px;">' + naveBadge + '</span>';
            html += '</div>';
          });
          document.getElementById('tripsList').innerHTML = html;

          // Auto-completar transportista si hay info
          const firstTransporte = trips.find(t => t.transporte);
          if (firstTransporte) {
            searchInput.value = firstTransporte.transporte;
            carrierHidden.value = firstTransporte.transporte;
          }
        }

        function setManualMode() {
          window._foundTrips = null;
          document.getElementById('manualFields').style.display = 'block';
          document.getElementById('multiOperation').style.display = 'none';
          document.getElementById('tripsFound').style.display = 'none';
          document.getElementById('tripsList').innerHTML = '';
        }

        document.getElementById('truck').addEventListener('input', function() {
          clearTimeout(patenteSearchTimeout);
          const val = this.value.trim().replace(/[-\\s]/g, '');
          const statusEl = document.getElementById('patenteStatus');

          if (val.length < 5) {
            statusEl.style.display = 'none';
            setManualMode();
            return;
          }

          statusEl.style.display = 'block';
          statusEl.style.background = '#eff6ff';
          statusEl.style.color = '#2563eb';
          statusEl.style.border = '1px solid #bfdbfe';
          statusEl.innerHTML = '🔍 Buscando viajes de hoy para esta patente...';

          patenteSearchTimeout = setTimeout(async () => {
            try {
              const res = await fetch('/api/buscar-patente/' + encodeURIComponent(val));
              const data = await res.json();

              if (data.found && data.trips && data.trips.length > 0) {
                const count = data.trips.length;
                statusEl.style.background = '#f0fdf4';
                statusEl.style.color = '#16a34a';
                statusEl.style.border = '1px solid #bbf7d0';
                const naves = [...new Set(data.trips.map(t => t.warehouse || t.deposito))].join(', ');
                statusEl.innerHTML = '✅ ' + count + ' viaje' + (count > 1 ? 's' : '') + ' encontrado' + (count > 1 ? 's' : '') + ' para hoy (' + naves + ')';
                setMultiTripMode(data.trips);
              } else {
                statusEl.style.background = '#fffbeb';
                statusEl.style.color = '#d97706';
                statusEl.style.border = '1px solid #fde68a';
                statusEl.innerHTML = '⚠️ Sin viajes programados para hoy. Completá los datos manualmente.';
                setManualMode();
              }
            } catch(e) {
              statusEl.style.display = 'none';
              setManualMode();
            }
          }, 600);
        });

        document.getElementById('truck').focus();

        async function registrar() {
          const truck = document.getElementById('truck').value.trim();
          const carrier = document.getElementById('carrier').value;

          clearFieldErrors();
          let hasError = false;
          if (!truck) { markFieldError('truck', 'Ingresá tu patente'); hasError = true; }
          if (!carrier) { markFieldError('carrierSearch', 'Seleccioná un transportista'); hasError = true; }

          if (window._foundTrips && window._foundTrips.length > 0) {
            // === MODO MULTI-VIAJE ===
            const operation = document.getElementById('operationMulti').value;
            if (!operation) { markFieldError('operationMulti', 'Seleccioná la operación'); hasError = true; }
            if (hasError) return;

            document.getElementById('btnSubmit').disabled = true;
            document.getElementById('btnSubmit').innerHTML = '⏳ Registrando ' + window._foundTrips.length + ' viaje(s)...';

            try {
              const trips = window._foundTrips.map(t => ({
                tripNumber: t.tripNumber || '',
                warehouse: t.warehouse || t.deposito || ''
              }));
              const res = await fetch('/api/entrada-multiple', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ truck, carrier, operation, trips })
              });
              const data = await res.json();

              if (data.success) {
                const totalCreated = data.created.length;
                const totalSkipped = data.skipped.length;
                let msg = '✅ ' + totalCreated + ' viaje(s) registrado(s)';
                if (totalSkipped > 0) msg += ' (' + totalSkipped + ' ya existían)';
                showSuccess(msg);
                if (data.firstId) {
                  setTimeout(() => { window.location.href = '/turno/' + data.firstId; }, 1500);
                }
              } else {
                showError(data.error);
                resetBtn();
              }
            } catch(e) {
              showError('Error de conexión');
              resetBtn();
            }
          } else {
            // === MODO MANUAL (sin viajes del sheet) ===
            const tripNumber = document.getElementById('tripNumber').value.trim();
            const warehouse = document.getElementById('warehouse').value;
            const operation = document.getElementById('operation').value;
            if (!warehouse) { markFieldError('warehouse', 'Seleccioná la nave'); hasError = true; }
            if (!operation) { markFieldError('operation', 'Seleccioná la operación'); hasError = true; }
            if (hasError) return;

            document.getElementById('btnSubmit').disabled = true;
            document.getElementById('btnSubmit').innerHTML = '⏳ Procesando...';

            try {
              const res = await fetch('/api/entrada', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ truck, carrier, tripNumber, warehouse, operation })
              });
              const data = await res.json();

              if (data.success) {
                showSuccess(data.existing ? '✅ Ya tenés un turno activo' : '✅ ¡Registrado correctamente!');
                setTimeout(() => { window.location.href = '/turno/' + data.id; }, 1500);
              } else {
                showError(data.error);
                resetBtn();
              }
            } catch(e) {
              showError('Error de conexión');
              resetBtn();
            }
          }
        }
        
        function resetBtn() {
          document.getElementById('btnSubmit').disabled = false;
          document.getElementById('btnSubmit').innerHTML = '🚛 Registrar Ingreso';
        }
        
        function markFieldError(fieldId, msg) {
          const el = document.getElementById(fieldId);
          el.classList.add('field-error');
          let msgEl = el.parentNode.querySelector('.field-error-msg');
          if (!msgEl) {
            msgEl = document.createElement('p');
            msgEl.className = 'field-error-msg';
            el.parentNode.insertBefore(msgEl, el.nextSibling);
          }
          msgEl.textContent = msg;
          msgEl.style.display = 'block';
        }

        function clearFieldErrors() {
          document.querySelectorAll('.field-error').forEach(el => el.classList.remove('field-error'));
          document.querySelectorAll('.field-error-msg').forEach(el => el.style.display = 'none');
          document.getElementById('error').style.display = 'none';
        }

        function showError(msg) {
          document.getElementById('success').style.display = 'none';
          document.getElementById('error').textContent = msg;
          document.getElementById('error').style.display = 'block';
        }
        function showSuccess(msg) {
          document.getElementById('error').style.display = 'none';
          document.getElementById('success').textContent = msg;
          document.getElementById('success').style.display = 'block';
        }
      </script>
    </body></html>
  `);
} // end if(false)

// ==================== PÁGINA TURNO (ESTADO DEL CHOFER) ====================
app.get('/turno/:id', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Mi Turno - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="padding-top: 20px;">
        <div style="text-align: center;">
          <img src="${logoSrc}" alt="OCASA" class="logo">
        </div>
        <div id="content">
          <div style="text-align: center; padding-top: 40px;">
            <div class="icon-circle icon-primary">⏳</div>
            <p>Cargando...</p>
          </div>
        </div>
      </div>
      
      <script>
        const turnoId = '${req.params.id}';
        let siblingTurnos = [];

        async function loadTurno() {
          try {
            const res = await fetch('/api/turno/' + turnoId);
            const data = await res.json();

            if (data.success) {
              const t = data.turno;
              // Buscar turnos hermanos (misma patente, distinto turno)
              try {
                const sibRes = await fetch('/api/turnos-by-patente/' + encodeURIComponent(t.truck));
                const sibData = await sibRes.json();
                siblingTurnos = (sibData.turnos || []).filter(s => s.turno_id !== turnoId);
              } catch(e) {
                siblingTurnos = [];
              }
              renderTurno(t);
            } else {
              document.getElementById('content').innerHTML = '<div class="error">Turno no encontrado</div>';
            }
          } catch(e) {
            document.getElementById('content').innerHTML = '<div class="error">Error de conexión</div>';
          }
        }

        function renderTurno(t) {
          // Buscar si hay un turno hermano con dársena asignada pendiente
          const nextSibling = siblingTurnos.find(s =>
            s.status === 'DARSENA_ASIGNADA' || s.status === 'ESPERANDO_ASIGNACION'
          );

          let statusMsg = '';
          if (t.status === 'ESPERANDO_ASIGNACION') {
            statusMsg = '⏳ Esperando asignación de dársena';
          } else if (t.status === 'DARSENA_ASIGNADA') {
            statusMsg = '📍 Dirigite a la dársena ' + t.dock;
          } else if (t.status === 'ATRACADO') {
            statusMsg = '🔄 Operación en curso en ' + t.dock;
          } else if (t.status === 'DESATRACADO' && nextSibling && nextSibling.dock) {
            statusMsg = '📍 Ahora dirigite a la dársena ' + nextSibling.dock + ' (' + (nextSibling.warehouse || '') + ')';
          } else if (t.status === 'DESATRACADO' && nextSibling && !nextSibling.dock) {
            statusMsg = '⏳ Esperando asignación de dársena para ' + (nextSibling.warehouse || 'otra nave');
          } else if (t.status === 'DESATRACADO') {
            statusMsg = '✅ Operación finalizada. Dirigite a la salida';
          } else if (t.status === 'EGRESADO') {
            statusMsg = '👋 ¡Hasta pronto!';
          }

          const hasNextDock = t.status === 'DESATRACADO' && nextSibling;
          const iconClass = (t.status === 'DESATRACADO' && !nextSibling) || t.status === 'EGRESADO' ? 'icon-green' : 'icon-primary';

          let html = '<div style="text-align: center;">';
          html += '<div class="icon-circle ' + iconClass + '">🚛</div>';
          html += '<h1>' + t.truck + '</h1>';
          html += '<p class="subtitle">' + statusMsg + '</p>';
          html += '</div>';

          // Banner de siguiente nave (solo si desatracado + hay hermano pendiente)
          if (hasNextDock && nextSibling.dock) {
            html += '<div class="card" style="background: rgba(0,153,168,0.08); border: 2px solid ${colors.primary}; text-align: center; margin-bottom: 16px;">';
            html += '<p style="margin:0; font-size:13px; color:${colors.textMuted}; font-weight:600;">SIGUIENTE DESTINO</p>';
            html += '<p style="margin:8px 0 4px 0; font-size:32px; font-weight:700; color:${colors.primary};">' + nextSibling.dock + '</p>';
            html += '<p style="margin:0; font-size:14px; color:${colors.textSecondary};">Nave ' + (nextSibling.warehouse || '') + (nextSibling.trip_number ? ' • Viaje ' + nextSibling.trip_number : '') + '</p>';
            html += '</div>';
          } else if (hasNextDock && !nextSibling.dock) {
            html += '<div class="card" style="background: #fffbeb; border: 2px solid #fde68a; text-align: center; margin-bottom: 16px;">';
            html += '<p style="margin:0; font-size:13px; color:#d97706; font-weight:600;">ESPERANDO ASIGNACIÓN</p>';
            html += '<p style="margin:8px 0 4px 0; font-size:18px; font-weight:600; color:#d97706;">Tenés otro viaje en ' + (nextSibling.warehouse || 'otra nave') + '</p>';
            html += '<p style="margin:0; font-size:14px; color:${colors.textSecondary};">Aguardá la asignación de dársena</p>';
            html += '</div>';
          }

          html += '<div class="card">';
          html += '<div class="timeline">';

          html += renderTimelineItem(t.ts_entrada, 'Ingreso registrado', t.status === 'ESPERANDO_ASIGNACION' && !t.ts_asignacion);
          html += renderTimelineItem(t.ts_asignacion, 'Dársena asignada' + (t.dock ? ': ' + t.dock : ''), t.status === 'ESPERANDO_ASIGNACION');
          html += renderTimelineItem(t.ts_atracado, 'Atracado', t.status === 'DARSENA_ASIGNADA');
          html += renderTimelineItem(t.ts_desatracado, 'Desatracado', t.status === 'ATRACADO');

          if (hasNextDock) {
            // Mostrar paso intermedio: ir a otra nave
            html += renderTimelineItem(null, 'Ir a ' + (nextSibling.dock || nextSibling.warehouse || 'otra nave'), t.status === 'DESATRACADO');
          }

          html += renderTimelineItem(t.ts_egreso, 'Egreso', t.status === 'DESATRACADO' && !hasNextDock);

          html += '</div></div>';

          // Mostrar turnos hermanos si los hay
          if (siblingTurnos.length > 0) {
            html += '<div class="card" style="margin-top:16px;">';
            html += '<p style="margin:0 0 12px 0; font-weight:600; font-size:14px; color:${colors.textSecondary};">📋 Tus otros viajes</p>';
            siblingTurnos.forEach(s => {
              const sibStatusText = {
                'ESPERANDO_ASIGNACION': '⏳ Esperando',
                'DARSENA_ASIGNADA': '📍 ' + (s.dock || ''),
                'ATRACADO': '🔄 En ' + (s.dock || ''),
                'DESATRACADO': '✅ Completado',
                'EGRESADO': '👋 Egresado'
              };
              const isCurrent = s.status === 'DARSENA_ASIGNADA' && t.status === 'DESATRACADO';
              const borderStyle = isCurrent ? 'border:2px solid ${colors.primary}; background:rgba(0,153,168,0.04);' : 'border:1px solid ${colors.border};';
              html += '<div style="padding:10px 14px; border-radius:8px; margin-bottom:6px; display:flex; align-items:center; justify-content:space-between; ' + borderStyle + '">';
              html += '<div>';
              html += '<span style="font-weight:600; font-size:13px;">Viaje ' + (s.trip_number || 'S/N') + '</span>';
              html += '<span style="font-size:12px; color:${colors.textMuted}; margin-left:8px;">' + (s.warehouse || '') + '</span>';
              html += '</div>';
              html += '<span style="font-size:12px;">' + (sibStatusText[s.status] || s.status) + '</span>';
              html += '</div>';
            });
            html += '</div>';
          }

          // Safety notice
          html += '<div class="card" style="background: #fffbeb; border: 1px solid #fde68a; margin-top: 16px;">';
          html += '<p style="margin: 0; font-weight: 600; color: #d97706;">⚠️ PUNTOS A TENER EN CUENTA</p>';
          html += '<p style="margin: 8px 0 0 0; font-size: 14px; color: ${colors.textPrimary};">• Usar <strong>zapatos de seguridad</strong></p>';
          html += '<p style="margin: 4px 0 0 0; font-size: 14px; color: ${colors.textPrimary};">• Usar <strong>chaleco reflectivo</strong></p>';
          html += '</div>';
          html += '<p class="refresh-notice">🔄 Actualizando automáticamente</p>';

          document.getElementById('content').innerHTML = html;
        }
        
        function renderTimelineItem(ts, text, isCurrent) {
          const done = ts ? 'done' : '';
          const current = isCurrent ? 'current' : '';
          return '<div class="timeline-item ' + done + ' ' + current + '">' +
            '<div class="timeline-time">' + formatTime(ts) + '</div>' +
            '<div class="timeline-text">' + text + '</div></div>';
        }
        
        function formatTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        }
        
        loadTurno();
        setInterval(loadTurno, 5000);
      </script>
    </body></html>
  `);
});

// ==================== PÁGINA DOCK (QR DÁRSENA) ====================
app.get('/dock/:dockId', (req, res) => {
  const dockId = req.params.dockId;
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Dársena ${dockId} - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="text-align: center; padding-top: 40px;">
        <img src="${logoSrc}" alt="OCASA" class="logo">
        <div id="loading">
          <div class="icon-circle icon-primary">⚓</div>
          <h1>Dársena ${dockId}</h1>
          <p class="subtitle">Consultando estado...</p>
        </div>
        <div id="preview" style="display:none;"></div>
        <div id="result" style="display:none;"></div>
      </div>

      <script>
        async function cargarEstado() {
          try {
            const res = await fetch('/api/turnos');
            const data = await res.json();
            const turnos = data.turnos || [];
            const turno = turnos.find(t => t.dock === '${dockId}' && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');

            document.getElementById('loading').style.display = 'none';

            if (!turno) {
              document.getElementById('preview').style.display = 'block';
              document.getElementById('preview').innerHTML =
                '<div class="card">' +
                '<div class="icon-circle" style="background: ${colors.light};">✓</div>' +
                '<h2 style="color: ${colors.textMuted};">Dársena libre</h2>' +
                '<p class="subtitle">No hay ningún camión asignado a ${dockId}</p>' +
                '</div>';
              return;
            }

            const accion = turno.status === 'DARSENA_ASIGNADA' ? 'atracar' : 'desatracar';
            const accionLabel = accion === 'atracar' ? '⚓ Confirmar Atraque' : '🚪 Confirmar Desatraque';
            const accionColor = accion === 'atracar' ? 'btn-primary' : 'btn-orange';

            document.getElementById('preview').style.display = 'block';
            document.getElementById('preview').innerHTML =
              '<div class="card" style="text-align:left;">' +
              '<div style="text-align:center; margin-bottom: 16px;">' +
              '<div class="icon-circle icon-primary" style="margin: 0 auto 12px;">🚛</div>' +
              '<h1 style="margin:0;">' + turno.truck + '</h1>' +
              '<p style="color:${colors.textMuted}; margin-top:4px;">' + turno.carrier + '</p>' +
              '</div>' +
              '<div style="border-top: 1px solid ${colors.border}; padding-top: 16px; margin-top: 8px;">' +
              '<p style="margin: 6px 0;"><strong>Dársena:</strong> ${dockId}</p>' +
              '<p style="margin: 6px 0;"><strong>Operación:</strong> ' + (turno.operation || '-') + '</p>' +
              '<p style="margin: 6px 0;"><strong>Nave:</strong> ' + (turno.warehouse || '-') + '</p>' +
              '<p style="margin: 6px 0;"><strong>Estado:</strong> ' + turno.status.replace(/_/g, ' ') + '</p>' +
              '</div>' +
              '</div>' +
              '<p style="color:${colors.textSecondary}; font-size:14px; font-weight:500; margin-bottom: 8px;">¿Confirmar <strong>' + accion + '</strong> de este camión?</p>' +
              '<button class="btn ' + accionColor + '" onclick="ejecutar()" id="btnConfirm">' + accionLabel + '</button>' +
              '<button class="btn" style="background:${colors.light}; color:${colors.textSecondary}; margin-top:8px;" onclick="location.reload()">Cancelar</button>';
          } catch(e) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('preview').style.display = 'block';
            document.getElementById('preview').innerHTML =
              '<div class="card"><div class="icon-circle" style="background:#fef2f2;">❌</div>' +
              '<h1 style="color:#dc2626;">Error de conexión</h1>' +
              '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
          }
        }

        async function ejecutar() {
          document.getElementById('btnConfirm').disabled = true;
          document.getElementById('btnConfirm').innerHTML = '⏳ Procesando...';

          try {
            const res = await fetch('/api/dock/${dockId}', { method: 'POST' });
            const data = await res.json();

            document.getElementById('preview').style.display = 'none';
            document.getElementById('result').style.display = 'block';

            if (data.success) {
              if (data.action === 'atracado') {
                document.getElementById('result').innerHTML =
                  '<div class="card"><div class="icon-circle icon-green">✅</div>' +
                  '<h1 style="color:#16a34a;">¡Atracado!</h1>' +
                  '<p class="subtitle">Camión ' + data.truck + '</p>' +
                  '<p style="color:${colors.textMuted};">Dársena ${dockId}</p></div>' +
                  '<button class="btn btn-primary" onclick="location.reload()">Escanear otra dársena</button>';
              } else {
                let desatraqueHtml = '<div class="card"><div class="icon-circle icon-orange">🚪</div>' +
                  '<h1 style="color:#d97706;">¡Desatracado!</h1>' +
                  '<p class="subtitle">Camión ' + data.truck + '</p>';

                if (data.nextDock && data.nextDock.dock) {
                  desatraqueHtml += '<div style="margin-top:16px; padding:16px; background:rgba(0,153,168,0.08); border:2px solid ${colors.primary}; border-radius:12px;">';
                  desatraqueHtml += '<p style="margin:0; font-size:12px; font-weight:600; color:${colors.textMuted};">SIGUIENTE DESTINO</p>';
                  desatraqueHtml += '<p style="margin:6px 0 2px 0; font-size:28px; font-weight:700; color:${colors.primary};">' + data.nextDock.dock + '</p>';
                  desatraqueHtml += '<p style="margin:0; font-size:14px; color:${colors.textSecondary};">Nave ' + (data.nextDock.warehouse || '') + (data.nextDock.tripNumber ? ' • Viaje ' + data.nextDock.tripNumber : '') + '</p>';
                  desatraqueHtml += '</div>';
                } else if (data.nextDock && !data.nextDock.dock) {
                  desatraqueHtml += '<div style="margin-top:16px; padding:16px; background:#fffbeb; border:2px solid #fde68a; border-radius:12px;">';
                  desatraqueHtml += '<p style="margin:0; font-size:14px; font-weight:600; color:#d97706;">Tiene otro viaje en ' + (data.nextDock.warehouse || 'otra nave') + '</p>';
                  desatraqueHtml += '<p style="margin:4px 0 0 0; font-size:13px; color:${colors.textSecondary};">Aguardando asignación de dársena</p>';
                  desatraqueHtml += '</div>';
                } else {
                  desatraqueHtml += '<p style="color:${colors.textMuted};">Puede dirigirse a la salida</p>';
                }

                desatraqueHtml += '</div>';
                desatraqueHtml += '<button class="btn btn-primary" onclick="location.reload()">Escanear otra dársena</button>';
                document.getElementById('result').innerHTML = desatraqueHtml;
              }
            } else {
              document.getElementById('result').innerHTML =
                '<div class="card"><div class="icon-circle" style="background:#fef2f2;">❌</div>' +
                '<h1 style="color:#dc2626;">Error</h1>' +
                '<p class="subtitle">' + data.error + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
            }
          } catch(e) {
            document.getElementById('result').innerHTML =
              '<div class="card"><div class="icon-circle" style="background:#fef2f2;">❌</div>' +
              '<h1 style="color:#dc2626;">Error de conexión</h1>' +
              '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
          }
        }

        cargarEstado();
      </script>
    </body></html>
  `);
});

// ==================== PÁGINA SALIDA ====================
app.get('/salida', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Salida - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="text-align: center; padding-top: 40px;">
        <img src="${logoSrc}" alt="OCASA" class="logo-large">
        <div class="icon-circle icon-orange">🚪</div>
        <h1>Registro de Salida</h1>
        <p class="subtitle">Ingresá tu patente para registrar egreso</p>
        
        <div id="error" class="error" style="display:none;"></div>
        <div id="success" class="success" style="display:none;"></div>
        
        <div class="card">
          <input type="text" id="truck" placeholder="Ej: AA-123-BB" maxlength="10"
                 style="text-transform: uppercase; font-family: monospace; font-size: 24px; text-align: center;">
          <button class="btn btn-orange" onclick="registrar()" id="btnSubmit">
            🚪 Registrar Salida
          </button>
        </div>
      </div>
      
      <script>
        document.getElementById('truck').addEventListener('keyup', function(e) {
          this.value = this.value.toUpperCase();
          if (e.key === 'Enter') registrar();
        });
        document.getElementById('truck').focus();
        
        async function registrar() {
          const truck = document.getElementById('truck').value.trim();
          if (!truck) { showError('Ingresá tu patente'); return; }
          
          document.getElementById('btnSubmit').disabled = true;
          document.getElementById('btnSubmit').innerHTML = '⏳ Procesando...';
          
          try {
            const res = await fetch('/api/salida', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ truck })
            });
            const data = await res.json();
            
            if (data.success) {
              const t = data.turno;
              const entradaTime = t.ts_entrada ? new Date(t.ts_entrada) : null;
              const tiempoEnPredio = entradaTime ? Math.floor((Date.now() - entradaTime.getTime()) / 60000) : 0;
              const horas = Math.floor(tiempoEnPredio / 60);
              const mins = tiempoEnPredio % 60;
              const tiempoStr = horas > 0 ? horas + 'h ' + mins + 'min' : mins + ' min';

              document.getElementById('success').innerHTML =
                '<strong>✅ Egreso registrado</strong><br>' +
                '<span style="font-size:13px;">Patente: <strong>' + t.truck + '</strong> — ' +
                'Transportista: <strong>' + t.carrier + '</strong> — ' +
                'Tiempo en predio: <strong>' + tiempoStr + '</strong></span>';
              document.getElementById('success').style.display = 'block';
              document.getElementById('error').style.display = 'none';

              setTimeout(() => {
                document.getElementById('truck').value = '';
                document.getElementById('success').style.display = 'none';
                document.getElementById('btnSubmit').disabled = false;
                document.getElementById('btnSubmit').innerHTML = '🚪 Registrar Salida';
                document.getElementById('truck').focus();
              }, 5000);
            } else {
              showError(data.error);
              resetBtn();
            }
          } catch(e) {
            showError('Error de conexión');
            resetBtn();
          }
        }
        
        function resetBtn() {
          document.getElementById('btnSubmit').disabled = false;
          document.getElementById('btnSubmit').innerHTML = '🚪 Registrar Salida';
        }
        
        function showError(msg) {
          document.getElementById('success').style.display = 'none';
          document.getElementById('error').textContent = msg;
          document.getElementById('error').style.display = 'block';
        }
        function showSuccess(msg) {
          document.getElementById('error').style.display = 'none';
          document.getElementById('success').textContent = msg;
          document.getElementById('success').style.display = 'block';
        }
      </script>
    </body></html>
  `);
});

// ==================== PÁGINA OPERADOR ====================
app.get('/operador', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Panel Operador - OCASA Dock Manager</title>
      <style>${styles}
        .nav-tabs { display: flex; gap: 8px; margin-bottom: 16px; }
        .nav-tab { flex: 1; padding: 12px; border: 2px solid ${colors.primary}; background: ${colors.bgCard}; color: ${colors.primary}; border-radius: 8px; font-family: 'Montserrat', sans-serif; font-size: 15px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
        .nav-tab:hover { background: rgba(0,153,168,0.06); }
        .nav-tab.active { background: ${colors.primary}; color: white; }
        .turno-row { display: flex; align-items: center; gap: 12px; padding: 14px; background: ${colors.bgCard}; border-radius: 10px; margin-bottom: 8px; flex-wrap: wrap; border: 1px solid ${colors.border}; box-shadow: 0 1px 2px ${colors.shadow}; transition: all 0.2s; }
        .turno-row:hover { border-color: ${colors.primary}; box-shadow: 0 2px 8px ${colors.shadowHover}; }
        .turno-info-main { flex: 1; min-width: 200px; }
        .turno-info-main h3 { margin: 0; font-size: 15px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .turno-info-main p { margin: 4px 0 0 0; font-size: 13px; color: ${colors.textMuted}; }
        .turno-actions { display: flex; gap: 8px; align-items: center; }
        .turno-actions select { padding: 8px 12px; font-size: 14px; min-height: 40px; border-radius: 8px; min-width: 100px; }
        .turno-actions button { padding: 8px 16px; font-size: 14px; min-height: 40px; white-space: nowrap; border-radius: 8px; }
        .op-badge { font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; letter-spacing: 0.3px; }
        .op-descarga { background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; }
        .op-colecta { background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; }
        .op-carga { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }
        .dock-cell { cursor: pointer; transition: transform 0.1s, box-shadow 0.2s; }
        .dock-cell:hover { transform: scale(1.08); box-shadow: 0 2px 8px ${colors.shadowHover}; }
      </style>
    </head><body>
      <div class="container-wide">
        <div class="header">
          <div class="header-left">
            <img src="${logoSrc}" alt="OCASA" class="logo">
            <div>
              <h1>Panel Operador</h1>
              <p class="subtitle" style="margin:0;">Gestión de dársenas y turnos</p>
            </div>
          </div>
          <button id="audioBtn" onclick="enableAudio()" style="background: #fffbeb; border: 1px solid #fde68a; color: #d97706; padding: 8px 16px; border-radius: 8px; font-family: 'Montserrat', sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;">🔔 Activar sonido</button>
        </div>
        
        <div class="nav-tabs">
          <button class="nav-tab active" onclick="setFilter('PL2')" id="tab-PL2">🏭 PL2</button>
          <button class="nav-tab" onclick="setFilter('PL3')" id="tab-PL3">🏭 PL3</button>
          <button class="nav-tab" onclick="setFilter('TODOS')" id="tab-TODOS">📋 Todos</button>
          <div style="flex:1;"></div>
          <button class="nav-tab nav-tab-dashboard" onclick="toggleDashboard()" id="tab-DASHBOARD">📊 Dashboard</button>
        </div>

        <!-- Vista operador (turnos activos) -->
        <div id="operatorView">
          <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:24px;" id="kpis">
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">En predio</div></div>
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Esperando</div></div>
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Atracados</div></div>
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Dársenas libres</div></div>
          </div>

          <div style="display:flex; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap;">
            <h2 style="margin:0;">Turnos activos</h2>
            <input type="text" id="searchTurnos" placeholder="Buscar patente o transportista..."
                   oninput="renderTurnos()"
                   style="flex:1; min-width:200px; margin:0; padding:10px 14px; font-size:14px; min-height:40px;">
            <button onclick="toggleViewMode()" id="viewModeBtn" style="background:${colors.bgCard}; border:1px solid ${colors.border}; color:${colors.textSecondary}; padding:8px 14px; border-radius:8px; font-family:'Montserrat',sans-serif; font-size:13px; font-weight:600; cursor:pointer; white-space:nowrap;">📋 Vista tabla</button>
          </div>
          <div id="turnos"></div>

          <h2 style="margin-top: 24px;">Estado de dársenas</h2>
          <div id="docks"></div>

          <p class="refresh-notice">🔄 Actualizando automáticamente cada 5 segundos</p>
        </div>

        <!-- Vista dashboard (KPIs históricos) -->
        <div id="dashboardView" style="display:none;">
          <div class="date-range-bar">
            <button class="range-btn active" id="range-today" onclick="loadDashboardData('today')">Hoy</button>
            <button class="range-btn" id="range-week" onclick="loadDashboardData('week')">Semana</button>
            <button class="range-btn" id="range-month" onclick="loadDashboardData('month')">Mes</button>
            <button class="range-btn" id="range-custom" onclick="showCustomRange()">Personalizado</button>
            <input type="date" id="dash-from" style="display:none; width:auto; min-height:36px; padding:6px 10px; font-size:13px; border:1px solid ${colors.border}; border-radius:8px; font-family:'Montserrat',sans-serif;" onchange="loadDashboardData('custom')">
            <input type="date" id="dash-to" style="display:none; width:auto; min-height:36px; padding:6px 10px; font-size:13px; border:1px solid ${colors.border}; border-radius:8px; font-family:'Montserrat',sans-serif;" onchange="loadDashboardData('custom')">
          </div>
          <div id="dashboardContent">
            <div class="dash-empty">⏳ Cargando datos...</div>
          </div>
        </div>
      </div>
      
      <!-- Modal detalle -->
      <div class="modal-overlay" id="modal">
        <div class="modal">
          <div class="modal-header">
            <h2 id="modal-title">Detalle</h2>
            <button class="modal-close" onclick="closeModal()">✕</button>
          </div>
          <div id="modal-content"></div>
        </div>
      </div>
      
      <script>
        let allTurnos = [];
        let currentFilter = 'PL2';
        let prevEsperando = -1;
        let audioEnabled = false;
        let activeSelect = null;
        let viewMode = 'cards'; // 'cards' o 'table'
        let collapsedGroups = {};
        let dashboardMode = false;
        let dashboardRange = 'today';
        let dashboardData = null;
        
        // Detectar cuando alguien está usando un select
        document.addEventListener('focus', (e) => {
          if (e.target.tagName === 'SELECT') activeSelect = e.target.id;
        }, true);
        document.addEventListener('blur', (e) => {
          if (e.target.tagName === 'SELECT') setTimeout(() => activeSelect = null, 100);
        }, true);
        
        function playAlert() {
          if (!audioEnabled) return;
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.value = 800;
          g.gain.value = 0.3;
          o.start();
          o.stop(ctx.currentTime + 0.3);
        }
        
        function enableAudio() {
          audioEnabled = true;
          document.getElementById('audioBtn').innerHTML = '🔊 Sonido activado';
          document.getElementById('audioBtn').style.background = '#f0fdf4';
          document.getElementById('audioBtn').style.borderColor = '#bbf7d0';
          document.getElementById('audioBtn').style.color = '#16a34a';
        }
        
        function setFilter(filter) {
          // Si estamos en dashboard, salir de él
          if (dashboardMode) {
            dashboardMode = false;
            document.getElementById('operatorView').style.display = '';
            document.getElementById('dashboardView').style.display = 'none';
            document.getElementById('tab-DASHBOARD').classList.remove('active');
          }
          currentFilter = filter;
          document.querySelectorAll('.nav-tab:not(.nav-tab-dashboard)').forEach(t => t.classList.remove('active'));
          document.getElementById('tab-' + filter).classList.add('active');
          renderTurnos();
          renderKPIs();
        }
        
        async function loadData() {
          try {
            const res = await fetch('/api/turnos');
            const data = await res.json();
            allTurnos = data.turnos || [];
            
            const esperando = allTurnos.filter(t => t.status === 'ESPERANDO_ASIGNACION').length;
            if (esperando > prevEsperando && prevEsperando >= 0) {
              playAlert();
            }
            prevEsperando = esperando;
            
            renderKPIs();
            if (!activeSelect) {
              renderTurnos();
              renderDocks();
            }
          } catch(e) {
            console.error(e);
          }
        }
        
        function getFilteredTurnos() {
          if (currentFilter === 'TODOS') return allTurnos;
          return allTurnos.filter(t => t.warehouse === currentFilter || (!t.warehouse && currentFilter === 'PL2'));
        }
        
        function getTimeAgo(ts) {
          if (!ts) return '';
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
          if (mins < 1) return 'ahora';
          if (mins < 60) return mins + ' min';
          const hrs = Math.floor(mins / 60);
          const remMins = mins % 60;
          return hrs + 'h ' + remMins + 'm';
        }

        function getTimeBadgeClass(ts) {
          if (!ts) return 'time-badge';
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
          if (mins > 120) return 'time-badge danger';
          if (mins > 60) return 'time-badge warning';
          return 'time-badge';
        }

        function renderKPIs() {
          const filtered = getFilteredTurnos();
          const activos = filtered.filter(t => t.status !== 'EGRESADO');
          const enPredio = activos.length;
          const esperando = activos.filter(t => t.status === 'ESPERANDO_ASIGNACION').length;
          const atracados = activos.filter(t => t.status === 'ATRACADO').length;

          const totalDocks = currentFilter === 'PL3' ? 19 : (currentFilter === 'PL2' ? 21 : 40);
          const docksOcupados = activos.filter(t => t.dock && t.status !== 'DESATRACADO').length;
          const docksLibres = totalDocks - docksOcupados;

          document.getElementById('kpis').innerHTML =
            '<div class="kpi"><div class="kpi-value">' + enPredio + '</div><div class="kpi-label">En predio</div></div>' +
            '<div class="kpi"><div class="kpi-value" style="color:#d97706;">' + esperando + '</div><div class="kpi-label">Esperando</div></div>' +
            '<div class="kpi"><div class="kpi-value">' + atracados + '</div><div class="kpi-label">Atracados</div></div>' +
            '<div class="kpi"><div class="kpi-value" style="color:#16a34a;">' + docksLibres + '</div><div class="kpi-label">Dársenas libres</div></div>';
        }
        
        function toggleViewMode() {
          viewMode = viewMode === 'cards' ? 'table' : 'cards';
          const btn = document.getElementById('viewModeBtn');
          btn.innerHTML = viewMode === 'cards' ? '📋 Vista tabla' : '🃏 Vista tarjetas';
          renderTurnos();
        }

        function toggleGroup(groupKey) {
          collapsedGroups[groupKey] = !collapsedGroups[groupKey];
          renderTurnos();
        }

        function renderTurnos() {
          const filtered = getFilteredTurnos();
          let activos = filtered.filter(t => t.status !== 'EGRESADO');

          // Filtro de búsqueda
          const search = (document.getElementById('searchTurnos') || {}).value || '';
          if (search.trim()) {
            const q = search.trim().toLowerCase();
            activos = activos.filter(t =>
              t.truck.toLowerCase().includes(q) ||
              (t.carrier || '').toLowerCase().includes(q) ||
              (t.trip_number || '').toLowerCase().includes(q) ||
              (t.dock || '').toLowerCase().includes(q)
            );
          }

          if (activos.length === 0) {
            document.getElementById('turnos').innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">' + (search.trim() ? 'Sin resultados para "' + search.trim() + '"' : 'No hay turnos activos en ' + currentFilter) + '</div>';
            return;
          }

          // Agrupar por estado
          const statusOrder = ['ESPERANDO_ASIGNACION', 'DARSENA_ASIGNADA', 'ATRACADO', 'DESATRACADO'];
          const statusLabels = {
            'ESPERANDO_ASIGNACION': '⏳ Esperando asignación',
            'DARSENA_ASIGNADA': '📍 Dársena asignada',
            'ATRACADO': '⚓ Atracados',
            'DESATRACADO': '🚪 Desatracados'
          };
          const statusColors = {
            'ESPERANDO_ASIGNACION': '#d97706',
            'DARSENA_ASIGNADA': '${colors.primary}',
            'ATRACADO': '#16a34a',
            'DESATRACADO': '#ea580c'
          };

          const groups = {};
          statusOrder.forEach(s => { groups[s] = []; });
          activos.forEach(t => {
            if (groups[t.status]) groups[t.status].push(t);
          });

          let html = '';
          statusOrder.forEach(status => {
            const items = groups[status];
            if (items.length === 0) return;
            const collapsed = collapsedGroups[status];
            const color = statusColors[status];
            html += '<div style="margin-bottom:16px;">';
            html += '<div onclick="toggleGroup(\\'' + status + '\\')" style="cursor:pointer; display:flex; align-items:center; gap:8px; padding:10px 14px; background:' + color + '10; border:1px solid ' + color + '30; border-radius:10px; margin-bottom:' + (collapsed ? '0' : '8') + 'px; user-select:none;">';
            html += '<span style="font-size:13px; transform:rotate(' + (collapsed ? '-90' : '0') + 'deg); transition:transform 0.2s;">▼</span>';
            html += '<span style="font-weight:600; font-size:14px; color:' + color + ';">' + statusLabels[status] + '</span>';
            html += '<span style="background:' + color + '; color:white; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; margin-left:4px;">' + items.length + '</span>';
            html += '</div>';

            if (!collapsed) {
              if (viewMode === 'table') {
                html += renderTurnosTable(items, status);
              } else {
                items.forEach(t => { html += renderTurnoCard(t); });
              }
            }
            html += '</div>';
          });

          document.getElementById('turnos').innerHTML = html;
        }

        function renderTurnoCard(t) {
          const opBadge = t.operation === 'Colecta'
            ? '<span class="op-badge op-colecta">COLECTA</span>'
            : (t.operation === 'Carga' ? '<span class="op-badge op-carga">CARGA</span>' : '<span class="op-badge op-descarga">DESCARGA</span>');

          let html = '<div class="turno-row" onclick="showDetail(\\'' + t.turno_id + '\\')">';
          html += '<div class="turno-info-main">';
          html += '<h3>' + t.truck + ' ' + getStatusBadge(t.status) + ' ' + opBadge + '</h3>';
          html += '<p>' + t.carrier + (t.trip_number ? ' • Viaje: ' + t.trip_number : '') + (t.dock ? ' • ' + t.dock : '') + '</p>';
          html += '</div>';
          html += '<div class="turno-actions">';

          if (t.status === 'ESPERANDO_ASIGNACION') {
            const dockStart = t.warehouse === 'PL3' ? 22 : 1;
            const dockEnd = t.warehouse === 'PL3' ? 40 : 21;
            html += '<select id="dock-' + t.turno_id + '" onclick="event.stopPropagation();">';
            for (let i = dockStart; i <= dockEnd; i++) {
              const d = 'D-' + String(i).padStart(2, '0');
              const ocupada = allTurnos.some(x => x.dock === d && x.status !== 'EGRESADO' && x.status !== 'DESATRACADO');
              html += '<option value="' + d + '"' + (ocupada ? ' disabled' : '') + '>' + d + (ocupada ? ' (ocup)' : '') + '</option>';
            }
            html += '</select>';
            html += '<button class="btn btn-green" onclick="event.stopPropagation(); asignar(\\'' + t.turno_id + '\\')">Asignar</button>';
          }

          if (t.status === 'DESATRACADO') {
            html += '<select id="reasign-' + t.turno_id + '" onclick="event.stopPropagation();">';
            html += '<option value="">🔄 Reasignar...</option>';
            for (let i = 1; i <= 40; i++) {
              const d = 'D-' + String(i).padStart(2, '0');
              const ocupada = allTurnos.some(x => x.dock === d && x.status !== 'EGRESADO' && x.status !== 'DESATRACADO');
              if (!ocupada) html += '<option value="' + d + '">' + d + '</option>';
            }
            html += '</select>';
            html += '<button class="btn btn-orange" onclick="event.stopPropagation(); reasignar(\\'' + t.turno_id + '\\')">Reasignar</button>';
          }

          html += '<div style="text-align:right;">';
          html += '<div class="' + getTimeBadgeClass(t.ts_entrada) + '">⏱ ' + getTimeAgo(t.ts_entrada) + '</div>';
          html += '<div class="time-badge">' + formatTime(t.ts_entrada) + '</div>';
          html += '</div>';
          html += '</div></div>';
          return html;
        }

        function renderTurnosTable(items, status) {
          let html = '<div style="overflow-x:auto;">';
          html += '<table style="width:100%; border-collapse:separate; border-spacing:0; font-size:13px; background:white; border-radius:10px; overflow:hidden; border:1px solid ${colors.border};">';
          html += '<thead><tr style="background:${colors.bg};">';
          html += '<th style="padding:10px 12px; text-align:left; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Patente</th>';
          html += '<th style="padding:10px 12px; text-align:left; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Transportista</th>';
          html += '<th style="padding:10px 12px; text-align:left; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Op</th>';
          html += '<th style="padding:10px 12px; text-align:left; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Dársena</th>';
          html += '<th style="padding:10px 12px; text-align:left; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Tiempo</th>';
          html += '<th style="padding:10px 12px; text-align:center; font-weight:600; color:${colors.textSecondary}; font-size:11px; text-transform:uppercase; letter-spacing:0.5px;">Acción</th>';
          html += '</tr></thead><tbody>';

          items.forEach((t, idx) => {
            const rowBg = idx % 2 === 0 ? 'white' : '${colors.bg}';
            const opBadge = t.operation === 'Colecta'
              ? '<span class="op-badge op-colecta">COL</span>'
              : (t.operation === 'Carga' ? '<span class="op-badge op-carga">CAR</span>' : '<span class="op-badge op-descarga">DESC</span>');

            html += '<tr style="background:' + rowBg + '; cursor:pointer;" onclick="showDetail(\\'' + t.turno_id + '\\')" onmouseover="this.style.background=\\'${colors.bgCardHover}\\'" onmouseout="this.style.background=\\'' + rowBg + '\\'">';
            html += '<td style="padding:10px 12px; font-weight:600; white-space:nowrap;">' + t.truck + '</td>';
            html += '<td style="padding:10px 12px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + t.carrier + (t.trip_number ? ' <span style="color:${colors.textMuted}; font-size:11px;">V:' + t.trip_number + '</span>' : '') + '</td>';
            html += '<td style="padding:10px 12px;">' + opBadge + '</td>';
            html += '<td style="padding:10px 12px; font-weight:600;">' + (t.dock || '-') + '</td>';
            html += '<td style="padding:10px 12px;"><span class="' + getTimeBadgeClass(t.ts_entrada) + '">⏱ ' + getTimeAgo(t.ts_entrada) + '</span></td>';
            html += '<td style="padding:10px 12px; text-align:center;" onclick="event.stopPropagation();">';

            if (t.status === 'ESPERANDO_ASIGNACION') {
              const dockStart = t.warehouse === 'PL3' ? 22 : 1;
              const dockEnd = t.warehouse === 'PL3' ? 40 : 21;
              html += '<div style="display:flex; gap:4px; justify-content:center;">';
              html += '<select id="dock-' + t.turno_id + '" style="min-height:32px; padding:4px 8px; font-size:12px; min-width:70px; margin:0;">';
              for (let i = dockStart; i <= dockEnd; i++) {
                const d = 'D-' + String(i).padStart(2, '0');
                const ocupada = allTurnos.some(x => x.dock === d && x.status !== 'EGRESADO' && x.status !== 'DESATRACADO');
                html += '<option value="' + d + '"' + (ocupada ? ' disabled' : '') + '>' + d + (ocupada ? ' ✗' : '') + '</option>';
              }
              html += '</select>';
              html += '<button class="btn btn-green" style="min-height:32px; padding:4px 10px; font-size:12px; margin:0; width:auto; display:inline-block;" onclick="asignar(\\'' + t.turno_id + '\\')">✓</button>';
              html += '</div>';
            } else if (t.status === 'DESATRACADO') {
              html += '<div style="display:flex; gap:4px; justify-content:center;">';
              html += '<select id="reasign-' + t.turno_id + '" style="min-height:32px; padding:4px 8px; font-size:12px; min-width:70px; margin:0;">';
              html += '<option value="">🔄...</option>';
              for (let i = 1; i <= 40; i++) {
                const d = 'D-' + String(i).padStart(2, '0');
                const ocupada = allTurnos.some(x => x.dock === d && x.status !== 'EGRESADO' && x.status !== 'DESATRACADO');
                if (!ocupada) html += '<option value="' + d + '">' + d + '</option>';
              }
              html += '</select>';
              html += '<button class="btn btn-orange" style="min-height:32px; padding:4px 10px; font-size:12px; margin:0; width:auto; display:inline-block;" onclick="reasignar(\\'' + t.turno_id + '\\')">✓</button>';
              html += '</div>';
            } else {
              html += '<span style="color:${colors.textMuted};">—</span>';
            }

            html += '</td></tr>';
          });

          html += '</tbody></table></div>';
          return html;
        }
        
        function renderDocks() {
          let html = '';
          
          html += '<div class="warehouse"><h3>🏭 PL2 (D-01 a D-21)</h3><div class="dock-grid">';
          for (let i = 1; i <= 21; i++) {
            const d = 'D-' + String(i).padStart(2, '0');
            const turnoEnDock = allTurnos.find(t => t.dock === d && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');
            const ocupada = !!turnoEnDock;
            html += '<div class="dock dock-cell ' + (ocupada ? 'dock-occupied' : 'dock-free') + '" onclick="showDockDetail(\\'' + d + '\\')">' + d + '</div>';
          }
          html += '</div></div>';
          
          html += '<div class="warehouse"><h3>🏭 PL3 (D-22 a D-40)</h3><div class="dock-grid">';
          for (let i = 22; i <= 40; i++) {
            const d = 'D-' + String(i).padStart(2, '0');
            const turnoEnDock = allTurnos.find(t => t.dock === d && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');
            const ocupada = !!turnoEnDock;
            html += '<div class="dock dock-cell ' + (ocupada ? 'dock-occupied' : 'dock-free') + '" onclick="showDockDetail(\\'' + d + '\\')">' + d + '</div>';
          }
          html += '</div></div>';
          
          document.getElementById('docks').innerHTML = html;
        }
        
        function showDockDetail(dockId) {
          const turno = allTurnos.find(t => t.dock === dockId && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');
          
          document.getElementById('modal-title').textContent = 'Dársena ' + dockId;
          
          let html = '';
          if (turno) {
            html += '<div style="text-align:center; padding: 16px 0;">';
            html += '<div class="icon-circle icon-green" style="margin: 0 auto 16px;">🚛</div>';
            html += '<h2 style="margin:0;">' + turno.truck + '</h2>';
            html += '<p style="color:' + colors.textMuted + ';">' + turno.carrier + '</p>';
            html += '<p>' + getStatusBadge(turno.status) + '</p>';
            if (turno.trip_number) html += '<p>Viaje: <strong>' + turno.trip_number + '</strong></p>';
            if (turno.operation) html += '<p>Operación: <strong>' + turno.operation + '</strong></p>';
            html += '</div>';
            
            html += '<div class="timeline">';
            html += renderTimelineItem(turno.ts_entrada, 'Ingreso');
            html += renderTimelineItem(turno.ts_asignacion, 'Asignado a ' + dockId);
            html += renderTimelineItem(turno.ts_atracado, 'Atracado');
            html += '</div>';
          } else {
            html += '<div style="text-align:center; padding: 32px 0;">';
            html += '<div class="icon-circle" style="margin: 0 auto 16px; background: rgba(255,255,255,0.1);">✓</div>';
            html += '<h3 style="margin:0; color:' + colors.textMuted + ';">Dársena libre</h3>';
            html += '</div>';
          }
          
          document.getElementById('modal-content').innerHTML = html;
          document.getElementById('modal').classList.add('active');
        }
        
        async function asignar(turnoId) {
          const dock = document.getElementById('dock-' + turnoId).value;
          const warehouse = parseInt(dock.split('-')[1]) <= 20 ? 'PL2' : 'PL3';
          
          try {
            const res = await fetch('/api/asignar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ turnoId, dock, warehouse })
            });
            const data = await res.json();
            if (data.success) {
              showToast('Dársena asignada correctamente', 'success');
              loadData();
            } else {
              showToast(data.error, 'error');
            }
          } catch(e) {
            showToast('Error de conexión', 'error');
          }
        }

        async function reasignar(turnoId) {
          const dock = document.getElementById('reasign-' + turnoId).value;
          if (!dock) {
            showToast('Seleccioná un dock para reasignar', 'error');
            return;
          }
          const warehouse = parseInt(dock.split('-')[1]) <= 20 ? 'PL2' : 'PL3';
          
          try {
            const res = await fetch('/api/reasignar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ turnoId, dock, warehouse })
            });
            const data = await res.json();
            if (data.success) {
              showToast('Reasignación exitosa', 'success');
              loadData();
            } else {
              showToast(data.error, 'error');
            }
          } catch(e) {
            showToast('Error de conexión', 'error');
          }
        }

        function showDetail(turnoId) {
          const t = allTurnos.find(x => x.turno_id === turnoId);
          if (!t) return;
          
          document.getElementById('modal-title').textContent = t.truck;
          
          let html = '<div style="margin-bottom:16px;">';
          html += '<p><strong>Transportista:</strong> ' + t.carrier + '</p>';
          if (t.trip_number) html += '<p><strong>N° Viaje:</strong> ' + t.trip_number + '</p>';
          if (t.operation) html += '<p><strong>Operación:</strong> ' + t.operation + '</p>';
          if (t.warehouse) html += '<p><strong>Nave:</strong> ' + t.warehouse + '</p>';
          html += '</div>';
          
          html += '<div class="timeline">';
          html += renderTimelineItem(t.ts_entrada, 'Ingreso registrado');
          html += renderTimelineItem(t.ts_asignacion, 'Dársena asignada' + (t.dock ? ': ' + t.dock : ''));
          html += renderTimelineItem(t.ts_atracado, 'Atracado');
          html += renderTimelineItem(t.ts_desatracado, 'Desatracado');
          html += renderTimelineItem(t.ts_egreso, 'Egreso');
          html += '</div>';
          
          document.getElementById('modal-content').innerHTML = html;
          document.getElementById('modal').classList.add('active');
        }
        
        function renderTimelineItem(ts, text) {
          const done = ts ? 'done' : '';
          return '<div class="timeline-item ' + done + '">' +
            '<div class="timeline-time">' + formatDateTime(ts) + '</div>' +
            '<div class="timeline-text">' + text + '</div></div>';
        }
        
        function closeModal() {
          document.getElementById('modal').classList.remove('active');
        }

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') closeModal();
        });

        document.getElementById('modal').addEventListener('click', function(e) {
          if (e.target === this) closeModal();
        });

        function showToast(msg, type) {
          let toast = document.getElementById('toast');
          if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            document.body.appendChild(toast);
          }
          toast.className = 'toast toast-' + type;
          toast.textContent = msg;
          setTimeout(() => toast.classList.add('show'), 10);
          setTimeout(() => toast.classList.remove('show'), 3000);
        }

        function getStatusBadge(status) {
          const badges = {
            'ESPERANDO_ASIGNACION': '<span class="badge badge-yellow">Esperando</span>',
            'DARSENA_ASIGNADA': '<span class="badge badge-primary">Asignada</span>',
            'ATRACADO': '<span class="badge badge-green">Atracado</span>',
            'DESATRACADO': '<span class="badge badge-orange">Desatracado</span>',
            'EGRESADO': '<span class="badge badge-dark">Egresado</span>'
          };
          return badges[status] || status;
        }

        function formatTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        }

        function formatDateTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        // ========== DASHBOARD FUNCTIONS ==========
        function toggleDashboard() {
          dashboardMode = !dashboardMode;
          if (dashboardMode) {
            document.getElementById('operatorView').style.display = 'none';
            document.getElementById('dashboardView').style.display = '';
            document.querySelectorAll('.nav-tab:not(.nav-tab-dashboard)').forEach(t => t.classList.remove('active'));
            document.getElementById('tab-DASHBOARD').classList.add('active');
            if (!dashboardData) loadDashboardData();
          } else {
            document.getElementById('operatorView').style.display = '';
            document.getElementById('dashboardView').style.display = 'none';
            document.getElementById('tab-DASHBOARD').classList.remove('active');
            document.getElementById('tab-' + currentFilter).classList.add('active');
          }
        }

        function showCustomRange() {
          dashboardRange = 'custom';
          document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
          document.getElementById('range-custom').classList.add('active');
          document.getElementById('dash-from').style.display = '';
          document.getElementById('dash-to').style.display = '';
          const today = new Date();
          const weekAgo = new Date(today);
          weekAgo.setDate(today.getDate() - 7);
          document.getElementById('dash-from').value = weekAgo.toISOString().slice(0,10);
          document.getElementById('dash-to').value = today.toISOString().slice(0,10);
          loadDashboardData('custom');
        }

        async function loadDashboardData(range) {
          if (range) dashboardRange = range;
          document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
          const activeBtn = document.getElementById('range-' + dashboardRange);
          if (activeBtn) activeBtn.classList.add('active');
          if (dashboardRange !== 'custom') {
            document.getElementById('dash-from').style.display = 'none';
            document.getElementById('dash-to').style.display = 'none';
          }
          let url = '/api/dashboard/stats?range=' + dashboardRange;
          if (dashboardRange === 'custom') {
            const from = document.getElementById('dash-from').value;
            const to = document.getElementById('dash-to').value;
            if (from && to) url += '&from=' + from + '&to=' + to;
          }
          document.getElementById('dashboardContent').innerHTML = '<div class="dash-empty">⏳ Cargando datos...</div>';
          try {
            const res = await fetch(url);
            const data = await res.json();
            if (data.success) {
              dashboardData = data.stats;
              renderDashboard();
            } else {
              document.getElementById('dashboardContent').innerHTML = '<div class="dash-empty">❌ Error al cargar datos</div>';
            }
          } catch(e) {
            document.getElementById('dashboardContent').innerHTML = '<div class="dash-empty">❌ Error de conexión</div>';
          }
        }

        function formatDuration(secs) {
          if (!secs || secs <= 0) return '--';
          const h = Math.floor(secs / 3600);
          const m = Math.floor((secs % 3600) / 60);
          if (h > 0) return h + 'h ' + m + 'm';
          return m + ' min';
        }

        function renderDashboard() {
          const d = dashboardData;
          if (!d) return;
          let html = '';

          // KPI cards
          html += '<div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:12px; margin-bottom:16px;">';
          html += '<div class="kpi"><div class="kpi-value">' + formatDuration(d.avgPredio) + '</div><div class="kpi-label">Prom. en predio</div></div>';
          html += '<div class="kpi"><div class="kpi-value">' + formatDuration(d.avgAtraque) + '</div><div class="kpi-label">Prom. atraque</div></div>';
          html += '<div class="kpi"><div class="kpi-value">' + formatDuration(d.avgEspera) + '</div><div class="kpi-label">Prom. espera</div></div>';
          html += '<div class="kpi"><div class="kpi-value" style="color:${colors.primary};">' + d.totalCompleted + '</div><div class="kpi-label">Camiones procesados</div></div>';
          html += '</div>';

          if (d.totalCompleted === 0) {
            html += '<div class="dash-empty">📭 No hay datos completados en este período</div>';
            document.getElementById('dashboardContent').innerHTML = html;
            return;
          }

          // Por operación + Por nave
          html += '<div class="dash-grid">';
          html += '<div class="dash-section"><h3>📦 Por operación</h3>';
          const maxOp = Math.max(...d.byOperation.map(o => o.count), 1);
          const opColors = { 'Descarga': 'bar-fill-primary', 'Colecta': 'bar-fill-orange', 'Carga': 'bar-fill-green' };
          d.byOperation.forEach(o => {
            const pct = (o.count / maxOp * 100).toFixed(0);
            const cls = opColors[o.operation] || 'bar-fill-primary';
            html += '<div class="bar-row"><div class="bar-label">' + (o.operation || 'S/T') + '</div>';
            html += '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%;"></div></div>';
            html += '<div class="bar-value">' + o.count + ' <span style="font-size:10px;color:${colors.textMuted};">(' + formatDuration(o.avgPredio) + ')</span></div></div>';
          });
          html += '</div>';

          html += '<div class="dash-section"><h3>🏭 Por nave</h3>';
          const maxWh = Math.max(...d.byWarehouse.map(w => w.count), 1);
          d.byWarehouse.forEach(w => {
            const pct = (w.count / maxWh * 100).toFixed(0);
            const cls = w.warehouse === 'PL3' ? 'bar-fill-orange' : 'bar-fill-primary';
            html += '<div class="bar-row"><div class="bar-label">' + (w.warehouse || 'S/N') + '</div>';
            html += '<div class="bar-track"><div class="bar-fill ' + cls + '" style="width:' + pct + '%;"></div></div>';
            html += '<div class="bar-value">' + w.count + ' <span style="font-size:10px;color:${colors.textMuted};">(' + formatDuration(w.avgPredio) + ')</span></div></div>';
          });
          html += '</div></div>';

          // Top transportistas
          if (d.byCarrier.length > 0) {
            html += '<div class="dash-grid"><div class="dash-section dash-full"><h3>🚛 Top transportistas</h3>';
            const maxCr = Math.max(...d.byCarrier.map(c => c.count), 1);
            d.byCarrier.forEach((c, i) => {
              const pct = (c.count / maxCr * 100).toFixed(0);
              html += '<div class="bar-row"><div class="bar-label" title="' + c.carrier + '">' + c.carrier + '</div>';
              html += '<div class="bar-track"><div class="bar-fill bar-fill-primary" style="width:' + pct + '%; opacity:' + (1 - i * 0.06) + ';"></div></div>';
              html += '<div class="bar-value">' + c.count + ' <span style="font-size:10px;color:${colors.textMuted};">(' + formatDuration(c.avgPredio) + ')</span></div></div>';
            });
            html += '</div></div>';
          }

          // Hora pico + Tendencia
          html += '<div class="dash-grid">';
          html += '<div class="dash-section"><h3>⏰ Distribución horaria</h3><div class="hour-chart">';
          const maxHour = Math.max(...d.byHour.map(h => h.count), 1);
          const hourMap = {};
          d.byHour.forEach(h => { hourMap[h.hour] = h.count; });
          for (let h = 0; h < 24; h++) {
            const count = hourMap[h] || 0;
            const pct = count > 0 ? Math.max((count / maxHour * 100), 5) : 0;
            html += '<div class="hour-bar-wrap"><div class="hour-bar" style="height:' + pct + '%;"><span class="hour-bar-tooltip">' + h + ':00 - ' + count + '</span></div>';
            html += '<div class="hour-label">' + (h % 3 === 0 ? h : '') + '</div></div>';
          }
          html += '</div></div>';

          html += '<div class="dash-section"><h3>📈 Tendencia diaria (30d)</h3>';
          if (d.dailyTrend.length > 0) {
            html += '<div class="trend-chart">';
            const maxDay = Math.max(...d.dailyTrend.map(t => t.count), 1);
            d.dailyTrend.forEach((t, i) => {
              const pct = Math.max((t.count / maxDay * 100), 5);
              const dayLabel = new Date(t.day).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
              const showLabel = i === 0 || i === d.dailyTrend.length - 1 || i % 5 === 0;
              html += '<div class="trend-bar-wrap"><div class="trend-bar" style="height:' + pct + '%;"><span class="trend-bar-tooltip">' + dayLabel + ': ' + t.count + '</span></div>';
              html += '<div class="trend-label">' + (showLabel ? dayLabel : '') + '</div></div>';
            });
            html += '</div>';
          } else {
            html += '<div class="dash-empty">Sin datos</div>';
          }
          html += '</div></div>';

          document.getElementById('dashboardContent').innerHTML = html;
        }

        loadData();
        setInterval(loadData, 5000);
      </script>
    </body></html>
  `);
});
// ==================== PÁGINA GARITA/SEGURIDAD ====================
app.get('/garita', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Control de Accesos - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container-wide">
        <div class="header">
          <div class="header-left">
            <img src="${logoSrc}" alt="OCASA" class="logo">
            <div>
              <h1>Control de Accesos</h1>
              <p class="subtitle" style="margin:0;">Seguridad - Vehículos en predio</p>
            </div>
          </div>
        </div>
        
        <div class="grid-2" id="kpis">
          <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">En predio</div></div>
          <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Egresos hoy</div></div>
        </div>
        
        <div style="margin-bottom: 16px;">
          <input type="text" id="searchPatente" placeholder="Buscar por patente..." style="font-size:15px;"
                 oninput="filterByPatente()">
        </div>

        <div class="tabs">
          <button class="tab active" onclick="showTab('predio')">En Predio</button>
          <button class="tab" onclick="showTab('egresos')">Egresos</button>
        </div>

        <div id="predio"></div>
        <div id="egresos" style="display:none;"></div>
        
        <p class="refresh-notice">🔄 Actualizando automáticamente cada 5 segundos</p>
      </div>
      
      <!-- Modal detalle -->
      <div class="modal-overlay" id="modal">
        <div class="modal">
          <div class="modal-header">
            <h2 id="modal-title">Detalle</h2>
            <button class="modal-close" onclick="closeModal()">✕</button>
          </div>
          <div id="modal-content"></div>
        </div>
      </div>
      
      <script>
        let allTurnos = [];
        
        async function loadData() {
          try {
            const res = await fetch('/api/turnos');
            const data = await res.json();
            allTurnos = data.turnos || [];
            renderKPIs();
            renderPredio();
            renderEgresos();
          } catch(e) {
            console.error(e);
          }
        }
        
        function renderKPIs() {
          const enPredio = allTurnos.filter(t => t.status !== 'EGRESADO').length;
          const egresosHoy = allTurnos.filter(t => {
            if (t.status !== 'EGRESADO' || !t.ts_egreso) return false;
            const today = new Date().toDateString();
            return new Date(t.ts_egreso).toDateString() === today;
          }).length;
          
          document.getElementById('kpis').innerHTML = 
            '<div class="kpi"><div class="kpi-value">' + enPredio + '</div><div class="kpi-label">En predio</div></div>' +
            '<div class="kpi"><div class="kpi-value">' + egresosHoy + '</div><div class="kpi-label">Egresos hoy</div></div>';
        }
        
        let searchFilter = '';

        function filterByPatente() {
          searchFilter = document.getElementById('searchPatente').value.toUpperCase();
          renderPredio();
          renderEgresos();
        }

        function getTimeAgo(ts) {
          if (!ts) return '';
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
          if (mins < 1) return 'ahora';
          if (mins < 60) return mins + ' min';
          const hrs = Math.floor(mins / 60);
          const remMins = mins % 60;
          return hrs + 'h ' + remMins + 'm';
        }

        function getTimeBadgeClass(ts) {
          if (!ts) return 'time-badge';
          const mins = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
          if (mins > 120) return 'time-badge danger';
          if (mins > 60) return 'time-badge warning';
          return 'time-badge';
        }

        function renderPredio() {
          let enPredio = allTurnos.filter(t => t.status !== 'EGRESADO');
          if (searchFilter) enPredio = enPredio.filter(t => t.truck.toUpperCase().includes(searchFilter));

          if (enPredio.length === 0) {
            document.getElementById('predio').innerHTML = '<div class="card" style="text-align:center; color:${colors.textMuted};">' + (searchFilter ? 'Sin resultados para "' + searchFilter + '"' : 'No hay vehículos en predio') + '</div>';
            return;
          }

          let html = '';
          enPredio.forEach(t => {
            html += '<div class="turno-card" onclick="showDetail(\\'' + t.turno_id + '\\')">';
            html += '<div class="turno-info">';
            html += '<h3>' + t.truck + ' ' + getStatusBadge(t.status) + '</h3>';
            html += '<p>' + t.carrier + (t.dock ? ' → ' + t.dock : '') + '</p>';
            html += '</div>';
            html += '<div class="turno-meta">';
            html += '<div class="' + getTimeBadgeClass(t.ts_entrada) + '">⏱ ' + getTimeAgo(t.ts_entrada) + '</div>';
            html += '<div class="time-badge">' + formatTime(t.ts_entrada) + '</div>';
            html += '</div></div>';
          });

          document.getElementById('predio').innerHTML = html;
        }
        
        function renderEgresos() {
          const egresos = allTurnos.filter(t => t.status === 'EGRESADO');
          if (egresos.length === 0) {
            document.getElementById('egresos').innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">No hay egresos registrados</div>';
            return;
          }
          
          let html = '';
          egresos.slice(0, 50).forEach(t => {
            html += '<div class="turno-card" onclick="showDetail(\\'' + t.turno_id + '\\')">';
            html += '<div class="turno-info">';
            html += '<h3>' + t.truck + '</h3>';
            html += '<p>' + t.carrier + '</p>';
            html += '</div>';
            html += '<div class="turno-meta">';
            html += '<div class="time">Egreso</div>';
            html += '<div class="time">' + formatTime(t.ts_egreso) + '</div>';
            html += '</div></div>';
          });
          
          document.getElementById('egresos').innerHTML = html;
        }
        
        function showTab(tab) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          event.target.classList.add('active');
          document.getElementById('predio').style.display = tab === 'predio' ? 'block' : 'none';
          document.getElementById('egresos').style.display = tab === 'egresos' ? 'block' : 'none';
        }
        
        function showDetail(turnoId) {
          const t = allTurnos.find(x => x.turno_id === turnoId);
          if (!t) return;
          
          document.getElementById('modal-title').textContent = t.truck;
          
          let html = '<div class="timeline">';
          html += renderTimelineItem(t.ts_entrada, 'Ingreso registrado');
          html += renderTimelineItem(t.ts_asignacion, 'Dársena asignada' + (t.dock ? ': ' + t.dock : ''));
          html += renderTimelineItem(t.ts_atracado, 'Atracado');
          html += renderTimelineItem(t.ts_desatracado, 'Desatracado');
          html += renderTimelineItem(t.ts_egreso, 'Egreso');
          html += '</div>';
          
          document.getElementById('modal-content').innerHTML = html;
          document.getElementById('modal').classList.add('active');
        }
        
        function renderTimelineItem(ts, text) {
          const done = ts ? 'done' : '';
          return '<div class="timeline-item ' + done + '">' +
            '<div class="timeline-time">' + formatDateTime(ts) + '</div>' +
            '<div class="timeline-text">' + text + '</div></div>';
        }
        
        function closeModal() {
          document.getElementById('modal').classList.remove('active');
        }

        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape') closeModal();
        });

        document.getElementById('modal').addEventListener('click', function(e) {
          if (e.target === this) closeModal();
        });

        function getStatusBadge(status) {
          const badges = {
            'ESPERANDO_ASIGNACION': '<span class="badge badge-yellow">Esperando</span>',
            'DARSENA_ASIGNADA': '<span class="badge badge-primary">Asignada</span>',
            'ATRACADO': '<span class="badge badge-green">Atracado</span>',
            'DESATRACADO': '<span class="badge badge-orange">Desatracado</span>',
            'EGRESADO': '<span class="badge badge-dark">Egresado</span>'
          };
          return badges[status] || status;
        }

        function formatTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        }

        function formatDateTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        loadData();
        setInterval(loadData, 5000);
      </script>
    </body></html>
  `);
});
// ==================== PÁGINA GARITA-REGISTRO ====================
app.get('/garita-registro', (req, res) => {
  const carriers = [
    "Acaricia Transporte Logan","Adrian Servicio","Alfa Omega","Americantec","Andesmar","Andreani","Apicol","ASPELEYTER","Avaltrans","AYG Trucks",
    "Bahia SRL","Balboa","Bataglia","Beira Mar","Bessone","Better Catering","Biopak","BL Puerto y Logística","Blanca Luna","Brouclean","Bulonera Central","Bulonera Pacheco",
    "Camila Duarte","Cantarini","CASA Thames","CBC Group","CFA Fumigación","Ciari","Cimes","CISA","CLSA","Comercial Ñandubay","Container Leasing","CORREO Urbano","Cruz del Sur","CST Transporte",
    "DATULI","Del Valle","DHL","Don Antonio","Don Gumer","DPD","Duro",
    "Enviopack","EPSA","Erbas","EURO Packaging","Expreso Oro Negro",
    "Failde","FAILE","Flecha Lok","FM Transporte","FRATI","Fravega","FIS Logística",
    "Gabcin","Gentile","Grabet","Grasso","Grupo GLI","Grupo Luro","Grupo Silco","Guevara Fletes",
    "HDL Transporte","HECA","HFL","HIMP A","Hornero",
    "IAFRATELLI","IFLOW","Impresur","Internavegación","INTERMEDIO","Id Group",
    "Joaquin","JM Yaya e Hijos","Juarez",
    "La Sevillanita","La Tablada","LEO Trucks","Lir","Loginter","Logística del Valle","Logística Giménez","Logística Integral Romano","Logística Soria","Logitech","Lomas del Mirador","LTN","Luisito","Lugone","Ludamany",
    "Marra e Hijos","Marino","MARIANO","Maringa","MAV","Meli (Mercado Libre)","MICHELIN (Mantenimiento)","Mirtrans","Moova","Moreiro","Multarys Traslados",
    "Nahuel Remolques","Navarro","NB Cargo","Newsan","Nieva","Norlog","Norte",
    "OCA","OCASA","Oliveri Transporte","Onetrade","Oro Negro","Oriente Elevadores",
    "Pabile","Paganini","PANGEA","Parra","Pavile","PEF","PLK Group","Promei","Provenzano","PYTEL",
    "QX",
    "Ragazzi","Reyna Isabel","Romano","Ruta 21 DPD",
    "Saff","Sainz","SERVINTAR","SERVITRAN","SIARI","Sipe","Spineta","STC","SUMAR Servicio Industrial",
    "Técnica Lift","Techin","TGC Autoelevadores","Thames","Toledo","Transporte del Valle","Transporte Grasso","Transporte Juarez","Transporte Norte","Transporte Trejo","Tronador",
    "Unibrick","Unión Logística","Unitrans","Urbano Logística",
    "Vega","VOLKOV","Vento",
    "Webpack","WBL",
    "Otros"
  ];
  const carrierListJSON = JSON.stringify(carriers);

  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Garita - Registro de Ingresos/Egresos</title>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>
      <style>${styles}
        .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px; }
        label { display: block; text-align: left; color: ${colors.textMuted}; font-size: 13px; margin-bottom: 4px; margin-top: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
        .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        textarea { width: 100%; padding: 12px; border: 2px solid rgba(255,255,255,0.1); border-radius: 12px; font-size: 15px; background: rgba(255,255,255,0.05); color: white; min-height: 80px; resize: vertical; font-family: inherit; }
        textarea:focus { outline: none; border-color: ${colors.primary}; }
        .banner-info { background: rgba(0,153,168,0.15); border: 1px solid ${colors.primary}; color: ${colors.primary}; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .banner-error { background: rgba(239,68,68,0.15); border: 1px solid #ef4444; color: #fca5a5; padding: 12px; border-radius: 8px; margin-bottom: 12px; font-size: 14px; }
        .toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); background: ${colors.green}; color: white; padding: 14px 28px; border-radius: 12px; font-weight: 600; z-index: 2000; display: none; box-shadow: 0 4px 20px rgba(0,0,0,0.3); }
        .toast.active { display: block; animation: fadeInUp 0.3s ease; }
        @keyframes fadeInUp { from { opacity:0; transform: translateX(-50%) translateY(20px); } to { opacity:1; transform: translateX(-50%) translateY(0); } }
        .guard-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
        .guard-header .guard-name { font-size: 14px; color: ${colors.primary}; font-weight: 600; }
        .egreso-card { background: rgba(255,255,255,0.08); border-radius: 12px; padding: 16px; margin: 16px 0; border: 1px solid rgba(255,255,255,0.1); }
        .egreso-card .row { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .egreso-card .label { color: ${colors.textMuted}; font-size: 13px; }
        .egreso-card .value { font-weight: 600; font-size: 15px; }
        .hist-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .hist-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 700px; }
        .hist-table th { background: rgba(0,153,168,0.2); color: ${colors.primary}; padding: 10px 8px; text-align: left; font-weight: 600; position: sticky; top: 0; }
        .hist-table td { padding: 10px 8px; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hist-table tr:hover { background: rgba(255,255,255,0.03); }
        .range-btns { display: flex; gap: 8px; margin-bottom: 12px; }
        .range-btn { padding: 8px 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.05); color: ${colors.light}; cursor: pointer; font-weight: 600; font-size: 13px; }
        .range-btn.active { background: ${colors.primary}; color: white; border-color: ${colors.primary}; }
        .carrier-dropdown { position: relative; }
        .carrier-list { position: absolute; top: 100%; left: 0; right: 0; max-height: 200px; overflow-y: auto; background: ${colors.darkBlue}; border: 1px solid rgba(255,255,255,0.15); border-radius: 0 0 12px 12px; z-index: 100; display: none; }
        .carrier-list.open { display: block; }
        .carrier-item { padding: 12px 16px; cursor: pointer; font-size: 15px; color: ${colors.light}; }
        .carrier-item:hover { background: rgba(0,153,168,0.2); }
        .carrier-item.highlighted { background: rgba(0,153,168,0.15); }
        @media (max-width: 768px) {
          .row-2 { grid-template-columns: 1fr; }
          .grid-3 { grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
          .kpi { padding: 12px; }
          .kpi-value { font-size: 28px; }
        }
        @media (max-width: 500px) {
          .grid-3 { grid-template-columns: 1fr; }
        }
      </style>
    </head><body>
      <div class="container-wide">
        <!-- LOGIN -->
        <div id="login-section">
          <div style="text-align:center; padding-top:60px;">
            <img src="${logoSrc}" alt="OCASA" class="logo-large">
            <div class="icon-circle icon-primary">🛡️</div>
            <h1>Acceso Garita</h1>
            <p class="subtitle">Ingresá tus credenciales</p>
          </div>
          <div class="card" style="max-width:400px; margin:0 auto;">
            <div id="login-error" class="error" style="display:none;"></div>
            <label>EMAIL</label>
            <input type="email" id="login-email" placeholder="guardia@ocasa.com">
            <label>CONTRASEÑA</label>
            <input type="password" id="login-pass" placeholder="Contraseña">
            <button class="btn btn-primary" onclick="doLogin()">Ingresar</button>
          </div>
        </div>

        <!-- PANEL PRINCIPAL (oculto hasta login) -->
        <div id="main-panel" style="display:none;">
          <div class="header">
            <div class="header-left">
              <img src="${logoSrc}" alt="OCASA" class="logo">
              <div>
                <h1>Registro de Garita</h1>
                <div class="guard-header">
                  <span class="guard-name" id="guard-name-display"></span>
                </div>
              </div>
            </div>
          </div>

          <!-- KPIs -->
          <div class="grid-3" id="kpis-garita">
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">En predio</div></div>
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Ingresos hoy</div></div>
            <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Egresos hoy</div></div>
          </div>

          <!-- TABS -->
          <div class="tabs">
            <button class="tab active" onclick="showTab('ingreso', this)">Ingreso</button>
            <button class="tab" onclick="showTab('egreso', this)">Egreso</button>
            <button class="tab" onclick="showTab('historial', this)">Historial</button>
          </div>

          <!-- TAB INGRESO -->
          <div id="tab-ingreso">
            <div class="card">
              <div id="ingreso-banner"></div>
              <div id="ingreso-error" class="error" style="display:none;"></div>

              <label>PATENTE TRACTOR *</label>
              <input type="text" id="ing-truck" placeholder="Ej: AA-123-BB" maxlength="10"
                     style="text-transform:uppercase; font-family:monospace; font-size:22px; text-align:center;"
                     onblur="checkPatente()">

              <label>TRANSPORTISTA *</label>
              <div class="carrier-dropdown">
                <input type="text" id="ing-carrier" placeholder="Escribí para buscar..." autocomplete="off"
                       oninput="filterCarriers()" onfocus="filterCarriers()">
                <div class="carrier-list" id="carrier-list"></div>
              </div>

              <label>NOMBRE Y APELLIDO DEL CHOFER *</label>
              <input type="text" id="ing-chofer" placeholder="Nombre completo">

              <div class="row-2">
                <div>
                  <label>DNI CHOFER</label>
                  <input type="text" id="ing-dni" placeholder="Ej: 12345678" maxlength="10">
                </div>
                <div>
                  <label>CELULAR</label>
                  <input type="tel" id="ing-celular" placeholder="Ej: 1155554444">
                </div>
              </div>

              <div class="row-2">
                <div>
                  <label>PATENTE SEMI</label>
                  <input type="text" id="ing-semi" placeholder="Semi/Acoplado" style="text-transform:uppercase;" maxlength="10">
                </div>
                <div>
                  <label>N° CONTENEDOR</label>
                  <input type="text" id="ing-contenedor" placeholder="Contenedor">
                </div>
              </div>

              <div class="row-2">
                <div>
                  <label>PRECINTO</label>
                  <input type="text" id="ing-precinto" placeholder="N° precinto">
                </div>
                <div>
                  <label>NAVE</label>
                  <select id="ing-nave">
                    <option value="">Sin asignar</option>
                    <option value="PL2">PL2</option>
                    <option value="PL3">PL3</option>
                  </select>
                </div>
              </div>

              <label>VIAJE HDR</label>
              <input type="text" id="ing-viaje" placeholder="N° de viaje (opcional)">

              <label>ENTRA VACÍO O CON CARGA *</label>
              <select id="ing-carga">
                <option value="" disabled selected>Seleccioná...</option>
                <option value="VACIO">Vacío</option>
                <option value="CON_CARGA">Con carga</option>
              </select>

              <label>OBSERVACIONES DE INGRESO</label>
              <textarea id="ing-obs" placeholder="Observaciones..."></textarea>

              <button class="btn btn-primary" id="btn-ingreso" onclick="registrarIngreso()">Registrar Ingreso</button>
            </div>
          </div>

          <!-- TAB EGRESO -->
          <div id="tab-egreso" style="display:none;">
            <div class="card">
              <div id="egreso-error" class="error" style="display:none;"></div>

              <label>BUSCAR POR PATENTE</label>
              <div style="display:flex; gap:8px;">
                <input type="text" id="egr-truck" placeholder="Patente del tractor"
                       style="text-transform:uppercase; font-family:monospace; font-size:20px; text-align:center; flex:1;"
                       onkeydown="if(event.key==='Enter')buscarParaEgreso()">
                <button class="btn btn-primary" onclick="buscarParaEgreso()" style="width:auto; margin-top:0; padding:12px 24px;">Buscar</button>
              </div>

              <div id="egreso-result" style="display:none;">
                <div class="egreso-card" id="egreso-info"></div>
                <label>OBSERVACIONES DE EGRESO</label>
                <textarea id="egr-obs" placeholder="Observaciones de salida..."></textarea>
                <button class="btn btn-orange" id="btn-egreso" onclick="confirmarEgreso()">Confirmar Egreso</button>
              </div>
            </div>
          </div>

          <!-- TAB HISTORIAL -->
          <div id="tab-historial" style="display:none;">
            <div class="card">
              <div class="range-btns">
                <button class="range-btn" onclick="loadHistorial(0, this)">Hoy</button>
                <button class="range-btn active" onclick="loadHistorial(7, this)">7 días</button>
                <button class="range-btn" onclick="loadHistorial(30, this)">30 días</button>
              </div>
              <input type="text" id="hist-filter" placeholder="Filtrar por patente..." style="font-size:14px; margin-bottom:12px;"
                     oninput="filterHistorial()">
              <div class="hist-table-wrap">
                <table class="hist-table">
                  <thead>
                    <tr>
                      <th>Fecha</th><th>Patente</th><th>Semi</th><th>Chofer</th>
                      <th>Empresa</th><th>Nave</th><th>Estado</th><th>Obs</th>
                    </tr>
                  </thead>
                  <tbody id="hist-body"></tbody>
                </table>
              </div>
            </div>
          </div>

          <p class="refresh-notice">🔄 Actualizando automáticamente</p>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast" id="toast"></div>

      <!-- Modal QR -->
      <div class="modal-overlay" id="qr-modal" style="display:none; align-items:center; justify-content:center;">
        <div class="modal" style="max-width:360px; text-align:center; padding:32px 24px;">
          <h2 style="margin-bottom:4px;" id="qr-turno-title">Turno registrado</h2>
          <p style="color:${colors.textMuted}; font-size:14px; margin-bottom:20px;">Mostrá este QR al chofer para que pueda seguir su turno desde su celular</p>
          <div id="qr-container" style="display:flex; justify-content:center; margin-bottom:20px;"></div>
          <p style="font-size:12px; color:${colors.textMuted}; margin-bottom:20px;" id="qr-url-text"></p>
          <button class="btn btn-primary" onclick="closeQRModal()" style="margin-bottom:8px;">Registrar otro ingreso</button>
          <button class="btn" onclick="printQR()" style="background:${colors.light}; color:${colors.textPrimary};">Imprimir QR</button>
        </div>
      </div>

      <!-- Modal detalle -->
      <div class="modal-overlay" id="modal">
        <div class="modal">
          <div class="modal-header">
            <h2 id="modal-title">Detalle</h2>
            <button class="modal-close" onclick="closeModal()">✕</button>
          </div>
          <div id="modal-content"></div>
        </div>
      </div>

      <script>
        const CARRIERS = ${carrierListJSON};
        let guardNombre = '';
        let guardEmail = '';
        let allTurnos = [];
        let historialData = [];
        let enrichingTurno = null;

        // ===== LOGIN =====
        document.getElementById('login-pass').addEventListener('keydown', e => { if(e.key==='Enter') doLogin(); });

        async function doLogin() {
          const email = document.getElementById('login-email').value.trim();
          const pass = document.getElementById('login-pass').value;
          if (!email || !pass) { showLoginError('Completá email y contraseña'); return; }

          try {
            const res = await fetch('/api/garita/login', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password: pass })
            });
            const data = await res.json();
            if (!data.success) { showLoginError(data.error); return; }

            guardNombre = data.nombre;
            guardEmail = data.email;
            document.getElementById('guard-name-display').textContent = '🛡️ ' + guardNombre;
            document.getElementById('login-section').style.display = 'none';
            document.getElementById('main-panel').style.display = 'block';
            loadKPIs();
            document.getElementById('ing-truck').focus();
          } catch(e) {
            showLoginError('Error de conexión');
          }
        }

        function showLoginError(msg) {
          const el = document.getElementById('login-error');
          el.textContent = msg; el.style.display = 'block';
          setTimeout(() => el.style.display = 'none', 4000);
        }

        // ===== TABS =====
        function showTab(tab, btn) {
          document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
          if (btn) btn.classList.add('active');
          document.getElementById('tab-ingreso').style.display = tab === 'ingreso' ? 'block' : 'none';
          document.getElementById('tab-egreso').style.display = tab === 'egreso' ? 'block' : 'none';
          document.getElementById('tab-historial').style.display = tab === 'historial' ? 'block' : 'none';
          if (tab === 'historial') loadHistorial(7);
        }

        // ===== KPIs =====
        async function loadKPIs() {
          try {
            const res = await fetch('/api/turnos');
            const data = await res.json();
            allTurnos = data.turnos || [];

            const enPredio = allTurnos.filter(t => t.status !== 'EGRESADO').length;
            const today = new Date().toDateString();
            const ingresosHoy = allTurnos.filter(t => new Date(t.ts_entrada).toDateString() === today).length;
            const egresosHoy = allTurnos.filter(t => t.status === 'EGRESADO' && t.ts_egreso && new Date(t.ts_egreso).toDateString() === today).length;

            document.getElementById('kpis-garita').innerHTML =
              '<div class="kpi"><div class="kpi-value">' + enPredio + '</div><div class="kpi-label">En predio</div></div>' +
              '<div class="kpi"><div class="kpi-value">' + ingresosHoy + '</div><div class="kpi-label">Ingresos hoy</div></div>' +
              '<div class="kpi"><div class="kpi-value">' + egresosHoy + '</div><div class="kpi-label">Egresos hoy</div></div>';
          } catch(e) { console.error(e); }
        }

        // ===== COMBOBOX CARRIERS =====
        let carrierHighlight = -1;

        function filterCarriers() {
          const val = document.getElementById('ing-carrier').value.toLowerCase();
          const list = document.getElementById('carrier-list');
          const filtered = CARRIERS.filter(c => c.toLowerCase().includes(val));
          carrierHighlight = -1;

          if (filtered.length === 0 || !val) { list.classList.remove('open'); return; }

          list.innerHTML = filtered.map(c =>
            '<div class="carrier-item" onclick="selectCarrier(\\'' + c.replace(/'/g, "\\\\'") + '\\')">' + c + '</div>'
          ).join('');
          list.classList.add('open');
        }

        function selectCarrier(name) {
          document.getElementById('ing-carrier').value = name;
          document.getElementById('carrier-list').classList.remove('open');
        }

        document.addEventListener('click', e => {
          if (!e.target.closest('.carrier-dropdown')) {
            document.getElementById('carrier-list').classList.remove('open');
          }
        });

        document.getElementById('ing-carrier').addEventListener('keydown', e => {
          const list = document.getElementById('carrier-list');
          const items = list.querySelectorAll('.carrier-item');
          if (!list.classList.contains('open') || items.length === 0) return;

          if (e.key === 'ArrowDown') { e.preventDefault(); carrierHighlight = Math.min(carrierHighlight + 1, items.length - 1); updateCarrierHighlight(items); }
          else if (e.key === 'ArrowUp') { e.preventDefault(); carrierHighlight = Math.max(carrierHighlight - 1, 0); updateCarrierHighlight(items); }
          else if (e.key === 'Enter' && carrierHighlight >= 0) { e.preventDefault(); items[carrierHighlight].click(); }
        });

        function updateCarrierHighlight(items) {
          items.forEach((it, i) => it.classList.toggle('highlighted', i === carrierHighlight));
          if (items[carrierHighlight]) items[carrierHighlight].scrollIntoView({ block: 'nearest' });
        }

        // ===== CHECK PATENTE (auto-check on blur) =====
        async function checkPatente() {
          const truck = document.getElementById('ing-truck').value.trim().toUpperCase();
          const banner = document.getElementById('ingreso-banner');
          enrichingTurno = null;
          banner.innerHTML = '';

          if (!truck || truck.length < 3) return;

          try {
            // 1. Check duplicado en predio
            const dupRes = await fetch('/api/garita/check-duplicado/' + encodeURIComponent(truck));
            const dupData = await dupRes.json();

            if (dupData.exists) {
              const turno = dupData.turnos[0];
              if ((dupData.registrado_por || 'driver') === 'driver') {
                enrichingTurno = turno;
                banner.innerHTML = '<div class="banner-info">ℹ️ Vehículo ya registrado por el chofer (turno ' + turno.turno_id + '). Se completarán los datos de garita.</div>';
                if (turno.carrier) document.getElementById('ing-carrier').value = turno.carrier;
                if (turno.warehouse) document.getElementById('ing-nave').value = turno.warehouse;
              } else {
                banner.innerHTML = '<div class="banner-error">⚠️ Vehículo ya registrado en predio por garita. Registrá el egreso primero.</div>';
              }
              return;
            }

            // 2. Buscar viajes programados para hoy (Google Sheets)
            const patenteClean = truck.replace(/[-\\s]/g, '');
            if (patenteClean.length < 5) return;

            banner.innerHTML = '<div class="banner-info">🔍 Buscando viajes programados para esta patente...</div>';

            const sheetRes = await fetch('/api/buscar-patente/' + encodeURIComponent(patenteClean));
            const sheetData = await sheetRes.json();

            if (sheetData.found && sheetData.trips && sheetData.trips.length > 0) {
              const trips = sheetData.trips;
              const count = trips.length;
              const naves = [...new Set(trips.map(t => t.warehouse || t.deposito).filter(Boolean))].join(', ');

              // Auto-completar transportista
              const firstCarrier = trips.find(t => t.transporte);
              if (firstCarrier) document.getElementById('ing-carrier').value = firstCarrier.transporte;

              // Auto-completar nave (si hay una sola)
              if (trips.length === 1 && trips[0].warehouse) {
                document.getElementById('ing-nave').value = trips[0].warehouse;
              }

              // Auto-completar viaje (si hay uno solo)
              if (trips.length === 1 && trips[0].tripNumber) {
                document.getElementById('ing-viaje').value = trips[0].tripNumber;
              }

              // Mostrar banner con viajes encontrados
              let tripHtml = '<div class="banner-info" style="margin-bottom:0;">✅ ' + count + ' viaje' + (count > 1 ? 's' : '') + ' encontrado' + (count > 1 ? 's' : '') + ' para hoy — Nave' + (count > 1 ? 's' : '') + ': ' + naves + '</div>';
              if (count > 1) {
                tripHtml += '<div style="margin-top:8px;">';
                trips.forEach(t => {
                  tripHtml += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,153,168,0.08);border-radius:6px;margin-top:4px;font-size:13px;">';
                  tripHtml += '<span>📦 Viaje ' + (t.tripNumber || 'S/N') + '</span>';
                  if (t.warehouse) tripHtml += '<span style="margin-left:auto;font-weight:700;color:${colors.primary};">' + t.warehouse + '</span>';
                  tripHtml += '</div>';
                });
                tripHtml += '</div>';
              }
              banner.innerHTML = tripHtml;
            } else {
              banner.innerHTML = '<div style="background:rgba(255,171,64,0.12);border:1px solid rgba(255,171,64,0.3);color:#ffab40;padding:10px 12px;border-radius:8px;font-size:13px;">⚠️ Sin viajes programados para hoy. Completá los datos manualmente.</div>';
            }
          } catch(e) { console.error(e); banner.innerHTML = ''; }
        }

        // ===== REGISTRAR INGRESO =====
        async function registrarIngreso() {
          const truck = document.getElementById('ing-truck').value.trim().toUpperCase();
          const carrier = document.getElementById('ing-carrier').value.trim();
          const chofer = document.getElementById('ing-chofer').value.trim();
          const carga_estado = document.getElementById('ing-carga').value;

          if (!truck || !carrier || !chofer) {
            showIngresoError('Completá patente, transportista y nombre del chofer');
            return;
          }
          if (!carga_estado) {
            showIngresoError('Indicá si el camión entra vacío o con carga');
            return;
          }

          const btn = document.getElementById('btn-ingreso');
          btn.disabled = true; btn.textContent = '⏳ Procesando...';

          try {
            const res = await fetch('/api/garita/entrada', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                truck,
                carrier,
                chofer,
                dni_chofer: document.getElementById('ing-dni').value.trim(),
                celular_chofer: document.getElementById('ing-celular').value.trim(),
                patente_semi: document.getElementById('ing-semi').value.trim().toUpperCase(),
                contenedor: document.getElementById('ing-contenedor').value.trim(),
                precinto: document.getElementById('ing-precinto').value.trim(),
                warehouse: document.getElementById('ing-nave').value,
                obs_ingreso: document.getElementById('ing-obs').value.trim(),
                viaje_hdr: document.getElementById('ing-viaje').value.trim(),
                carga_estado,
                registrado_por: guardEmail
              })
            });
            const data = await res.json();

            if (!data.success) { showIngresoError(data.error); return; }

            resetIngresoForm();
            loadKPIs();
            showQRModal(data.turno_id);
          } catch(e) {
            showIngresoError('Error de conexión');
          } finally {
            btn.disabled = false; btn.textContent = 'Registrar Ingreso';
          }
        }

        // ===== MODAL QR =====
        function showQRModal(turnoId) {
          const url = window.location.origin + '/turno/' + turnoId;
          document.getElementById('qr-turno-title').textContent = 'Turno ' + turnoId;
          document.getElementById('qr-url-text').textContent = url;
          const container = document.getElementById('qr-container');
          container.innerHTML = '';
          new QRCode(container, { text: url, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
          const modal = document.getElementById('qr-modal');
          modal.style.display = 'flex';
        }

        function closeQRModal() {
          document.getElementById('qr-modal').style.display = 'none';
          document.getElementById('ing-truck').focus();
        }

        function printQR() {
          const url = document.getElementById('qr-url-text').textContent;
          const title = document.getElementById('qr-turno-title').textContent;
          const qrImg = document.querySelector('#qr-container img');
          if (!qrImg) return;
          const win = window.open('', '_blank');
          win.document.write('<html><body style="text-align:center;font-family:sans-serif;padding:40px;">' +
            '<h2>' + title + '</h2><img src="' + qrImg.src + '" style="width:220px;height:220px;"><br>' +
            '<p style="font-size:12px;color:#666;">' + url + '</p>' +
            '<p style="font-size:13px;">Escaneá para seguir tu turno en OCASA</p></body></html>');
          win.document.close();
          win.print();
        }

        function showIngresoError(msg) {
          const el = document.getElementById('ingreso-error');
          el.textContent = msg; el.style.display = 'block';
          setTimeout(() => el.style.display = 'none', 5000);
        }

        function resetIngresoForm() {
          ['ing-truck','ing-carrier','ing-chofer','ing-dni','ing-celular','ing-semi','ing-contenedor','ing-precinto','ing-viaje'].forEach(id => {
            document.getElementById(id).value = '';
          });
          document.getElementById('ing-nave').value = '';
          document.getElementById('ing-carga').value = '';
          document.getElementById('ing-obs').value = '';
          document.getElementById('ingreso-banner').innerHTML = '';
          enrichingTurno = null;
        }

        // ===== BUSCAR PARA EGRESO =====
        let egresoTurno = null;

        async function buscarParaEgreso() {
          const truck = document.getElementById('egr-truck').value.trim().toUpperCase();
          if (!truck) return;

          const errorEl = document.getElementById('egreso-error');
          const resultEl = document.getElementById('egreso-result');
          errorEl.style.display = 'none';
          resultEl.style.display = 'none';
          egresoTurno = null;

          try {
            const res = await fetch('/api/garita/check-duplicado/' + encodeURIComponent(truck));
            const data = await res.json();

            if (!data.exists) {
              errorEl.textContent = 'No se encontró vehículo activo con patente ' + truck;
              errorEl.style.display = 'block';
              return;
            }

            const t = data.turnos[0];
            egresoTurno = t;

            const tiempoMs = Date.now() - new Date(t.ts_entrada).getTime();
            const hrs = Math.floor(tiempoMs / 3600000);
            const mins = Math.floor((tiempoMs % 3600000) / 60000);
            const tiempoStr = hrs > 0 ? hrs + 'h ' + mins + 'm' : mins + ' min';

            document.getElementById('egreso-info').innerHTML =
              '<div class="row"><span class="label">Patente</span><span class="value">' + t.truck + '</span></div>' +
              '<div class="row"><span class="label">Transportista</span><span class="value">' + (t.carrier || '-') + '</span></div>' +
              '<div class="row"><span class="label">Chofer</span><span class="value">' + (t.chofer || '-') + '</span></div>' +
              '<div class="row"><span class="label">Tiempo en predio</span><span class="value">' + tiempoStr + '</span></div>' +
              '<div class="row"><span class="label">Estado actual</span><span class="value">' + getStatusBadge(t.status) + '</span></div>' +
              '<div class="row"><span class="label">Ingreso</span><span class="value">' + formatDateTime(t.ts_entrada) + '</span></div>';

            resultEl.style.display = 'block';
          } catch(e) {
            errorEl.textContent = 'Error de conexión';
            errorEl.style.display = 'block';
          }
        }

        async function confirmarEgreso() {
          if (!egresoTurno) return;

          const btn = document.getElementById('btn-egreso');
          btn.disabled = true; btn.textContent = '⏳ Procesando...';

          try {
            const res = await fetch('/api/garita/salida', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                truck: egresoTurno.truck,
                obs_egreso: document.getElementById('egr-obs').value.trim()
              })
            });
            const data = await res.json();

            if (!data.success) {
              document.getElementById('egreso-error').textContent = data.error;
              document.getElementById('egreso-error').style.display = 'block';
              return;
            }

            const turno = data.turno;
            const tiempoMs = new Date(turno.ts_egreso).getTime() - new Date(turno.ts_entrada).getTime();
            const hrs = Math.floor(tiempoMs / 3600000);
            const mins = Math.floor((tiempoMs % 3600000) / 60000);
            showToast('✅ Egreso confirmado — ' + turno.truck + ' (' + (hrs > 0 ? hrs + 'h ' : '') + mins + 'm en predio)');

            document.getElementById('egr-truck').value = '';
            document.getElementById('egr-obs').value = '';
            document.getElementById('egreso-result').style.display = 'none';
            egresoTurno = null;
            loadKPIs();
          } catch(e) {
            document.getElementById('egreso-error').textContent = 'Error de conexión';
            document.getElementById('egreso-error').style.display = 'block';
          } finally {
            btn.disabled = false; btn.textContent = 'Confirmar Egreso';
          }
        }

        // ===== HISTORIAL =====
        let currentDays = 7;

        async function loadHistorial(days, btn) {
          if (days !== undefined) currentDays = days;
          if (btn) {
            document.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
          }

          const d = currentDays === 0 ? 1 : currentDays;
          try {
            const res = await fetch('/api/garita/historial?days=' + d);
            const data = await res.json();
            historialData = data.turnos || [];

            if (currentDays === 0) {
              const today = new Date().toDateString();
              historialData = historialData.filter(t => new Date(t.ts_entrada).toDateString() === today);
            }

            renderHistorial();
          } catch(e) { console.error(e); }
        }

        function filterHistorial() {
          renderHistorial();
        }

        function renderHistorial() {
          const filter = (document.getElementById('hist-filter').value || '').toUpperCase();
          let filtered = historialData;
          if (filter) filtered = filtered.filter(t => t.truck.toUpperCase().includes(filter));

          const tbody = document.getElementById('hist-body');
          if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; opacity:0.5; padding:24px;">Sin registros</td></tr>';
            return;
          }

          tbody.innerHTML = filtered.map(t =>
            '<tr onclick="showDetail(\\'' + t.turno_id + '\\')" style="cursor:pointer;">' +
            '<td>' + formatDateTime(t.ts_entrada) + '</td>' +
            '<td style="font-weight:600;">' + t.truck + '</td>' +
            '<td>' + (t.patente_semi || '-') + '</td>' +
            '<td>' + (t.chofer || '-') + '</td>' +
            '<td>' + (t.carrier || '-') + '</td>' +
            '<td>' + (t.warehouse || '-') + '</td>' +
            '<td>' + getStatusBadge(t.status) + '</td>' +
            '<td>' + (t.obs_ingreso || '-') + '</td></tr>'
          ).join('');
        }

        // ===== MODAL DETALLE (reutilizado de /garita) =====
        function showDetail(turnoId) {
          const t = (historialData.length > 0 ? historialData : allTurnos).find(x => x.turno_id === turnoId);
          if (!t) return;

          document.getElementById('modal-title').textContent = t.truck + ' — ' + (t.carrier || '');

          let html = '<div style="margin-bottom:16px;">';
          if (t.chofer) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Chofer</span><span style="font-weight:600;">' + t.chofer + '</span></div>';
          if (t.carga_estado) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Carga</span><span>' + (t.carga_estado === 'CON_CARGA' ? 'Con carga' : 'Vacío') + '</span></div>';
          if (t.dni_chofer) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">DNI</span><span>' + t.dni_chofer + '</span></div>';
          if (t.celular_chofer) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Celular</span><span>' + t.celular_chofer + '</span></div>';
          if (t.patente_semi) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Semi</span><span>' + t.patente_semi + '</span></div>';
          if (t.contenedor) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Contenedor</span><span>' + t.contenedor + '</span></div>';
          if (t.precinto) html += '<div class="row" style="display:flex; justify-content:space-between; margin-bottom:6px;"><span style="opacity:0.6;">Precinto</span><span>' + t.precinto + '</span></div>';
          html += '</div>';

          html += '<div class="timeline">';
          html += renderTimelineItem(t.ts_entrada, 'Ingreso registrado');
          html += renderTimelineItem(t.ts_asignacion, 'Dársena asignada' + (t.dock ? ': ' + t.dock : ''));
          html += renderTimelineItem(t.ts_atracado, 'Atracado');
          html += renderTimelineItem(t.ts_desatracado, 'Desatracado');
          html += renderTimelineItem(t.ts_egreso, 'Egreso');
          html += '</div>';

          if (t.obs_ingreso) html += '<div style="margin-top:12px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; font-size:13px;"><strong>Obs. Ingreso:</strong> ' + t.obs_ingreso + '</div>';
          if (t.obs_egreso) html += '<div style="margin-top:8px; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; font-size:13px;"><strong>Obs. Egreso:</strong> ' + t.obs_egreso + '</div>';

          document.getElementById('modal-content').innerHTML = html;
          document.getElementById('modal').classList.add('active');
        }

        function renderTimelineItem(ts, text) {
          const done = ts ? 'done' : '';
          return '<div class="timeline-item ' + done + '">' +
            '<div class="timeline-time">' + formatDateTime(ts) + '</div>' +
            '<div class="timeline-text">' + text + '</div></div>';
        }

        function closeModal() { document.getElementById('modal').classList.remove('active'); }

        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
        document.getElementById('modal').addEventListener('click', e => { if (e.target === document.getElementById('modal')) closeModal(); });

        // ===== UTILS =====
        function getStatusBadge(status) {
          const badges = {
            'ESPERANDO_ASIGNACION': '<span class="badge badge-yellow">Esperando</span>',
            'DARSENA_ASIGNADA': '<span class="badge badge-primary">Asignada</span>',
            'ATRACADO': '<span class="badge badge-green">Atracado</span>',
            'DESATRACADO': '<span class="badge badge-orange">Desatracado</span>',
            'EGRESADO': '<span class="badge badge-dark">Egresado</span>'
          };
          return badges[status] || status;
        }

        function formatTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        }

        function formatDateTime(ts) {
          if (!ts) return '--:--';
          return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
        }

        function showToast(msg) {
          const toast = document.getElementById('toast');
          toast.textContent = msg;
          toast.classList.add('active');
          setTimeout(() => toast.classList.remove('active'), 4000);
        }

        // ===== AUTO-REFRESH =====
        setInterval(loadKPIs, 10000);
      </script>
    </body></html>
  `);
});

// ==================== PÁGINA ADMIN (OCULTA) ====================
// ==================== PÁGINA ADMIN (OCULTA) ====================
app.get('/admin', (req, res) => {
  const carriers = [
    "Acaricia Transporte Logan","Adrian Servicio","Alfa Omega","Americantec","Andesmar","Andreani","Apicol","ASPELEYTER","Avaltrans","AYG Trucks",
    "Bahia SRL","Balboa","Bataglia","Beira Mar","Bessone","Better Catering","Biopak","BL Puerto y Logística","Blanca Luna","Brouclean","Bulonera Central","Bulonera Pacheco",
    "Camila Duarte","Cantarini","CASA Thames","CBC Group","CFA Fumigación","Ciari","Cimes","CISA","CLSA","Comercial Ñandubay","Container Leasing","CORREO Urbano","Cruz del Sur","CST Transporte",
    "DATULI","Del Valle","DHL","Don Antonio","Don Gumer","DPD","Duro",
    "Enviopack","EPSA","Erbas","EURO Packaging","Expreso Oro Negro",
    "Failde","FAILE","Flecha Lok","FM Transporte","FRATI","Fravega","FIS Logística",
    "Gabcin","Gentile","Grabet","Grasso","Grupo GLI","Grupo Luro","Grupo Silco","Guevara Fletes",
    "HDL Transporte","HECA","HFL","HIMP A","Hornero",
    "IAFRATELLI","IFLOW","Impresur","Internavegación","INTERMEDIO","Id Group",
    "Joaquin","JM Yaya e Hijos","Juarez",
    "La Sevillanita","La Tablada","LEO Trucks","Lir","Loginter","Logística del Valle","Logística Giménez","Logística Integral Romano","Logística Soria","Logitech","Lomas del Mirador","LTN","Luisito","Lugone","Ludamany",
    "Marra e Hijos","Marino","MARIANO","Maringa","MAV","Meli (Mercado Libre)","MICHELIN (Mantenimiento)","Mirtrans","Moova","Moreiro","Multarys Traslados",
    "Nahuel Remolques","Navarro","NB Cargo","Newsan","Nieva","Norlog","Norte",
    "OCA","OCASA","Oliveri Transporte","Onetrade","Oro Negro","Oriente Elevadores",
    "Pabile","Paganini","PANGEA","Parra","Pavile","PEF","PLK Group","Promei","Provenzano","PYTEL",
    "QX",
    "Ragazzi","Reyna Isabel","Romano","Ruta 21 DPD",
    "Saff","Sainz","SERVINTAR","SERVITRAN","SIARI","Sipe","Spineta","STC","SUMAR Servicio Industrial",
    "Técnica Lift","Techin","TGC Autoelevadores","Thames","Toledo","Transporte del Valle","Transporte Grasso","Transporte Juarez","Transporte Norte","Transporte Trejo","Tronador",
    "Unibrick","Unión Logística","Unitrans","Urbano Logística",
    "Vega","VOLKOV","Vento",
    "Webpack","WBL",
    "Otros"
  ];
  const carrierOptions = carriers.map(c => `<option value="${c}">${c}</option>`).join('');
  
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${fontLink}
      <title>Admin - OCASA Dock Manager</title>
      <style>${styles}
        .turno-admin { background: rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 8px; }
        .turno-admin-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
        .turno-admin-header h3 { margin: 0; }
        .turno-admin-actions { display: flex; gap: 8px; }
        .turno-admin-actions button { padding: 6px 12px; font-size: 12px; }
        .edit-form { display: none; margin-top: 12px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); }
        .edit-form.active { display: block; }
        .edit-form label { display: block; font-size: 12px; color: ${colors.textMuted}; margin: 8px 0 4px; }
        .edit-form input, .edit-form select { width: 100%; padding: 8px; font-size: 14px; margin-bottom: 4px; }
        .edit-form .row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .btn-delete { background: #dc3545 !important; }
        .btn-edit { background: #ffc107 !important; color: #000 !important; }
        .btn-save { background: #28a745 !important; }
      </style>
    </head><body>
      <div class="container-wide">
        <img src="${logoSrc}" alt="OCASA" class="logo">
        <h1>🔐 Panel de Administración</h1>
        
        <div id="login" class="card">
          <input type="password" id="pass" placeholder="Contraseña" style="width:100%; padding:16px; font-size:18px; border-radius:8px; border:none; margin-bottom:12px;">
          <button onclick="login()" style="width:100%;">Ingresar</button>
        </div>
        
        <div id="panel" style="display:none;">
          <div class="card">
            <h2 style="margin-top:0;">🧹 Limpiar Base de Datos</h2>
            <button onclick="limpiar('egresados')" style="width:100%; background:#ffc107; color:#000; margin-bottom:8px;">Borrar turnos finalizados</button>
            <button onclick="limpiar('viejos')" style="width:100%; background:#ff9800; margin-bottom:8px;">Borrar turnos +7 días</button>
            <button onclick="limpiar('todos')" style="width:100%; background:#dc3545;">⚠️ Borrar TODOS</button>
          </div>
          
          <h2 style="margin-top:24px;">📋 Gestión de Turnos</h2>
          <div id="turnos-admin"></div>
        </div>
      </div>
      
      <script>
        const PASS = 'Newsanpilar2026';
        const carrierOptions = \`${carrierOptions}\`;
        let allTurnos = [];
        
        function login() {
          if (document.getElementById('pass').value === PASS) {
            document.getElementById('login').style.display = 'none';
            document.getElementById('panel').style.display = 'block';
            loadTurnos();
          } else {
            alert('Contraseña incorrecta');
          }
        }
        
        async function loadTurnos() {
          const res = await fetch('/api/turnos');
          const data = await res.json();
          allTurnos = data.turnos || [];
          renderTurnos();
        }
        
        function renderTurnos() {
          const activos = allTurnos.filter(t => t.status !== 'EGRESADO');
          if (activos.length === 0) {
            document.getElementById('turnos-admin').innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">No hay turnos activos</div>';
            return;
          }
          
          let html = '';
          activos.forEach(t => {
            html += '<div class="turno-admin" id="turno-' + t.turno_id + '">';
            html += '<div class="turno-admin-header">';
            html += '<h3>' + t.truck + ' <span class="badge badge-primary">' + t.status + '</span></h3>';
            html += '<div class="turno-admin-actions">';
            html += '<button class="btn btn-edit" onclick="toggleEdit(\\'' + t.turno_id + '\\')">✏️ Editar</button>';
            html += '<button class="btn btn-delete" onclick="eliminar(\\'' + t.turno_id + '\\')">🗑️ Eliminar</button>';
            html += '</div></div>';
            html += '<p style="margin:0; font-size:13px; color:#aaa;">' + t.carrier + (t.trip_number ? ' • Viaje: ' + t.trip_number : '') + ' • ' + (t.warehouse || 'Sin nave') + ' • ' + (t.operation || 'Sin op') + (t.dock ? ' • ' + t.dock : '') + '</p>';
            
            html += '<div class="edit-form" id="edit-' + t.turno_id + '">';
            html += '<div class="row-2">';
            html += '<div><label>Patente</label><input type="text" id="truck-' + t.turno_id + '" value="' + t.truck + '"></div>';
            html += '<div><label>N° Viaje</label><input type="text" id="trip-' + t.turno_id + '" value="' + (t.trip_number || '') + '"></div>';
            html += '</div>';
            html += '<label>Transportista</label><select id="carrier-' + t.turno_id + '"><option value="">Seleccionar...</option>' + carrierOptions + '</select>';
            html += '<div class="row-2">';
            html += '<div><label>Nave</label><select id="warehouse-' + t.turno_id + '"><option value="PL2"' + (t.warehouse === 'PL2' ? ' selected' : '') + '>PL2</option><option value="PL3"' + (t.warehouse === 'PL3' ? ' selected' : '') + '>PL3</option></select></div>';
            html += '<div><label>Operación</label><select id="operation-' + t.turno_id + '"><option value="Descarga"' + (t.operation === 'Descarga' ? ' selected' : '') + '>Descarga</option><option value="Colecta"' + (t.operation === 'Colecta' ? ' selected' : '') + '>Colecta</option><option value="Carga"' + (t.operation === 'Carga' ? ' selected' : '') + '>Carga</option></select></div>';
            html += '</div>';
            html += '<label>Dársena</label><select id="dock-' + t.turno_id + '"><option value="">Sin asignar</option>';
            for (let i = 1; i <= 40; i++) {
              const d = 'D-' + String(i).padStart(2, '0');
              html += '<option value="' + d + '"' + (t.dock === d ? ' selected' : '') + '>' + d + '</option>';
            }
            html += '</select>';
            html += '<button class="btn btn-save" onclick="guardar(\\'' + t.turno_id + '\\')" style="width:100%; margin-top:12px;">💾 Guardar cambios</button>';
            html += '</div></div>';
          });
          
          document.getElementById('turnos-admin').innerHTML = html;
          
          // Set carrier values after render
          activos.forEach(t => {
            const sel = document.getElementById('carrier-' + t.turno_id);
            if (sel && t.carrier) sel.value = t.carrier;
          });
        }
        
        function toggleEdit(id) {
          document.getElementById('edit-' + id).classList.toggle('active');
        }
        
        async function eliminar(id) {
          if (!confirm('¿Eliminar este turno?')) return;
          const res = await fetch('/api/admin/eliminar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ turnoId: id, pass: PASS })
          });
          const data = await res.json();
          if (data.success) {
            loadTurnos();
          } else {
            alert(data.error);
          }
        }
        
        async function guardar(id) {
          const turno = {
            turnoId: id,
            truck: document.getElementById('truck-' + id).value,
            carrier: document.getElementById('carrier-' + id).value,
            tripNumber: document.getElementById('trip-' + id).value,
            warehouse: document.getElementById('warehouse-' + id).value,
            operation: document.getElementById('operation-' + id).value,
            dock: document.getElementById('dock-' + id).value,
            pass: PASS
          };
          
          const res = await fetch('/api/admin/editar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(turno)
          });
          const data = await res.json();
          if (data.success) {
            alert('✅ Guardado');
            loadTurnos();
          } else {
            alert(data.error);
          }
        }
        
        async function limpiar(tipo) {
          const msgs = {
            'egresados': '¿Borrar turnos FINALIZADOS?',
            'viejos': '¿Borrar turnos +7 días?',
            'todos': '⚠️ ¿BORRAR TODO?'
          };
          if (!confirm(msgs[tipo])) return;
          if (tipo === 'todos' && !confirm('¿SEGURO? No se puede deshacer.')) return;
          
          const res = await fetch('/api/admin/limpiar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tipo, pass: PASS })
          });
          const data = await res.json();
          alert(data.success ? '✅ ' + data.mensaje : '❌ ' + data.error);
          loadTurnos();
        }
      </script>
    </body></html>
  `);
});

app.post('/api/admin/limpiar', async (req, res) => {
  const { tipo, pass } = req.body;
  if (pass !== 'Newsanpilar2026') return res.json({ success: false, error: 'No autorizado' });
  
  try {
    let result;
    switch(tipo) {
      case 'egresados':
        result = await pool.query("DELETE FROM turnos WHERE status = 'EGRESADO'");
        break;
      case 'viejos':
        result = await pool.query("DELETE FROM turnos WHERE ts_entrada < NOW() - INTERVAL '7 days'");
        break;
      case 'todos':
        result = await pool.query("DELETE FROM turnos");
        break;
      default:
        return res.json({ success: false, error: 'Tipo inválido' });
    }
    res.json({ success: true, mensaje: result.rowCount + ' turnos eliminados' });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/admin/eliminar', async (req, res) => {
  const { turnoId, pass } = req.body;
  if (pass !== 'Newsanpilar2026') return res.json({ success: false, error: 'No autorizado' });
  
  try {
    await pool.query('DELETE FROM turnos WHERE turno_id = $1', [turnoId]);
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.post('/api/admin/editar', async (req, res) => {
  const { turnoId, truck, carrier, tripNumber, warehouse, operation, dock, pass } = req.body;
  if (pass !== 'Newsanpilar2026') return res.json({ success: false, error: 'No autorizado' });

  try {
    await withTransaction(async (client) => {
      await client.query(
        `UPDATE turnos SET truck = $1, carrier = $2, trip_number = $3, warehouse = $4, operation = $5, dock = $6 WHERE turno_id = $7`,
        [truck.toUpperCase(), carrier, tripNumber || null, warehouse, operation, dock || null, turnoId]
      );
    });
    res.json({ success: true });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});
// ===================== INICIAR SERVIDOR =====================
app.listen(PORT, () => {
  console.log(`🚛 OCASA Dock Manager corriendo en puerto ${PORT}`);
});


// Diagnóstico de DB
app.get('/db-check', async (req, res) => {
  const turnoId = req.query.turno || 'TRN-0858';
  const results = [];

  try {
    // Test 1: Read via pool.query
    const r1 = await pool.query('SELECT turno_id, status, dock FROM turnos WHERE turno_id = $1', [turnoId]);
    results.push({ test: 'pool.query READ', data: r1.rows[0] || 'NOT FOUND' });

    // Test 2: Read via dedicated client
    const client = await pool.connect();
    try {
      const r2 = await client.query('SELECT turno_id, status, dock FROM turnos WHERE turno_id = $1', [turnoId]);
      results.push({ test: 'client READ', data: r2.rows[0] || 'NOT FOUND' });

      // Test 3: Transaction test — UPDATE and verify within same client
      await client.query('BEGIN');
      await client.query("UPDATE turnos SET dock = 'TEST' WHERE turno_id = $1", [turnoId]);
      const r3 = await client.query('SELECT dock FROM turnos WHERE turno_id = $1', [turnoId]);
      results.push({ test: 'client UPDATE+READ (in tx)', dock_after_update: r3.rows[0]?.dock });
      await client.query('ROLLBACK'); // No persistir cambio de test

      // Test 4: Verify ROLLBACK worked
      const r4 = await client.query('SELECT dock FROM turnos WHERE turno_id = $1', [turnoId]);
      results.push({ test: 'client after ROLLBACK', dock: r4.rows[0]?.dock });
    } finally {
      client.release();
    }

    // Test 5: Pool info
    results.push({
      test: 'pool_info',
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount
    });

    // Test 6: Check PostgreSQL config
    const pgVersion = await pool.query('SHOW server_version');
    const txIsolation = await pool.query('SHOW default_transaction_isolation');
    const txReadOnly = await pool.query('SHOW default_transaction_read_only');
    results.push({
      test: 'pg_config',
      version: pgVersion.rows[0].server_version,
      isolation: txIsolation.rows[0].default_transaction_isolation,
      read_only: txReadOnly.rows[0].default_transaction_read_only
    });

    res.json({ ok: true, results });
  } catch(e) {
    res.json({ ok: false, error: e.message, results });
  }
});

app.get('/setup-db', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS trip_number VARCHAR(50)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS operation VARCHAR(20)`);
    await pool.query(`UPDATE turnos SET warehouse = 'PL2' WHERE warehouse = 'Nave 1'`);
    await pool.query(`UPDATE turnos SET warehouse = 'PL3' WHERE warehouse = 'Nave 2'`);
    res.send('✅ Base de datos actualizada');
  } catch(e) {
    res.send('❌ Error: ' + e.message);
  }
});

// ===================== MIGRACIÓN V2: CAMPOS GARITA =====================
app.get('/setup-db-v2', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS chofer VARCHAR(100)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS dni_chofer VARCHAR(20)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS celular_chofer VARCHAR(20)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS patente_semi VARCHAR(20)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS contenedor VARCHAR(30)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS precinto VARCHAR(30)`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS obs_ingreso TEXT`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS obs_egreso TEXT`);
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS registrado_por VARCHAR(20) DEFAULT 'driver'`);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS garita_usuarios (
        id SERIAL PRIMARY KEY,
        email VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(100) NOT NULL,
        nombre VARCHAR(100) NOT NULL,
        activo BOOLEAN DEFAULT true
      )
    `);
    await pool.query(`
      INSERT INTO garita_usuarios (email, password, nombre)
      VALUES ('guardia@ocasa.com', 'garita2026', 'Guardia 1')
      ON CONFLICT (email) DO NOTHING
    `);

    res.json({ success: true, message: 'Migración V2 completada: campos garita + tabla usuarios' });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

app.get('/setup-db-v3', async (req, res) => {
  try {
    await pool.query(`ALTER TABLE turnos ADD COLUMN IF NOT EXISTS carga_estado VARCHAR(20) DEFAULT 'VACIO'`);
    res.json({ success: true, message: 'Migración V3 completada: campo carga_estado agregado' });
  } catch(e) {
    res.json({ success: false, error: e.message });
  }
});

//DEBUG//

app.get('/test-db', async (req, res) => {
  try {
    // Test conexión
    const test = await pool.query('SELECT NOW()');
    
    // Ver columnas de la tabla
    const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'turnos'`);
    
    // Intentar insertar
    const turnoId = 'TEST-' + Date.now();
    await pool.query(
      `INSERT INTO turnos (turno_id, truck, carrier, trip_number, warehouse, operation, type, status, ts_entrada) 
       VALUES ($1, $2, $3, $4, $5, $6, 'INBOUND', 'ESPERANDO_ASIGNACION', CURRENT_TIMESTAMP)`,
      [turnoId, 'TEST123', 'Test Carrier', null, 'PL2', 'Descarga']
    );
    
    // Borrar el test
    await pool.query('DELETE FROM turnos WHERE turno_id = $1', [turnoId]);
    
    res.send('<pre>✅ Todo OK\n\nColumnas: ' + cols.rows.map(r => r.column_name).join(', ') + '</pre>');
  } catch(e) {
    res.send('<pre>❌ Error: ' + e.message + '\n\nStack: ' + e.stack + '</pre>');
  }
});
