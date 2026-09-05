/**
 * Generador Dinámico de Catálogo PDF Editorial Autohaus
 * Diseñado para generar un catálogo de alta resolución, ultra nítido y de carga instantánea (< 10 MB).
 */

let puppeteer;
try {
  puppeteer = require('puppeteer');
} catch (e) {
  puppeteer = require('puppeteer-core');
}
const fs = require('fs');
const path = require('path');

const CATEGORY_ORDER = [
  'SEDAN & HATCHBACK',
  "SUV'S",
  'PICK UPS',
  'UTILITARIOS',
  'DEPORTIVOS'
];

/**
 * Ordena el inventario por categoría
 */
function sortCatalogByCategory(vehicles) {
  const groups = {};
  CATEGORY_ORDER.forEach(cat => { groups[cat] = []; });

  vehicles.forEach(v => {
    const cat = v.category || 'SEDAN & HATCHBACK';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push({ ...v });
  });

  const sorted = [];
  Object.keys(groups).forEach(cat => {
    sorted.push(...groups[cat]);
  });

  return sorted;
}

/**
 * Convierte un archivo local a Base64
 */
function imageToBase64(relOrAbsPath) {
  try {
    const absPath = path.isAbsolute(relOrAbsPath)
      ? relOrAbsPath
      : path.join(__dirname, '..', relOrAbsPath);

    if (fs.existsSync(absPath)) {
      const ext = path.extname(absPath).replace('.', '').toLowerCase();
      const mime = ext === 'png' ? 'image/png' : ext === 'svg' ? 'image/svg+xml' : 'image/jpeg';
      const b64 = fs.readFileSync(absPath).toString('base64');
      return `data:${mime};base64,${b64}`;
    }
  } catch (e) {
    console.error('Error convirtiendo imagen a base64:', relOrAbsPath, e.message);
  }
  return '';
}

/**
 * Genera el documento HTML completo para el PDF
 */
