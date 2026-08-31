/**
 * Autohaus - Landing Page & Catálogo Comercial Interactivo
 * Incluye: Sistema de Favoritos (Likes ❤️), Perfil de Clientes y Embudo de Ventas WhatsApp
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
    flipbookPage: 1,
    currentUser: null,
    clientToken: localStorage.getItem('autohaus_client_token') || null,
    favorites: JSON.parse(localStorage.getItem('autohaus_client_favs') || '[]')
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
  const countFavorites = document.getElementById('countFavorites');

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

  // Client Auth Modal Elements
  const clientAuthModalOverlay = document.getElementById('clientAuthModalOverlay');
  const clientAuthModalCloseBtn = document.getElementById('clientAuthModalCloseBtn');
  const authTabLoginBtn = document.getElementById('authTabLoginBtn');
  const authTabRegisterBtn = document.getElementById('authTabRegisterBtn');
  const clientLoginForm = document.getElementById('clientLoginForm');
  const clientRegisterForm = document.getElementById('clientRegisterForm');
  const authAlertMessage = document.getElementById('authAlertMessage');
  const linkSwitchToRegister = document.getElementById('linkSwitchToRegister');
  const linkSwitchToLogin = document.getElementById('linkSwitchToLogin');
  const navUserContainer = document.getElementById('navUserContainer');

  // Initialize
  async function init() {
    await checkAuthSession();
    await loadVehicles();
    setupEventListeners();
    setupAuthEventListeners();
    updateFavoritesCounter();
    updateNavbarUserUI();
  }

  // ==========================================
  // AUTHENTICATION & USER SESSION (CLIENTS & STAFF)
  // ==========================================
  async function checkAuthSession() {
    const adminToken = localStorage.getItem('autohaus_admin_token');
    const clientToken = localStorage.getItem('autohaus_client_token');
    const token = clientToken || adminToken;

    if (!token) return;

    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.user) {
        state.currentUser = data.user;
        if (data.user.role === 'client') {
          state.clientToken = token;
          // Merge favorites
          if (Array.isArray(data.user.favorites) && data.user.favorites.length) {
            const merged = Array.from(new Set([...state.favorites, ...data.user.favorites]));
            state.favorites = merged;
            localStorage.setItem('autohaus_client_favs', JSON.stringify(state.favorites));
          }
        }
      }
    } catch (e) {
      console.warn('Session check error:', e);
    }
  }

  function updateNavbarUserUI() {
    if (!navUserContainer) return;

    if (!state.currentUser) {
      navUserContainer.innerHTML = `
        <button id="navLoginBtn" class="action-btn btn-admin-nav" onclick="window.appOpenClientAuthModal()" title="Iniciar sesión o crear cuenta para guardar favoritos">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <span id="navLoginBtnText">Iniciar Sesión</span>
        </button>
      `;
    } else if (state.currentUser.role === 'client') {
      const firstName = (state.currentUser.name || 'Cliente').split(' ')[0];
      navUserContainer.innerHTML = `
        <div class="client-profile-nav-wrap">
          <button class="action-btn btn-client-profile" onclick="window.appToggleUserDropdown(event)" title="Mi perfil de cliente">
            <span class="client-avatar-mini">${firstName.charAt(0).toUpperCase()}</span>
            <span>${firstName}</span>
            <span class="favs-pill-count">❤️ ${state.favorites.length}</span>
          </button>
          
          <div class="client-dropdown-menu" id="clientDropdownMenu">
            <div class="dropdown-header-user">
              <strong>${state.currentUser.name}</strong>
              <span>${state.currentUser.email}</span>
            </div>
            <button class="dropdown-item-btn" onclick="window.appFilterByFavorites()">
              <span>❤️ Mis Autos Favoritos (${state.favorites.length})</span>
            </button>
            <div style="border-top: 1px solid rgba(255,255,255,0.1); margin: 0.3rem 0;"></div>
            <button class="dropdown-item-btn item-logout" onclick="window.appClientLogout()">
              <span>Cerrar Sesión</span>
            </button>
          </div>
        </div>
      `;
    } else {
      // Staff (Admin / Vendedor / Secretaria)
      navUserContainer.innerHTML = `
        <a href="/admin" class="action-btn btn-admin-nav" title="Panel de Control Autohaus">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Panel Admin</span>
        </a>
      `;
    }
  }

  window.appToggleUserDropdown = (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('clientDropdownMenu');
    if (dropdown) dropdown.classList.toggle('active');
  };

  document.addEventListener('click', () => {
    const dropdown = document.getElementById('clientDropdownMenu');
    if (dropdown) dropdown.classList.remove('active');
  });

  window.appClientLogout = () => {
    localStorage.removeItem('autohaus_client_token');
    localStorage.removeItem('autohaus_client_user');
    state.currentUser = null;
    state.clientToken = null;
    updateNavbarUserUI();
    applyFilters();
  };

  // ==========================================
  // FAVORITES (LIKES ❤️) SYSTEM
  // ==========================================
  window.appToggleFavorite = async (pageNum) => {
    const p = parseInt(pageNum);
    const index = state.favorites.indexOf(p);
    let isAdded = false;

    if (index > -1) {
      state.favorites.splice(index, 1);
    } else {
      state.favorites.push(p);
      isAdded = true;
    }

    localStorage.setItem('autohaus_client_favs', JSON.stringify(state.favorites));
    updateFavoritesCounter();
    updateNavbarUserUI();

    // Visual pulse & update on the clicked heart
    const heartBtns = document.querySelectorAll(`.btn-fav-${p}`);
    heartBtns.forEach(btn => {
      if (isAdded) {
        btn.classList.add('is-favorited');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ef4444" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
      } else {
        btn.classList.remove('is-favorited');
        btn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="rgba(0,0,0,0.4)" stroke="#ffffff" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>`;
      }
    });

    // If currently filtered by favorites and removed, re-render
    if (state.selectedCategory === 'FAVORITOS') {
      applyFilters();
    }

    // Sync with cloud if logged in
    if (state.clientToken) {
      try {
        await fetch('/api/client/favorites', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${state.clientToken}`
          },
          body: JSON.stringify({ vehicle_page: p })
        });
      } catch (e) {
        console.warn('Error syncing favorites:', e);
      }
    }
  };

  function updateFavoritesCounter() {
    if (countFavorites) countFavorites.textContent = state.favorites.length;
  }

  window.appFilterByFavorites = () => {
    document.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
    const favPill = document.getElementById('catPillFavs');
    if (favPill) favPill.classList.add('active');

    state.selectedCategory = 'FAVORITOS';
    applyFilters();

    const invSection = document.getElementById('inventario');
    if (invSection) invSection.scrollIntoView({ behavior: 'smooth' });
  };

  window.appShowAllCars = () => {
    document.querySelectorAll('.cat-pill-btn').forEach(b => b.classList.remove('active'));
    const allBtn = document.querySelector('.cat-pill-btn[data-category="all"]');
    if (allBtn) allBtn.classList.add('active');
    state.selectedCategory = 'all';
    applyFilters();
  };

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
    updateFavoritesCounter();
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
        closeQuoteModal();
        closeClientAuthModal();
      }
    });
  }

  function applyFilters() {
    let list = [...state.vehicles];

    // 1. Category / Favorites Filter
    if (state.selectedCategory === 'FAVORITOS') {
      list = list.filter(v => state.favorites.includes(v.page));
    } else if (state.selectedCategory !== 'all') {
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
    renderVehicles();
  }

  function renderVehicles() {
    showingVehiclesCount.textContent = state.filteredVehicles.length;

    if (state.filteredVehicles.length === 0) {
      if (state.selectedCategory === 'FAVORITOS') {
        vehiclesGridContainer.innerHTML = `
          <div class="empty-favs-state" style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; background: rgba(19, 46, 96, 0.5); border: 1.5px dashed rgba(255, 222, 89, 0.4); border-radius: 20px;">
            <div style="font-size: 3rem; margin-bottom: 0.8rem;">❤️</div>
            <h3 style="font-family: var(--font-display); font-size: 1.4rem; color: #ffffff; margin-bottom: 0.5rem;">Aún no tienes autos en tu lista de favoritos</h3>
            <p style="color: #cbd5e1; font-size: 0.92rem; max-width: 480px; margin: 0 auto 1.5rem;">
              Explora nuestro catálogo y toca el corazón ❤️ en cualquier vehículo para guardarlo aquí y cotizarlo cuando gustes.
            </p>
            <button class="btn-hero-primary" onclick="window.appShowAllCars()" style="display: inline-flex; align-items: center; gap: 0.5rem;">
              <span>Explorar Todo el Inventario</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </button>
          </div>
        `;
      } else {
        vehiclesGridContainer.innerHTML = `
          <div class="no-results-box" style="grid-column: 1 / -1;">
            <div class="no-results-icon">🔍</div>
            <h3>No encontramos vehículos con esos criterios</h3>
            <p>Intenta con otra búsqueda o selecciona otra categoría.</p>
          </div>
        `;
      }
      return;
    }

    vehiclesGridContainer.innerHTML = state.filteredVehicles.map(v => {
      const coverPhoto = v.cover_photo || `assets/cars/page_${v.page}_img_2.jpeg`;
      const specsPreview = (v.specs || []).slice(0, 4);
      const isFav = state.favorites.includes(v.page);

      return `
        <div class="commercial-car-card" data-page="${v.page}">
          
          <!-- Photo Box -->
          <div class="card-photo-box" onclick="window.appOpenDetailModal(${v.page})">
            <img src="${coverPhoto}" alt="${v.brand} ${v.model}" class="card-car-img" loading="lazy" onerror="this.src='assets/svg/autohaus-tag.svg'" />
            <span class="card-category-badge">${v.category}</span>
            <span class="card-year-badge">${v.year}</span>

            <!-- Heart / Favorite Button -->
            <button class="btn-card-favorite btn-fav-${v.page} ${isFav ? 'is-favorited' : ''}" onclick="event.stopPropagation(); window.appToggleFavorite(${v.page})" title="${isFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${isFav ? '#ef4444' : 'rgba(0,0,0,0.4)'}" stroke="${isFav ? '#ef4444' : '#ffffff'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            </button>
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
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="10" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                Detalles
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

    modalCalcDownpayment.textContent = `$${downpayment.toLocaleString('es-MX')} MXN`;
    modalCalcMonthly.textContent = `$${monthlyPayment.toLocaleString('es-MX')} MXN`;

    modalWhatsAppBtn.onclick = (e) => {
      e.preventDefault();
      closeVehicleModal();
      window.appOpenQuoteModal(v.page);
    };

    vehicleDetailModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.appSwitchModalPhoto = (src, thumbElem) => {
    modalMainImg.src = src;
    document.querySelectorAll('.modal-thumb').forEach(t => t.classList.remove('active'));
    thumbElem.classList.add('active');
  };

  function closeVehicleModal() {
    vehicleDetailModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // ==========================================
  // CLIENT AUTH MODAL (LOGIN & REGISTRO)
  // ==========================================
  window.appOpenClientAuthModal = () => {
    if (clientAuthModalOverlay) {
      authAlertMessage.style.display = 'none';
      clientAuthModalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  function closeClientAuthModal() {
    if (clientAuthModalOverlay) {
      clientAuthModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  function setupAuthEventListeners() {
    if (clientAuthModalCloseBtn) clientAuthModalCloseBtn.addEventListener('click', closeClientAuthModal);
    if (clientAuthModalOverlay) {
      clientAuthModalOverlay.addEventListener('click', (e) => {
        if (e.target === clientAuthModalOverlay) closeClientAuthModal();
      });
    }

    // Switch to Register
    const showRegister = () => {
      authTabLoginBtn.classList.remove('active');
      authTabRegisterBtn.classList.add('active');
      clientLoginForm.classList.remove('active');
      clientRegisterForm.classList.add('active');
      authAlertMessage.style.display = 'none';
    };

    // Switch to Login
    const showLogin = () => {
      authTabRegisterBtn.classList.remove('active');
      authTabLoginBtn.classList.add('active');
      clientRegisterForm.classList.remove('active');
      clientLoginForm.classList.add('active');
      authAlertMessage.style.display = 'none';
    };

    if (authTabRegisterBtn) authTabRegisterBtn.addEventListener('click', showRegister);
    if (linkSwitchToRegister) linkSwitchToRegister.addEventListener('click', (e) => { e.preventDefault(); showRegister(); });
    if (authTabLoginBtn) authTabLoginBtn.addEventListener('click', showLogin);
    if (linkSwitchToLogin) linkSwitchToLogin.addEventListener('click', (e) => { e.preventDefault(); showLogin(); });

    // Client Login Handler
    if (clientLoginForm) {
      clientLoginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('clientLoginEmail').value.trim();
        const password = document.getElementById('clientLoginPassword').value.trim();
        const btn = document.getElementById('btnClientLogin');

        authAlertMessage.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<span>Verificando...</span>';

        try {
          const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
          });
          const data = await res.json();

          if (data.success) {
            // Check if Staff or Client
            if (data.user.role !== 'client') {
              localStorage.setItem('autohaus_admin_token', data.token);
              localStorage.setItem('autohaus_admin_user', JSON.stringify(data.user));
              window.location.href = '/admin';
              return;
            }

            // Client Login Success
            localStorage.setItem('autohaus_client_token', data.token);
            localStorage.setItem('autohaus_client_user', JSON.stringify(data.user));
            state.clientToken = data.token;
            state.currentUser = data.user;

            // Merge favorites
            if (Array.isArray(data.user.favorites) && data.user.favorites.length) {
              state.favorites = Array.from(new Set([...state.favorites, ...data.user.favorites]));
              localStorage.setItem('autohaus_client_favs', JSON.stringify(state.favorites));
            }

            closeClientAuthModal();
            updateFavoritesCounter();
            updateNavbarUserUI();
            renderVehicles();
          } else {
            authAlertMessage.textContent = data.message || 'Correo o contraseña incorrectos.';
            authAlertMessage.style.display = 'block';
          }
        } catch (err) {
          authAlertMessage.textContent = 'Error de conexión al iniciar sesión.';
          authAlertMessage.style.display = 'block';
        } finally {
          btn.disabled = false;
          btn.innerHTML = `
            <span>Ingresar a Mi Cuenta</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
          `;
        }
      });
    }

    // Client Registration Handler
    if (clientRegisterForm) {
      clientRegisterForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('clientRegName').value.trim();
        const email = document.getElementById('clientRegEmail').value.trim();
        const phone = document.getElementById('clientRegPhone').value.trim();
        const password = document.getElementById('clientRegPassword').value.trim();
        const btn = document.getElementById('btnClientRegister');

        authAlertMessage.style.display = 'none';
        btn.disabled = true;
        btn.innerHTML = '<span>Creando cuenta...</span>';

        try {
          const res = await fetch('/api/auth/register-client', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, phone, password })
          });
          const data = await res.json();

          if (data.success) {
            localStorage.setItem('autohaus_client_token', data.token);
            localStorage.setItem('autohaus_client_user', JSON.stringify(data.user));
            state.clientToken = data.token;
            state.currentUser = data.user;

            // Sync current favorites to new account
            if (state.favorites.length) {
              fetch('/api/client/favorites', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${data.token}`
                },
                body: JSON.stringify({ favorites: state.favorites })
              }).catch(console.warn);
            }

            closeClientAuthModal();
            updateFavoritesCounter();
            updateNavbarUserUI();
            renderVehicles();
          } else {
            authAlertMessage.textContent = data.message || 'Error al registrar la cuenta.';
            authAlertMessage.style.display = 'block';
          }
        } catch (err) {
          authAlertMessage.textContent = 'Error de conexión al crear cuenta.';
          authAlertMessage.style.display = 'block';
        } finally {
          btn.disabled = false;
          btn.innerHTML = `
            <span>Crear Cuenta y Guardar Favoritos</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          `;
        }
      });
    }
  }

  // ==========================================
  // MODAL DE COTIZACIÓN RÁPIDA / EMBUDO AUTOHAUS (WHATSAPP + CRM LEADS)
  // ==========================================
  const quoteModalOverlay = document.getElementById('quoteModalOverlay');
  const quoteModalCloseBtn = document.getElementById('quoteModalCloseBtn');
  const quoteLeadForm = document.getElementById('quoteLeadForm');
  const quoteVehiclePage = document.getElementById('quoteVehiclePage');
  const quoteVehicleName = document.getElementById('quoteVehicleName');
  const quoteModalVehicleTitle = document.getElementById('quoteModalVehicleTitle');
  const quoteModalVehiclePrice = document.getElementById('quoteModalVehiclePrice');
  const quoteModalVehicleFin = document.getElementById('quoteModalVehicleFin');
  const quotePlanSelect = document.getElementById('quotePlanSelect');
  const quoteClientName = document.getElementById('quoteClientName');
  const quoteClientPhone = document.getElementById('quoteClientPhone');

  window.appOpenQuoteModal = (pageNum, customTitle, customPrice, customFin) => {
    let carTitle = 'Vehículo de Interés';
    let carPrice = 'A consultar';
    let carFin = 'Planes desde 20%';
    let carPageVal = 0;

    if (pageNum) {
      const v = state.vehicles.find(item => item.page === pageNum);
      if (v) {
        carPageVal = v.page;
        carTitle = `${v.brand} ${v.model} ${v.year}`;
        carPrice = v.price_contado;
        carFin = v.price_financiado || 'Desde 20% enganche';
      }
    } else if (customTitle) {
      carTitle = customTitle;
      carPrice = customPrice || '';
      carFin = customFin || '';
    }

    if (quoteVehiclePage) quoteVehiclePage.value = carPageVal;
    if (quoteVehicleName) quoteVehicleName.value = carTitle;
    if (quoteModalVehicleTitle) quoteModalVehicleTitle.textContent = carTitle;
    if (quoteModalVehiclePrice) quoteModalVehiclePrice.textContent = carPrice;
    if (quoteModalVehicleFin) quoteModalVehicleFin.textContent = carFin;

    // Autofill with logged client info if available
    if (state.currentUser) {
      if (quoteClientName && !quoteClientName.value) quoteClientName.value = state.currentUser.name || '';
      if (quoteClientPhone && !quoteClientPhone.value) quoteClientPhone.value = state.currentUser.phone || '';
    }

    if (quoteModalOverlay) {
      quoteModalOverlay.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  };

  function closeQuoteModal() {
    if (quoteModalOverlay) {
      quoteModalOverlay.classList.remove('active');
      document.body.style.overflow = '';
    }
  }

  if (quoteModalCloseBtn) quoteModalCloseBtn.addEventListener('click', closeQuoteModal);
  if (quoteModalOverlay) {
    quoteModalOverlay.addEventListener('click', (e) => {
      if (e.target === quoteModalOverlay) closeQuoteModal();
    });
  }

  if (quoteLeadForm) {
    quoteLeadForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const pageNum = parseInt(quoteVehiclePage.value) || null;
      const vName = quoteVehicleName.value || 'Vehículo Autohaus';
      const cName = quoteClientName.value.trim();
      const cPhone = quoteClientPhone.value.trim();
      const planVal = quotePlanSelect.value;
      const notesVal = document.getElementById('quoteClientNotes').value.trim();
      const submitBtn = document.getElementById('btnSubmitQuote');

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Registrando solicitud...</span>';

      try {
        await fetch('/api/leads/public', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_name: cName,
            client_phone: cPhone,
            vehicle_page: pageNum,
            vehicle_name: vName,
            notes: `Plan: ${planVal}${notesVal ? ' | Mensaje: ' + notesVal : ''}`
          })
        });
      } catch (err) {
        console.warn('Lead capture error:', err);
      }

      // WhatsApp Redirect
      const officialPhone = '526143653015';
      const messageText = `Hola Autohaus, me interesa cotizar una unidad:%0A%0A` +
        `🚗 *Vehículo:* ${vName}%0A` +
        `👤 *Nombre:* ${cName}%0A` +
        `📱 *Teléfono:* ${cPhone}%0A` +
        `💳 *Plan de interés:* ${planVal}%0A` +
        (notesVal ? `📝 *Comentarios:* ${notesVal}%0A%0A` : `%0A`) +
        `¿Me podrían brindar más detalles y fotos?`;

      const whatsappUrl = `https://wa.me/${officialPhone}?text=${messageText}`;

      closeQuoteModal();
      submitBtn.disabled = false;
      submitBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.589 1.99.9 3.036.9 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.782-5.999-5.782zm0 10.366c-.927 0-1.802-.276-2.571-.78l-.184-.11-1.905.5 5.09-1.859-.12-.191c-.553-.879-.884-1.854-.883-2.826.001-2.534 2.062-4.594 4.597-4.594 2.536 0 4.597 2.061 4.597 4.596-.001 2.535-2.062 4.594-4.597 4.594z"/></svg>
        <span>Continuar y Enviar a WhatsApp</span>
      `;

      window.open(whatsappUrl, '_blank');
    });
  }

  // ==========================================
  // DIRECT PDF DOWNLOAD
  // ==========================================
  function downloadPDFCatalog() {
    const pdfUrl = '/api/catalog/download-pdf';
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'Catalogo_Autohaus_Chihuahua_2025.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================================
  // FLIPBOOK VISOR MODAL
  // ==========================================
  function openFlipbookModal() {
    if (!flipbookMagazineModal) return;
    flipbookViewerContainer.innerHTML = `
      <div style="text-align: center; color: #ffffff; padding: 2rem;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📖</div>
        <p style="font-size: 1rem; font-weight: 700;">Cargando visor digital...</p>
        <button class="btn-hero-primary" onclick="window.open('/assets/docs/Catalogo_Autohaus_Editorial_2025.pdf', '_blank')" style="margin-top: 1rem;">
          Abrir Catálogo Completo en Nueva Pestaña
        </button>
      </div>
    `;
    flipbookMagazineModal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeFlipbookModal() {
    if (!flipbookMagazineModal) return;
    flipbookMagazineModal.classList.remove('active');
    document.body.style.overflow = '';
  }

  // Run initialization
  init();
});
