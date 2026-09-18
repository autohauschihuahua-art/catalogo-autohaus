/**
 * Autohaus Enterprise Database Layer (SQL & Supabase Cloud)
 * Soporte relacional completo: Supabase (Cloud PostgreSQL) y SQLite local
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const DB_PATH = path.join(__dirname, 'assets', 'data', 'autohaus.db');
const DATA_DIR = path.join(__dirname, 'assets', 'data');
const CATALOG_JSON = path.join(DATA_DIR, 'catalog.json');
const USERS_JSON = path.join(DATA_DIR, 'users.json');
const LEADS_JSON = path.join(DATA_DIR, 'leads.json');

fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance = null;
let supabase = null;
let useSupabase = false;

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || '';

if (SUPABASE_URL && SUPABASE_KEY) {
  try {
    supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: { persistSession: false }
    });
    useSupabase = true;
    console.log('⚡ Conectado a Supabase Cloud Database (' + SUPABASE_URL + ')');
  } catch (e) {
    console.warn('Advertencia al iniciar cliente Supabase:', e.message);
    useSupabase = false;
  }
}

function getSqliteDb() {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(DB_PATH);
  }
  return dbInstance;
}

// SQL Query helper for SQLite
async function runQuery(sql, params = []) {
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

// Formatting helpers
function formatVehicle(v) {
  if (!v) return null;
  let specs = [];
  try {
    specs = typeof v.specs === 'string' ? JSON.parse(v.specs) : (v.specs || []);
  } catch (e) {
    specs = [v.specs];
  }

  let real_photos = [];
  try {
    real_photos = typeof v.real_photos === 'string' ? JSON.parse(v.real_photos) : (v.real_photos || []);
  } catch (e) {
    real_photos = [v.cover_photo || 'assets/svg/autohaus-tag.svg'];
  }

  return {
    id: v.id,
    page: parseInt(v.page, 10) || 0,
    brand: v.brand || '',
    model: v.model || '',
    year: parseInt(v.year, 10) || new Date().getFullYear(),
    category: v.category || 'SEDAN & HATCHBACK',
    price: v.price_contado || '$0',
    price_contado: v.price_contado || '$0',
    price_financiado: v.price_financiado || 'No Aplica',
    price_num: parseInt(v.price_num, 10) || 0,
    status: (v.status || 'disponible').toLowerCase(),
    branch_id: v.branch_id || 1,
    specs: Array.isArray(specs) ? specs : [],
    cover_photo: v.cover_photo || 'assets/svg/autohaus-tag.svg',
    real_photos: Array.isArray(real_photos) ? real_photos : [v.cover_photo || 'assets/svg/autohaus-tag.svg'],
    photos: Array.isArray(real_photos) ? real_photos : [v.cover_photo || 'assets/svg/autohaus-tag.svg'],
    cutout_photo: v.cutout_photo || v.cover_photo || 'assets/svg/autohaus-tag.svg',
    main_photo: v.main_photo || v.cover_photo || 'assets/svg/autohaus-tag.svg',
    created_at: v.created_at,
    updated_at: v.updated_at
  };
}

function formatUser(u) {
  if (!u) return null;
  let favs = [];
  try {
    favs = typeof u.favorites === 'string' ? JSON.parse(u.favorites) : (u.favorites || []);
  } catch (e) {
    favs = [];
  }
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    phone: u.phone || '',
    password: u.password,
    role: u.role || 'client',
    favorites: Array.isArray(favs) ? favs : [],
    created_at: u.created_at
  };
}

function formatLead(l) {
  if (!l) return null;
  return {
    id: l.id,
    client_id: l.client_id || null,
    vehicle_id: l.vehicle_id || (l.vehicle_page ? `autohaus-p${l.vehicle_page}` : null),
    sales_rep_id: l.sales_rep_id || null,
    client_name: l.client_name,
    client_phone: l.client_phone,
    client_email: l.client_email || '',
    vehicle_page: l.vehicle_page ? parseInt(l.vehicle_page, 10) : null,
    vehicle_name: l.vehicle_name || '',
    assigned_to: l.assigned_to || '',
    assigned_name: l.assigned_name || l.assigned_to || '',
    status: l.status || 'nuevo',
    notes: l.notes || '',
    created_at: l.created_at,
    updated_at: l.updated_at
  };
}

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
  // SQLite relational schema
  await runQuery(`
    CREATE TABLE IF NOT EXISTS branches (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      address TEXT,
      city TEXT DEFAULT 'Chihuahua',
      phone TEXT
    );
  `);

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
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS sales_reps (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      branch_id INTEGER,
      is_active BOOLEAN DEFAULT 1,
      turn_order INTEGER DEFAULT 1
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT,
      city TEXT DEFAULT 'Chihuahua',
      created_at TEXT
    );
  `);

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
      branch_id INTEGER DEFAULT 1,
      specs TEXT,
      cover_photo TEXT,
      real_photos TEXT,
      cutout_photo TEXT,
      main_photo TEXT,
      created_at TEXT,
      updated_at TEXT
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS vehicle_status_history (
      id TEXT PRIMARY KEY,
      vehicle_id TEXT,
      status TEXT NOT NULL,
      previous_status TEXT,
      client_id INTEGER,
      sales_rep_id INTEGER,
      deposit_amount TEXT,
      notes TEXT,
      created_at TEXT
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      client_id INTEGER,
      vehicle_id TEXT,
      sales_rep_id INTEGER,
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
    );
  `);

  await runQuery(`
    CREATE TABLE IF NOT EXISTS client_favorites (
      client_id INTEGER,
      vehicle_id TEXT,
      created_at TEXT,
      PRIMARY KEY (client_id, vehicle_id)
    );
  `);
}

// ==========================================
// VEHICLES CRUD & STATUS OPERATIONS
// ==========================================

async function getVehicles() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('vehicles').select('*').order('page', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        return sortVehicles(data.map(formatVehicle));
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM vehicles ORDER BY page ASC');
  return sortVehicles(res.rows.map(formatVehicle));
}

async function getVehicle(identifier) {
  if (useSupabase && supabase) {
    try {
      const pageNum = parseInt(identifier, 10) || -1;
      const { data, error } = await supabase.from('vehicles').select('*').or(`id.eq.${identifier},page.eq.${pageNum}`).limit(1);
      if (!error && data && data.length > 0) {
        return formatVehicle(data[0]);
      }
    } catch (e) {}
  }
  const res = await runQuery(
    'SELECT * FROM vehicles WHERE id = ? OR page = ? LIMIT 1',
    [String(identifier), parseInt(identifier, 10) || -1]
  );
  if (!res.rows.length) return null;
  return formatVehicle(res.rows[0]);
}

async function createVehicle(car) {
  const now = new Date().toISOString();
  const newId = car.id || ('autohaus-v' + Date.now());
  const priceClean = car.price_num || parseInt((car.price_contado || '').replace(/[^0-9]/g, '')) || 0;

  const maxPageRes = await runQuery('SELECT MAX(page) as max_page FROM vehicles');
  const maxPage = parseInt(maxPageRes.rows[0]?.max_page || 3, 10);
  const newPage = car.page || (maxPage + 1);

  const vehicleObj = {
    id: newId,
    page: newPage,
    brand: (car.brand || '').toUpperCase().trim(),
    model: (car.model || '').toUpperCase().trim(),
    year: parseInt(car.year, 10) || new Date().getFullYear(),
    category: car.category || 'SEDAN & HATCHBACK',
    price_contado: car.price_contado || '$0',
    price_financiado: car.price_financiado || 'No Aplica',
    price_num: priceClean,
    status: (car.status || 'disponible').toLowerCase(),
    branch_id: car.branch_id || 1,
    specs: car.specs || [],
    cover_photo: car.cover_photo || 'assets/svg/autohaus-tag.svg',
    real_photos: car.real_photos || [car.cover_photo || 'assets/svg/autohaus-tag.svg'],
    cutout_photo: car.cutout_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    main_photo: car.main_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    created_at: now,
    updated_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('vehicles').insert([vehicleObj]);
    } catch (e) {}
  }

  await runQuery(`
    INSERT INTO vehicles (
      id, page, brand, model, year, category, price_contado, price_financiado, price_num, status, branch_id, specs, cover_photo, real_photos, cutout_photo, main_photo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    vehicleObj.id, vehicleObj.page, vehicleObj.brand, vehicleObj.model, vehicleObj.year, vehicleObj.category,
    vehicleObj.price_contado, vehicleObj.price_financiado, vehicleObj.price_num, vehicleObj.status, vehicleObj.branch_id,
    JSON.stringify(vehicleObj.specs), vehicleObj.cover_photo, JSON.stringify(vehicleObj.real_photos),
    vehicleObj.cutout_photo, vehicleObj.main_photo, now, now
  ]);

  // Log status history
  await logStatusChange(newId, vehicleObj.status, '', 'Ingreso inicial a inventario');

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
  const branch_id = car.branch_id !== undefined ? car.branch_id : existing.branch_id;
  const price_contado = car.price_contado !== undefined ? car.price_contado : existing.price_contado;
  const price_financiado = car.price_financiado !== undefined ? car.price_financiado : existing.price_financiado;
  const price_num = car.price_num !== undefined ? car.price_num : (parseInt((price_contado || '').replace(/[^0-9]/g, '')) || existing.price_num);
  const specs = car.specs !== undefined ? car.specs : existing.specs;
  const cover_photo = car.cover_photo !== undefined ? car.cover_photo : existing.cover_photo;
  const real_photos = car.real_photos !== undefined ? car.real_photos : existing.real_photos;

  const updates = {
    brand, model, year, category, price_contado, price_financiado, price_num,
    status, branch_id, specs, cover_photo, real_photos, cutout_photo: cover_photo, main_photo: cover_photo,
    updated_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('vehicles').update(updates).or(`id.eq.${existing.id},page.eq.${existing.page}`);
    } catch (e) {}
  }

  await runQuery(`
    UPDATE vehicles SET
      brand = ?, model = ?, year = ?, category = ?, price_contado = ?, price_financiado = ?, price_num = ?,
      status = ?, branch_id = ?, specs = ?, cover_photo = ?, real_photos = ?, cutout_photo = ?, main_photo = ?, updated_at = ?
    WHERE id = ? OR page = ?
  `, [
    brand, model, year, category, price_contado, price_financiado, price_num, status, branch_id,
    JSON.stringify(specs), cover_photo, JSON.stringify(real_photos), cover_photo, cover_photo, now,
    existing.id, existing.page
  ]);

  if (existing.status !== status) {
    await logStatusChange(existing.id, status, existing.status, 'Actualización de ficha técnica');
  }

  return getVehicle(existing.id);
}

async function updateVehicleStatus(identifier, status, extra = {}) {
  const existing = await getVehicle(identifier);
  if (!existing) return null;

  const now = new Date().toISOString();
  const safeStatus = (status || 'disponible').toLowerCase();

  if (useSupabase && supabase) {
    try {
      await supabase.from('vehicles').update({ status: safeStatus, updated_at: now }).or(`id.eq.${existing.id},page.eq.${existing.page}`);
    } catch (e) {}
  }

  await runQuery(`
    UPDATE vehicles SET status = ?, updated_at = ?
    WHERE id = ? OR page = ?
  `, [safeStatus, now, existing.id, existing.page]);

  await logStatusChange(
    existing.id, safeStatus, existing.status,
    extra.notes || `Cambio de estatus rápido a ${safeStatus.toUpperCase()}`,
    extra.deposit_amount || '',
    extra.client_id || null,
    extra.sales_rep_id || null
  );

  return getVehicle(existing.id);
}

async function deleteVehicle(identifier) {
  const existing = await getVehicle(identifier);
  if (!existing) return null;

  if (useSupabase && supabase) {
    try {
      await supabase.from('vehicles').delete().or(`id.eq.${existing.id},page.eq.${existing.page}`);
    } catch (e) {}
  }

  await runQuery('DELETE FROM vehicles WHERE id = ? OR page = ?', [existing.id, existing.page]);
  return existing;
}

// ==========================================
// VEHICLE STATUS HISTORY OPERATIONS
// ==========================================

async function logStatusChange(vehicleId, newStatus, previousStatus = '', notes = '', depositAmount = '', clientId = null, salesRepId = null) {
  const now = new Date().toISOString();
  const histId = 'hist_' + Date.now() + '_' + Math.round(Math.random() * 1000);

  const histObj = {
    id: histId,
    vehicle_id: vehicleId,
    status: newStatus,
    previous_status: previousStatus,
    client_id: clientId,
    sales_rep_id: salesRepId,
    deposit_amount: depositAmount,
    notes,
    created_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('vehicle_status_history').insert([histObj]);
    } catch (e) {}
  }

  await runQuery(`
    INSERT INTO vehicle_status_history (id, vehicle_id, status, previous_status, client_id, sales_rep_id, deposit_amount, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [histId, vehicleId, newStatus, previousStatus, clientId, salesRepId, depositAmount, notes, now]);
}

async function getVehicleStatusHistory(vehicleId) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('vehicle_status_history').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM vehicle_status_history WHERE vehicle_id = ? ORDER BY created_at DESC', [vehicleId]);
  return res.rows;
}

// ==========================================
// BRANCHES & SALES REPS OPERATIONS
// ==========================================

async function getBranches() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('branches').select('*').order('id', { ascending: true });
      if (!error && data) return data;
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM branches ORDER BY id ASC');
  return res.rows;
}

async function getSalesReps() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('sales_reps').select('*').order('turn_order', { ascending: true });
      if (!error && data) return data;
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM sales_reps ORDER BY turn_order ASC');
  return res.rows;
}

// ==========================================
// USERS & CLIENTS OPERATIONS
// ==========================================

async function getUsers() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*').order('id', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(formatUser);
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM users ORDER BY id ASC');
  return res.rows.map(formatUser);
}

async function getUserById(id) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) {
        return formatUser(data[0]);
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM users WHERE id = ? LIMIT 1', [id]);
  if (!res.rows.length) return null;
  return formatUser(res.rows[0]);
}

async function getUserByEmail(email) {
  if (!email) return null;
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('users').select('*').ilike('email', email.toLowerCase().trim()).limit(1);
      if (!error && data && data.length > 0) {
        return formatUser(data[0]);
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM users WHERE LOWER(email) = ? LIMIT 1', [email.toLowerCase().trim()]);
  if (!res.rows.length) return null;
  return formatUser(res.rows[0]);
}

async function createUser(user) {
  const now = new Date().toISOString();
  const id = user.id || Date.now();
  const userObj = {
    id,
    name: (user.name || '').trim(),
    email: (user.email || '').toLowerCase().trim(),
    phone: (user.phone || '').trim(),
    password: user.password,
    role: user.role || 'client',
    favorites: user.favorites || [],
    created_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('users').insert([userObj]);
      if (userObj.role === 'client') {
        await supabase.from('clients').insert([{
          id,
          user_id: id,
          name: userObj.name,
          email: userObj.email,
          phone: userObj.phone,
          city: 'Chihuahua',
          created_at: now
        }]);
      }
    } catch (e) {}
  }

  await runQuery(`
    INSERT INTO users (id, name, email, phone, password, role, favorites, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    userObj.id, userObj.name, userObj.email, userObj.phone, userObj.password, userObj.role,
    JSON.stringify(userObj.favorites), now
  ]);

  if (userObj.role === 'client') {
    await runQuery(`
      INSERT INTO clients (id, user_id, name, email, phone, city, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [id, id, userObj.name, userObj.email, userObj.phone, 'Chihuahua', now]);
  }

  return getUserById(id);
}

async function updateUserFavorites(userId, favorites) {
  if (useSupabase && supabase) {
    try {
      await supabase.from('users').update({ favorites }).eq('id', userId);
    } catch (e) {}
  }
  await runQuery('UPDATE users SET favorites = ? WHERE id = ?', [JSON.stringify(favorites || []), userId]);
  return getUserById(userId);
}

// ==========================================
// CLIENTS OPERATIONS
// ==========================================

async function getClients() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('clients').select('*').order('id', { ascending: true });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data;
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM clients ORDER BY id ASC');
  return res.rows;
}

async function getClientById(id) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('clients').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) {
        return data[0];
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM clients WHERE id = ? LIMIT 1', [id]);
  return res.rows[0] || null;
}

async function createClient(client) {
  const now = new Date().toISOString();
  const id = client.id || Date.now();
  const clientObj = {
    id,
    user_id: client.user_id || null,
    name: (client.name || '').trim(),
    email: (client.email || '').toLowerCase().trim(),
    phone: (client.phone || '').trim(),
    city: client.city || 'Chihuahua',
    created_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('clients').insert([clientObj]);
    } catch (e) {}
  }

  await runQuery(`
    INSERT INTO clients (id, user_id, name, email, phone, city, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [clientObj.id, clientObj.user_id, clientObj.name, clientObj.email, clientObj.phone, clientObj.city, now]);

  return getClientById(id);
}

// ==========================================
// LEADS CRUD OPERATIONS
// ==========================================

async function getLeads() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('leads').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(formatLead);
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM leads ORDER BY created_at DESC');
  return res.rows.map(formatLead);
}

async function getLeadById(id) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('leads').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) {
        return formatLead(data[0]);
      }
    } catch (e) {}
  }
  const res = await runQuery('SELECT * FROM leads WHERE id = ? LIMIT 1', [id]);
  if (!res.rows.length) return null;
  return formatLead(res.rows[0]);
}

async function createLead(lead) {
  const now = new Date().toISOString();
  const id = lead.id || ('lead_' + Date.now());
  const vId = lead.vehicle_id || (lead.vehicle_page ? `autohaus-p${lead.vehicle_page}` : null);

  const leadObj = {
    id,
    client_id: lead.client_id || null,
    vehicle_id: vId,
    sales_rep_id: lead.sales_rep_id || null,
    client_name: lead.client_name.trim(),
    client_phone: lead.client_phone.trim(),
    client_email: (lead.client_email || '').trim(),
    vehicle_page: lead.vehicle_page ? parseInt(lead.vehicle_page, 10) : null,
    vehicle_name: lead.vehicle_name || 'Interés General',
    assigned_to: (lead.assigned_to || '').toLowerCase().trim(),
    assigned_name: lead.assigned_name || lead.assigned_to || '',
    status: lead.status || 'nuevo',
    notes: lead.notes || '',
    created_at: now,
    updated_at: now
  };

  if (useSupabase && supabase) {
    try {
      await supabase.from('leads').insert([leadObj]);
    } catch (e) {}
  }

  await runQuery(`
    INSERT INTO leads (id, client_id, vehicle_id, sales_rep_id, client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, status, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    leadObj.id, leadObj.client_id, leadObj.vehicle_id, leadObj.sales_rep_id,
    leadObj.client_name, leadObj.client_phone, leadObj.client_email,
    leadObj.vehicle_page, leadObj.vehicle_name, leadObj.assigned_to, leadObj.assigned_name,
    leadObj.status, leadObj.notes, now, now
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
  const vehicle_id = data.vehicle_id !== undefined ? data.vehicle_id : existing.vehicle_id;
  const vehicle_name = data.vehicle_name !== undefined ? data.vehicle_name : existing.vehicle_name;
  const assigned_to = data.assigned_to !== undefined ? data.assigned_to.toLowerCase().trim() : existing.assigned_to;
  const assigned_name = data.assigned_name !== undefined ? data.assigned_name : existing.assigned_name;
  const status = data.status !== undefined ? data.status : existing.status;
  const notes = data.notes !== undefined ? data.notes : existing.notes;

  const updates = { client_name, client_phone, client_email, vehicle_page, vehicle_id, vehicle_name, assigned_to, assigned_name, status, notes, updated_at: now };

  if (useSupabase && supabase) {
    try {
      await supabase.from('leads').update(updates).eq('id', id);
    } catch (e) {}
  }

  await runQuery(`
    UPDATE leads SET
      client_name = ?, client_phone = ?, client_email = ?, vehicle_page = ?, vehicle_id = ?,
      vehicle_name = ?, assigned_to = ?, assigned_name = ?, status = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `, [
    client_name, client_phone, client_email, vehicle_page, vehicle_id,
    vehicle_name, assigned_to, assigned_name, status, notes, now, id
  ]);

  return getLeadById(id);
}

async function deleteLead(id) {
  const existing = await getLeadById(id);
  if (!existing) return null;

  if (useSupabase && supabase) {
    try {
      await supabase.from('leads').delete().eq('id', id);
    } catch (e) {}
  }

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
  getVehicleStatusHistory,
  logStatusChange,
  getBranches,
  getSalesReps,
  getClients,
  getClientById,
  createClient,
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
