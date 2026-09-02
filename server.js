const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sortCatalogByCategory, generateFullCatalogPDF } = require('./scripts/pdfGenerator');

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'autohaus_super_secure_jwt_secret_2025';

// Paths
const DATA_FILE = path.join(__dirname, 'assets', 'data', 'catalog.json');
const JS_DATA_FILE = path.join(__dirname, 'scripts', 'data.js');
const USERS_FILE = path.join(__dirname, 'assets', 'data', 'users.json');
const LEADS_FILE = path.join(__dirname, 'assets', 'data', 'leads.json');
const UPLOADS_DIR = path.join(__dirname, 'assets', 'cars');

// Ensure directories exist
fs.mkdirSync(path.join(__dirname, 'assets', 'data'), { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initialize Users if not exists
if (!fs.existsSync(USERS_FILE)) {
  const initialUsers = [
    {
      id: 1,
      name: 'Administrador Autohaus',
      email: 'admin@autohaus.mx',
      password: bcrypt.hashSync('autohaus2025', 10),
      role: 'admin'
    },
    {
      id: 2,
      name: 'Alice (Secretaria)',
      email: 'alice@autohaus.mx',
      password: bcrypt.hashSync('alice2025', 10),
      role: 'secretary'
    },
    {
      id: 3,
      name: 'Napo (Vendedor)',
      email: 'napo@autohaus.mx',
      password: bcrypt.hashSync('napo2025', 10),
      role: 'sales'
    },
    {
      id: 4,
      name: 'Javier (Vendedor)',
      email: 'javier@autohaus.mx',
      password: bcrypt.hashSync('javier2025', 10),
      role: 'sales'
    },
    {
      id: 5,
      name: 'Fernanda (Vendedora)',
      email: 'fernanda@autohaus.mx',
      password: bcrypt.hashSync('fernanda2025', 10),
      role: 'sales'
    },
    {
      id: 6,
      name: 'Raúl (Vendedor)',
      email: 'raul@autohaus.mx',
      password: bcrypt.hashSync('raul2025', 10),
      role: 'sales'
    }
  ];
  fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
}

// Initialize Leads if not exists
if (!fs.existsSync(LEADS_FILE)) {
  fs.writeFileSync(LEADS_FILE, JSON.stringify([], null, 2), 'utf-8');
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Multer Storage Configuration for Car Images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOADS_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpeg';
    const uniqueSuffix = Date.now() + '_' + Math.round(Math.random() * 1E4);
    cb(null, `car_${uniqueSuffix}${ext.toLowerCase()}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen (JPEG, PNG, WebP)'));
    }
  }
});

// Helper: Load vehicles from catalog.json
function loadVehicles() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Error loading vehicles:', err);
  }
  return [];
}

// Helper: Save vehicles and sync data.js
function saveVehicles(vehicles) {
  try {
    // 1. Save JSON
    fs.writeFileSync(DATA_FILE, JSON.stringify(vehicles, null, 2), 'utf-8');
    
    // 2. Sync scripts/data.js for client-side catalog
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
    console.error('Error saving vehicles:', err);
    return false;
  }
}

// Helper: Load leads
function loadLeads() {
  try {
    if (fs.existsSync(LEADS_FILE)) {
      return JSON.parse(fs.readFileSync(LEADS_FILE, 'utf-8'));
    }
  } catch (err) {
    console.error('Error loading leads:', err);
  }
  return [];
}

// Helper: Save leads
function saveLeads(leads) {
  try {
    fs.writeFileSync(LEADS_FILE, JSON.stringify(leads, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving leads:', err);
    return false;
  }
}

// Auth Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ success: false, message: 'Acceso no autorizado. Inicia sesión.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Sesión expirada o token inválido.' });
    }
    req.user = user;
    next();
  });
}

// Role guards
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
app.post('/api/auth/register-client', (req, res) => {
  try {
    const { name, email, phone, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'Nombre, correo y contraseña son obligatorios.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'La contraseña debe tener al menos 6 caracteres.' });
    }

    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

    if (existing) {
      return res.status(400).json({ success: false, message: 'Este correo electrónico ya está registrado. Inicia sesión.' });
    }

    const hashedPassword = bcrypt.hashSync(password, 10);
    const newClient = {
      id: Date.now(),
      name: name.trim(),
      email: email.toLowerCase().trim(),
      phone: (phone || '').trim(),
      password: hashedPassword,
      role: 'client',
      favorites: [],
      created_at: new Date().toISOString()
    };

    users.push(newClient);
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

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
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (!email || !password) {
    return res.status(400).json({ success: false, message: 'Ingresa correo y contraseña.' });
  }

  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());

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
});

// 3. Verify Me / Profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
  const user = users.find(u => u.id === req.user.id);
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
});

// 4. Client Favorites Endpoints
app.get('/api/client/favorites', authenticateToken, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const user = users.find(u => u.id === req.user.id);
    res.json({
      success: true,
      favorites: user ? (user.favorites || []) : []
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar favoritos.' });
  }
});

app.post('/api/client/favorites', authenticateToken, (req, res) => {
  try {
    const { vehicle_page, favorites } = req.body;
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const userIndex = users.findIndex(u => u.id === req.user.id);

    if (userIndex === -1) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (Array.isArray(favorites)) {
      users[userIndex].favorites = favorites.map(n => parseInt(n)).filter(n => !isNaN(n));
    } else if (vehicle_page !== undefined) {
      const pageNum = parseInt(vehicle_page);
      if (!users[userIndex].favorites) users[userIndex].favorites = [];
      const favIndex = users[userIndex].favorites.indexOf(pageNum);
      if (favIndex > -1) {
        users[userIndex].favorites.splice(favIndex, 1);
      } else {
        users[userIndex].favorites.push(pageNum);
      }
    }

    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');

    res.json({
      success: true,
      message: 'Favoritos actualizados con éxito.',
      favorites: users[userIndex].favorites
    });
  } catch (err) {
    console.error('Error saving favorites:', err);
    res.status(500).json({ success: false, message: 'Error al guardar favoritos.' });
  }
});

// 5. Get List of Sales Reps (for Admin Lead Assignment)
app.get('/api/users/sales', authenticateToken, (req, res) => {
  try {
    const users = JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    const salesList = users
      .filter(u => u.role === 'sales')
      .map(u => ({ id: u.id, name: u.name, email: u.email }));
    res.json({ success: true, data: salesList });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al consultar vendedores.' });
  }
});

// ==========================================
// VEHICLES API ROUTES (CRUD)
// ==========================================

// 1. GET ALL VEHICLES (Public)
app.get('/api/vehicles', (req, res) => {
  const vehicles = loadVehicles();
  res.json({ success: true, count: vehicles.length, data: vehicles });
});

// 2. GET SINGLE VEHICLE
app.get('/api/vehicles/:page', (req, res) => {
  const pageNum = parseInt(req.params.page);
  const vehicles = loadVehicles();
  const found = vehicles.find(v => v.page === pageNum);
  
  if (!found) {
    return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
  }
  res.json({ success: true, data: found });
});

// 3. STATS FOR DASHBOARD
app.get('/api/stats', (req, res) => {
  const vehicles = loadVehicles();
  const leads = loadLeads();
  
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
    const priceVal = parseInt((v.price_contado || '').replace(/[^0-9]/g, '')) || 0;
    totalContadoValue += priceVal;
    
    const status = v.status || 'disponible';
    if (status === 'apartado') apartadosCount++;
    else if (status === 'vendido') vendidosCount++;
    else disponiblesCount++;

    if (categoryCounts[v.category] !== undefined) {
      categoryCounts[v.category]++;
    }
  });

  res.json({
    success: true,
    totalVehicles: vehicles.length,
    disponiblesCount,
    apartadosCount,
    vendidosCount,
    totalValue: totalContadoValue,
    totalLeads: leads.length,
    categoryCounts,
    lastUpdated: new Date().toISOString()
  });
});

// 4. CREATE NEW VEHICLE (Admin & Secretaria)
app.post('/api/vehicles', authenticateToken, requireAdminOrSecretary, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), (req, res) => {
  try {
    const vehicles = loadVehicles();
    
    const brand = (req.body.brand || '').toUpperCase().trim();
    const model = (req.body.model || '').toUpperCase().trim();
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const category = req.body.category || 'SEDAN & HATCHBACK';
    const price_contado = req.body.price_contado || '$0';
    const price_financiado = req.body.price_financiado || '$0';
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

    const priceClean = parseInt(price_contado.replace(/[^0-9]/g, '')) || 0;
    
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

    const maxPage = vehicles.reduce((max, v) => Math.max(max, v.page || 0), 3);
    const newPage = maxPage + 1;

    const newVehicle = {
      page: newPage,
      brand,
      model,
      year,
      category,
      price_contado,
      price_financiado,
      price_num: priceClean,
      status, // 'disponible', 'apartado', 'vendido'
      specs: specs.length ? specs : ['Garantía de agencia', 'Excelente estado'],
      cover_photo: coverPhotoPath,
      real_photos: realPhotos,
      photos: realPhotos,
      cutout_photo: coverPhotoPath,
      main_photo: coverPhotoPath
    };

    vehicles.push(newVehicle);
    
    // Sort by category order (placing new car at the end of its category) & renumber pages
    const sortedVehicles = sortCatalogByCategory(vehicles);
    saveVehicles(sortedVehicles);

    // Regenerate full editorial PDF in background
    generateFullCatalogPDF().catch(err => console.error('Error in PDF auto-generation:', err));

    res.status(201).json({
      success: true,
      message: 'Vehículo agregado exitosamente al catálogo y PDF actualizado.',
      data: newVehicle
    });
  } catch (err) {
    console.error('Error creating vehicle:', err);
    res.status(500).json({ success: false, message: 'Error al guardar vehículo: ' + err.message });
  }
});

// 5. UPDATE EXISTING VEHICLE (Admin & Secretaria)
app.put('/api/vehicles/:page', authenticateToken, requireAdminOrSecretary, upload.fields([
  { name: 'cover_photo', maxCount: 1 },
  { name: 'gallery_photos', maxCount: 10 }
]), (req, res) => {
  try {
    const pageNum = parseInt(req.params.page);
    const vehicles = loadVehicles();
    const index = vehicles.findIndex(v => v.page === pageNum);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }

    const current = vehicles[index];

    if (req.body.brand) current.brand = req.body.brand.toUpperCase().trim();
    if (req.body.model) current.model = req.body.model.toUpperCase().trim();
    if (req.body.year) current.year = parseInt(req.body.year) || current.year;
    if (req.body.category) current.category = req.body.category;
    if (req.body.status) current.status = req.body.status;
    if (req.body.price_contado) {
      current.price_contado = req.body.price_contado;
      current.price_num = parseInt(req.body.price_contado.replace(/[^0-9]/g, '')) || current.price_num;
    }
    if (req.body.price_financiado) current.price_financiado = req.body.price_financiado;

    if (req.body.specs) {
      if (typeof req.body.specs === 'string') {
        try {
          current.specs = JSON.parse(req.body.specs);
        } catch (e) {
          current.specs = req.body.specs.split('\n').map(s => s.trim()).filter(Boolean);
        }
      } else if (Array.isArray(req.body.specs)) {
        current.specs = req.body.specs;
      }
    }

    if (req.files && req.files['cover_photo'] && req.files['cover_photo'][0]) {
      current.cover_photo = `assets/cars/${req.files['cover_photo'][0].filename}`;
      current.main_photo = current.cover_photo;
      current.cutout_photo = current.cover_photo;
      if (!current.real_photos || current.real_photos.length === 0) {
        current.real_photos = [current.cover_photo];
      } else {
        current.real_photos[0] = current.cover_photo;
      }
    }

    if (req.files && req.files['gallery_photos'] && req.files['gallery_photos'].length > 0) {
      if (!current.real_photos || current.real_photos.length === 0) {
        current.real_photos = [current.cover_photo];
      }
      req.files['gallery_photos'].forEach(f => {
        current.real_photos.push(`assets/cars/${f.filename}`);
      });
    }
    current.photos = current.real_photos;

    const sortedVehicles = sortCatalogByCategory(vehicles);
    saveVehicles(sortedVehicles);

    // Regenerate full editorial PDF in background
    generateFullCatalogPDF().catch(err => console.error('Error in PDF auto-generation:', err));

    res.json({
      success: true,
      message: 'Vehículo actualizado exitosamente y PDF regenerado.',
      data: current
    });
  } catch (err) {
    console.error('Error updating vehicle:', err);
    res.status(500).json({ success: false, message: 'Error interno al actualizar: ' + err.message });
  }
});

// 6. QUICK STATUS TOGGLE (Admin & Secretaria: disponible, apartado, vendido)
app.patch('/api/vehicles/:page/status', authenticateToken, requireAdminOrSecretary, (req, res) => {
  try {
    const pageNum = parseInt(req.params.page);
    const { status } = req.body;
    
    if (!['disponible', 'apartado', 'vendido'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Estado inválido. Use disponible, apartado o vendido.' });
    }

    const vehicles = loadVehicles();
    const car = vehicles.find(v => v.page === pageNum);

    if (!car) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }

    car.status = status;
    saveVehicles(vehicles);

    // Regenerate full editorial PDF in background
    generateFullCatalogPDF().catch(err => console.error('Error in PDF auto-generation:', err));

    res.json({
      success: true,
      message: `Estado actualizado a "${status.toUpperCase()}"`,
      data: car
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al cambiar estado.' });
  }
});

// 7. DELETE VEHICLE (Admin & Secretaria)
app.delete('/api/vehicles/:page', authenticateToken, requireAdminOrSecretary, (req, res) => {
  try {
    const pageNum = parseInt(req.params.page);
    let vehicles = loadVehicles();
    const index = vehicles.findIndex(v => v.page === pageNum);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Vehículo no encontrado.' });
    }

    const removed = vehicles.splice(index, 1)[0];
    const sortedVehicles = sortCatalogByCategory(vehicles);
    saveVehicles(sortedVehicles);

    // Regenerate full editorial PDF in background
    generateFullCatalogPDF().catch(err => console.error('Error in PDF auto-generation:', err));

    res.json({
      success: true,
      message: `Vehículo ${removed.brand} ${removed.model} eliminado con éxito del catálogo.`,
      data: removed
    });
  } catch (err) {
    console.error('Error deleting vehicle:', err);
    res.status(500).json({ success: false, message: 'Error al eliminar vehículo.' });
  }
});

// Active Sales Representatives for Automatic Round-Robin Lead Assignment (uno a uno)
const SALES_REPRESENTATIVES = [
  { email: 'napo@autohaus.mx', name: 'Napo' },
  { email: 'javier@autohaus.mx', name: 'Javier' },
  { email: 'fernanda@autohaus.mx', name: 'Fernanda' },
  { email: 'raul@autohaus.mx', name: 'Raúl' }
];

// Helper to get next salesperson in round-robin sequence
function getNextAssignedSalesperson() {
  const leads = loadLeads();
  // Find the most recent lead assigned to one of our active sales reps
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
app.get('/api/leads', authenticateToken, (req, res) => {
  try {
    const leads = loadLeads();
    if (req.user.role === 'admin') {
      return res.json({ success: true, count: leads.length, data: leads });
    } else if (req.user.role === 'sales') {
      const myLeads = leads.filter(l => (l.assigned_to || '').toLowerCase() === req.user.email.toLowerCase());
      return res.json({ success: true, count: myLeads.length, data: myLeads });
    } else {
      // Secretary
      return res.json({ success: true, count: leads.length, data: leads });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al obtener leads.' });
  }
});

// 2. GET NEXT IN TURN FOR ROUND-ROBIN
app.get('/api/leads/next-turn', authenticateToken, (req, res) => {
  const next = getNextAssignedSalesperson();
  res.json({
    success: true,
    nextSalesperson: next,
    rotation: SALES_REPRESENTATIVES
  });
});

// 3. CREATE LEAD & ASSIGN (Admin - Automatic Round-Robin or Manual Override)
app.post('/api/leads', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { client_name, client_phone, client_email, vehicle_page, vehicle_name, assigned_to, assigned_name, notes } = req.body;
    
    if (!client_name || !client_phone) {
      return res.status(400).json({ success: false, message: 'Nombre de cliente y teléfono son requeridos.' });
    }

    let finalAssignedTo = assigned_to;
    let finalAssignedName = assigned_name;

    // Automatic Round-Robin if 'auto' or not provided
    if (!finalAssignedTo || finalAssignedTo === 'auto' || finalAssignedTo === 'automatico') {
      const nextSales = getNextAssignedSalesperson();
      finalAssignedTo = nextSales.email;
      finalAssignedName = nextSales.name;
    } else {
      const matched = SALES_REPRESENTATIVES.find(s => s.email.toLowerCase() === finalAssignedTo.toLowerCase());
      if (matched) {
        finalAssignedName = matched.name;
      }
    }

    const leads = loadLeads();
    const newLead = {
      id: 'lead_' + Date.now(),
      client_name: client_name.trim(),
      client_phone: client_phone.trim(),
      client_email: (client_email || '').trim(),
      vehicle_page: vehicle_page ? parseInt(vehicle_page) : null,
      vehicle_name: vehicle_name || 'Interés General / Por definir',
      assigned_to: finalAssignedTo.toLowerCase().trim(),
      assigned_name: finalAssignedName || finalAssignedTo,
      status: 'nuevo', // 'nuevo', 'contactado', 'cita', 'vendido', 'descartado'
      notes: notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    leads.unshift(newLead);
    saveLeads(leads);

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

// 4. PUBLIC LEAD CREATION (From Landing Page - Automatic Round-Robin)
app.post('/api/leads/public', (req, res) => {
  try {
    const { client_name, client_phone, client_email, vehicle_page, vehicle_name, notes } = req.body;
    if (!client_name || !client_phone) {
      return res.status(400).json({ success: false, message: 'Nombre y teléfono son requeridos.' });
    }

    const nextSales = getNextAssignedSalesperson();
    const leads = loadLeads();

    const newLead = {
      id: 'lead_' + Date.now(),
      client_name: client_name.trim(),
      client_phone: client_phone.trim(),
      client_email: (client_email || '').trim(),
      vehicle_page: vehicle_page ? parseInt(vehicle_page) : null,
      vehicle_name: vehicle_name || 'Interés General / Catálogo Web',
      assigned_to: nextSales.email,
      assigned_name: nextSales.name,
      status: 'nuevo',
      notes: notes || 'Prospecto registrado desde la Landing Page de Autohaus',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    leads.unshift(newLead);
    saveLeads(leads);

    res.status(201).json({
      success: true,
      message: 'Solicitud recibida. Un asesor se comunicará contigo a la brevedad.',
      data: { id: newLead.id, assigned_name: nextSales.name }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al procesar solicitud.' });
  }
});

// 5. DOWNLOAD EDITORIAL PDF CATALOG (Always up to date & no-cache)
app.get('/api/catalog/download-pdf', async (req, res) => {
  const pdfPath = path.join(__dirname, 'assets', 'docs', 'Catalogo_Autohaus_Editorial_2025.pdf');
  
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (fs.existsSync(pdfPath)) {
    res.download(pdfPath, 'Catalogo_Autohaus_Chihuahua_2025.pdf');
  } else {
    // If not compiled yet, generate immediately and serve
    try {
      console.log('Generating PDF on the fly for download request...');
      const genResult = await generateFullCatalogPDF();
      if (genResult.success && fs.existsSync(pdfPath)) {
        res.download(pdfPath, 'Catalogo_Autohaus_Chihuahua_2025.pdf');
      } else {
        res.status(500).json({ success: false, message: 'Error al compilar el catálogo PDF.' });
      }
    } catch (e) {
      res.status(500).json({ success: false, message: 'Error interno: ' + e.message });
    }
  }
});

// 6. REGENERATE PDF ON DEMAND (Admin & Secretaria)
app.post('/api/catalog/regenerate-pdf', authenticateToken, requireAdminOrSecretary, async (req, res) => {
  try {
    const result = await generateFullCatalogPDF();
    if (result.success) {
      res.json({
        success: true,
        message: `Catálogo PDF regenerado con éxito (${result.count} vehículos).`,
        size: result.size
      });
    } else {
      res.status(500).json({ success: false, message: 'Error generando PDF: ' + result.error });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error interno: ' + err.message });
  }
});

// 3. UPDATE LEAD (Admin can update all; Sales can update status and notes)
app.put('/api/leads/:id', authenticateToken, (req, res) => {
  try {
    const leadId = req.params.id;
    const leads = loadLeads();
    const lead = leads.find(l => l.id === leadId);

    if (!lead) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado.' });
    }

    if (req.user.role === 'sales') {
      if (lead.assigned_to.toLowerCase() !== req.user.email.toLowerCase()) {
        return res.status(403).json({ success: false, message: 'No tienes permiso para modificar este lead.' });
      }
      if (req.body.status) lead.status = req.body.status;
      if (req.body.notes) lead.notes = req.body.notes;
      lead.updated_at = new Date().toISOString();
    } else if (req.user.role === 'admin') {
      if (req.body.client_name) lead.client_name = req.body.client_name;
      if (req.body.client_phone) lead.client_phone = req.body.client_phone;
      if (req.body.client_email) lead.client_email = req.body.client_email;
      if (req.body.vehicle_page !== undefined) lead.vehicle_page = req.body.vehicle_page;
      if (req.body.vehicle_name) lead.vehicle_name = req.body.vehicle_name;
      if (req.body.assigned_to) {
        lead.assigned_to = req.body.assigned_to.toLowerCase();
        lead.assigned_name = req.body.assigned_name || req.body.assigned_to;
      }
      if (req.body.status) lead.status = req.body.status;
      if (req.body.notes !== undefined) lead.notes = req.body.notes;
      lead.updated_at = new Date().toISOString();
    } else {
      return res.status(403).json({ success: false, message: 'Acción no permitida.' });
    }

    saveLeads(leads);

    res.json({
      success: true,
      message: 'Lead actualizado correctamente.',
      data: lead
    });
  } catch (err) {
    console.error('Error updating lead:', err);
    res.status(500).json({ success: false, message: 'Error al actualizar lead.' });
  }
});

// 4. DELETE LEAD (Admin only)
app.delete('/api/leads/:id', authenticateToken, requireAdmin, (req, res) => {
  try {
    const leadId = req.params.id;
    let leads = loadLeads();
    const index = leads.findIndex(l => l.id === leadId);

    if (index === -1) {
      return res.status(404).json({ success: false, message: 'Lead no encontrado.' });
    }

    const removed = leads.splice(index, 1)[0];
    saveLeads(leads);

    res.json({
      success: true,
      message: `Lead de ${removed.client_name} eliminado.`,
      data: removed
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error al eliminar lead.' });
  }
});

// 8. EXPORT BACKUP JSON
app.get('/api/export', authenticateToken, requireAdmin, (req, res) => {
  const vehicles = loadVehicles();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=autohaus_catalog_backup_${Date.now()}.json`);
  res.send(JSON.stringify(vehicles, null, 2));
});

// ==========================================
// STATIC FILES & ROUTING
// ==========================================

app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/styles', express.static(path.join(__dirname, 'styles')));
app.use('/scripts', express.static(path.join(__dirname, 'scripts')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// Admin routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'index.html'));
});

app.get('/admin/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin', 'login.html'));
});

// Public catalog
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚗 SERVIDOR AUTOHAUS FULLSTACK CMS & CRM ACTIVO`);
  console.log(`🌐 Catálogo Público:       http://localhost:${PORT}`);
  console.log(`🔐 Panel de Administración: http://localhost:${PORT}/admin`);
  console.log(`🔑 Login Admin:            http://localhost:${PORT}/admin/login`);
  console.log(`👤 Admin:                   admin@autohaus.mx / autohaus2025`);
  console.log(`👤 Secretaria:              alice@autohaus.mx / alice2025`);
  console.log(`👤 Vendedores:              napo, javier, fernanda, raul @autohaus.mx`);
  console.log(`======================================================\n`);
});
