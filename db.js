/**
 * Autohaus Enterprise Database Layer (SQL & Supabase Cloud SSOT)
 * Single Source of Truth (SSOT) en Supabase PostgreSQL con fallback local SQLite.
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const DB_PATH = path.join(__dirname, 'assets', 'data', 'autohaus.db');
const DATA_DIR = path.join(__dirname, 'assets', 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

let dbInstance = null;
let sqliteModule = null;
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
  if (useSupabase) return null;
  if (!dbInstance) {
    try {
      if (!sqliteModule) {
        sqliteModule = require('sqlite3').verbose();
      }
      dbInstance = new sqliteModule.Database(DB_PATH);
    } catch (e) {
      console.warn('SQLite offline no disponible (usando Supabase o modo degradado):', e.message);
      return null;
    }
  }
  return dbInstance;
}

// SQL Query helper for SQLite (Solo utilizado en modo offline/fallback)
async function runQuery(sql, params = []) {
  const db = getSqliteDb();
  if (!db) {
    return { rows: [] };
  }
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
    vin: v.vin || '',
    is_active: v.is_active !== false && v.is_active !== 0,
    deleted_at: v.deleted_at || null,
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
 * Initialize Database Schema (Offline SQLite Fallback)
 */
async function initDb() {
  try {
    // SQLite relational schema fallback
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
        branch_id INTEGER,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT,
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
        branch_id INTEGER DEFAULT 1,
        vin TEXT UNIQUE,
        page INTEGER,
        brand TEXT,
        model TEXT,
        year INTEGER,
        category TEXT,
        price_contado TEXT,
        price_financiado TEXT,
        price_num INTEGER,
        status TEXT DEFAULT 'disponible',
        is_active BOOLEAN DEFAULT 1,
        deleted_at TEXT,
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
        client_id INTEGER,
        sales_rep_id INTEGER,
        status TEXT NOT NULL,
        previous_status TEXT,
        deposit_amount TEXT,
        notes TEXT,
        created_at TEXT,
        updated_at TEXT
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

    await runQuery(`
      CREATE TABLE IF NOT EXISTS credit_applications (
        id TEXT PRIMARY KEY,
        client_name TEXT NOT NULL,
        client_phone TEXT NOT NULL,
        client_email TEXT,
        vehicle_id TEXT,
        vehicle_name TEXT NOT NULL,
        vehicle_price TEXT,
        financial_institution TEXT NOT NULL,
        down_payment TEXT,
        financed_amount TEXT,
        term_months INTEGER,
        monthly_payment TEXT,
        sales_rep TEXT,
        status TEXT DEFAULT 'en_proceso',
        notes TEXT,
        created_by TEXT,
        created_at TEXT,
        updated_at TEXT
      );
    `);

    // Check if credit_applications is empty and seed from JSON
    const creditRows = await runQuery('SELECT COUNT(*) as cnt FROM credit_applications');
    if (creditRows.rows && creditRows.rows[0] && creditRows.rows[0].cnt === 0) {
      const jsonPath = path.join(__dirname, 'assets/data/credits.json');
      if (fs.existsSync(jsonPath)) {
        try {
          const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
          for (const c of list) {
            await runQuery(`
              INSERT OR IGNORE INTO credit_applications (
                id, client_name, client_phone, client_email, vehicle_id, vehicle_name, vehicle_price,
                financial_institution, down_payment, financed_amount, term_months, monthly_payment,
                sales_rep, status, notes, created_by, created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              c.id, c.client_name, c.client_phone, c.client_email, c.vehicle_id, c.vehicle_name, c.vehicle_price,
              c.financial_institution, c.down_payment, c.financed_amount, c.term_months, c.monthly_payment,
              c.sales_rep, c.status, c.notes, c.created_by, c.created_at, c.updated_at
            ]);
          }
        } catch (e) {}
      }
    }
  } catch (err) {
    console.error('Error in initDb:', err.message);
  }
}

// ==========================================
// VEHICLES CRUD & STATUS OPERATIONS
// ==========================================

async function getVehicles(options = {}) {
  const includeDeleted = options.includeDeleted === true;
  if (useSupabase && supabase) {
    try {
      let query = supabase.from('vehicles').select('*');
      if (!includeDeleted) {
        query = query.eq('is_active', true).is('deleted_at', null);
      }
      const { data, error } = await query.order('page', { ascending: true });
      if (!error && Array.isArray(data)) {
        return sortVehicles(data.map(formatVehicle));
      }
      if (error) {
        console.error('Supabase getVehicles error:', error.message);
      }
    } catch (e) {
      console.error('Error in getVehicles Supabase:', e.message);
    }
  }

  let sql = 'SELECT * FROM vehicles';
  if (!includeDeleted) {
    sql += ' WHERE (is_active = 1 OR is_active IS NULL) AND deleted_at IS NULL';
  }
  sql += ' ORDER BY page ASC';
  const res = await runQuery(sql);
  return sortVehicles(res.rows.map(formatVehicle));
}

async function getVehicle(identifier, options = {}) {
  const includeDeleted = options.includeDeleted !== false; // default true for direct lookup
  if (useSupabase && supabase) {
    try {
      const pageNum = parseInt(identifier, 10) || -1;
      let query = supabase.from('vehicles').select('*').or(`id.eq.${identifier},page.eq.${pageNum}`);
      if (!includeDeleted) {
        query = query.eq('is_active', true).is('deleted_at', null);
      }
      const { data, error } = await query.limit(1);
      if (!error && data && data.length > 0) {
        return formatVehicle(data[0]);
      }
    } catch (e) {
      console.error('Error in getVehicle Supabase:', e.message);
    }
  }

  let sql = 'SELECT * FROM vehicles WHERE (id = ? OR page = ?)';
  if (!includeDeleted) {
    sql += ' AND (is_active = 1 OR is_active IS NULL) AND deleted_at IS NULL';
  }
  sql += ' LIMIT 1';
  const res = await runQuery(sql, [String(identifier), parseInt(identifier, 10) || -1]);
  if (!res.rows.length) return null;
  return formatVehicle(res.rows[0]);
}

async function createVehicle(car) {
  const now = new Date().toISOString();
  const newId = car.id || ('autohaus-v' + Date.now());
  const priceClean = car.price_num || parseInt((car.price_contado || '').replace(/[^0-9]/g, '')) || 0;

  let newPage = car.page;
  if (!newPage) {
    const all = await getVehicles({ includeDeleted: true });
    const maxPage = all.reduce((max, v) => Math.max(max, v.page || 0), 3);
    newPage = maxPage + 1;
  }

  const rawStatus = (car.status || 'disponible').toLowerCase().trim();
  const status = ['disponible', 'apartado', 'en_preparacion', 'vendido', 'baja'].includes(rawStatus) ? rawStatus : 'disponible';

  let cleanVin = null;
  if (car.vin && typeof car.vin === 'string' && car.vin.trim()) {
    cleanVin = car.vin.trim().toUpperCase();
  }

  const vehicleObj = {
    id: newId,
    vin: cleanVin,
    branch_id: car.branch_id || 1,
    page: newPage,
    brand: (car.brand || '').toUpperCase().trim(),
    model: (car.model || '').toUpperCase().trim(),
    year: parseInt(car.year, 10) || new Date().getFullYear(),
    category: car.category || 'SEDAN & HATCHBACK',
    price_contado: car.price_contado || '$0',
    price_financiado: car.price_financiado || 'No Aplica',
    price_num: priceClean,
    status,
    is_active: true,
    deleted_at: null,
    specs: car.specs || [],
    cover_photo: car.cover_photo || 'assets/svg/autohaus-tag.svg',
    real_photos: car.real_photos || [car.cover_photo || 'assets/svg/autohaus-tag.svg'],
    cutout_photo: car.cutout_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    main_photo: car.main_photo || car.cover_photo || 'assets/svg/autohaus-tag.svg',
    created_at: now,
    updated_at: now
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('vehicles').insert([vehicleObj]).select().single();
    if (error) {
      console.error('Error inserting vehicle in Supabase:', error.message);
      throw new Error(error.message);
    }
    await logStatusChange(newId, vehicleObj.status, '', 'Ingreso inicial a inventario');
    return formatVehicle(data || vehicleObj);
  }

  await runQuery(`
    INSERT INTO vehicles (
      id, branch_id, vin, page, brand, model, year, category, price_contado, price_financiado, price_num, status, is_active, deleted_at, specs, cover_photo, real_photos, cutout_photo, main_photo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    vehicleObj.id, vehicleObj.branch_id, vehicleObj.vin, vehicleObj.page, vehicleObj.brand, vehicleObj.model, vehicleObj.year, vehicleObj.category,
    vehicleObj.price_contado, vehicleObj.price_financiado, vehicleObj.price_num, vehicleObj.status, 1, null,
    JSON.stringify(vehicleObj.specs), vehicleObj.cover_photo, JSON.stringify(vehicleObj.real_photos),
    vehicleObj.cutout_photo, vehicleObj.main_photo, now, now
  ]);

  await logStatusChange(newId, vehicleObj.status, '', 'Ingreso inicial a inventario');
  return getVehicle(newId, { includeDeleted: true });
}

async function updateVehicle(identifier, car) {
  const existing = await getVehicle(identifier, { includeDeleted: true });
  if (!existing) return null;

  const now = new Date().toISOString();
  const brand = car.brand !== undefined ? car.brand.toUpperCase().trim() : existing.brand;
  const model = car.model !== undefined ? car.model.toUpperCase().trim() : existing.model;
  const year = car.year !== undefined ? (parseInt(car.year, 10) || existing.year) : existing.year;
  const category = car.category !== undefined ? car.category : existing.category;
  let status = existing.status;
  if (car.status !== undefined) {
    const s = car.status.toLowerCase().trim();
    if (['disponible', 'apartado', 'en_preparacion', 'vendido', 'baja'].includes(s)) {
      status = s;
    }
  }
  const branch_id = car.branch_id !== undefined ? car.branch_id : existing.branch_id;
  
  let cleanVin = null;
  if (car.vin !== undefined) {
    if (car.vin && typeof car.vin === 'string' && car.vin.trim()) {
      cleanVin = car.vin.trim().toUpperCase();
    }
  } else if (existing.vin && typeof existing.vin === 'string' && existing.vin.trim()) {
    cleanVin = existing.vin.trim().toUpperCase();
  }

  const is_active = car.is_active !== undefined ? car.is_active : existing.is_active;
  const deleted_at = car.deleted_at !== undefined ? car.deleted_at : existing.deleted_at;
  const price_contado = car.price_contado !== undefined ? car.price_contado : existing.price_contado;
  const price_financiado = car.price_financiado !== undefined ? car.price_financiado : existing.price_financiado;
  const price_num = car.price_num !== undefined ? car.price_num : (parseInt((price_contado || '').replace(/[^0-9]/g, '')) || existing.price_num);
  const specs = car.specs !== undefined ? car.specs : existing.specs;
  const cover_photo = car.cover_photo !== undefined ? car.cover_photo : existing.cover_photo;
  const real_photos = car.real_photos !== undefined ? car.real_photos : existing.real_photos;

  const updates = {
    brand, model, year, category, price_contado, price_financiado, price_num,
    status, branch_id, vin: cleanVin, is_active, deleted_at, specs, cover_photo, real_photos,
    cutout_photo: cover_photo, main_photo: cover_photo, updated_at: now
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('vehicles').update(updates).eq('id', existing.id).select().single();
    if (error) {
      console.error('Error updating vehicle in Supabase:', error.message);
      throw new Error(error.message);
    }
    if (existing.status !== status) {
      await logStatusChange(existing.id, status, existing.status, 'Actualización de ficha técnica');
    }
    return formatVehicle(data || { ...existing, ...updates });
  }

  await runQuery(`
    UPDATE vehicles SET
      brand = ?, model = ?, year = ?, category = ?, price_contado = ?, price_financiado = ?, price_num = ?,
      status = ?, branch_id = ?, vin = ?, is_active = ?, deleted_at = ?, specs = ?, cover_photo = ?, real_photos = ?, cutout_photo = ?, main_photo = ?, updated_at = ?
    WHERE id = ? OR page = ?
  `, [
    brand, model, year, category, price_contado, price_financiado, price_num, status, branch_id,
    vin, is_active ? 1 : 0, deleted_at, JSON.stringify(specs), cover_photo, JSON.stringify(real_photos),
    cover_photo, cover_photo, now, existing.id, existing.page
  ]);

  if (existing.status !== status) {
    await logStatusChange(existing.id, status, existing.status, 'Actualización de ficha técnica');
  }

  return getVehicle(existing.id, { includeDeleted: true });
}

async function updateVehicleStatus(identifier, status, extra = {}) {
  const existing = await getVehicle(identifier, { includeDeleted: true });
  if (!existing) return null;

  const now = new Date().toISOString();
  const safeStatus = (status || 'disponible').toLowerCase().trim();
  if (!['disponible', 'apartado', 'en_preparacion', 'vendido', 'baja'].includes(safeStatus)) {
    throw new Error('Estatus inválido: ' + status);
  }

  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('vehicles').update({ status: safeStatus, updated_at: now }).eq('id', existing.id).select().single();
    if (error) {
      console.error('Error updating vehicle status in Supabase:', error.message);
      throw new Error(error.message);
    }
    await logStatusChange(
      existing.id, safeStatus, existing.status,
      extra.notes || `Cambio de estatus rápido a ${safeStatus.toUpperCase()}`,
      extra.deposit_amount || '',
      extra.client_id || null,
      extra.sales_rep_id || null
    );
    return formatVehicle(data || { ...existing, status: safeStatus });
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

  return getVehicle(existing.id, { includeDeleted: true });
}

/**
 * Soft Delete: Marca el vehículo como inactivo (is_active = false, deleted_at = now, status = 'baja')
 * Preserva integridad referencial y audita el movimiento en vehicle_status_history.
 */
async function deleteVehicle(identifier) {
  const existing = await getVehicle(identifier, { includeDeleted: true });
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates = {
    is_active: false,
    deleted_at: now,
    status: 'baja',
    updated_at: now
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('vehicles').update(updates).eq('id', existing.id).select().single();
    if (error) {
      console.error('Error soft-deleting in Supabase:', error.message);
      throw new Error(error.message);
    }
    await logStatusChange(existing.id, 'baja', existing.status, 'Baja de inventario (Soft Delete)');
    return formatVehicle(data || { ...existing, ...updates });
  }

  await runQuery(`
    UPDATE vehicles SET is_active = 0, deleted_at = ?, status = 'baja', updated_at = ?
    WHERE id = ? OR page = ?
  `, [now, now, existing.id, existing.page]);

  await logStatusChange(existing.id, 'baja', existing.status, 'Baja de inventario (Soft Delete)');

  return { ...existing, ...updates };
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
    created_at: now,
    updated_at: now
  };

  if (useSupabase && supabase) {
    const { data, error } = await supabase.from('vehicle_status_history').insert([histObj]).select().single();
    if (error) {
      console.error('Error logging status history in Supabase:', error.message);
    }
    return data || histObj;
  }

  await runQuery(`
    INSERT INTO vehicle_status_history (id, vehicle_id, status, previous_status, client_id, sales_rep_id, deposit_amount, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [histId, vehicleId, newStatus, previousStatus, clientId, salesRepId, depositAmount, notes, now, now]);

  return histObj;
}

async function getVehicleStatusHistory(vehicleId) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('vehicle_status_history').select('*').eq('vehicle_id', vehicleId).order('created_at', { ascending: false });
      if (!error && data) return data;
    } catch (e) {
      console.error('Error fetching vehicle status history:', e.message);
    }
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
      return formatUser(userObj);
    } catch (e) {
      console.error('Error creating user in Supabase:', e.message);
      throw new Error(e.message);
    }
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
      return getUserById(userId);
    } catch (e) {
      console.error('Error updating favorites in Supabase:', e.message);
    }
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
      const { data, error } = await supabase.from('clients').insert([clientObj]).select().single();
      if (error) throw new Error(error.message);
      return data || clientObj;
    } catch (e) {
      console.error('Error creating client in Supabase:', e.message);
      throw new Error(e.message);
    }
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
      const { data, error } = await supabase.from('leads').insert([leadObj]).select().single();
      if (error) throw new Error(error.message);
      return formatLead(data || leadObj);
    } catch (e) {
      console.error('Error inserting lead in Supabase:', e.message);
      throw new Error(e.message);
    }
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
      const { data: updated, error } = await supabase.from('leads').update(updates).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return formatLead(updated || { ...existing, ...updates });
    } catch (e) {
      console.error('Error updating lead in Supabase:', e.message);
      throw new Error(e.message);
    }
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
      return existing;
    } catch (e) {
      console.error('Error deleting lead in Supabase:', e.message);
      throw new Error(e.message);
    }
  }

  await runQuery('DELETE FROM leads WHERE id = ?', [id]);
  return existing;
}

// ==========================================
// CREDIT APPLICATIONS (FINANCIAMIENTO & FNA)
// ==========================================

function formatCredit(c) {
  if (!c) return null;
  return {
    id: c.id,
    client_name: c.client_name || '',
    client_phone: c.client_phone || '',
    client_email: c.client_email || '',
    vehicle_id: c.vehicle_id || null,
    vehicle_name: c.vehicle_name || 'Vehículo no especificado',
    vehicle_price: c.vehicle_price || '$0',
    financial_institution: c.financial_institution || 'Por definir',
    down_payment: c.down_payment || '$0',
    financed_amount: c.financed_amount || '$0',
    term_months: parseInt(c.term_months, 10) || 48,
    monthly_payment: c.monthly_payment || '$0',
    sales_rep: c.sales_rep || 'Sin asignar',
    status: (c.status || 'en_proceso').toLowerCase(),
    notes: c.notes || '',
    created_by: c.created_by || 'fna@autohaus.mx',
    created_at: c.created_at || new Date().toISOString(),
    updated_at: c.updated_at || new Date().toISOString()
  };
}

async function getCredits() {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('credit_applications').select('*').order('created_at', { ascending: false });
      if (!error && Array.isArray(data) && data.length > 0) {
        return data.map(formatCredit);
      }
    } catch (e) {}
  }
  try {
    const res = await runQuery('SELECT * FROM credit_applications ORDER BY created_at DESC');
    if (res.rows && res.rows.length) {
      return res.rows.map(formatCredit);
    }
  } catch (e) {}
  
  // Local JSON fallback
  const jsonPath = path.join(__dirname, 'assets/data/credits.json');
  if (fs.existsSync(jsonPath)) {
    try {
      const list = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      return list.map(formatCredit);
    } catch (e) {}
  }
  return [];
}

async function getCreditById(id) {
  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('credit_applications').select('*').eq('id', id).limit(1);
      if (!error && data && data.length > 0) {
        return formatCredit(data[0]);
      }
    } catch (e) {}
  }
  try {
    const res = await runQuery('SELECT * FROM credit_applications WHERE id = ? LIMIT 1', [id]);
    if (res.rows && res.rows.length) return formatCredit(res.rows[0]);
  } catch (e) {}

  const list = await getCredits();
  return list.find(c => c.id === id) || null;
}

async function createCredit(credit) {
  const now = new Date().toISOString();
  const id = credit.id || ('cred-' + Date.now());

  const creditObj = {
    id,
    client_name: (credit.client_name || '').trim(),
    client_phone: (credit.client_phone || '').trim(),
    client_email: (credit.client_email || '').trim(),
    vehicle_id: credit.vehicle_id || null,
    vehicle_name: credit.vehicle_name || 'Vehículo',
    vehicle_price: credit.vehicle_price || '$0',
    financial_institution: credit.financial_institution || 'BBVA Bancomer',
    down_payment: credit.down_payment || '$0',
    financed_amount: credit.financed_amount || '$0',
    term_months: parseInt(credit.term_months, 10) || 48,
    monthly_payment: credit.monthly_payment || '$0',
    sales_rep: credit.sales_rep || 'Napo',
    status: (credit.status || 'en_proceso').toLowerCase(),
    notes: credit.notes || '',
    created_by: credit.created_by || 'fna@autohaus.mx',
    created_at: now,
    updated_at: now
  };

  if (useSupabase && supabase) {
    try {
      const { data, error } = await supabase.from('credit_applications').insert([creditObj]).select().single();
      if (!error && data) return formatCredit(data);
    } catch (e) {}
  }

  try {
    await runQuery(`
      INSERT INTO credit_applications (
        id, client_name, client_phone, client_email, vehicle_id, vehicle_name, vehicle_price,
        financial_institution, down_payment, financed_amount, term_months, monthly_payment,
        sales_rep, status, notes, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      creditObj.id, creditObj.client_name, creditObj.client_phone, creditObj.client_email,
      creditObj.vehicle_id, creditObj.vehicle_name, creditObj.vehicle_price,
      creditObj.financial_institution, creditObj.down_payment, creditObj.financed_amount,
      creditObj.term_months, creditObj.monthly_payment, creditObj.sales_rep,
      creditObj.status, creditObj.notes, creditObj.created_by, now, now
    ]);
  } catch (e) {}

  // Sync to local credits.json
  const jsonPath = path.join(__dirname, 'assets/data/credits.json');
  let currentList = [];
  try {
    if (fs.existsSync(jsonPath)) currentList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {}
  currentList.unshift(creditObj);
  fs.writeFileSync(jsonPath, JSON.stringify(currentList, null, 2), 'utf8');

  return creditObj;
}

async function updateCredit(id, data) {
  const existing = await getCreditById(id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const updates = {
    client_name: data.client_name !== undefined ? data.client_name.trim() : existing.client_name,
    client_phone: data.client_phone !== undefined ? data.client_phone.trim() : existing.client_phone,
    client_email: data.client_email !== undefined ? data.client_email.trim() : existing.client_email,
    vehicle_id: data.vehicle_id !== undefined ? data.vehicle_id : existing.vehicle_id,
    vehicle_name: data.vehicle_name !== undefined ? data.vehicle_name : existing.vehicle_name,
    vehicle_price: data.vehicle_price !== undefined ? data.vehicle_price : existing.vehicle_price,
    financial_institution: data.financial_institution !== undefined ? data.financial_institution : existing.financial_institution,
    down_payment: data.down_payment !== undefined ? data.down_payment : existing.down_payment,
    financed_amount: data.financed_amount !== undefined ? data.financed_amount : existing.financed_amount,
    term_months: data.term_months !== undefined ? parseInt(data.term_months, 10) : existing.term_months,
    monthly_payment: data.monthly_payment !== undefined ? data.monthly_payment : existing.monthly_payment,
    sales_rep: data.sales_rep !== undefined ? data.sales_rep : existing.sales_rep,
    status: data.status !== undefined ? data.status.toLowerCase() : existing.status,
    notes: data.notes !== undefined ? data.notes : existing.notes,
    updated_at: now
  };

  if (useSupabase && supabase) {
    try {
      const { data: updated, error } = await supabase.from('credit_applications').update(updates).eq('id', id).select().single();
      if (!error && updated) return formatCredit(updated);
    } catch (e) {}
  }

  try {
    await runQuery(`
      UPDATE credit_applications SET
        client_name = ?, client_phone = ?, client_email = ?, vehicle_id = ?, vehicle_name = ?, vehicle_price = ?,
        financial_institution = ?, down_payment = ?, financed_amount = ?, term_months = ?, monthly_payment = ?,
        sales_rep = ?, status = ?, notes = ?, updated_at = ?
      WHERE id = ?
    `, [
      updates.client_name, updates.client_phone, updates.client_email, updates.vehicle_id, updates.vehicle_name, updates.vehicle_price,
      updates.financial_institution, updates.down_payment, updates.financed_amount, updates.term_months, updates.monthly_payment,
      updates.sales_rep, updates.status, updates.notes, now, id
    ]);
  } catch (e) {}

  // Sync to local credits.json
  const jsonPath = path.join(__dirname, 'assets/data/credits.json');
  try {
    if (fs.existsSync(jsonPath)) {
      let currentList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      const idx = currentList.findIndex(c => c.id === id);
      if (idx !== -1) {
        currentList[idx] = { ...currentList[idx], ...updates };
        fs.writeFileSync(jsonPath, JSON.stringify(currentList, null, 2), 'utf8');
      }
    }
  } catch (e) {}

  return { ...existing, ...updates };
}

async function deleteCredit(id) {
  const existing = await getCreditById(id);
  if (!existing) return null;

  if (useSupabase && supabase) {
    try {
      await supabase.from('credit_applications').delete().eq('id', id);
    } catch (e) {}
  }

  try {
    await runQuery('DELETE FROM credit_applications WHERE id = ?', [id]);
  } catch (e) {}

  // Sync to local credits.json
  const jsonPath = path.join(__dirname, 'assets/data/credits.json');
  try {
    if (fs.existsSync(jsonPath)) {
      let currentList = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      currentList = currentList.filter(c => c.id !== id);
      fs.writeFileSync(jsonPath, JSON.stringify(currentList, null, 2), 'utf8');
    }
  } catch (e) {}

  return existing;
}

async function getCreditStats() {
  const credits = await getCredits();
  let total = credits.length;
  let enProceso = 0;
  let aprobados = 0;
  let rechazados = 0;
  let entregados = 0;

  const byInstitution = {};

  credits.forEach(c => {
    const st = (c.status || 'en_proceso').toLowerCase();
    if (st === 'aprobado') aprobados++;
    else if (st === 'rechazado') rechazados++;
    else if (st === 'entregado') entregados++;
    else enProceso++;

    const inst = c.financial_institution || 'Otras';
    byInstitution[inst] = (byInstitution[inst] || 0) + 1;
  });

  return {
    total,
    enProceso,
    aprobados,
    rechazados,
    entregados,
    byInstitution,
    lastUpdated: new Date().toISOString()
  };
}

// ==========================================
// STATS
// ==========================================

async function getStats() {
  const allVehicles = await getVehicles({ includeDeleted: true });
  const activeVehicles = allVehicles.filter(v => v.is_active && !v.deleted_at);
  const leads = await getLeads();

  let totalContadoValue = 0;
  let disponiblesCount = 0;
  let apartadosCount = 0;
  let vendidosCount = 0;
  let enPreparacionCount = 0;
  let bajasCount = 0;

  const categoryCounts = {
    'SEDAN & HATCHBACK': 0,
    "SUV'S": 0,
    'PICK UPS': 0,
    'DEPORTIVOS': 0
  };

  allVehicles.forEach(v => {
    const st = (v.status || 'disponible').toLowerCase();
    if (!v.is_active || v.deleted_at || st === 'baja') {
      bajasCount++;
      return;
    }

    totalContadoValue += (v.price_num || 0);
    if (st === 'apartado') apartadosCount++;
    else if (st === 'vendido') vendidosCount++;
    else if (st === 'en_preparacion') enPreparacionCount++;
    else disponiblesCount++;

    if (categoryCounts[v.category] !== undefined) {
      categoryCounts[v.category]++;
    }
  });

  return {
    totalVehicles: activeVehicles.length,
    activeVehicles: activeVehicles.length,
    totalAllIncludingDeleted: allVehicles.length,
    disponiblesCount,
    apartadosCount,
    vendidosCount,
    enPreparacionCount,
    bajasCount,
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
  getCredits,
  getCreditById,
  createCredit,
  updateCredit,
  deleteCredit,
  getCreditStats,
  getStats,
  getSupabaseClient: () => (useSupabase ? supabase : null),
  CATEGORY_ORDER,
  sortVehicles
};
