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
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

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

// ===================== COLORES OCASA =====================
const colors = {
  primary: '#0099A8',
  primaryDark: '#056572',
  green: '#8fbf4c',
  orange: '#ffab40',
  light: '#efefef',
  dark: '#1a1a2e',
  darkBlue: '#16213e',
  white: '#ffffff',
  black: '#000000'
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
const styles = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { 
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, ${colors.dark} 0%, ${colors.darkBlue} 100%);
    min-height: 100vh;
    color: ${colors.white};
  }
  .container { max-width: 500px; margin: 0 auto; padding: 20px; }
  .container-wide { max-width: 900px; margin: 0 auto; padding: 20px; }
  .logo { height: 40px; margin-bottom: 16px; }
  .logo-large { height: 60px; margin-bottom: 24px; }
  h1 { font-size: 24px; margin-bottom: 8px; color: ${colors.white}; }
  h2 { font-size: 20px; margin-bottom: 12px; color: ${colors.light}; }
  .subtitle { color: ${colors.light}; margin-bottom: 24px; opacity: 0.8; }
  .card { 
    background: rgba(255,255,255,0.08); 
    border-radius: 16px; 
    padding: 20px; 
    margin-bottom: 16px;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .btn { 
    display: block; width: 100%; padding: 16px; border: none; border-radius: 12px; 
    font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 12px;
    transition: transform 0.2s, opacity 0.2s;
    text-decoration: none; text-align: center;
  }
  .btn:hover { transform: scale(1.02); opacity: 0.9; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .btn-primary { background: linear-gradient(135deg, ${colors.primary} 0%, ${colors.primaryDark} 100%); color: white; }
  .btn-green { background: linear-gradient(135deg, ${colors.green} 0%, #6d9e2e 100%); color: white; }
  .btn-orange { background: linear-gradient(135deg, ${colors.orange} 0%, #e6952e 100%); color: white; }
  input, select { 
    width: 100%; padding: 16px; border: 2px solid rgba(255,255,255,0.1); 
    border-radius: 12px; font-size: 18px; background: rgba(255,255,255,0.05); 
    color: white; margin-bottom: 8px; min-height: 52px;
  }
  input::placeholder { color: rgba(255,255,255,0.5); }
  input:focus, select:focus { outline: none; border-color: ${colors.primary}; }
  select option { background: ${colors.dark}; color: white; padding: 12px; font-size: 16px; }
  select option:disabled { color: rgba(255,255,255,0.4); }
  .error { background: rgba(239,68,68,0.2); color: #fca5a5; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
  .success { background: rgba(143,191,76,0.2); color: ${colors.green}; padding: 12px; border-radius: 8px; margin-bottom: 16px; }
  .icon-circle { 
    width: 80px; height: 80px; border-radius: 50%; 
    display: flex; align-items: center; justify-content: center; 
    font-size: 40px; margin: 0 auto 16px;
  }
  .icon-primary { background: rgba(0,153,168,0.2); }
  .icon-green { background: rgba(143,191,76,0.2); }
  .icon-orange { background: rgba(255,171,64,0.2); }
  .badge { 
    display: inline-block; padding: 4px 12px; border-radius: 20px; 
    font-size: 12px; font-weight: 600; margin-left: 8px;
  }
  .badge-yellow { background: rgba(255,171,64,0.2); color: ${colors.orange}; }
  .badge-primary { background: rgba(0,153,168,0.2); color: ${colors.primary}; }
  .badge-green { background: rgba(143,191,76,0.2); color: ${colors.green}; }
  .badge-orange { background: rgba(255,171,64,0.2); color: ${colors.orange}; }
  .badge-dark { background: rgba(5,101,114,0.3); color: ${colors.light}; }
  .turno-card { 
    background: rgba(255,255,255,0.05); border-radius: 12px; 
    padding: 16px; margin-bottom: 12px; 
    display: flex; justify-content: space-between; align-items: center;
    cursor: pointer; transition: background 0.2s;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .turno-card:hover { background: rgba(0,153,168,0.1); border-color: ${colors.primary}; }
  .turno-info h3 { font-size: 18px; margin-bottom: 4px; }
  .turno-info p { color: ${colors.light}; font-size: 14px; opacity: 0.7; }
  .turno-meta { text-align: right; }
  .turno-meta .time { color: ${colors.light}; font-size: 14px; opacity: 0.7; }
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 24px; }
  .kpi { 
    background: rgba(255,255,255,0.05); border-radius: 12px; padding: 20px; text-align: center;
    border: 1px solid rgba(255,255,255,0.05);
  }
  .kpi-value { font-size: 36px; font-weight: 700; color: ${colors.primary}; }
  .kpi-label { color: ${colors.light}; font-size: 14px; margin-top: 4px; opacity: 0.7; }
  .dock-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-top: 16px; }
  .dock { 
    padding: 12px 8px; border-radius: 8px; text-align: center; 
    font-weight: 600; font-size: 14px;
  }
  .dock-free { background: rgba(143,191,76,0.2); color: ${colors.green}; }
  .dock-occupied { background: rgba(255,171,64,0.2); color: ${colors.orange}; }
  .warehouse { margin-bottom: 24px; }
  .warehouse h3 { margin-bottom: 12px; color: ${colors.light}; opacity: 0.8; }
  .tabs { display: flex; gap: 8px; margin-bottom: 20px; }
  .tab { 
    flex: 1; padding: 12px; border-radius: 8px; border: none; 
    background: rgba(255,255,255,0.05); color: ${colors.light}; cursor: pointer;
    font-weight: 600; transition: all 0.2s;
  }
  .tab:hover { background: rgba(0,153,168,0.2); }
  .tab.active { background: ${colors.primary}; color: white; }
  .timeline { margin-top: 20px; }
  .timeline-item { 
    display: flex; align-items: center; padding: 16px 0; 
    border-left: 2px solid rgba(255,255,255,0.1); 
    margin-left: 12px; padding-left: 24px; position: relative; 
  }
  .timeline-item::before { 
    content: ''; position: absolute; left: -7px; width: 12px; height: 12px; 
    border-radius: 50%; background: rgba(255,255,255,0.3); 
  }
  .timeline-item.done::before { background: ${colors.green}; }
  .timeline-item.current::before { background: ${colors.primary}; box-shadow: 0 0 0 4px rgba(0,153,168,0.3); }
  .timeline-time { color: ${colors.light}; font-size: 14px; width: 100px; opacity: 0.7; }
  .timeline-text { flex: 1; }
  .modal-overlay {
    display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.8); z-index: 1000; 
    justify-content: center; align-items: center; padding: 20px;
  }
  .modal-overlay.active { display: flex; }
  .modal {
    background: ${colors.darkBlue}; border-radius: 16px; padding: 24px;
    max-width: 500px; width: 100%; max-height: 90vh; overflow-y: auto;
    border: 1px solid rgba(255,255,255,0.1);
  }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
  .modal-close { 
    background: none; border: none; color: ${colors.light}; font-size: 24px; 
    cursor: pointer; padding: 4px 8px;
  }
  .modal-close:hover { color: white; }
  .header { 
    display: flex; align-items: center; justify-content: space-between; 
    margin-bottom: 24px; padding-bottom: 16px; 
    border-bottom: 1px solid rgba(255,255,255,0.1);
  }
  .header-left { display: flex; align-items: center; gap: 16px; }
  .assign-row { display: flex; gap: 8px; margin-top: 12px; align-items: stretch; }
  .assign-row select { 
    flex: 2; margin: 0; padding: 16px; font-size: 18px; font-weight: 600;
    min-height: 56px; min-width: 0;
}
  .assign-row button { flex: 1; margin: 0; padding: 16px 12px; min-height: 56px; font-size: 16px; white-space: nowrap; }
  .refresh-notice { 
    text-align: center; color: ${colors.light}; font-size: 13px; 
    margin-top: 20px; opacity: 0.6;
  }
`;

// ===================== FUNCIONES HELPER =====================
async function generarId() {
  const result = await pool.query('SELECT COUNT(*) FROM turnos');
  const count = parseInt(result.rows[0].count) + 1;
  return 'TRN-' + String(count).padStart(4, '0');
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
  const { truck } = req.body;
  if (!truck) return res.json({ success: false, error: 'Patente requerida' });
  
  try {
    // Buscar turno activo existente
    const existing = await pool.query(
      "SELECT * FROM turnos WHERE truck = $1 AND status != 'EGRESADO'",
      [truck.toUpperCase()]
    );
    
    if (existing.rows.length > 0) {
      return res.json({ success: true, id: existing.rows[0].turno_id, existing: true });
    }
    
    // Crear nuevo turno
    const turnoId = await generarId();
    await pool.query(
      `INSERT INTO turnos (turno_id, truck, carrier, type, status, ts_entrada) 
       VALUES ($1, $2, 'Por asignar', 'INBOUND', 'ESPERANDO_ASIGNACION', CURRENT_TIMESTAMP)`,
      [turnoId, truck.toUpperCase()]
    );
    
    res.json({ success: true, id: turnoId, existing: false });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
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
    const turno = await pool.query('SELECT * FROM turnos WHERE turno_id = $1', [turnoId]);
    if (turno.rows.length === 0) {
      return res.json({ success: false, error: 'Turno no encontrado' });
    }
    
    if (turno.rows[0].status !== 'ESPERANDO_ASIGNACION') {
      return res.json({ success: false, error: 'El turno ya tiene dársena asignada' });
    }
    
    // Verificar que el dock no esté ocupado
    const dockCheck = await pool.query(
      "SELECT * FROM turnos WHERE dock = $1 AND status NOT IN ('EGRESADO', 'DESATRACADO')",
      [dock]
    );
    
    if (dockCheck.rows.length > 0) {
      return res.json({ success: false, error: 'Esa dársena ya está ocupada' });
    }
    
    await pool.query(
      `UPDATE turnos SET dock = $1, warehouse = $2, status = 'DARSENA_ASIGNADA', ts_asignacion = CURRENT_TIMESTAMP 
       WHERE turno_id = $3`,
      [dock, warehouse, turnoId]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Atraque automático (escanear QR de dársena)
app.post('/api/dock/:dockId', async (req, res) => {
  const dockId = req.params.dockId;
  
  try {
    const turno = await pool.query(
      "SELECT * FROM turnos WHERE dock = $1 AND status NOT IN ('EGRESADO', 'DESATRACADO')",
      [dockId]
    );
    
    if (turno.rows.length === 0) {
      return res.json({ success: false, error: 'No hay ningún camión asignado a esta dársena' });
    }
    
    const t = turno.rows[0];
    
    if (t.status === 'DARSENA_ASIGNADA') {
      await pool.query(
        "UPDATE turnos SET status = 'ATRACADO', ts_atracado = CURRENT_TIMESTAMP WHERE turno_id = $1",
        [t.turno_id]
      );
      return res.json({ success: true, action: 'atracado', truck: t.truck });
    } else if (t.status === 'ATRACADO') {
      await pool.query(
        "UPDATE turnos SET status = 'DESATRACADO', dock = '', ts_desatracado = CURRENT_TIMESTAMP WHERE turno_id = $1",
        [t.turno_id]
      );
      return res.json({ success: true, action: 'desatracado', truck: t.truck });
    } else {
      return res.json({ success: false, error: 'Estado no válido: ' + t.status });
    }
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
  }
});

// Registrar salida
app.post('/api/salida', async (req, res) => {
  const { truck } = req.body;
  
  try {
    const turno = await pool.query(
      "SELECT * FROM turnos WHERE truck = $1 AND status = 'DESATRACADO'",
      [truck.toUpperCase()]
    );
    
    if (turno.rows.length === 0) {
      return res.json({ success: false, error: 'No se encontró un turno desatracado para esa patente' });
    }
    
    await pool.query(
      "UPDATE turnos SET status = 'EGRESADO', ts_egreso = CURRENT_TIMESTAMP WHERE turno_id = $1",
      [turno.rows[0].turno_id]
    );
    
    res.json({ success: true, turno: turno.rows[0] });
  } catch (err) {
    console.error(err);
    res.json({ success: false, error: 'Error de base de datos' });
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
      <title>Entrada - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="text-align: center; padding-top: 40px;">
        <img src="${logoSrc}" alt="OCASA" class="logo-large">
        <div class="icon-circle icon-primary">🚛</div>
        <h1>Registro de Ingreso</h1>
        <p class="subtitle">Ingresá tu patente para registrarte</p>
        
        <div id="error" class="error" style="display:none;"></div>
        <div id="success" class="success" style="display:none;"></div>
        
        <div class="card">
          <input type="text" id="truck" placeholder="Ej: AA-123-BB" maxlength="10"
                 style="text-transform: uppercase; font-family: monospace; font-size: 24px; text-align: center;">
          <button class="btn btn-primary" onclick="registrar()" id="btnSubmit">
            🚛 Registrar Ingreso
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
            const res = await fetch('/api/entrada', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ truck })
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
        
        function resetBtn() {
          document.getElementById('btnSubmit').disabled = false;
          document.getElementById('btnSubmit').innerHTML = '🚛 Registrar Ingreso';
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

// ==================== PÁGINA TURNO (ESTADO DEL CHOFER) ====================
app.get('/turno/:id', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        
        async function loadTurno() {
          try {
            const res = await fetch('/api/turno/' + turnoId);
            const data = await res.json();
            
            if (data.success) {
              renderTurno(data.turno);
            } else {
              document.getElementById('content').innerHTML = '<div class="error">Turno no encontrado</div>';
            }
          } catch(e) {
            document.getElementById('content').innerHTML = '<div class="error">Error de conexión</div>';
          }
        }
        
        function renderTurno(t) {
          const statusText = {
            'ESPERANDO_ASIGNACION': '⏳ Esperando asignación de dársena',
            'DARSENA_ASIGNADA': '📍 Dirigite a la dársena ' + t.dock,
            'ATRACADO': '🔄 Operación en curso en ' + t.dock,
            'DESATRACADO': '✅ Operación finalizada. Dirigite a la salida',
            'EGRESADO': '👋 ¡Hasta pronto!'
          };
          
          const iconClass = t.status === 'DESATRACADO' || t.status === 'EGRESADO' ? 'icon-green' : 'icon-primary';
          
          let html = '<div style="text-align: center;">';
          html += '<div class="icon-circle ' + iconClass + '">🚛</div>';
          html += '<h1>' + t.truck + '</h1>';
          html += '<p class="subtitle">' + statusText[t.status] + '</p>';
          html += '</div>';
          
          html += '<div class="card">';
          html += '<div class="timeline">';
          
          html += renderTimelineItem(t.ts_entrada, 'Ingreso registrado', t.status === 'ESPERANDO_ASIGNACION' && !t.ts_asignacion);
          html += renderTimelineItem(t.ts_asignacion, 'Dársena asignada' + (t.dock ? ': ' + t.dock : ''), t.status === 'ESPERANDO_ASIGNACION');
          html += renderTimelineItem(t.ts_atracado, 'Atracado', t.status === 'DARSENA_ASIGNADA');
          html += renderTimelineItem(t.ts_desatracado, 'Desatracado', t.status === 'ATRACADO');
          html += renderTimelineItem(t.ts_egreso, 'Egreso', t.status === 'DESATRACADO');
          
          html += '</div></div>';
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
      <title>Dársena ${dockId} - OCASA Dock Manager</title>
      <style>${styles}</style>
    </head><body>
      <div class="container" style="text-align: center; padding-top: 40px;">
        <img src="${logoSrc}" alt="OCASA" class="logo">
        <div id="loading">
          <div class="icon-circle icon-primary">⚓</div>
          <h1>Dársena ${dockId}</h1>
          <p class="subtitle">⏳ Procesando...</p>
        </div>
        <div id="result" style="display:none;"></div>
      </div>
      
      <script>
        async function procesar() {
          try {
            const res = await fetch('/api/dock/${dockId}', { method: 'POST' });
            const data = await res.json();
            
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
            
            if (data.success) {
              if (data.action === 'atracado') {
                document.getElementById('result').innerHTML = 
                  '<div class="card"><div class="icon-circle icon-green">✅</div>' +
                  '<h1 style="color:#8fbf4c;">¡Atracado!</h1>' +
                  '<p class="subtitle">Camión ' + data.truck + '</p>' +
                  '<p style="color:#efefef; opacity:0.7;">Dársena ${dockId}</p></div>';
              } else {
                document.getElementById('result').innerHTML = 
                  '<div class="card"><div class="icon-circle icon-orange">🚪</div>' +
                  '<h1 style="color:#ffab40;">¡Desatracado!</h1>' +
                  '<p class="subtitle">Camión ' + data.truck + '</p>' +
                  '<p style="color:#efefef; opacity:0.7;">Puede dirigirse a la salida</p></div>';
              }
            } else {
              document.getElementById('result').innerHTML = 
                '<div class="card"><div class="icon-circle" style="background:rgba(239,68,68,0.2);">❌</div>' +
                '<h1 style="color:#ef4444;">Error</h1>' +
                '<p class="subtitle">' + data.error + '</p>' +
                '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
            }
          } catch(e) {
            document.getElementById('loading').style.display = 'none';
            document.getElementById('result').style.display = 'block';
            document.getElementById('result').innerHTML = 
              '<div class="card"><div class="icon-circle" style="background:rgba(239,68,68,0.2);">❌</div>' +
              '<h1 style="color:#ef4444;">Error de conexión</h1>' +
              '<button class="btn btn-primary" onclick="location.reload()">Reintentar</button></div>';
          }
        }
        
        procesar();
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
              showSuccess('✅ ¡Egreso registrado! Buen viaje 🚛');
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
      <title>Panel Operador - OCASA Dock Manager</title>
      <style>${styles}</style>
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
        </div>
        
        <div class="grid-2" id="kpis">
          <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">En predio</div></div>
          <div class="kpi"><div class="kpi-value">-</div><div class="kpi-label">Atracados</div></div>
        </div>
        
        <h2>Turnos activos</h2>
        <div id="turnos"></div>
        
        <h2 style="margin-top: 24px;">Estado de dársenas</h2>
        <div id="docks"></div>
        
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
            renderTurnos();
            renderDocks();
          } catch(e) {
            console.error(e);
          }
        }
        
        function renderKPIs() {
          const enPredio = allTurnos.filter(t => t.status !== 'EGRESADO').length;
          const atracados = allTurnos.filter(t => t.status === 'ATRACADO').length;
          document.getElementById('kpis').innerHTML = 
            '<div class="kpi"><div class="kpi-value">' + enPredio + '</div><div class="kpi-label">En predio</div></div>' +
            '<div class="kpi"><div class="kpi-value">' + atracados + '</div><div class="kpi-label">Atracados</div></div>';
        }
        
        function renderTurnos() {
          const activos = allTurnos.filter(t => t.status !== 'EGRESADO');
          if (activos.length === 0) {
            document.getElementById('turnos').innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">No hay turnos activos</div>';
            return;
          }
          
          let html = '';
          activos.forEach(t => {
            html += '<div class="turno-card" onclick="showDetail(\\'' + t.turno_id + '\\')">';
            html += '<div class="turno-info">';
            html += '<h3>' + t.truck + ' ' + getStatusBadge(t.status) + '</h3>';
            html += '<p>' + t.carrier + (t.dock ? ' → ' + t.dock : '') + '</p>';
            html += '</div>';
            html += '<div class="turno-meta">';
            html += '<div class="time">' + formatTime(t.ts_entrada) + '</div>';
            html += '</div></div>';
            
            if (t.status === 'ESPERANDO_ASIGNACION') {
              html += '<div class="assign-row">';
              html += '<select id="dock-' + t.turno_id + '">';
              for (let i = 1; i <= 40; i++) {
                const d = 'D-' + String(i).padStart(2, '0');
                const ocupada = allTurnos.some(x => x.dock === d && x.status !== 'EGRESADO' && x.status !== 'DESATRACADO');
                html += '<option value="' + d + '"' + (ocupada ? ' disabled' : '') + '>' + d + (ocupada ? ' (ocupada)' : '') + '</option>';
              }
              html += '</select>';
              html += '<button class="btn btn-green" onclick="event.stopPropagation(); asignar(\\'' + t.turno_id + '\\')">Asignar</button>';
              html += '</div>';
            }
          });
          
          document.getElementById('turnos').innerHTML = html;
        }
        
        function renderDocks() {
          let html = '';
          
          html += '<div class="warehouse"><h3>🏭 Nave 1 (D-01 a D-20)</h3><div class="dock-grid">';
          for (let i = 1; i <= 20; i++) {
            const d = 'D-' + String(i).padStart(2, '0');
            const ocupada = allTurnos.some(t => t.dock === d && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');
            html += '<div class="dock ' + (ocupada ? 'dock-occupied' : 'dock-free') + '">' + d + '</div>';
          }
          html += '</div></div>';
          
          html += '<div class="warehouse"><h3>🏭 Nave 2 (D-21 a D-40)</h3><div class="dock-grid">';
          for (let i = 21; i <= 40; i++) {
            const d = 'D-' + String(i).padStart(2, '0');
            const ocupada = allTurnos.some(t => t.dock === d && t.status !== 'EGRESADO' && t.status !== 'DESATRACADO');
            html += '<div class="dock ' + (ocupada ? 'dock-occupied' : 'dock-free') + '">' + d + '</div>';
          }
          html += '</div></div>';
          
          document.getElementById('docks').innerHTML = html;
        }
        
        async function asignar(turnoId) {
          const dock = document.getElementById('dock-' + turnoId).value;
          const warehouse = parseInt(dock.split('-')[1]) <= 20 ? 'Nave 1' : 'Nave 2';
          
          try {
            const res = await fetch('/api/asignar', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ turnoId, dock, warehouse })
            });
            const data = await res.json();
            if (data.success) {
              loadData();
            } else {
              alert(data.error);
            }
          } catch(e) {
            alert('Error de conexión');
          }
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

// ==================== PÁGINA GARITA/SEGURIDAD ====================
app.get('/garita', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html><head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        
        function renderPredio() {
          const enPredio = allTurnos.filter(t => t.status !== 'EGRESADO');
          if (enPredio.length === 0) {
            document.getElementById('predio').innerHTML = '<div class="card" style="text-align:center; opacity:0.6;">No hay vehículos en predio</div>';
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
            html += '<div class="time">Ingreso</div>';
            html += '<div class="time">' + formatTime(t.ts_entrada) + '</div>';
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

// ===================== INICIAR SERVIDOR =====================
app.listen(PORT, () => {
  console.log(`🚛 OCASA Dock Manager corriendo en puerto ${PORT}`);
});
