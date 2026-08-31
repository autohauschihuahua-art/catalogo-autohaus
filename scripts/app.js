/**
 * Autohaus - Landing Page & Catálogo Comercial Interactivo
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  const state = {
    vehicles: [],
    filteredVehicles: [],
    selectedCategory: 'all',
    searchQuery: '',
    sortBy: 'default',
    currentModalVehicle: null,
    flipbookPage: 1
  };

  // DOM Elements
  const vehiclesGridContainer = document.getElementById('vehiclesGridContainer');
  const landingSearchInput = document.getElementById('landingSearchInput');
  const categoryFilterPills = document.getElementById('categoryFilterPills');
  const landingSortSelect = document.getElementById('landingSortSelect');
  const showingVehiclesCount = document.getElementById('showingVehiclesCount');

  // Count Badges
  const countAll = document.getElementById('countAll');
  const countSedan = document.getElementById('countSedan');
  const countSuv = document.getElementById('countSuv');
  const countPickup = document.getElementById('countPickup');
  const countSport = document.getElementById('countSport');

  // PDF Export Buttons
  const navDownloadPdfBtn = document.getElementById('navDownloadPdfBtn');
  const heroDownloadPdfBtn = document.getElementById('heroDownloadPdfBtn');
  const bannerDownloadPdfBtn = document.getElementById('bannerDownloadPdfBtn');

  // Flipbook Modal Buttons
  const heroOpenFlipbookBtn = document.getElementById('heroOpenFlipbookBtn');
  const bannerOpenFlipbookBtn = document.getElementById('bannerOpenFlipbookBtn');
  const flipbookMagazineModal = document.getElementById('flipbookMagazineModal');
  const flipbookModalCloseBtn = document.getElementById('flipbookModalCloseBtn');
  const flipbookViewerContainer = document.getElementById('flipbookViewerContainer');

  // Vehicle Detail Modal Elements
  const vehicleDetailModal = document.getElementById('vehicleDetailModal');
  const modalCloseBtn = document.getElementById('modalCloseBtn');
  const modalMainImg = document.getElementById('modalMainImg');
  const modalThumbsList = document.getElementById('modalThumbsList');
  const modalBrand = document.getElementById('modalBrand');
  const modalModel = document.getElementById('modalModel');
  const modalYear = document.getElementById('modalYear');
  const modalPriceContado = document.getElementById('modalPriceContado');
  const modalPriceFinanciado = document.getElementById('modalPriceFinanciado');
  const modalSpecsList = document.getElementById('modalSpecsList');
  const modalCalcDownpayment = document.getElementById('modalCalcDownpayment');
  const modalCalcMonthly = document.getElementById('modalCalcMonthly');
  const modalWhatsAppBtn = document.getElementById('modalWhatsAppBtn');

  // Initialize
  async function init() {
    await loadVehicles();
    setupEventListeners();
  }

  // Load Vehicles from API with fallback to static data
  async function loadVehicles() {
    try {
      const res = await fetch('/api/vehicles');
      const data = await res.json();
      if (data.success && data.data && data.data.length) {
        state.vehicles = data.data;
      } else {
        throw new Error('Fallback to static data');
      }
    } catch (e) {
      if (typeof AUTOHAUS_DATA !== 'undefined' && AUTOHAUS_DATA.vehicles) {
        state.vehicles = AUTOHAUS_DATA.vehicles;
      }
    }

    updateCategoryCounts();
    applyFilters();
  }

  function updateCategoryCounts() {
    const list = state.vehicles;
    if (countAll) countAll.textContent = list.length;
    if (countSedan) countSedan.textContent = list.filter(v => v.category === 'SEDAN & HATCHBACK').length;
    if (countSuv) countSuv.textContent = list.filter(v => v.category === "SUV'S").length;
    if (countPickup) countPickup.textContent = list.filter(v => v.category === 'PICK UPS').length;
    if (countSport) countSport.textContent = list.filter(v => v.category === 'DEPORTIVOS').length;
  }

  function setupEventListeners() {
    // Live Search
    landingSearchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      applyFilters();
    });

    // Category Filter Pills
    categoryFilterPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.cat-pill-btn');
      if (!btn) return;

      document.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      state.selectedCategory = btn.dataset.category;
      applyFilters();
    });

    // Sorting
    landingSortSelect.addEventListener('change', (e) => {
      state.sortBy = e.target.value;
      applyFilters();
    });

    // Direct PDF File Download Triggers
    const triggerPDFDownload = () => downloadPDFCatalog();
    if (navDownloadPdfBtn) navDownloadPdfBtn.addEventListener('click', triggerPDFDownload);
    if (heroDownloadPdfBtn) heroDownloadPdfBtn.addEventListener('click', triggerPDFDownload);
    if (bannerDownloadPdfBtn) bannerDownloadPdfBtn.addEventListener('click', triggerPDFDownload);

    // Print Catalog Trigger
    const bannerPrintBtn = document.getElementById('bannerPrintBtn');
    if (bannerPrintBtn) bannerPrintBtn.addEventListener('click', () => printCatalog());

    // Flipbook Magazine Modal
    const openFlipbook = () => openFlipbookModal();
    if (heroOpenFlipbookBtn) heroOpenFlipbookBtn.addEventListener('click', openFlipbook);
    if (bannerOpenFlipbookBtn) bannerOpenFlipbookBtn.addEventListener('click', openFlipbook);
    if (flipbookModalCloseBtn) flipbookModalCloseBtn.addEventListener('click', closeFlipbookModal);
    if (flipbookMagazineModal) {
      flipbookMagazineModal.addEventListener('click', (e) => {
        if (e.target === flipbookMagazineModal) closeFlipbookModal();
      });
    }

    // Vehicle Modal Close
    if (modalCloseBtn) modalCloseBtn.addEventListener('click', closeVehicleModal);
    if (vehicleDetailModal) {
      vehicleDetailModal.addEventListener('click', (e) => {
        if (e.target === vehicleDetailModal) closeVehicleModal();
      });
    }

    // Keyboard ESC
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeVehicleModal();
        closeFlipbookModal();
      }
    });
  }

  function applyFilters() {
    let list = [...state.vehicles];

    // 1. Category Filter
    if (state.selectedCategory !== 'all') {
      list = list.filter(v => v.category === state.selectedCategory);
    }

    // 2. Search Query
    if (state.searchQuery) {
      const q = state.searchQuery;
      list = list.filter(v => {
        const full = `${v.brand} ${v.model} ${v.year} ${v.price_contado} ${v.price_financiado} ${(v.specs || []).join(' ')}`.toLowerCase();
        return full.includes(q);
      });
    }

    // 3. Sorting
    if (state.sortBy === 'price-asc') {
      list.sort((a, b) => (a.price_num || 0) - (b.price_num || 0));
    } else if (state.sortBy === 'price-desc') {
      list.sort((a, b) => (b.price_num || 0) - (a.price_num || 0));
    } else if (state.sortBy === 'year-desc') {
      list.sort((a, b) => b.year - a.year);
    } else if (state.sortBy === 'year-asc') {
      list.sort((a, b) => a.year - b.year);
    }

    state.filteredVehicles = list;
    if (showingVehiclesCount) showingVehiclesCount.textContent = list.length;
    renderVehiclesGrid();
  }

  // Render Commercial Vehicle Grid
  function renderVehiclesGrid() {
    if (!vehiclesGridContainer) return;

    if (state.filteredVehicles.length === 0) {
      vehiclesGridContainer.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; color: #94a3b8;">
          <div style="font-size: 2.5rem; margin-bottom: 0.8rem;">🚗</div>
          <h3 style="color: #ffffff; font-size: 1.2rem; margin-bottom: 0.4rem;">No encontramos vehículos con esos filtros</h3>
          <p style="font-size: 0.88rem;">Intenta con otra búsqueda o selecciona "Todos" para ver el inventario completo.</p>
        </div>
      `;
      return;
    }

    vehiclesGridContainer.innerHTML = state.filteredVehicles.map(v => {
      const coverPhoto = v.cover_photo || `assets/cars/page_${v.page}_img_2.jpeg`;
      const specsPreview = (v.specs || []).slice(0, 4);

      return `
        <div class="commercial-car-card" data-page="${v.page}">
          
          <!-- Photo Box -->
          <div class="card-photo-box" onclick="window.appOpenDetailModal(${v.page})">
            <img src="${coverPhoto}" alt="${v.brand} ${v.model}" class="card-car-img" loading="lazy" onerror="this.src='assets/svg/autohaus-tag.svg'" />
            <span class="card-category-badge">${v.category}</span>
            <span class="card-year-badge">${v.year}</span>
          </div>

          <!-- Card Body -->
          <div class="card-body-content">
            <div class="card-brand-title">${v.brand}</div>
            <h3 class="card-model-title">${v.model}</h3>

            <!-- Prices Box -->
            <div class="card-prices-box">
              <div class="card-price-contado-wrap">
                <span class="card-price-label">Contado</span>
                <span class="card-price-contado-val">${v.price_contado}</span>
              </div>
              <div class="card-price-financiado-wrap">
                <span class="card-price-label">Financiado Desde</span>
                <span class="card-price-financiado-val">${v.price_financiado || '-'}</span>
              </div>
            </div>

            <!-- Specs Chips -->
            <div class="card-specs-list">
              ${specsPreview.map(s => `
                <div class="card-spec-tag">
                  <span>✦</span> ${s}
                </div>
              `).join('')}
            </div>

            <!-- Card Actions -->
            <div class="card-buttons-group">
              <button class="btn-card-details" onclick="window.appOpenDetailModal(${v.page})">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Ver Detalles & Fotos
              </button>

              <button class="btn-card-whatsapp" onclick="window.appOpenQuoteModal(${v.page})" title="Cotizar y contactar asesor de Autohaus">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.589 1.99.9 3.036.9 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.782-5.999-5.782zm0 10.366c-.927 0-1.802-.276-2.571-.78l-.184-.11-1.905.5 5.09-1.859-.12-.191c-.553-.879-.884-1.854-.883-2.826.001-2.534 2.062-4.594 4.597-4.594 2.536 0 4.597 2.061 4.597 4.596-.001 2.535-2.062 4.594-4.597 4.594z"/></svg>
                Cotizar
              </button>
            </div>

          </div>

        </div>
      `;
    }).join('');
  }

  // Open Vehicle Detail Modal
  window.appOpenDetailModal = (pageNum) => {
    const v = state.vehicles.find(item => item.page === pageNum);
    if (!v) return;

    state.currentModalVehicle = v;

    modalBrand.textContent = v.brand;
    modalModel.textContent = v.model;
    modalYear.textContent = `AÑO ${v.year} • ${v.category}`;
    modalPriceContado.textContent = v.price_contado;
    modalPriceFinanciado.textContent = v.price_financiado || '-';

    // Photos Gallery
    const cover = v.cover_photo || `assets/cars/page_${v.page}_img_2.jpeg`;
    modalMainImg.src = cover;

    const allPhotos = v.real_photos && v.real_photos.length ? v.real_photos : [cover];
    modalThumbsList.innerHTML = allPhotos.map((p, idx) => `
      <div class="modal-thumb ${idx === 0 ? 'active' : ''}" onclick="window.appSwitchModalPhoto('${p}', this)">
        <img src="${p}" alt="Foto ${idx + 1}" />
      </div>
    `).join('');

    // Specs
    modalSpecsList.innerHTML = (v.specs || []).map(s => `
      <div class="spec-chip-item">
        <span class="dot-gold">✦</span>
        <span>${s}</span>
      </div>
    `).join('');

    // Loan Calculator Calculation
    const numPrice = v.price_num || parseInt((v.price_contado || '').replace(/[^0-9]/g, '')) || 0;
    const downpayment = Math.round(numPrice * 0.35);
    const loanAmount = numPrice - downpayment;
    const monthlyRate = 0.013; // ~15.6% anual
    const months = 48;
    const monthlyPayment = Math.round((loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, months))) / (Math.pow(1 + monthlyRate, months) - 1));

    modalCalcDownpayment.textContent = `$${downpayment.toLocaleString()} MXN`;
    modalCalcMonthly.textContent = `$${monthlyPayment.toLocaleString()} MXN / mes`;

    // WhatsApp CTA button opens Quote Funnel
    modalWhatsAppBtn.onclick = (e) => {
      e.preventDefault();
      closeVehicleModal();
      window.appOpenQuoteModal(v.page);
    };

    vehicleDetailModal.classList.add('active');
  };

  window.appSwitchModalPhoto = (src, thumbEl) => {
    modalMainImg.src = src;
    document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
    if (thumbEl) thumbEl.classList.add('active');
  };

  function closeVehicleModal() {
    vehicleDetailModal.classList.remove('active');
  }

  // Open Flipbook Modal
  function openFlipbookModal() {
    state.flipbookPage = 1;
    renderFlipbookInModal();
    flipbookMagazineModal.classList.add('active');
  }

  function closeFlipbookModal() {
    flipbookMagazineModal.classList.remove('active');
  }

  function renderFlipbookInModal() {
    const v = state.vehicles[state.flipbookPage - 1];
    if (!v) return;

    const coverPhoto = v.cover_photo || `assets/cars/page_${v.page}_img_2.jpeg`;

    flipbookViewerContainer.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        
        <!-- Controls -->
        <div style="display: flex; align-items: center; gap: 1rem;">
          <button class="action-btn" id="flipPrevBtn" ${state.flipbookPage <= 1 ? 'disabled' : ''}>← Anterior</button>
          <span style="font-weight: 700; color: #ffffff; font-size: 0.9rem;">Página ${state.flipbookPage} de ${state.vehicles.length}</span>
          <button class="action-btn" id="flipNextBtn" ${state.flipbookPage >= state.vehicles.length ? 'disabled' : ''}>Siguiente →</button>
        </div>

        <!-- Editorial Page Render -->
        <div class="catalog-page" style="transform: scale(0.85); transform-origin: top center; margin-bottom: -90px;">
          
          <div class="card-top-topo">
            <div class="vehicle-brand-huge">${v.brand}</div>
            <div class="vehicle-model-spaced">${v.model}</div>
            <div class="vehicle-year-badge-center"><span>${v.year}</span></div>
            <div class="car-real-photo-hero-wrapper">
              <img class="car-real-hero-img" src="${coverPhoto}" alt="${v.brand} ${v.model}" />
            </div>
          </div>

          <div class="card-bottom-solid-blue">
            <div class="pricing-luxury-card">
              <div class="contado-box-wrapper">
                <span class="contado-label">Precio Contado</span>
                <span class="contado-amount">${v.price_contado}</span>
              </div>
              <div class="pricing-vertical-line"></div>
              <div class="financiado-box-wrapper">
                <span class="financiado-label">Financiado</span>
                <div class="financiado-card-yellow">
                  <span class="financiado-amount">${v.price_financiado || '-'}</span>
                </div>
              </div>
            </div>

            <div class="specs-header-luxury">
              <span class="specs-title-text">ESPECIFICACIONES</span>
              <span class="specs-header-line"></span>
            </div>

            <div class="specs-luxury-grid">
              ${(v.specs || []).map(s => `
                <div class="spec-chip-item">
                  <span class="dot-gold">✦</span>
                  <span>${s}</span>
                </div>
              `).join('')}
            </div>

            <div class="card-footer-luxury">
              <span class="footer-decor-line"></span>
              <a href="https://instagram.com/autohausautohaus" target="_blank" class="card-footer-handle-yellow">@autohausautohaus</a>
              <span class="footer-decor-line"></span>
            </div>
          </div>

        </div>

      </div>
    `;

    document.getElementById('flipPrevBtn').addEventListener('click', () => {
      if (state.flipbookPage > 1) {
        state.flipbookPage--;
        renderFlipbookInModal();
      }
    });

    document.getElementById('flipNextBtn').addEventListener('click', () => {
      if (state.flipbookPage < state.vehicles.length) {
        state.flipbookPage++;
        renderFlipbookInModal();
      }
    });
  }

  // 1. Direct PDF Catalog File Download
  function downloadPDFCatalog() {
    showToastNotification('📥 Descargando Catálogo Completo Autohaus (PDF Oficial)...');
    
    const a = document.createElement('a');
    a.href = '/api/catalog/download-pdf';
    a.download = 'Catalogo_Autohaus_Chihuahua_2025.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // 2. Print Live Inventory Catalog
  function printCatalog() {
    showToastNotification('🖨️ Preparando vista de impresión del catálogo...');
    const printContainer = document.getElementById('printExportHiddenContainer');
    if (!printContainer) return;

    printContainer.innerHTML = state.vehicles.map(v => {
      const coverPhoto = v.cover_photo || `assets/cars/page_${v.page}_img_2.jpeg`;

      return `
        <div class="catalog-page">
          <div class="card-top-topo">
            <div class="vehicle-brand-huge">${v.brand}</div>
            <div class="vehicle-model-spaced">${v.model}</div>
            <div class="vehicle-year-badge-center"><span>${v.year}</span></div>
            <div class="car-real-photo-hero-wrapper">
              <img class="car-real-hero-img" src="${coverPhoto}" alt="${v.brand} ${v.model}" />
            </div>
          </div>

          <div class="card-bottom-solid-blue">
            <div class="pricing-luxury-card">
              <div class="contado-box-wrapper">
                <span class="contado-label">Precio Contado</span>
                <span class="contado-amount">${v.price_contado}</span>
              </div>
              <div class="pricing-vertical-line"></div>
              <div class="financiado-box-wrapper">
                <span class="financiado-label">Financiado</span>
                <div class="financiado-card-yellow">
                  <span class="financiado-amount">${v.price_financiado || '-'}</span>
                </div>
              </div>
            </div>

            <div class="specs-header-luxury">
              <span class="specs-title-text">ESPECIFICACIONES</span>
              <span class="specs-header-line"></span>
            </div>

            <div class="specs-luxury-grid">
              ${(v.specs || []).map(s => `
                <div class="spec-chip-item">
                  <span class="dot-gold">✦</span>
                  <span>${s}</span>
                </div>
              `).join('')}
            </div>

            <div class="card-footer-luxury">
              <span class="footer-decor-line"></span>
              <a href="https://instagram.com/autohausautohaus" target="_blank" class="card-footer-handle-yellow">@autohausautohaus</a>
              <span class="footer-decor-line"></span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    setTimeout(() => {
      window.print();
    }, 400);
  }

  // ========================================================
  // MODAL DE COTIZACIÓN RÁPIDA & CAPTURA DE LEADS (EMBUDO)
  // ========================================================
  window.appOpenQuoteModal = (pageNum, customName, customPrice, customFin) => {
    const v = state.vehicles.find(item => item.page === pageNum);
    const vehicleTitle = v ? `${v.brand} ${v.model} (${v.year})` : (customName || 'Atención Personalizada Autohaus');
    const priceContado = v ? v.price_contado : (customPrice || '$0 MXN');
    const priceFin = v ? (v.price_financiado || 'Desde 20% enganche') : (customFin || 'Desde 20% enganche');

    const quoteVehiclePage = document.getElementById('quoteVehiclePage');
    const quoteVehicleName = document.getElementById('quoteVehicleName');
    const quoteModalVehicleTitle = document.getElementById('quoteModalVehicleTitle');
    const quoteModalVehiclePrice = document.getElementById('quoteModalVehiclePrice');
    const quoteModalVehicleFin = document.getElementById('quoteModalVehicleFin');
    const quoteModalOverlay = document.getElementById('quoteModalOverlay');

    if (quoteVehiclePage) quoteVehiclePage.value = pageNum || '';
    if (quoteVehicleName) quoteVehicleName.value = vehicleTitle;
    if (quoteModalVehicleTitle) quoteModalVehicleTitle.textContent = vehicleTitle;
    if (quoteModalVehiclePrice) quoteModalVehiclePrice.textContent = priceContado;
    if (quoteModalVehicleFin) quoteModalVehicleFin.textContent = priceFin;

    if (quoteModalOverlay) quoteModalOverlay.classList.add('active');
  };

  const quoteModalOverlay = document.getElementById('quoteModalOverlay');
  const quoteModalCloseBtn = document.getElementById('quoteModalCloseBtn');
  if (quoteModalCloseBtn && quoteModalOverlay) {
    quoteModalCloseBtn.addEventListener('click', () => quoteModalOverlay.classList.remove('active'));
  }
  if (quoteModalOverlay) {
    quoteModalOverlay.addEventListener('click', (e) => {
      if (e.target === quoteModalOverlay) quoteModalOverlay.classList.remove('active');
    });
  }

  // Submit Lead Form: Guardar en CRM (Round-Robin 1 a 1) y Redirigir a WhatsApp
  const quoteLeadForm = document.getElementById('quoteLeadForm');
  if (quoteLeadForm) {
    quoteLeadForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const clientName = document.getElementById('quoteClientName').value.trim();
      const clientPhone = document.getElementById('quoteClientPhone').value.trim();
      const vehiclePage = document.getElementById('quoteVehiclePage').value;
      const vehicleName = document.getElementById('quoteVehicleName').value;
      const planSelect = document.getElementById('quotePlanSelect').value;
      const clientNotes = document.getElementById('quoteClientNotes').value.trim();

      const btnSubmit = document.getElementById('btnSubmitQuote');
      btnSubmit.disabled = true;
      btnSubmit.textContent = 'Guardando y Conectando con Asesor...';

      const fullNotes = `Plan: ${planSelect}${clientNotes ? ' | Mensaje: ' + clientNotes : ''}`;

      try {
        // 1. Guardar Lead en Backend CRM (Asignación automática Round-Robin 1 a 1 a vendedores)
        await fetch('/api/leads/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: clientName,
            client_phone: clientPhone,
            vehicle_page: vehiclePage ? parseInt(vehiclePage) : null,
            vehicle_name: vehicleName,
            notes: fullNotes
          })
        });
      } catch (err) {
        console.warn('Error al guardar lead en CRM:', err);
      }

      // 2. Construir mensaje de WhatsApp al número oficial del embudo: 614 365 3015
      const waNumber = '526143653015';
      const waMsg = `¡Hola Autohaus! Mi nombre es *${clientName}* (WhatsApp: ${clientPhone}).

Me interesa cotizar el vehículo:
🚗 *${vehicleName}*
💳 *Plan de interés:* ${planSelect}
${clientNotes ? `💬 *Pregunta/Nota:* ${clientNotes}\n` : ''}
📍 Sucursales en Chihuahua:
• San Felipe: Fernando de Borja 907
• Sur: Calle Industrial 8 #7407

¿Me podrían brindar información sobre disponibilidad, enganche y opciones de compra? ¡Muchas gracias!`;

      if (quoteModalOverlay) quoteModalOverlay.classList.remove('active');
      quoteLeadForm.reset();
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.589 1.99.9 3.036.9 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.782-5.999-5.782zm0 10.366c-.927 0-1.802-.276-2.571-.78l-.184-.11-1.905.5 5.09-1.859-.12-.191c-.553-.879-.884-1.854-.883-2.826.001-2.534 2.062-4.594 4.597-4.594 2.536 0 4.597 2.061 4.597 4.596-.001 2.535-2.062 4.594-4.597 4.594z"/></svg>
        <span>Continuar y Enviar a WhatsApp</span>
      `;

      showToastNotification('✅ Lead registrado en CRM. Conectando por WhatsApp...');

      // Redirigir a WhatsApp oficial de Autohaus
      const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
      window.open(waUrl, '_blank');
    });
  }

  // Floating Toast Notification
  function showToastNotification(message) {
    let toast = document.getElementById('appToastFloating');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'appToastFloating';
      toast.style.cssText = 'position:fixed; bottom:25px; right:25px; background:#2252ab; color:#ffffff; border:2px solid #ffde59; border-radius:12px; padding:12px 20px; font-family:Poppins,sans-serif; font-size:0.88rem; font-weight:700; box-shadow:0 10px 30px rgba(0,0,0,0.4); z-index:9999; display:flex; align-items:center; gap:8px; transition:all 0.3s ease;';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
    }, 3500);
  }

  init();
});
