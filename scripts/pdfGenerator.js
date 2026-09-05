/**
 * Generador Dinámico de Catálogo PDF Editorial Autohaus
 * Crea páginas de alta resolución (1080x1920) con el diseño oficial de la marca.
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
 * Ordena el inventario por categoría colocando los autos nuevos al final de su categoría
 * y renumera las páginas de forma secuencial.
 */
function sortCatalogByCategory(vehicles) {
  const groups = {};
  CATEGORY_ORDER.forEach(cat => { groups[cat] = []; });

  vehicles.forEach(v => {
    const cat = v.category || 'SEDAN & HATCHBACK';
    if (!groups[cat]) groups[cat] = [];
    // Clone vehicle to prevent unintended mutation
    groups[cat].push({ ...v });
  });

  const sorted = [];
  Object.keys(groups).forEach(cat => {
    sorted.push(...groups[cat]);
  });

  return sorted;
}

/**
 * Convierte un archivo local a Base64 para que Puppeteer lo renderice de forma instantánea
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
 * Genera el documento HTML completo para el PDF con portada y todas las páginas de vehículos
 */
function buildCatalogHtml(vehicles) {
  const logoInlineB64 = imageToBase64('assets/images/autohaus_logo_white.png');
  const tagLogoB64 = imageToBase64('assets/images/autohaus_tag_original.png');

  // 1. Portada Editorial Oficial (Página 1)
  const coverHtml = `
    <div class="page-container page-cover">
      <div class="cover-background-glow"></div>
      
      <div class="cover-header">
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

  // 2. Páginas Individuales de Vehículos (Con el diseño de revista oficial)
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
        
        <!-- Top Section: Watermark & Hero Car -->
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

        <!-- Bottom Section: Royal Blue Luxury Specs & Pricing -->
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
        @import url('https://fonts.googleapis.com/css2?family=Comfortaa:wght@700&family=Poppins:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700&display=swap');

        @page {
          size: 1080px 1920px;
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
          width: 1080px;
          height: 1920px;
          page-break-after: always;
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          background: #163875;
        }

        /* COVER PAGE STYLES */
        .page-cover {
          background: radial-gradient(circle at 50% 40%, #2458b8 0%, #163875 60%, #0d2248 100%);
          padding: 100px 70px 80px;
          justify-content: space-between;
          align-items: center;
          text-align: center;
        }

        .cover-tag-badge {
          display: inline-block;
          background: #ffde59;
          color: #000000;
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.15em;
          padding: 8px 36px;
          border-radius: 30px;
          margin-bottom: 40px;
          box-shadow: 0 8px 24px rgba(0,0,0,0.4);
        }

        .cover-logo-wrap {
          margin-bottom: 25px;
        }

        .cover-logo-img {
          height: 110px;
          width: auto;
          filter: drop-shadow(0 10px 25px rgba(0,0,0,0.5));
        }

        .cover-divider-gold {
          width: 220px;
          height: 4px;
          background: #ffde59;
          margin: 0 auto 30px;
          border-radius: 2px;
        }

        .cover-subtitle {
          font-size: 38px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #ffffff;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .cover-location {
          font-size: 24px;
          font-weight: 600;
          color: #93c5fd;
          letter-spacing: 0.08em;
        }

        .cover-badge-vehicles-count {
          background: rgba(15, 39, 82, 0.85);
          border: 4px solid #ffde59;
          border-radius: 32px;
          padding: 50px 70px;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5), 0 0 40px rgba(255,222,89,0.3);
          display: flex;
          flex-direction: column;
          align-items: center;
        }

        .count-number {
          font-size: 140px;
          font-weight: 900;
          color: #ffde59;
          line-height: 1;
          margin-bottom: 10px;
          text-shadow: 0 4px 25px rgba(255,222,89,0.4);
        }

        .count-text {
          font-size: 26px;
          font-weight: 800;
          letter-spacing: 0.12em;
          color: #ffffff;
        }

        .cover-features-row {
          display: flex;
          justify-content: center;
          gap: 20px;
          margin-bottom: 30px;
        }

        .cover-feat-pill {
          background: rgba(255,255,255,0.12);
          border: 2px solid rgba(255,255,255,0.25);
          padding: 14px 24px;
          border-radius: 20px;
          font-size: 20px;
          font-weight: 700;
          color: #ffffff;
        }

        .cover-contact-bar {
          border-top: 2px solid rgba(255,255,255,0.2);
          padding-top: 25px;
          display: flex;
          justify-content: space-around;
          font-size: 20px;
          color: #cbd5e1;
          font-weight: 600;
        }

        /* VEHICLE PAGE STYLES */
        .page-top {
          height: 1100px;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 70px 60px 20px;
          background: radial-gradient(circle at 50% 35%, #2a62c8 0%, #1a4490 60%, #12316a 100%);
        }

        .page-brand {
          font-size: 64px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          text-align: center;
          line-height: 1.1;
          text-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }

        .page-model {
          font-size: 32px;
          font-weight: 700;
          color: #ffde59;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-align: center;
          margin-top: 10px;
          margin-bottom: 18px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.4);
        }

        .page-meta-row {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 25px;
        }

        .page-year-badge {
          background: #ffde59;
          color: #000000;
          font-size: 26px;
          font-weight: 900;
          padding: 4px 32px;
          border-radius: 25px;
          box-shadow: 0 6px 18px rgba(0,0,0,0.35);
        }

        .page-category-pill {
          background: rgba(15, 39, 82, 0.85);
          border: 1.5px solid rgba(255,255,255,0.3);
          color: #93c5fd;
          font-size: 20px;
          font-weight: 800;
          padding: 6px 24px;
          border-radius: 20px;
          letter-spacing: 0.05em;
        }

        .page-car-img-wrap {
          flex: 1;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
        }

        .page-car-img {
          max-width: 950px;
          max-height: 600px;
          object-fit: contain;
          filter: drop-shadow(0 25px 35px rgba(0,0,0,0.65));
        }

        .status-overlay-badge {
          position: absolute;
          top: 20px;
          right: 20px;
          padding: 10px 24px;
          border-radius: 16px;
          font-size: 22px;
          font-weight: 900;
          letter-spacing: 0.08em;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .status-apartado {
          background: #facc15;
          color: #000000;
          border: 2px solid #ffffff;
        }

        .status-vendido {
          background: #ef4444;
          color: #ffffff;
          border: 2px solid #ffffff;
        }

        /* BOTTOM SOLID ROYAL BLUE CARD */
        .page-bottom {
          height: 820px;
          background: #0f2752;
          border-top: 6px solid #ffde59;
          padding: 45px 65px;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          box-shadow: 0 -15px 40px rgba(0,0,0,0.4);
        }

        /* PRICING BOX */
        .price-card-box {
          background: rgba(22, 56, 117, 0.85);
          border: 3px solid rgba(255, 222, 89, 0.6);
          border-radius: 24px;
          padding: 28px 40px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          box-shadow: 0 10px 30px rgba(0,0,0,0.3);
        }

        .price-col-contado {
          flex: 1;
          text-align: center;
        }

        .price-label-contado {
          font-size: 22px;
          font-weight: 700;
          color: #93c5fd;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
        }

        .price-val-contado {
          font-size: 56px;
          font-weight: 900;
          color: #ffffff;
          letter-spacing: -0.02em;
        }

        .price-divider {
          width: 3px;
          height: 85px;
          background: rgba(255, 255, 255, 0.25);
          margin: 0 35px;
        }

        .price-col-financiado {
          flex: 1;
          text-align: center;
        }

        .price-label-financiado {
          font-size: 22px;
          font-weight: 700;
          color: #ffde59;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          margin-bottom: 6px;
        }

        .price-badge-financiado {
          background: #ffde59;
          color: #000000;
          font-size: 48px;
          font-weight: 900;
          padding: 4px 24px;
          border-radius: 16px;
          display: inline-block;
          box-shadow: 0 6px 16px rgba(0,0,0,0.3);
        }

        /* SPECS SECTION */
        .specs-header {
          display: flex;
          align-items: center;
          gap: 20px;
          margin: 20px 0 16px;
        }

        .specs-header-text {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: 0.15em;
          color: #ffde59;
          text-transform: uppercase;
        }

        .specs-header-line {
          flex: 1;
          height: 3px;
          background: linear-gradient(90deg, #ffde59, transparent);
        }

        .specs-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px 26px;
        }

        .spec-item {
          background: rgba(255, 255, 255, 0.08);
          border: 1.5px solid rgba(255, 255, 255, 0.15);
          border-radius: 14px;
          padding: 12px 18px;
          font-size: 22px;
          font-weight: 600;
          color: #f1f5f9;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .spec-bullet {
          color: #ffde59;
          font-size: 24px;
        }

        .spec-text {
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* FOOTER */
        .page-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-top: 2px solid rgba(255, 255, 255, 0.15);
          padding-top: 18px;
          font-size: 22px;
          color: #94a3b8;
        }

        .footer-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .footer-handle {
          color: #ffde59;
          font-weight: 800;
        }

        .footer-dot {
          color: rgba(255,255,255,0.3);
        }

        .page-number-badge {
          background: rgba(255, 222, 89, 0.2);
          color: #ffde59;
          border: 1.5px solid #ffde59;
          padding: 4px 20px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 20px;
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

// Mutex to avoid parallel headless Chrome instances colliding
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
  return undefined; // Allows puppeteer's bundled Chrome on Render / Linux
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
      
      // 1. Acomodar por categoría y asignar numeración
      const sortedCars = sortCatalogByCategory(rawCars);
      
      // Guardar catálogo ordenado
      fs.writeFileSync(catalogPath, JSON.stringify(sortedCars, null, 2));

      // Actualizar scripts/data.js con estructura completa
      const jsDataPath = path.join(__dirname, 'data.js');
      const jsContent = `/**
 * AUTOHAUS DATA STORE - INVENTARIO OFICIAL EDITORIAL 2025
 */
const AUTOHAUS_DATA = {
  metadata: {
    title: "Catálogo Autohaus",
    version: "7.0.0",
    total_pages: ${Math.max(65, sortedCars.length + 6)},
    vehicles_count: ${sortedCars.length},
    contact: "477 771 0000",
    whatsapp: "524777710000",
    instagram: "@autohausautohaus",
    location: "Chihuahua, Chihuahua, México",
    generated_at: "${new Date().toISOString()}"
  },
  sections: [
    { page: 1, type: "cover", hero_image: "assets/cars/page_4_img_2.jpeg", title: "CATÁLOGO DIGITAL AUTOHAUS", subtitle: "INVENTARIO COMPLETO Y FINANCIAMIENTO", handle: "@autohausautohaus" },
    { page: 2, type: "divider", category: "SEDAN & HATCHBACK", line1: "LÍNEA", line2: "SEDAN & HATCHBACK", hero_image: "assets/cars/page_2_img_2.jpeg", handle: "@autohausautohaus" },
    { page: 22, type: "divider", category: "SUV'S", line1: "LÍNEA", line2: "SUV'S", hero_image: "assets/cars/page_23_img_2.jpeg", handle: "@autohausautohaus" },
    { page: 47, type: "divider", category: "PICK UPS", line1: "LÍNEA", line2: "PICK UPS", hero_image: "assets/cars/page_48_img_2.jpeg", handle: "@autohausautohaus" },
    { page: 62, type: "divider", category: "DEPORTIVOS", line1: "LÍNEA", line2: "DEPORTIVOS", hero_image: "assets/cars/page_65_img_2.jpeg", handle: "@autohausautohaus" }
  ],
  vehicles: ${JSON.stringify(sortedCars, null, 2)}
};
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AUTOHAUS_DATA;
}
`;
      fs.writeFileSync(jsDataPath, jsContent);

      // 2. Construir HTML
      const html = buildCatalogHtml(sortedCars);

      // 3. Generar PDF con Puppeteer
      const chromePath = getChromeExecutablePath();
      const launchOptions = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-background-networking',
          '--disable-default-apps',
          '--disable-extensions',
          '--disable-sync',
          '--disable-translate',
          '--hide-scrollbars',
          '--metrics-recording-only',
          '--mute-audio',
          '--no-first-run',
          '--safebrowsing-disable-auto-update'
        ]
      };
      if (chromePath) {
        launchOptions.executablePath = chromePath;
      }

      const browser = await puppeteer.launch(launchOptions);

      const page = await browser.newPage();
      await page.setViewport({ width: 1080, height: 1920 });
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });

      const outputPath = targetPath || path.join(__dirname, '..', 'assets', 'docs', 'Catalogo_Autohaus_Editorial_2025.pdf');
      
      // Asegurar directorio
      fs.mkdirSync(path.dirname(outputPath), { recursive: true });

      const pdfBuffer = await page.pdf({
        width: '1080px',
        height: '1920px',
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