function buildCatalogHtml(vehicles) {
  const logoInlineB64 = imageToBase64('assets/images/autohaus_logo_white.png');
  const tagLogoB64 = imageToBase64('assets/images/autohaus_tag_original.png');

  // 1. Portada Editorial Oficial (Página 1)
  const coverHtml = `
    <div class="page-container page-cover">
      <div class="cover-top-box">
        <div class="cover-tag-badge">EDICIÓN OFICIAL 2025</div>
        <div class="cover-logo-wrap">
          ${logoInlineB64 ? `<img src="${logoInlineB64}" class="cover-logo-img" alt="Autohaus" />` : '<h1 class="cover-fallback-title">AUTO HAUS</h1>'}
        </div>
        <div class="cover-divider-gold"></div>
        <h2 class="cover-subtitle">CATÁLOGO EDITORIAL & INVENTARIO</h2>
        <p class="cover-location">CHIHUAHUA, CHIH. • SUCURSALES SAN FELIPE Y SUR</p>
      </div>

      <div class="cover-hero-center">
        <div class="cover-badge-vehicles-count">
          <span class="count-number">${vehicles.length}</span>
          <span class="count-text">VEHÍCULOS CERTIFICADOS DISPONIBLES</span>
        </div>
      </div>

      <div class="cover-footer">
        <div class="cover-features-row">
          <div class="cover-feat-pill">✓ Garantía Mecánica y Legal</div>
          <div class="cover-feat-pill">✓ Crédito desde 20% de Enganche</div>
          <div class="cover-feat-pill">✓ Financiamiento entre Particulares</div>
        </div>
        <div class="cover-contact-bar">
          <span>📍 San Felipe: Fernando de Borja 907</span>
          <span>📍 Sur: Calle Industrial 8 #7407</span>
          <span>📱 WhatsApp: 614 365 3015</span>
        </div>
      </div>
    </div>
  `;

  // 2. Páginas Individuales de Vehículos
  const vehiclePagesHtml = vehicles.map(car => {
    const photoPath = car.cover_photo || car.main_photo || (car.photos && car.photos[0]) || `assets/cars/page_${car.page}_img_2.jpeg`;
    const photoB64 = imageToBase64(photoPath) || tagLogoB64;
    const specs = (car.specs && car.specs.length) ? car.specs.slice(0, 6) : [
      'Transmisión Automática',
      'Eléctrico',
      'Excelente Estado',
      'Factura de Agencia'
    ];

    const carStatus = car.status || 'disponible';
    let statusBadgeHtml = '';
    if (carStatus === 'apartado') {
      statusBadgeHtml = '<div class="status-overlay-badge status-apartado">🟡 UNIDAD APARTADA</div>';
    } else if (carStatus === 'vendido') {
      statusBadgeHtml = '<div class="status-overlay-badge status-vendido">🔴 VENDIDO</div>';
    }

    return `
      <div class="page-container page-vehicle">
        
        <!-- Top Section -->
        <div class="page-top">
          <div class="page-brand">${car.brand}</div>
          <div class="page-model">${car.model}</div>
          
          <div class="page-meta-row">
            <div class="page-year-badge">${car.year}</div>
            <div class="page-category-pill">${car.category}</div>
          </div>

          <div class="page-car-img-wrap">
            ${photoB64 ? `<img src="${photoB64}" class="page-car-img" alt="${car.brand} ${car.model}" />` : ''}
            ${statusBadgeHtml}
          </div>
        </div>

        <!-- Bottom Section -->
        <div class="page-bottom">
          
          <!-- Pricing Box -->
          <div class="price-card-box">
            <div class="price-col-contado">
              <div class="price-label-contado">Precio Contado</div>
              <div class="price-val-contado">${car.price_contado || '$0'}</div>
            </div>
            
            <div class="price-divider"></div>
            
            <div class="price-col-financiado">
              <div class="price-label-financiado">Financiado Desde</div>
              <div class="price-badge-financiado">${car.price_financiado || 'Consultar'}</div>
            </div>
          </div>

          <!-- Specs Title -->
          <div class="specs-header">
            <span class="specs-header-text">ESPECIFICACIONES</span>
            <span class="specs-header-line"></span>
          </div>

          <!-- Specs Grid -->
          <div class="specs-grid">
            ${specs.map(s => `
              <div class="spec-item">
                <span class="spec-bullet">✦</span>
                <span class="spec-text">${s}</span>
              </div>
            `).join('')}
          </div>

          <!-- Footer -->
          <div class="page-footer">
            <div class="footer-left">
              <span class="footer-handle">@autohausautohaus</span>
              <span class="footer-dot">•</span>
              <span class="footer-location">📱 614 365 3015 • Chihuahua, Chih.</span>
            </div>
            <div class="footer-right">
              <span class="page-number-badge">Pág. ${car.page}</span>
            </div>
          </div>

        </div>

      </div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Catálogo Oficial Autohaus</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&display=swap');

        @page {
          size: 720px 1280px;
          margin: 0;
        }

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Poppins', sans-serif;
          background: #0f2752;
          color: #ffffff;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        .page-container {
          width: 720px;
          height: 1280px;
          page-break-after: always;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #163875;
        }

        /* COVER PAGE STYLES */
        .page-cover {
          background: linear-gradient(180deg, #132e60 0%, #1a428a 50%, #0d2248 100%);
          padding: 60px 45px 50px;
          justify-content: space-between;
          align-items: center;
          text-align: center;
        }

        .cover-tag-badge {
          display: inline-block;
          background: #ffde59;
          color: #000000;
          font-size: 16px;
          font-weight: 900;
          letter-spacing: 0.15em;
          padding: 6px 24px;
          border-radius: 20px;
          margin-bottom: 25px;
        }

        .cover-logo-wrap {
          margin-bottom: 15px;
        }

        .cover-logo-img {
          height: 75px;
          width: auto;
        }

        .cover-fallback-title {
          font-size: 42px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.1em;
        }

        .cover-divider-gold {
          width: 150px;
          height: 3px;
          background: #ffde59;
          margin: 0 auto 20px;
          border-radius: 2px;
        }

        .cover-subtitle {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #ffffff;
          text-transform: uppercase;
          margin-bottom: 8px;
        }

        .cover-location {
          font-size: 16px;
          font-weight: 600;
          color: #93c5fd;
          letter-spacing: 0.06em;
        }

        .cover-badge-vehicles-count {
          background: rgba(15, 39, 82, 0.95);
          border: 3px solid #ffde59;
          border-radius: 24px;
          padding: 35px 50px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .count-number {
          font-size: 95px;
          font-weight: 900;
          color: #ffde59;
          line-height: 1;
          margin-bottom: 8px;
        }

        .count-text {
          font-size: 18px;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: #ffffff;
        }

        .cover-features-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .cover-feat-pill {
          background: rgba(255,255,255,0.12);
          border: 1.5px solid rgba(255,255,255,0.25);
          padding: 10px 16px;
          border-radius: 14px;
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
        }

        .cover-contact-bar {
          border-top: 1.5px solid rgba(255,255,255,0.2);
          padding-top: 18px;
          display: flex;
          justify-content: space-around;
          font-size: 13px;
          color: #cbd5e1;
          font-weight: 600;
        }

        /* VEHICLE PAGE STYLES */
        .page-top {
          height: 60%;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 40px 15px;
          background: linear-gradient(180deg, #132e60 0%, #1e458e 100%);
        }

        .page-brand {
          font-size: 42px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          text-align: center;
          line-height: 1.1;
        }

        .page-model {
          font-size: 22px;
          font-weight: 700;
          color: #ffde59;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          text-align: center;
          margin-top: 6px;
          margin-bottom: 12px;
        }

        .page-meta-row {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 15px;
        }

        .page-year-badge {
          background: #ffde59;
          color: #000000;
          font-size: 17px;
          font-weight: 900;
          padding: 3px 20px;
          border-radius: 18px;
        }

        .page-category-pill {
          background: rgba(15, 39, 82, 0.85);
          border: 1px solid rgba(255,255,255,0.3);
          color: #93c5fd;
          font-size: 14px;
          font-weight: 800;
          padding: 4px 16px;
          border-radius: 15px;
          letter-spacing: 0.05em;
        }

        .page-car-img-wrap {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          overflow: hidden;
          border-radius: 16px;
        }

        .page-car-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 16px;
        }

        .status-overlay-badge {
          position: absolute;
          top: 15px;
          right: 15px;
          padding: 6px 16px;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 900;
          letter-spacing: 0.06em;
        }

        .status-apartado {
          background: #facc15;
          color: #000000;
          border: 1.5px solid #ffffff;
        }

        .status-vendido {
          background: #ef4444;
          color: #ffffff;
          border: 1.5px solid #ffffff;
        }

        /* BOTTOM SOLID ROYAL BLUE CARD */
        .page-bottom {
          height: 40%;
          background: #0f2752;
          border-top: 4px solid #ffde59;
          padding: 25px 40px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
        }

        /* PRICING BOX */
        .price-card-box {
          background: rgba(22, 56, 117, 0.85);
          border: 2px solid rgba(255, 222, 89, 0.6);
          border-radius: 16px;
          padding: 18px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .price-col-contado {
          flex: 1;
          text-align: center;
        }

        .price-label-contado {
          font-size: 14px;
          font-weight: 700;
          color: #93c5fd;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .price-val-contado {
          font-size: 36px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .price-divider {
          width: 2px;
          height: 55px;
          background: rgba(255, 255, 255, 0.25);
          margin: 0 15px;
        }

        .price-col-financiado {
          flex: 1;
          text-align: center;
        }

        .price-label-financiado {
          font-size: 14px;
          font-weight: 700;
          color: #ffde59;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 4px;
        }

        .price-badge-financiado {
          font-size: 32px;
          font-weight: 900;
          color: #ffde59;
          letter-spacing: -0.01em;
        }

        /* SPECS TITLE */
        .specs-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-top: 8px;
          margin-bottom: 6px;
        }

        .specs-header-text {
          font-size: 14px;
          font-weight: 900;
          color: #ffde59;
          letter-spacing: 0.15em;
          text-transform: uppercase;
        }

        .specs-header-line {
          flex: 1;
          height: 2px;
          background: rgba(255, 222, 89, 0.3);
        }

        /* SPECS GRID */
        .specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 6px 14px;
        }

        .spec-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          color: #e2e8f0;
          font-weight: 600;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .spec-bullet {
          color: #ffde59;
          font-size: 12px;
        }

        /* FOOTER */
        .page-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 1.5px solid rgba(255, 255, 255, 0.15);
          padding-top: 10px;
        }

        .footer-left {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12px;
          color: #94a3b8;
          font-weight: 600;
        }

        .footer-handle {
          color: #ffde59;
          font-weight: 700;
        }

        .page-number-badge {
          background: rgba(255, 255, 255, 0.12);
          border: 1px solid rgba(255, 255, 255, 0.25);
          padding: 3px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 800;
          color: #ffffff;
        }
      </style>
    </head>
    <body>
      ${coverHtml}
      ${vehiclePagesHtml}
    </body>
    </html>
  `;
}

let activeGenerationPromise = null;
let pendingRegenerate = false;

function getChromeExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const possiblePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const p of possiblePaths) {
    if (fs.existsSync(p)) return p;
  }
  return undefined;
}

