/**
 * Autohaus Database Layer (SQL)
 * Soporte dual: SQLite local (assets/data/autohaus.db) y PostgreSQL en la nube (DATABASE_URL)
 */

const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'assets', 'data', 'autohaus.db');
const DATA_DIR = path.join(__dirname, 'assets', 'data');
const CATALOG_JSON = path.join(DATA_DIR, 'catalog.json');
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const LEADS_JSON = path.join(DATA_DIR, 'leads.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance = null;
let isPg = false;
let pgPool = null;

if (process.env.DATABASE_URL) {
  try {
    const { Pool } = require('pg');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    isPg = true;
    console.log('📦 Conectado a base de datos PostgreSQL (Cloud DATABASE_URL)');
  } catch (e) {
    console.warn('Advertencia al iniciar PostgreSQL, usando SQLite como fallback:', e.message);
    isPg = false;
  }
}

function getSqliteDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH);
  }
  return dbInstance;
}

// SQL Query execution helper (works transparently for SQLite and Postgres)
async function runQuery(sql, params = []) {
  if (isPg && pgPool) {
    let pIdx = 1;
    const pgSql = sql.replace(/\?/g, () => `$${pIdx++}`);
    const result = await pgPool.query(pgSql, params);
    return { rows: result.rows, lastID: result.rows[0]?.id || null, changes: result.rowCount };
  } else {
    const db = getSqliteDb();
    return new Promise((resolve, reject) => {
      const isSelect = /^\s*(SELECT|PRAGMA)/i.test(sql);
      if (isSelect) {
        db.all(sql, params, (err, rows) => {
          if (err) return reject(err);
          resolve({ rows: rows || [] });
        });
      } else {
        db.run(sql, params, function (err) {
          if (err) return reject(err);
          resolve({ rows: [], lastID: this.lastID, changes: this.changes });
        });
      }
    });
  }
}

