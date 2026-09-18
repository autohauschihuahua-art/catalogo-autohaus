const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { sortCatalogByCategory, generateFullCatalogPDF, isGeneratingPDF } = require('./scripts/pdfGenerator');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'autohaus_super_secure_jwt_secret_2026';

// Paths
const DATA_FILE = path.join(__dirname, 'assets', 'data', 'catalog.json');
const JS_DATA_FILE = path.join(__dirname, 'scripts', 'data.js');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'cars');

// Ensure directories exist
fs.mkdirSync(path.join(__dirname, 'assets', 'data'), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Helper: Synchronize static mirrors (catalog.json & scripts/data.js) for static caching / offline fallbacks
function syncStaticMirrors(vehicles) {
  try {
    // 1. JSON Mirror
    fs.writeFileSync(DATA_FILE, JSON.stringify(vehicles, null, 2), 'utf-8');

    // 2. Client scripts/data.js Mirror
    const jsData = `/**
 * Catálogo Autohaus - Base de Datos Maestra (Sincronizada con el CMS)
 */

const AUTOHAUS_DATA = {
  metadata: {
    title: "Catálogo Autohaus",
    version: "7.0.0",
    total_pages: ${Math.max(65, vehicles.length + 6)},
    vehicles_count: ${vehicles.length},
    contact: "477 771 0000",
    whatsapp: "524777710000",
    instagram: "@autohausautohaus",
    location: "Chihuahua, Chihuahua, México",
    generated_at: "${new Date().toISOString()}"
  },
  sections: [
    {
      page: 1,
      type: "cover",
      hero_image: "assets/cars/page_4_img_2.jpeg",
      title: "CATÁLOGO DIGITAL AUTOHAUS",
      subtitle: "INVENTARIO COMPLETO Y FINANCIAMIENTO",
      handle: "@autohausautohaus"
    },
    {
      page: 2,
      type: "divider",
      category: "SEDAN & HATCHBACK",
      line1: "LÍNEA",
      line2: "SEDAN & HATCHBACK",
      hero_image: "assets/cars/page_2_img_2.jpeg",
      handle: "@autohausautohaus"
    },
    {
      page: 22,
      type: "divider",
      category: "SUV'S",
      line1: "LÍNEA",
      line2: "SUV'S",
      hero_image: "assets/cars/page_23_img_2.jpeg",
      handle: "@autohausautohaus"
    },
    {
      page: 47,
      type: "divider",
      category: "PICK UPS",
      line1: "LÍNEA",
      line2: "PICK UPS",
      hero_image: "assets/cars/page_48_img_2.jpeg",
      handle: "@autohausautohaus"
    },
    {
      page: 62,
      type: "divider",
      category: "DEPORTIVOS",
      line1: "LÍNEA",
      line2: "DEPORTIVOS",
      hero_image: "assets/cars/page_65_img_2.jpeg",
      handle: "@autohausautohaus"
    }
  ],
  vehicles: ${JSON.stringify(vehicles, null, 4)}
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AUTOHAUS_DATA;
}
`;
    fs.writeFileSync(JS_DATA_FILE, jsData, 'utf-8');
    return true;
  } catch (err) {
    console.error('Error sincronizando mirrors estáticos:', err);
    return false;
  }
}

// ==========================================
// SECURITY HEADERS (HELMET) & HARDENING
// ==========================================
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
      scriptSrcAttr: ["'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      styleSrcAttr: ["'unsafe-inline'"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https:", "http:"],
      connectSrc: ["'self'", "https://api.whatsapp.com", "https://wa.me"],
      frameSrc: ["'self'", "https://www.google.com"],
      objectSrc: ["'none'"]
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Hide server fingerprint
app.disable('x-powered-by');

// Middleware
app.use(cors());
app.use(express.json({ limit: '30mb' }));
app.use(express.urlencoded({ extended: true, limit: '30mb' }));

// Global Anti-Cache Middleware for all /api routes (ensures live DB persistence & no stale responses)
app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  next();
});