/**
 * Función principal para generar el archivo PDF del catálogo
 */
async function generateFullCatalogPDF(targetPath = null) {
  if (activeGenerationPromise) {
    console.log('⏳ Generación de PDF ya en curso. Encolando solicitud...');
    pendingRegenerate = true;
    return activeGenerationPromise;
  }

  activeGenerationPromise = (async () => {
    try {
      const catalogPath = path.join(__dirname, '..', 'assets', 'data', 'catalog.json');
      const rawCars = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
      
      const sortedCars = sortCatalogByCategory(rawCars);
      fs.writeFileSync(catalogPath, JSON.stringify(sortedCars, null, 2));

      // Construir HTML
      const html = buildCatalogHtml(sortedCars);

      const chromePath = getChromeExecutablePath();
      const launchOptions = {
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-zygote',
          '--single-process',
          '--disable-extensions',
          '--disable-software-rasterizer',
          '--hide-scrollbars'
        ]
      };
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      const browser = await puppeteer.launch(launchOptions);
      const page = await browser.newPage();
      await page.setViewport({ width: 720, height: 1280 });
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });

      const outputPath = targetPath || path.join(__dirname, '..', 'assets', 'docs', 'Catalogo_Autohaus_Editorial_2025.pdf');
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      const pdfBuffer = await page.pdf({
        width: '720px',
        height: '1280px',
        printBackground: true
      });

      await browser.close();
      fs.writeFileSync(outputPath, pdfBuffer);

      console.log(`✅ Catálogo PDF actualizado con éxito (${sortedCars.length} vehículos). Tamaño: ${(pdfBuffer.length / (1024*1024)).toFixed(2)} MB`);
      return { success: true, count: sortedCars.length, path: outputPath, size: pdfBuffer.length };
    } catch (error) {
      console.error('❌ Error generando Catálogo PDF:', error);
      return { success: false, error: error.message };
    } finally {
      activeGenerationPromise = null;
      if (pendingRegenerate) {
        pendingRegenerate = false;
        console.log('🔄 Ejecutando regeneración de PDF pendiente tras cambios simultáneos...');
        generateFullCatalogPDF(targetPath).catch(e => console.error('Error in queued PDF gen:', e));
      }
    }
  })();

  return activeGenerationPromise;
}

function isGeneratingPDF() {
  return activeGenerationPromise !== null;
}

module.exports = {
  sortCatalogByCategory,
  generateFullCatalogPDF,
  isGeneratingPDF,
  CATEGORY_ORDER
};