// Transform raw SQL row into client-friendly vehicle object
function formatVehicleRow(row) {
  if (!row) return null;
  let specs = [];
  try {
    specs = typeof row.specs === 'string' ? JSON.parse(row.specs) : (row.specs || []);
  } catch (e) {
    specs = [row.specs];
  }

  let real_photos = [];
  try {
    real_photos = typeof row.real_photos === 'string' ? JSON.parse(row.real_photos) : (row.real_photos || []);
  } catch (e) {
    real_photos = [row.cover_photo || 'assets/svg/autohaus-tag.svg'];
  }

  return {
    id: row.id,
    page: parseInt(row.page, 10) || 0,
    brand: row.brand || '',
    model: row.model || '',
    year: parseInt(row.year, 10) || new Date().getFullYear(),
    category: row.category || 'SEDAN & HATCHBACK',
    price: row.price_contado || '$0',
    price_contado: row.price_contado || '$0',
    price_financiado: row.price_financiado || 'No Aplica',
    price_num: parseInt(row.price_num, 10) || 0,
    status: (row.status || 'disponible').toLowerCase(),
    specs: Array.isArray(specs) ? specs : [],
    cover_photo: row.cover_photo || 'assets/svg/autohaus-tag.svg',
    real_photos: Array.isArray(real_photos) ? real_photos : [row.cover_photo || 'assets/svg/autohaus-tag.svg'],
    photos: Array.isArray(real_photos) ? real_photos : [row.cover_photo || 'assets/svg/autohaus-tag.svg'],
    cutout_photo: row.cutout_photo || row.cover_photo || 'assets/svg/autohaus-tag.svg',
    main_photo: row.main_photo || row.cover_photo || 'assets/svg/autohaus-tag.svg',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function formatUserRow(row) {
  if (!row) return null;
  let favs = [];
  try {
    favs = typeof row.favorites === 'string' ? JSON.parse(row.favorites) : (row.favorites || []);
  } catch (e) {
    favs = [];
  }
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    password: row.password,
    role: row.role || 'client',
    favorites: Array.isArray(favs) ? favs : [],
    created_at: row.created_at
  };
}

function formatLeadRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    client_name: row.client_name,
    client_phone: row.client_phone,
    client_email: row.client_email || '',
    vehicle_page: row.vehicle_page ? parseInt(row.vehicle_page, 10) : null,
    vehicle_name: row.vehicle_name || '',
    assigned_to: row.assigned_to || '',
    assigned_name: row.assigned_name || row.assigned_to || '',
    status: row.status || 'nuevo',
    notes: row.notes || '',
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

// Category sorting order
const CATEGORY_ORDER = [
  'SEDAN & HATCHBACK',
  "SUV'S",
  'PICK UPS',
  'DEPORTIVOS'
];

function sortVehicles(list) {
  const groups = {};
  CATEGORY_ORDER.forEach(c => { groups[c] = []; });

  list.forEach(v => {
    const cat = v.category || 'SEDAN & HATCHBACK';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(v);
  });

  const sorted = [];
  Object.keys(groups).forEach(cat => {
    sorted.push(...groups[cat]);
  });
  return sorted;
}

/**
 * Initialize Database Schema and Auto-Seed
 */
async function initDb() {
  // 1. Create Vehicles Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS vehicles (
      id TEXT PRIMARY KEY,
      page INTEGER,
      brand TEXT,
      model TEXT,
      year INTEGER,
      category TEXT,
      price_contado TEXT,
      price_financiado TEXT,
      price_num INTEGER,
      status TEXT DEFAULT 'disponible',
      specs TEXT,
      cover_photo TEXT,
      real_photos TEXT,
      cutout_photo TEXT,
      main_photo TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // 2. Create Users Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT,
      email TEXT UNIQUE,
      phone TEXT,
      password TEXT,
      role TEXT DEFAULT 'client',
      favorites TEXT,
      created_at TEXT
    )
  `);

  // 3. Create Leads Table
  await runQuery(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      client_name TEXT,
      client_phone TEXT,
      client_email TEXT,
      vehicle_page INTEGER,
      vehicle_name TEXT,
      assigned_to TEXT,
      assigned_name TEXT,
      status TEXT DEFAULT 'nuevo',
      notes TEXT,
      created_at TEXT,
      updated_at TEXT
    )
  `);

  // Auto-seed vehicles if table is empty
  const vehCountRes = await runQuery('SELECT COUNT(*) as count FROM vehicles');
  const vehCount = parseInt(vehCountRes.rows[0]?.count || 0, 10);
  if (vehCount === 0 && fs.existsSync(CATALOG_JSON)) {
    try {
      const initialVehicles = JSON.parse(fs.readFileSync(CATALOG_JSON, 'utf-8'));
      console.log(`🌱 Sembrando ${initialVehicles.length} vehículos en la base de datos SQL...`);
      for (const v of initialVehicles) {
        const vId = v.id || `autohaus-p${v.page}`;
        const priceClean = v.price_num || parseInt((v.price_contado || '').replace(/[^0-9]/g, '')) || 0;
        const now = new Date().toISOString();
        await runQuery(`
          INSERT INTO vehicles (
            id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          vId,
          v.page || 0,
          v.brand || '',
          v.model || '',
          v.year || new Date().getFullYear(),
          v.category || 'SEDAN & HATCHBACK',
          v.price_contado || '$0',
          v.price_financiado || 'No Aplica',
          priceClean,
          (v.status || 'disponible').toLowerCase(),
          JSON.stringify(v.specs || []),
          v.cover_photo || 'assets/svg/autohaus-tag.svg',
          JSON.stringify(v.real_photos || [v.cover_photo || 'assets/svg/autohaus-tag.svg']),
          v.cutout_photo || v.cover_photo || 'assets/svg/autohaus-tag.svg',
          v.main_photo || v.cover_photo || 'assets/svg/autohaus-tag.svg',
          now,
          now
        ]);
      }
      console.log('✅ Vehículos sembrados exitosamente en la base de datos.');
    } catch (err) {
      console.error('Error al sembrar vehículos iniciales:', err);
    }
  }

  // Auto-seed users if empty
  const userCountRes = await runQuery('SELECT COUNT(*) as count FROM users');
  const userCount = parseInt(userCountRes.rows[0]?.count || 0, 10);
  if (userCount === 0) {
    let initialUsers = [
      { id: 1, name: 'Administrador Autohaus', email: 'admin@autohaus.mx', password: bcrypt.hashSync('autohaus2025', 10), role: 'admin' },
      { id: 2, name: 'Alice (Secretaria)', email: 'alice@autohaus.mx', password: bcrypt.hashSync('alice2025', 10), role: 'secretary' },
      { id: 3, name: 'Napo (Vendedor)', email: 'napo@autohaus.mx', password: bcrypt.hashSync('napo2025', 10), role: 'sales' },
      { id: 4, name: 'Javier (Vendedor)', email: 'javier@autohaus.mx', password: bcrypt.hashSync('javier2025', 10), role: 'sales' },
      { id: 5, name: 'Fernanda (Vendedora)', email: 'fernanda@autohaus.mx', password: bcrypt.hashSync('fernanda2025', 10), role: 'sales' },
      { id: 6, name: 'Raúl (Vendedor)', email: 'raul@autohaus.mx', password: bcrypt.hashSync('raul2025', 10), role: 'sales' }
    ];
    if (fs.existsSync(USERS_JSON)) {
      try {
        const fileUsers = JSON.parse(fs.readFileSync(USERS_JSON, 'utf-8'));
        if (fileUsers && fileUsers.length) initialUsers = fileUsers;
      } catch (e) {}
    }
    console.log(`🌱 Sembrando ${initialUsers.length} usuarios en la base de datos SQL...`);
    for (const u of initialUsers) {
      await runQuery(`
        INSERT INTO users (id, name, email, phone, password, role, favorites, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        u.id || Date.now(),
        u.name || '',
        (u.email || '').toLowerCase().trim(),
        u.phone || '',
        u.password,
        u.role || 'client',
        JSON.stringify(u.favorites || []),
        u.created_at || new Date().toISOString()
      ]);
    }
    console.log('✅ Usuarios sembrados exitosamente.');
  }

  // Auto-seed leads if empty
  const leadCountRes = await runQuery('SELECT COUNT(*) as count FROM leads');
  const leadCount = parseInt(leadCountRes.rows[0]?.count || 0, 10);
  if (leadCount === 0 && fs.existsSync(LEADS_JSON)) {
    try {
      const fileLeads = JSON.parse(fs.readFileSync(LEADS_JSON, 'utf-8'));
      if (fileLeads && fileLeads.length) {
        console.log(`🌱 Sembrando ${fileLeads.length} leads en la base de datos SQL...`);
        for (const l of fileLeads) {
          await runQuery(`
            INSERT INTO leads (id, client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, status, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            l.id,
            l.client_name,
            l.client_phone,
            l.client_email || '',
            l.vehicle_page ? parseInt(l.vehicle_page, 10) : null,
            l.vehicle_name || '',
            (l.assigned_to || '').toLowerCase(),
            l.assigned_name || l.assigned_to || '',
            l.status || 'nuevo',
            l.notes || '',
            l.created_at || new Date().toISOString(),
            l.updated_at || new Date().toISOString()
          ]);
        }
        console.log('✅ Leads sembrados exitosamente.');
      }
    } catch (e) {}
  }
}

// ==========================================
// VEHICLES CRUD OPERATIONS
// ==========================================

async function getVehicles() {
  const res = await runQuery('SELECT * FROM vehicles ORDER BY page ASC');
  const formatted = res.rows.map(formatVehicleRow);
  return sortVehicles(formatted);
}

async function getVehicle(identifier) {
  const res = await runQuery(
    'SELECT * FROM vehicles WHERE id = ? OR page = ? LIMIT 1',
    [String(identifier), parseInt(identifier, 10) || -1]
  );
  if (!res.rows.length) return null;
  return formatVehicleRow(res.rows[0]);
}

async function createVehicle(car) {
  const now = new Date().toISOString();
  const newId = car.id || ('autohaus-v' + Date.now());
  const priceClean = car.price_num || parseInt((car.price_contado || '').replace(/[^0-9]/g, '')) || 0;

  // Compute next page number
  const maxPageRes = await runQuery('SELECT MAX(page) as max_page FROM vehicles');
  const maxPage = parseInt(maxPageRes.rows[0]?.max_page || 3, 10);
  const newPage = car.page || (maxPage + 1);

  await runQuery(`
    INSERT INTO vehicles (
      id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, specs, cover_photo, real_photos, cutout_photo, main_photo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    newId,
    newPage,
    (car.brand || '').toUpperCase().trim(),
    (car.model || '').toUpperCase().trim(),
    parseInt(car.year, 10) || new Date().getFullYear(),
    car.category || 'SEDAN & HATCHBACK',
    car.price_contado || '$0',
    car.price_financiado || 'No Aplica',
    priceClean,
    (car.status || 'disponible').toLowerCase(),
    JSON.stringify(car.specs || []),
    car.cover_photo || 'assets/svg/autohaus-tag.svg',
    JSON.stringify(car.real_photos || [car.cover_photo || 'assets/svg/autohaus-tag.svg']),
    car.cutout_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    car.main_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    now,
    now
  ]);

  return getVehicle(newId);
}

async function updateVehicle(identifier, car) {
  const existing = await getVehicle(identifier);
  if (!existing) return null;

  const now = new Date().toISOString();
  const brand = car.brand !== undefined ? car.brand.toUpperCase().trim() : existing.brand;
  const model = car.model !== undefined ? car.model.toUpperCase().trim() : existing.model;
  const year = car.year !== undefined ? (parseInt(car.year, 10) || existing.year) : existing.year;
  const category = car.category !== undefined ? car.category : existing.category;
  const status = car.status !== undefined ? car.status.toLowerCase() : existing.status;
  const price_contado = car.price_contado !== undefined ? car.price_contado : existing.price_contado;
  const price_financiado = car.price_financiado !== undefined ? car.price_financiado : existing.price_financiado;
  const price_num = car.price_num !== undefined ? car.price_num : (parseInt((price_contado || '').replace(/[^0-9]/g, '')) || existing.price_num);
  const specs = car.specs !== undefined ? car.specs : existing.specs;
  const cover_photo = car.cover_photo !== undefined ? car.cover_photo : existing.cover_photo;
  const real_photos = car.real_photos !== undefined ? car.real_photos : existing.real_photos;

  await runQuery(`
    UPDATE vehicles SET
      brand = ?,
      model = ?,
      year = ?,
      category = ?,
      price_contado = ?,
      price_financiado = ?,
      price_num = ?,
      status = ?,
      specs = ?,
      cover_photo = ?,
      real_photos = ?,
      cutout_photo = ?,
      main_photo = ?,
      updated_at = ?
    WHERE id = ? OR page = ?
  `, [
    brand,
    model,
    year,
    category,
    price_contado,
    price_financiado,
    price_num,
    status,
    JSON.stringify(specs),
    cover_photo,
    JSON.stringify(real_photos),
    cover_photo,
    cover_photo,
    now,
    existing.id,
    existing.page
  ]);

  return getVehicle(existing.id);
}

async function updateVehicleStatus(identifier, status) {
  const existing = await getVehicle(identifier);
  if (!existing) return null;

  const now = new Date().toISOString();
  const safeStatus = (status || 'disponible').toLowerCase();

  await runQuery(`
    UPDATE vehicles SET status = ?, updated_at = ?
    WHERE id = ? OR page = ?
  `, [safeStatus, now, existing.id, existing.page]);

  return getVehicle(existing.id);
}

async function deleteVehicle(identifier) {
  const existing = await getVehicle(identifier);
  if (!existing) return null;

  await runQuery('DELETE FROM vehicles WHERE id = ? OR page = ?', [existing.id, existing.page]);
  return existing;
}

// ==========================================
// USERS CRUD OPERATIONS
// ==========================================

async function getUsers() {
  const res = await runQuery('SELECT * FROM users ORDER BY id ASC');
  return res.rows.map(formatUserRow);
}

async function getUserById(id) {
  const res = await runQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  if (!res.rows.length) return null;
  return formatUserRow(res.rows[0]);
}

async function getUserByEmail(email) {
  if (!email) return null;
  const res = await runQuery('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email.toLowerCase().trim()]);
  if (!res.rows.length) return null;
  return formatUserRow(res.rows[0]);
}

async function createUser(user) {
  const now = new Date().toISOString();
  const id = user.id || Date.now();
  await runQuery(`
    INSERT INTO users (id, name, email, phone, password, role, favorites, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    (user.name || '').trim(),
    (user.email || '').toLowerCase().trim(),
    (user.phone || '').trim(),
    user.password,
    user.role || 'client',
    JSON.stringify(user.favorites || []),
    now
  ]);
  return getUserById(id);
}

async function updateUserFavorites(userId, favorites) {
  await runQuery('UPDATE users SET favorites = ? WHERE id = ?', [JSON.stringify(favorites || []), userId]);
  return getUserById(userId);
}

// ==========================================
// LEADS CRUD OPERATIONS
// ==========================================

async function getLeads() {
  const res = await runQuery('SELECT * FROM leads ORDER BY created_at DESC');
  return res.rows.map(formatLeadRow);
}

async function getLeadById(id) {
  const res = await runQuery('SELECT * FROM leads WHERE id = ? LIMIT 1', [id]);
  if (!res.rows.length) return null;
  return formatLeadRow(res.rows[0]);
}

async function createLead(lead) {
  const now = new Date().toISOString();
  const id = lead.id || ('lead_' + Date.now());

  await runQuery(`
    INSERT INTO leads (id, client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    lead.client_name.trim(),
    lead.client_phone.trim(),
    (lead.client_email || '').trim(),
    lead.vehicle_page ? parseInt(lead.vehicle_page, 10) : null,
    lead.vehicle_name || 'Interés General',
    (lead.assigned_to || '').toLowerCase().trim(),
    lead.assigned_name || lead.assigned_to || '',
    lead.status || 'nuevo',
    lead.notes || '',
    now,
    now
  ]);

  return getLeadById(id);
}

async function updateLead(id, data) {
  const existing = await getLeadById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const client_name = data.client_name !== undefined ? data.client_name.trim() : existing.client_name;
  const client_phone = data.client_phone !== undefined ? data.client_phone.trim() : existing.client_phone;
  const client_email = data.client_email !== undefined ? data.client_email.trim() : existing.client_email;
  const vehicle_page = data.vehicle_page !== undefined ? data.vehicle_page : existing.vehicle_page;
  const vehicle_name = data.vehicle_name !== undefined ? data.vehicle_name : existing.vehicle_name;
  const assigned_to = data.assigned_to !== undefined ? data.assigned_to.toLowerCase().trim() : existing.assigned_to;
  const assigned_name = data.assigned_name !== undefined ? data.assigned_name : existing.assigned_name;
  const status = data.status !== undefined ? data.status : existing.status;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  await runQuery(`
    UPDATE leads SET
      client_name = ?,
      client_phone = ?,
      client_email = ?,
      vehicle_page = ?,
      vehicle_name = ?,
      assigned_to = ?,
      assigned_name = ?,
      status = ?,
      notes = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    client_name,
    client_phone,
    client_email,
    vehicle_page,
    vehicle_name,
    assigned_to,
    assigned_name,
    status,
    notes,
    now,
    id
  ]);

  return getLeadById(id);
}

async function deleteLead(id) {
  const existing = await getLeadById(id);
  if (!existing) return null;

  await runQuery('DELETE FROM leads WHERE id = ?', [id]);
  return existing;
}

// ==========================================
// STATS
// ==========================================

async function getStats() {
  const vehicles = await getVehicles();
  const leads = await getLeads();

  let totalContadoValue = 0;
  let disponiblesCount = 0;
  let apartadosCount = 0;
  let vendidosCount = 0;

  const categoryCounts = {
    'SEDAN & HATCHBACK': 0,
    "SUV'S": 0,
    'PICK UPS': 0,
    'DEPORTIVOS': 0
  };

  vehicles.forEach(v => {
    totalContadoValue += (v.price_num || 0);
    const st = (v.status || 'disponible').toLowerCase();
    if (st === 'apartado') apartadosCount++;
    else if (st === 'vendido') vendidosCount++;
    else disponiblesCount++;

    if (categoryCounts[v.category] !== undefined) {
      categoryCounts[v.category]++;
    }
  });

  return {
    totalVehicles: vehicles.length,
    disponiblesCount,
    apartadosCount,
    vendidosCount,
    totalValue: totalContadoValue,
    totalLeads: leads.length,
    categoryCounts,
    lastUpdated: new Date().toISOString()
  };
}

module.exports = {
  initDb,
  getVehicles,
  getVehicle,
  createVehicle,
  updateVehicle,
  updateVehicleStatus,
  deleteVehicle,
  getUsers,
  getUserById,
  getUserByEmail,
  createUser,
  updateUserFavorites,
  getLeads,
  getLeadById,
  createLead,
  updateLead,
  deleteLead,
  getStats,
  CATEGORY_ORDER,
  sortVehicles
};