// ==========================================
// RATE LIMITERS (ANTI-BRUTE FORCE & ANTI-BOTS)
// ==========================================

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 400,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiadas solicitudes desde esta IP. Por favor intenta más tarde.' }
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Demasiados intentos fallidos de inicio de sesión. Tu IP ha sido bloqueada temporalmente durante 15 minutos por seguridad.' }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Has alcanzado el límite de creación de cuentas por hoy.' }
});

const leadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Has alcanzado el límite de solicitudes. Un asesor de Autohaus te contactará enseguida.' }
});

app.use('/api/', apiLimiter);

// Sanitization Helper
function sanitizeInput(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/javascript:/gi, '')
    .replace(/onload=/gi, '')
    .replace(/onerror=/gi, '')
    .trim();
}

// Multer Storage Configuration
const ALLOWED_EXTENSIONS = ['.jpeg', '.jpg', '.png', '.webp'];

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpeg';
    const safeExt = ALLOWED_EXTENSIONS.includes(ext) ? ext : '.jpeg';
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E6);
    cb(null, `car_${uniqueSuffix}${safeExt}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') && ALLOWED_EXTENSIONS.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen válidos (JPEG, PNG, WebP)'));
    }
  }
});

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Inicia sesión.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (!err) {
      req.user = user;
      return next();
    }
    jwt.verify(token, 'autohaus_super_secure_jwt_secret_2025', (legacyErr, legacyUser) => {
      if (!legacyErr) {
        req.user = legacyUser;
        return next();
      }
      return res.status(403).json({ success: false, message: 'Sesión expirada o token inválido.' });
    });
  });
}

function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Acción exclusiva para el Administrador.' });
}

function requireAdminOrSecretary(req, res, next) {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'secretary')) {
    return next();
  }
  return res.status(403).json({ success: false, message: 'Permiso denegado. Tu perfil es de solo lectura.' });
}

// ==========================================
// AUTHENTICATION API ROUTES
// ==========================================

// 1. Client Registration (Public)
app.post('/api/auth/register-client', registerLimiter, async (req, res) => {
  try {
    const name = sanitizeInput(req.body.name);
    const email = sanitizeInput(req.body.email);
    const phone = sanitizeInput(req.body.phone);
    const password = req.body.password;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, correo y contraseña son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const existing = await db.getUserByEmail(email);
    if (existing) {
      return res.status(400).json({ success: false, message: 'Este correo electrónico ya está registrado. Inicia sesión.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newClient = await db.createUser({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: (phone || '').trim(),
      password: hashedPassword,
      role: 'client',
      favorites: []
    });

    const token = jwt.sign(
      { id: newClient.id, email: newClient.email, name: newClient.name, role: 'client' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(201).json({
      success: true,
      message: '¡Cuenta creada con éxito! Bienvenido a Autohaus.',
      token,
      user: {
        id: newClient.id,
        name: newClient.name,
        email: newClient.email,
        phone: newClient.phone,
        role: 'client',
        favorites: []
      }
    });
  } catch (err) {
    console.error('Error registering client:', err);
    res.status(500).json({ success: false, message: 'Error interno al registrar cliente.' });
  }
});

// 2. Login (Clients and Staff)
app.post('/api/auth/login', authLimiter, async (req, res) => {
  try {
    const email = sanitizeInput(req.body.email);
    const password = req.body.password;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Ingresa correo y contraseña.' });
    }

    const user = await db.getUserByEmail(email);
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ success: false, message: 'Correo o contraseña incorrectos.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      JWT_SECRET,
      { expiresIn: user.role === 'client' ? '30d' : '7d' }
    );

    res.json({
      success: true,
      message: 'Inicio de sesión exitoso.',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        favorites: user.favorites || []
      }
    });
  } catch (err) {
    console.error('Error logging in:', err);
    res.status(500).json({ success: false, message: 'Error al iniciar sesión.' });
  }
});

// 3. Verify Me / Profile
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    if (user) {
      res.json({
        success: true,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone || '',
          role: user.role,
          favorites: user.favorites || []
        }
      });
    } else {
      res.json({ success: true, user: req.user });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar perfil.' });
  }
});

// 4. Client Favorites Endpoints
app.get('/api/client/favorites', authenticateToken, async (req, res) => {
  try {
    const user = await db.getUserById(req.user.id);
    res.json({
      success: true,
      favorites: user ? (user.favorites || []) : []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar favoritos.' });
  }
});

app.post('/api/client/favorites', authenticateToken, async (req, res) => {
  try {
    const { vehicle_page, favorites } = req.body;
    const user = await db.getUserById(req.user.id);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    let updatedFavorites = Array.isArray(user.favorites) ? [...user.favorites] : [];

    if (Array.isArray(favorites)) {
      updatedFavorites = favorites.map(n => parseInt(n, 10)).filter(n => !isNaN(n));
    } else if (vehicle_page !== undefined) {
      const pageNum = parseInt(vehicle_page, 10);
      const favIndex = updatedFavorites.indexOf(pageNum);
      if (favIndex > -1) {
        updatedFavorites.splice(favIndex, 1);
      } else {
        updatedFavorites.push(pageNum);
      }
    }

    await db.updateUserFavorites(user.id, updatedFavorites);

    res.json({
      success: true,
      message: 'Favoritos actualizados con éxito.',
      favorites: updatedFavorites
    });
  } catch (err) {
    console.error('Error saving favorites:', err);
    res.status(500).json({ success: false, message: 'Error al guardar favoritos.' });
  }
});

// 5. Get List of Sales Reps
app.get('/api/users/sales', authenticateToken, async (req, res) => {
  try {
    const users = await db.getUsers();
    const salesList = users
      .filter(u => u.role === 'sales')
      .map(u => ({ id: u.id, name: u.name, email: u.email }));
    res.json({ success: true, data: salesList });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar vendedores.' });
  }
});

// ==========================================
// VEHICLES API ROUTES (CRUD EN BASE DE DATOS SQL)
// ==========================================

// 1. GET ALL VEHICLES (Live SQL & Anti-Cache)
app.get('/api/vehicles', async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    res.json({ success: true, count: vehicles.length, data: vehicles });
  } catch (err) {
    console.error('Error loading vehicles from DB:', err);
    res.status(500).json({ success: false, message: 'Error al consultar inventario en la base de datos.' });
  }
});

// 2. GET SINGLE VEHICLE (By ID or Page)
app.get('/api/vehicles/:identifier', async (req, res) => {
  try {
    const found = await db.getVehicle(req.params.identifier);
    if (!found) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado en la base de datos.' });
    }
    res.json({ success: true, data: found });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar vehículo.' });
  }
});

// 3. STATS FOR DASHBOARD
app.get('/api/stats', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    console.error('Error fetching stats:', err);
    res.status(500).json({ success: false, message: 'Error al consultar estadísticas.' });
  }
});

// 4. CREATE NEW VEHICLE (Admin & Secretaria)
app.post('/api/vehicles', authenticateToken, requireAdminOrSecretary, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), async (req, res) => {
  try {
    const brand = (req.body.brand || '').toUpperCase().trim();
    const model = (req.body.model || '').toUpperCase().trim();
    const year = parseInt(req.body.year, 10) || new Date().getFullYear();
    const category = req.body.category || 'SEDAN & HATCHBACK';
    const price_contado = req.body.price_contado || '$0';
    const rawFin = (req.body.price_financiado || '').trim();
    const price_financiado = (!rawFin || rawFin === '$0' || rawFin === '0' || rawFin === '-' || rawFin.toLowerCase() === 'no aplica' || rawFin.toLowerCase() === 'n/a' || rawFin.toLowerCase() === 'consultar') ? 'No Aplica' : rawFin;
    const status = req.body.status || 'disponible';
    
    let specs = [];
    if (typeof req.body.specs === 'string') {
      try {
        specs = JSON.parse(req.body.specs);
      } catch (e) {
        specs = req.body.specs.split('\n').map(s => s.trim()).filter(Boolean);
      }
    } else if (Array.isArray(req.body.specs)) {
      specs = req.body.specs;
    }

    const priceClean = parseInt(price_contado.replace(/[^0-9]/g, ''), 10) || 0;
    
    let coverPhotoPath = 'assets/svg/autohaus-tag.svg';
    if (req.files && req.files['cover_photo'] && req.files['cover_photo'][0]) {
      coverPhotoPath = `assets/cars/${req.files['cover_photo'][0].filename}`;
    } else if (req.body.cover_photo_url) {
      coverPhotoPath = req.body.cover_photo_url;
    }

    let realPhotos = [];
    if (req.files && req.files['cover_photo'] && req.files['cover_photo'][0]) {
      realPhotos.push(coverPhotoPath);
    }
    if (req.files && req.files['gallery_photos']) {
      req.files['gallery_photos'].forEach(f => {
        realPhotos.push(`assets/cars/${f.filename}`);
      });
    }

    if (coverPhotoPath === 'assets/svg/autohaus-tag.svg' && realPhotos.length > 0) {
      coverPhotoPath = realPhotos[0];
    } else if (realPhotos.length === 0) {
      realPhotos = [coverPhotoPath];
    }

    const newVehicleData = {
      brand,
      model,
      year,
      category,
      price: price_contado,
      price_contado,
      price_financiado,
      price_num: priceClean,
      status,
      specs: specs.length ? specs : ['Garantía de agencia', 'Excelente estado'],
      cover_photo: coverPhotoPath,
      real_photos: realPhotos,
      photos: realPhotos,
      cutout_photo: coverPhotoPath,
      main_photo: coverPhotoPath
    };

    const created = await db.createVehicle(newVehicleData);
    const allVehicles = await db.getVehicles();

    // Sincronizar espejos estáticos
    syncStaticMirrors(allVehicles);

    // Regenerar PDF editorial en segundo plano
    generateFullCatalogPDF(null, allVehicles).catch(err => console.error('Error in PDF auto-generation:', err));

    res.status(201).json({
      success: true,
      message: `¡Vehículo ${created.brand} ${created.model} guardado con éxito en la base de datos!`,
      data: created
    });
  } catch (err) {
    console.error('Error creating vehicle in DB:', err);
    res.status(500).json({ success: false, message: 'Error al guardar vehículo en la base de datos: ' + err.message });
  }
});

// 5. UPDATE EXISTING VEHICLE (Admin & Secretaria)
app.put('/api/vehicles/:identifier', authenticateToken, requireAdminOrSecretary, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const existing = await db.getVehicle(identifier);

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado en la base de datos.' });
    }

    const updates = {};

    if (req.body.brand) updates.brand = req.body.brand.toUpperCase().trim();
    if (req.body.model) updates.model = req.body.model.toUpperCase().trim();
    if (req.body.year) updates.year = parseInt(req.body.year, 10) || existing.year;
    if (req.body.category) updates.category = req.body.category;
    if (req.body.status) updates.status = req.body.status;
    if (req.body.price_contado) {
      updates.price_contado = req.body.price_contado;
      updates.price = req.body.price_contado;
      updates.price_num = parseInt(req.body.price_contado.replace(/[^0-9]/g, ''), 10) || existing.price_num;
    }
    if (req.body.price_financiado !== undefined) {
      const rawFin = String(req.body.price_financiado).trim();
      updates.price_financiado = (!rawFin || rawFin === '$0' || rawFin === '0' || rawFin === '-' || rawFin.toLowerCase() === 'no aplica' || rawFin.toLowerCase() === 'n/a' || rawFin.toLowerCase() === 'consultar') ? 'No Aplica' : rawFin;
    }

    if (req.body.specs) {
      if (typeof req.body.specs === 'string') {
        try {
          updates.specs = JSON.parse(req.body.specs);
        } catch (e) {
          updates.specs = req.body.specs.split('\n').map(s => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(req.body.specs)) {
        updates.specs = req.body.specs;
      }
    }

    if (req.files && req.files['cover_photo'] && req.files['cover_photo'][0]) {
      updates.cover_photo = `assets/cars/${req.files['cover_photo'][0].filename}`;
      updates.main_photo = updates.cover_photo;
      updates.cutout_photo = updates.cover_photo;
    } else if (req.body.cover_photo_url) {
      updates.cover_photo = req.body.cover_photo_url;
      updates.main_photo = updates.cover_photo;
      updates.cutout_photo = updates.cover_photo;
    }

    let finalRealPhotos = [];
    if (req.body.existing_gallery_photos) {
      try {
        finalRealPhotos = JSON.parse(req.body.existing_gallery_photos);
      } catch (e) {
        finalRealPhotos = Array.isArray(req.body.existing_gallery_photos) ? req.body.existing_gallery_photos : [req.body.existing_gallery_photos];
      }
    } else if (existing.real_photos && existing.real_photos.length) {
      finalRealPhotos = [...existing.real_photos];
    }

    if (req.files && req.files['gallery_photos'] && req.files['gallery_photos'].length > 0) {
      req.files['gallery_photos'].forEach(f => {
        finalRealPhotos.push(`assets/cars/${f.filename}`);
      });
    }

    if (!finalRealPhotos.length) {
      finalRealPhotos = [updates.cover_photo || existing.cover_photo || 'assets/svg/autohaus-tag.svg'];
    }

    updates.real_photos = finalRealPhotos;

    const updated = await db.updateVehicle(identifier, updates);
    const allVehicles = await db.getVehicles();

    syncStaticMirrors(allVehicles);
    generateFullCatalogPDF(null, allVehicles).catch(err => console.error('Error in PDF auto-generation:', err));

    res.json({
      success: true,
      message: `¡Vehículo ${updated.brand} ${updated.model} actualizado con éxito en la base de datos!`,
      data: updated
    });
  } catch (err) {
    console.error('Error updating vehicle in DB:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar en la base de datos: ' + err.message });
  }
});

// 6. QUICK STATUS TOGGLE (Admin & Secretaria)
app.patch('/api/vehicles/:identifier/status', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const { status } = req.body;
    
    if (!['disponible', 'apartado', 'vendido'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido. Use disponible, apartado o vendido.' });
    }

    const updated = await db.updateVehicleStatus(identifier, status);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado en la base de datos.' });
    }

    const allVehicles = await db.getVehicles();
    syncStaticMirrors(allVehicles);
    generateFullCatalogPDF(null, allVehicles).catch(err => console.error('Error in PDF auto-generation:', err));

    res.json({
      success: true,
      message: `Estado guardado en base de datos: "${status.toUpperCase()}"`,
      data: updated
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al cambiar estado en base de datos.' });
  }
});

// 7. DELETE VEHICLE (Admin & Secretaria - Persistencia ACID en Base de Datos)
app.delete('/api/vehicles/:identifier', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const identifier = req.params.identifier;
    const removed = await db.deleteVehicle(identifier);

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado en la base de datos.' });
    }

    const allVehicles = await db.getVehicles();
    syncStaticMirrors(allVehicles);
    generateFullCatalogPDF(null, allVehicles).catch(err => console.error('Error in PDF auto-generation:', err));

    console.log(`🗑️ Vehículo ${removed.brand} ${removed.model} (${removed.id}) eliminado de la base de datos SQL. Quedan ${allVehicles.length} vehículos.`);

    res.json({
      success: true,
      message: `Vehículo ${removed.brand} ${removed.model} eliminado permanentemente de la base de datos.`,
      data: removed
    });
  } catch (err) {
    console.error('Error deleting vehicle from DB:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar vehículo de la base de datos: ' + err.message });
  }
});

// 8. GET VEHICLE STATUS HISTORY
app.get('/api/vehicles/:identifier/history', async (req, res) => {
  try {
    const car = await db.getVehicle(req.params.identifier);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }
    const history = await db.getVehicleStatusHistory(car.id);
    res.json({ success: true, vehicle_id: car.id, data: history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener historial de estatus.' });
  }
});

// 9. LOG VEHICLE STATUS CHANGE
app.post('/api/vehicles/:identifier/status-history', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const car = await db.getVehicle(req.params.identifier);
    if (!car) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }
    const { status, notes, deposit_amount, client_id, sales_rep_id } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, message: 'El estatus es requerido.' });
    }
    const updated = await db.updateVehicleStatus(car.id, status, {
      notes: notes || '',
      deposit_amount: deposit_amount || '',
      client_id: client_id || null,
      sales_rep_id: sales_rep_id || null
    });
    const history = await db.getVehicleStatusHistory(car.id);
    res.json({ success: true, message: 'Estatus e historial actualizados.', data: updated, history });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al actualizar estatus e historial.' });
  }
});

// ==========================================
// SUCURSALES & VENDEDORES & CLIENTES API
// ==========================================

// GET ALL BRANCHES (San Felipe, Central de Abastos)
app.get('/api/branches', async (req, res) => {
  try {
    const branches = await db.getBranches();
    res.json({ success: true, count: branches.length, data: branches });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener sucursales.' });
  }
});

// GET ALL SALES REPS
app.get('/api/sales-reps', async (req, res) => {
  try {
    const reps = await db.getSalesReps();
    res.json({ success: true, count: reps.length, data: reps });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener vendedores.' });
  }
});

// GET ALL CLIENTS
app.get('/api/clients', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const clients = await db.getClients();
    res.json({ success: true, count: clients.length, data: clients });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener clientes.' });
  }
});

// Active Sales Representatives for Automatic Round-Robin Lead Assignment (uno a uno)
const SALES_REPRESENTATIVES = [
  { email: 'napo@autohaus.mx', name: 'Napo' },
  { email: 'javier@autohaus.mx', name: 'Javier' },
  { email: 'fernanda@autohaus.mx', name: 'Fernanda' },
  { email: 'raul@autohaus.mx', name: 'Raúl' }
];

async function getNextAssignedSalesperson() {
  const leads = await db.getLeads();
  const lastAssignedLead = leads.find(l => 
    l.assigned_to && SALES_REPRESENTATIVES.some(s => s.email.toLowerCase() === l.assigned_to.toLowerCase())
  );

  if (!lastAssignedLead) {
    return SALES_REPRESENTATIVES[0]; // First in line: Napo
  }

  const lastIndex = SALES_REPRESENTATIVES.findIndex(
    s => s.email.toLowerCase() === lastAssignedLead.assigned_to.toLowerCase()
  );

  const nextIndex = (lastIndex + 1) % SALES_REPRESENTATIVES.length;
  return SALES_REPRESENTATIVES[nextIndex];
}

// ==========================================
// LEADS & CRM API ROUTES (ASIGNACIÓN DE LEADS)
// ==========================================

// 1. GET LEADS (Admin sees all; Sales sees only assigned)
app.get('/api/leads', authenticateToken, async (req, res) => {
  try {
    const leads = await db.getLeads();
    if (req.user.role === 'admin') {
      return res.json({ success: true, count: leads.length, data: leads });
    } else if (req.user.role === 'sales') {
      const myLeads = leads.filter(l => (l.assigned_to || '').toLowerCase() === req.user.email.toLowerCase());
      return res.json({ success: true, count: myLeads.length, data: myLeads });
    } else {
      return res.json({ success: true, count: leads.length, data: leads });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener leads.' });
  }
});

// 2. GET NEXT IN TURN FOR ROUND-ROBIN
app.get('/api/leads/next-turn', authenticateToken, async (req, res) => {
  try {
    const next = await getNextAssignedSalesperson();
    res.json({
      success: true,
      nextSalesperson: next,
      rotation: SALES_REPRESENTATIVES
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar turno de ventas.' });
  }
});

// 3. CREATE LEAD & ASSIGN (Admin)
app.post('/api/leads', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, notes } = req.body;
    
    if (!client_name || !client_phone) {
      return res.status(400).json({ success: false, message: 'Nombre de cliente y teléfono son requeridos.' });
    }

    let finalAssignedTo = assigned_to;
    let finalAssignedName = assigned_name;

    if (!finalAssignedTo || finalAssignedTo === 'auto' || finalAssignedTo === 'automatico') {
      const nextSales = await getNextAssignedSalesperson();
      finalAssignedTo = nextSales.email;
      finalAssignedName = nextSales.name;
    } else {
      const matched = SALES_REPRESENTATIVES.find(s => s.email.toLowerCase() === finalAssignedTo.toLowerCase());
      if (matched) {
        finalAssignedName = matched.name;
      }
    }

    const newLead = await db.createLead({
      client_name: client_name.trim(),
      client_phone: client_phone.trim(),
      client_email: (client_email || '').trim(),
      vehicle_page: vehicle_page ? parseInt(vehicle_page, 10) : null,
      vehicle_name: vehicle_name || 'Interés General / Por definir',
      assigned_to: finalAssignedTo.toLowerCase().trim(),
      assigned_name: finalAssignedName || finalAssignedTo,
      status: 'nuevo',
      notes: notes || ''
    });

    res.status(201).json({
      success: true,
      message: `Lead asignado automáticamente a ${newLead.assigned_name} (Turno 1 a 1).`,
      data: newLead
    });
  } catch (err) {
    console.error('Error creating lead:', err);
    res.status(500).json({ success: false, message: 'Error al crear lead.' });
  }
});

// 4. PUBLIC LEAD CREATION (From Landing Page)
app.post('/api/leads/public', leadLimiter, async (req, res) => {
  try {
    if (req.body.website || req.body.company_hp || req.body.url_check) {
      return res.status(200).json({ success: true, message: 'Solicitud recibida exitosamente.' });
    }

    const client_name = sanitizeInput(req.body.client_name);
    const client_phone = sanitizeInput(req.body.client_phone);
    const client_email = sanitizeInput(req.body.client_email);
    const vehicle_page = req.body.vehicle_page ? parseInt(req.body.vehicle_page, 10) : null;
    const vehicle_name = sanitizeInput(req.body.vehicle_name);
    const notes = sanitizeInput(req.body.notes);

    if (!client_name || !client_phone) {
      return res.status(400).json({ success: false, message: 'Nombre y teléfono son requeridos.' });
    }

    const nextSales = await getNextAssignedSalesperson();

    const newLead = await db.createLead({
      client_name: client_name.trim(),
      client_phone: client_phone.trim(),
      client_email: (client_email || '').trim(),
      vehicle_page: vehicle_page || null,
      vehicle_name: vehicle_name || 'Interés General / Catálogo Web',
      assigned_to: nextSales.email,
      assigned_name: nextSales.name,
      status: 'nuevo',
      notes: notes || 'Prospecto registrado desde la Landing Page de Autohaus'
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud recibida. Un asesor se comunicará contigo a la brevedad.',
      data: { id: newLead.id, assigned_name: nextSales.name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al procesar solicitud.' });
  }
});

// 5. UPDATE LEAD
app.put('/api/leads/:id', authenticateToken, async (req, res) => {
  try {
    const leadId = req.params.id;
    const lead = await db.getLeadById(leadId);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado.' });
    }

    const updates = {};

    if (req.user.role === 'sales') {
      if (lead.assigned_to.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para modificar este lead.' });
      }
      if (req.body.status) updates.status = req.body.status;
      if (req.body.notes) updates.notes = req.body.notes;
    } else if (req.user.role === 'admin') {
      if (req.body.client_name) updates.client_name = req.body.client_name;
      if (req.body.client_phone) updates.client_phone = req.body.client_phone;
      if (req.body.client_email) updates.client_email = req.body.client_email;
      if (req.body.vehicle_page !== undefined) updates.vehicle_page = req.body.vehicle_page;
      if (req.body.vehicle_name) updates.vehicle_name = req.body.vehicle_name;
      if (req.body.assigned_to) {
        updates.assigned_to = req.body.assigned_to.toLowerCase();
        updates.assigned_name = req.body.assigned_name || req.body.assigned_to;
      }
      if (req.body.status) updates.status = req.body.status;
      if (req.body.notes !== undefined) updates.notes = req.body.notes;
    } else {
      return res.status(403).json({ success: false, message: 'Acción no permitida.' });
    }

    const updated = await db.updateLead(leadId, updates);

    res.json({
      success: true,
      message: 'Lead actualizado correctamente.',
      data: updated
    });
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar lead.' });
  }
});

// 6. DELETE LEAD (Admin only)
app.delete('/api/leads/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const leadId = req.params.id;
    const removed = await db.deleteLead(leadId);

    if (!removed) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado.' });
    }

    res.json({
      success: true,
      message: `Lead de ${removed.client_name} eliminado.`,
      data: removed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar lead.' });
  }
});

// 7. DOWNLOAD EDITORIAL PDF CATALOG (Live from SQL DB & no-cache)
app.get('/api/catalog/download-pdf', async (req, res) => {
  const pdfPath = path.join(__dirname, 'assets', 'docs', 'Catalogo_Autohaus_Editorial_2026.pdf');
  const fallbackPdfPath = path.join(__dirname, 'assets', 'docs', 'Catalogo_Autohaus_Editorial_2025.pdf');
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');

  try {
    const forceRegen = req.query.force === '1' || req.query.force === 'true';
    const pdfStat = fs.existsSync(pdfPath) ? fs.statSync(pdfPath) : (fs.existsSync(fallbackPdfPath) ? fs.statSync(fallbackPdfPath) : null);
    const isOutdated = !pdfStat;

    if (forceRegen || isOutdated) {
      console.log('🔄 Consultando base de datos SQL en tiempo real y regenerando PDF oficial...');
      try {
        const vehicles = await db.getVehicles();
        await generateFullCatalogPDF(null, vehicles);
      } catch (genErr) {
        console.warn('Advertencia en generación dinámica de PDF:', genErr.message);
      }
    }

    const finalPath = fs.existsSync(pdfPath) ? pdfPath : fallbackPdfPath;
    if (fs.existsSync(finalPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Catalogo_Autohaus_Chihuahua_2026.pdf"');
      return res.sendFile(finalPath);
    } else {
      res.status(500).json({ success: false, message: 'El catálogo PDF se está compilando con los datos más recientes. Por favor intenta de nuevo en unos segundos.' });
    }
  } catch (e) {
    console.error('Error en download-pdf:', e);
    const finalPath = fs.existsSync(pdfPath) ? pdfPath : fallbackPdfPath;
    if (fs.existsSync(finalPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="Catalogo_Autohaus_Chihuahua_2026.pdf"');
      return res.sendFile(finalPath);
    } else {
      res.status(500).json({ success: false, message: 'Error interno: ' + e.message });
    }
  }
});

// 8. REGENERATE PDF ON DEMAND (Admin & Secretaria)
app.post('/api/catalog/regenerate-pdf', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    const result = await generateFullCatalogPDF(null, vehicles);
    if (result.success) {
      res.json({
        success: true,
        message: `Catálogo PDF 2026 regenerado con éxito (${result.count} vehículos).`,
        size: result.size
      });
    } else {
      res.status(500).json({ success: false, message: 'Error generando PDF: ' + result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error interno: ' + err.message });
  }
});

// 9. EXPORT BACKUP JSON
app.get('/api/export', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const vehicles = await db.getVehicles();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=autohaus_catalog_backup_${Date.now()}.json`);
    res.send(JSON.stringify(vehicles, null, 2));
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error exportando backup.' });
  }
});

// ==========================================
// STATIC FILES & ROUTING
// ==========================================

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize Database & Start Server
async function startServer() {
  try {
    await db.initDb();
    const vehicles = await db.getVehicles();
    syncStaticMirrors(vehicles);

    app.listen(PORT, () => {
      console.log(`\n======================================================`);
      console.log(`🚗 SERVIDOR AUTOHAUS FULLSTACK CMS & CRM (SQL DB ACTIVA)`);
      console.log(`📊 Total de Vehículos en Base de Datos: ${vehicles.length}`);
      console.log(`🌐 Catálogo Público:       http://localhost:${PORT}`);
      console.log(`🔐 Panel de Administración: http://localhost:${PORT}/admin`);
      console.log(`🔑 Login Admin:            http://localhost:${PORT}/admin/login`);
      console.log(`👤 Admin:                   admin@autohaus.mx / autohaus2025`);
      console.log(`👤 Secretaria:              alice@autohaus.mx / alice2025`);
      console.log(`👤 Vendedores:              napo, javier, fernanda, raul @autohaus.mx`);
      console.log(`======================================================\n`);
    });
  } catch (err) {
    console.error('Error fatal al inicializar servidor y base de datos:', err);
    process.exit(1);
  }
}

startServer();
