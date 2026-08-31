/**
 * Panel Administrativo Autohaus - Lógica del Dashboard, Inventario & CRM de Leads
 */

document.addEventListener('DOMContentLoaded', () => {
  // State
  const state = {
    token: localStorage.getItem('autohaus_admin_token'),
    user: null,
    vehicles: [],
    filteredVehicles: [],
    leads: [],
    filteredLeads: [],
    activeTab: 'tabInventory',
    lastKnownNewLeadsCount: 0,
    inventoryFilters: {
      search: '',
      category: 'all',
      status: 'all'
    },
    leadsFilters: {
      search: '',
      sales: 'all',
      status: 'all'
    }
  };

  // 1. Auth Validation
  if (!state.token) {
    window.location.href = '/admin/login';
    return;
  }

  // DOM Elements: Header & User
  const userNameLabel = document.getElementById('userNameLabel');
  const userRoleBadge = document.getElementById('userRoleBadge');
  const userAvatarCircle = document.getElementById('userAvatarCircle');
  const logoutBtn = document.getElementById('logoutBtn');
  const exportBackupBtn = document.getElementById('exportBackupBtn');
  const headerNotificationWrap = document.getElementById('headerNotificationWrap');
  const notificationBellBtn = document.getElementById('notificationBellBtn');
  const notificationBadgeCount = document.getElementById('notificationBadgeCount');

  // Sales Alert Banner
  const salesNewLeadBanner = document.getElementById('salesNewLeadBanner');
  const alertBannerTitle = document.getElementById('alertBannerTitle');
  const alertBannerSubtitle = document.getElementById('alertBannerSubtitle');
  const viewNewLeadsBtn = document.getElementById('viewNewLeadsBtn');
  const dismissAlertBannerBtn = document.getElementById('dismissAlertBannerBtn');

  // Tabs
  const tabBtnInventory = document.getElementById('tabBtnInventory');
  const tabBtnLeads = document.getElementById('tabBtnLeads');
  const tabPaneInventory = document.getElementById('tabInventory');
  const tabPaneLeads = document.getElementById('tabLeads');
  const tabCountInventory = document.getElementById('tabCountInventory');
  const tabCountLeads = document.getElementById('tabCountLeads');
  const tabLeadsTitle = document.getElementById('tabLeadsTitle');

  // Stats Elements
  const statTotalVehicles = document.getElementById('statTotalVehicles');
  const statDisponibles = document.getElementById('statDisponibles');
  const statApartadosVendidos = document.getElementById('statApartadosVendidos');
  const statLeadsLabel = document.getElementById('statLeadsLabel');
  const statLeadsValue = document.getElementById('statLeadsValue');

  // Inventory Elements
  const adminSearchInput = document.getElementById('adminSearchInput');
  const adminCategoryFilter = document.getElementById('adminCategoryFilter');
  const adminStatusFilter = document.getElementById('adminStatusFilter');
  const inventoryTableBody = document.getElementById('inventoryTableBody');
  const openCreateModalBtn = document.getElementById('openCreateModalBtn');

  // Leads Elements
  const leadsSearchInput = document.getElementById('leadsSearchInput');
  const leadsSalesFilter = document.getElementById('leadsSalesFilter');
  const leadsStatusFilter = document.getElementById('leadsStatusFilter');
  const leadsTableBody = document.getElementById('leadsTableBody');
  const openCreateLeadModalBtn = document.getElementById('openCreateLeadModalBtn');

  // Modal 1: Vehicle Form
  const vehicleFormModal = document.getElementById('vehicleFormModal');
  const closeVehicleModalBtn = document.getElementById('closeVehicleModalBtn');
  const cancelFormBtn = document.getElementById('cancelFormBtn');
  const vehicleForm = document.getElementById('vehicleForm');
  const modalFormTitle = document.getElementById('modalFormTitle');
  const editPageNumInput = document.getElementById('editPageNum');
  const coverPhotoFile = document.getElementById('coverPhotoFile');
  const coverPhotoPreview = document.getElementById('coverPhotoPreview');
  const galleryPhotosFiles = document.getElementById('galleryPhotosFiles');
  const galleryPhotosPreview = document.getElementById('galleryPhotosPreview');

  // Modal 2: Lead Form
  const leadFormModal = document.getElementById('leadFormModal');
  const closeLeadModalBtn = document.getElementById('closeLeadModalBtn');
  const cancelLeadBtn = document.getElementById('cancelLeadBtn');
  const leadForm = document.getElementById('leadForm');
  const leadModalTitle = document.getElementById('leadModalTitle');
  const editLeadId = document.getElementById('editLeadId');
  const leadVehicleSelect = document.getElementById('leadVehicleSelect');
  const leadAssignedSelect = document.getElementById('leadAssignedSelect');

  // Toast
  const toastContainer = document.getElementById('toastContainer');

  // Initialize
  async function init() {
    await verifyUser();
    setupEventListeners();
    await loadDashboardData();
    
    // Live Polling every 12s for real-time lead alerts
    setInterval(loadDashboardData, 12000);
  }

  // 1. Verify Session Token & Configure Role Permissions
  async function verifyUser() {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error('Invalid token');
      }
      state.user = data.user;
      
      // Update UI for User Info (Desktop & Mobile Drawer)
      if (userNameLabel) userNameLabel.textContent = data.user.name || data.user.email;
      if (userAvatarCircle) userAvatarCircle.textContent = (data.user.name || 'U').charAt(0).toUpperCase();
      
      const drawerUserName = document.getElementById('drawerUserName');
      const drawerUserAvatar = document.getElementById('drawerUserAvatar');
      const drawerUserRole = document.getElementById('drawerUserRole');
      if (drawerUserName) drawerUserName.textContent = data.user.name || data.user.email;
      if (drawerUserAvatar) drawerUserAvatar.textContent = (data.user.name || 'U').charAt(0).toUpperCase();

      // Configure Role Badge & UI
      if (data.user.role === 'admin') {
        userRoleBadge.textContent = 'ADMIN';
        userRoleBadge.className = 'badge-role role-admin';
        if (drawerUserRole) {
          drawerUserRole.textContent = 'ADMINISTRADOR';
          drawerUserRole.className = 'badge-role role-admin';
        }
        tabLeadsTitle.textContent = 'Asignación de Leads (CRM)';
      } else if (data.user.role === 'secretary') {
        userRoleBadge.textContent = 'SECRETARIA';
        userRoleBadge.className = 'badge-role role-secretary';
        if (drawerUserRole) {
          drawerUserRole.textContent = 'SECRETARIA (ALICE)';
          drawerUserRole.className = 'badge-role role-secretary';
        }
        tabBtnLeads.style.display = 'none';
        tabLeadsTitle.textContent = 'Leads (Oculto)';
      } else if (data.user.role === 'sales') {
        userRoleBadge.textContent = `VENDEDOR: ${data.user.name.split(' ')[0]}`;
        userRoleBadge.className = 'badge-role role-sales';
        if (drawerUserRole) {
          drawerUserRole.textContent = `VENDEDOR: ${data.user.name}`;
          drawerUserRole.className = 'badge-role role-sales';
        }
        tabLeadsTitle.textContent = 'Mis Leads Asignados';
        statLeadsLabel.textContent = 'Mis Leads Activos';
        // Hide Admin-only buttons
        if (openCreateModalBtn) openCreateModalBtn.style.display = 'none';
        if (exportBackupBtn) exportBackupBtn.style.display = 'none';
        const drawerExportBtn = document.getElementById('drawerExportBackupBtn');
        if (drawerExportBtn) drawerExportBtn.style.display = 'none';
        if (openCreateLeadModalBtn) openCreateLeadModalBtn.style.display = 'none';
        if (leadsSalesFilter) leadsSalesFilter.style.display = 'none';
      }
    } catch (e) {
      localStorage.removeItem('autohaus_admin_token');
      localStorage.removeItem('autohaus_admin_user');
      window.location.href = '/admin/login';
    }
  }

  // 2. Load Vehicles, Leads & Stats
  async function loadDashboardData() {
    try {
      // 1. Stats
      const resStats = await fetch('/api/stats');
      const dataStats = await resStats.json();
      if (dataStats.success) {
        statTotalVehicles.textContent = dataStats.totalVehicles;
        statDisponibles.textContent = dataStats.disponiblesCount;
        statApartadosVendidos.textContent = `${dataStats.apartadosCount} / ${dataStats.vendidosCount}`;
        statLeadsValue.textContent = dataStats.totalLeads;
      }

      // 2. Vehicles
      const resVeh = await fetch('/api/vehicles');
      const dataVeh = await resVeh.json();
      if (dataVeh.success) {
        state.vehicles = dataVeh.data;
        tabCountInventory.textContent = state.vehicles.length;
        populateVehicleSelect(state.vehicles);
        applyInventoryFilters();
      }

      // 3. Leads (if not secretary)
      if (state.user && state.user.role !== 'secretary') {
        const resLeads = await fetch('/api/leads', {
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const dataLeads = await resLeads.json();
        if (dataLeads.success) {
          state.leads = dataLeads.data;
          
          if (state.user.role === 'sales') {
            checkSalesNewLeadsAlert(state.leads);
            statLeadsValue.textContent = state.leads.length;
          } else {
            tabCountLeads.textContent = state.leads.length;
            await updateRoundRobinTurnBadge();
          }

          applyLeadsFilters();
        }
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    }
  }

  // Update Round-Robin Next Turn Indicator in UI
  async function updateRoundRobinTurnBadge() {
    try {
      const res = await fetch('/api/leads/next-turn', {
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const data = await res.json();
      if (data.success && data.nextSalesperson) {
        const badge = document.getElementById('nextSalespersonBadge');
        if (badge) {
          badge.textContent = `${data.nextSalesperson.name} (${data.nextSalesperson.email})`;
        }
      }
    } catch (e) {
      console.error('Error fetching round robin turn:', e);
    }
  }

  // 3. Check and Show New Lead Alerts for Sales Reps
  function checkSalesNewLeadsAlert(leads) {
    if (!state.user || state.user.role !== 'sales') return;

    const newLeads = leads.filter(l => l.status === 'nuevo');
    const newCount = newLeads.length;

    // Pulse notification in Tab
    if (newCount > 0) {
      tabCountLeads.innerHTML = `⭐ ${newCount} NUEVO${newCount > 1 ? 'S' : ''}`;
      tabCountLeads.style.background = '#ef4444';
      tabCountLeads.style.color = '#ffffff';
      
      // Header Notification Bell
      if (headerNotificationWrap) headerNotificationWrap.style.display = 'block';
      if (notificationBadgeCount) notificationBadgeCount.textContent = newCount;

      // Banner Alert
      if (salesNewLeadBanner) {
        salesNewLeadBanner.style.display = 'flex';
        const firstName = state.user.name.split(' ')[0];
        alertBannerTitle.textContent = `¡Atención ${firstName}! Tienes ${newCount} nuevo${newCount > 1 ? 's' : ''} lead${newCount > 1 ? 's' : ''} por contactar`;
        alertBannerSubtitle.textContent = `Último cliente: ${newLeads[0].client_name} (${newLeads[0].client_phone}) interesado en ${newLeads[0].vehicle_name}`;
      }

      // If count increased during session, trigger a toast
      if (newCount > state.lastKnownNewLeadsCount && state.lastKnownNewLeadsCount > 0) {
        showToast(`🔔 ¡Nuevo Lead Asignado! ${newLeads[0].client_name} - ${newLeads[0].vehicle_name}`, 'success');
      }
    } else {
      tabCountLeads.textContent = leads.length;
      tabCountLeads.style.background = 'rgba(0, 0, 0, 0.2)';
      tabCountLeads.style.color = '';
      if (salesNewLeadBanner) salesNewLeadBanner.style.display = 'none';
      if (headerNotificationWrap) headerNotificationWrap.style.display = 'none';
    }

    state.lastKnownNewLeadsCount = newCount;
  }

  // Populate Vehicle Dropdown inside Lead Modal
  function populateVehicleSelect(vehicles) {
    if (!leadVehicleSelect) return;
    leadVehicleSelect.innerHTML = '<option value="">-- Seleccionar Vehículo del Inventario --</option>';
    vehicles.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.page;
      opt.textContent = `Pág. ${v.page} | ${v.brand} ${v.model} (${v.year}) - ${v.price_contado}`;
      leadVehicleSelect.appendChild(opt);
    });
  }

  // 4. Event Listeners
  function setupEventListeners() {
    // Tabs Navigation
    tabBtnInventory.addEventListener('click', () => switchTab('tabInventory'));
    tabBtnLeads.addEventListener('click', () => switchTab('tabLeads'));

    // Notification Bell & Alert Banner Action
    if (notificationBellBtn) {
      notificationBellBtn.addEventListener('click', () => {
        switchTab('tabLeads');
        if (leadsStatusFilter) {
          leadsStatusFilter.value = 'nuevo';
          state.leadsFilters.status = 'nuevo';
          applyLeadsFilters();
        }
      });
    }

    if (viewNewLeadsBtn) {
      viewNewLeadsBtn.addEventListener('click', () => {
        switchTab('tabLeads');
        if (leadsStatusFilter) {
          leadsStatusFilter.value = 'nuevo';
          state.leadsFilters.status = 'nuevo';
          applyLeadsFilters();
        }
      });
    }

    if (dismissAlertBannerBtn) {
      dismissAlertBannerBtn.addEventListener('click', () => {
        if (salesNewLeadBanner) salesNewLeadBanner.style.display = 'none';
      });
    }

    // Logout (Desktop & Drawer)
    function handleLogout() {
      if (confirm('¿Deseas cerrar sesión en el panel?')) {
        localStorage.removeItem('autohaus_admin_token');
        localStorage.removeItem('autohaus_admin_user');
        window.location.href = '/admin/login';
      }
    }
    logoutBtn.addEventListener('click', handleLogout);
    const drawerLogoutBtn = document.getElementById('drawerLogoutBtn');
    if (drawerLogoutBtn) drawerLogoutBtn.addEventListener('click', handleLogout);

    // Mobile Drawer Toggle & Close
    const mobileMenuToggleBtn = document.getElementById('mobileMenuToggleBtn');
    const mobileDrawerOverlay = document.getElementById('mobileDrawerOverlay');
    const mobileDrawerCloseBtn = document.getElementById('mobileDrawerCloseBtn');

    if (mobileMenuToggleBtn && mobileDrawerOverlay) {
      mobileMenuToggleBtn.addEventListener('click', () => {
        mobileDrawerOverlay.classList.add('active');
      });
    }

    if (mobileDrawerCloseBtn && mobileDrawerOverlay) {
      mobileDrawerCloseBtn.addEventListener('click', () => {
        mobileDrawerOverlay.classList.remove('active');
      });
    }

    if (mobileDrawerOverlay) {
      mobileDrawerOverlay.addEventListener('click', (e) => {
        if (e.target === mobileDrawerOverlay) {
          mobileDrawerOverlay.classList.remove('active');
        }
      });
    }

    // Export Backup (Desktop & Drawer)
    function handleExportBackup() {
      window.open('/api/export', '_blank');
      showToast('Descargando copia de seguridad JSON...', 'success');
      if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('active');
    }
    if (exportBackupBtn) exportBackupBtn.addEventListener('click', handleExportBackup);
    const drawerExportBackupBtn = document.getElementById('drawerExportBackupBtn');
    if (drawerExportBackupBtn) drawerExportBackupBtn.addEventListener('click', handleExportBackup);

    // Regenerate Editorial PDF (Desktop & Drawer)
    async function handleRegeneratePdf() {
      try {
        if (mobileDrawerOverlay) mobileDrawerOverlay.classList.remove('active');
        showToast('Compilando catálogo editorial en PDF...', 'success');

        const res = await fetch('/api/catalog/regenerate-pdf', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success) {
          showToast(data.message, 'success');
        } else {
          showToast(data.message || 'Error al generar PDF', 'error');
        }
      } catch (e) {
        showToast('Error de conexión al regenerar PDF', 'error');
      }
    }
    const regeneratePdfBtn = document.getElementById('regeneratePdfBtn');
    if (regeneratePdfBtn) regeneratePdfBtn.addEventListener('click', handleRegeneratePdf);
    const drawerRegeneratePdfBtn = document.getElementById('drawerRegeneratePdfBtn');
    if (drawerRegeneratePdfBtn) drawerRegeneratePdfBtn.addEventListener('click', handleRegeneratePdf);

    // Inventory Search & Filters
    adminSearchInput.addEventListener('input', (e) => {
      state.inventoryFilters.search = e.target.value.toLowerCase().trim();
      applyInventoryFilters();
    });

    adminCategoryFilter.addEventListener('change', (e) => {
      state.inventoryFilters.category = e.target.value;
      applyInventoryFilters();
    });

    adminStatusFilter.addEventListener('change', (e) => {
      state.inventoryFilters.status = e.target.value;
      applyInventoryFilters();
    });

    // Leads Search & Filters
    if (leadsSearchInput) {
      leadsSearchInput.addEventListener('input', (e) => {
        state.leadsFilters.search = e.target.value.toLowerCase().trim();
        applyLeadsFilters();
      });
    }

    if (leadsSalesFilter) {
      leadsSalesFilter.addEventListener('change', (e) => {
        state.leadsFilters.sales = e.target.value;
        applyLeadsFilters();
      });
    }

    if (leadsStatusFilter) {
      leadsStatusFilter.addEventListener('change', (e) => {
        state.leadsFilters.status = e.target.value;
        applyLeadsFilters();
      });
    }

    // Modals: Vehicle
    if (openCreateModalBtn) {
      openCreateModalBtn.addEventListener('click', () => openVehicleModal());
    }
    if (closeVehicleModalBtn) {
      closeVehicleModalBtn.addEventListener('click', () => closeVehicleModal());
    }
    if (cancelFormBtn) {
      cancelFormBtn.addEventListener('click', () => closeVehicleModal());
    }
    if (vehicleForm) {
      vehicleForm.addEventListener('submit', handleVehicleFormSubmit);
    }

    // Modals: Lead
    if (openCreateLeadModalBtn) {
      openCreateLeadModalBtn.addEventListener('click', () => openLeadModal());
    }
    if (closeLeadModalBtn) {
      closeLeadModalBtn.addEventListener('click', () => closeLeadModal());
    }
    if (cancelLeadBtn) {
      cancelLeadBtn.addEventListener('click', () => closeLeadModal());
    }
    if (leadForm) {
      leadForm.addEventListener('submit', handleLeadFormSubmit);
    }

    // Image Upload Previews
    setupImageDropzone('coverDropzone', 'coverPhotoFile', 'coverPhotoPreview', false);
    setupImageDropzone('galleryDropzone', 'galleryPhotosFiles', 'galleryPhotosPreview', true);
  }

  // Switch Tab
  function switchTab(tabId) {
    state.activeTab = tabId;
    tabBtnInventory.classList.toggle('active', tabId === 'tabInventory');
    tabBtnLeads.classList.toggle('active', tabId === 'tabLeads');
    tabPaneInventory.classList.toggle('active', tabId === 'tabInventory');
    tabPaneLeads.classList.toggle('active', tabId === 'tabLeads');
  }

  // ==========================================
  // INVENTORY TABLE & ACTIONS
  // ==========================================

  function applyInventoryFilters() {
    state.filteredVehicles = state.vehicles.filter(v => {
      const q = state.inventoryFilters.search;
      const matchSearch = !q || 
        (v.brand && v.brand.toLowerCase().includes(q)) ||
        (v.model && v.model.toLowerCase().includes(q)) ||
        (v.year && v.year.toString().includes(q)) ||
        (v.price_contado && v.price_contado.toLowerCase().includes(q)) ||
        (v.page && v.page.toString() === q);

      const matchCat = state.inventoryFilters.category === 'all' || v.category === state.inventoryFilters.category;
      
      const vStatus = v.status || 'disponible';
      const matchStatus = state.inventoryFilters.status === 'all' || vStatus === state.inventoryFilters.status;

      return matchSearch && matchCat && matchStatus;
    });

    renderInventoryTable();
  }

  function renderInventoryTable() {
    inventoryTableBody.innerHTML = '';

    if (state.filteredVehicles.length === 0) {
      inventoryTableBody.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
            No se encontraron vehículos que coincidan con la búsqueda.
          </td>
        </tr>
      `;
      return;
    }

    const isSales = state.user.role === 'sales';
    const canManage = state.user.role === 'admin' || state.user.role === 'secretary';

    state.filteredVehicles.forEach(car => {
      const tr = document.createElement('tr');
      const carStatus = car.status || 'disponible';

      // Status selector or badge
      let statusHtml = '';
      if (canManage) {
        statusHtml = `
          <select class="status-pill-select status-${carStatus}" onchange="window.handleStatusChange(${car.page}, this.value)">
            <option value="disponible" ${carStatus === 'disponible' ? 'selected' : ''}>🟢 Disponible</option>
            <option value="apartado" ${carStatus === 'apartado' ? 'selected' : ''}>🟡 Apartado</option>
            <option value="vendido" ${carStatus === 'vendido' ? 'selected' : ''}>🔴 Vendido</option>
          </select>
        `;
      } else {
        const labels = { disponible: '🟢 Disponible', apartado: '🟡 Apartado', vendido: '🔴 Vendido' };
        statusHtml = `<span class="status-pill-select status-${carStatus}">${labels[carStatus] || '🟢 Disponible'}</span>`;
      }

      // Actions based on role
      let actionsHtml = '';
      if (canManage) {
        actionsHtml = `
          <div class="table-actions">
            <!-- Edit -->
            <button class="btn-action-icon" title="Editar vehículo" onclick="window.editVehicle(${car.page})">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            </button>
            <!-- Delete -->
            <button class="btn-action-icon btn-delete" title="Quitar del catálogo" onclick="window.deleteVehicle(${car.page}, '${car.brand} ${car.model}')">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
            </button>
          </div>
        `;
      } else if (isSales) {
        const shareText = encodeURIComponent(`Hola! Te comparto los detalles del ${car.brand} ${car.model} (${car.year}) en Autohaus Chihuahua. Precio de contado: ${car.price_contado}. Más info aquí: http://localhost:8080`);
        actionsHtml = `
          <div class="table-actions">
            <!-- Cotizar / Share WhatsApp -->
            <a href="https://wa.me/?text=${shareText}" target="_blank" class="btn-action-icon btn-whatsapp-lead" title="Compartir Ficha por WhatsApp">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.589 1.99.9 3.036.9 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.782-5.999-5.782zm0 10.366c-.927 0-1.802-.276-2.571-.78l-.184-.11-1.905.5 5.09-1.859-.12-.191c-.553-.879-.884-1.854-.883-2.826.001-2.534 2.062-4.594 4.597-4.594 2.536 0 4.597 2.061 4.597 4.596-.001 2.535-2.062 4.594-4.597 4.594z"/></svg>
            </a>
          </div>
        `;
      }

      tr.innerHTML = `
        <td style="font-weight: 800; color: #94a3b8;">${car.page}</td>
        <td>
          <img src="../${car.cover_photo || car.main_photo || 'assets/svg/autohaus-tag.svg'}" alt="Foto" class="car-thumb-preview" onerror="this.src='../assets/svg/autohaus-tag.svg'" />
        </td>
        <td>
          <div class="car-brand-title">${car.brand}</div>
          <div class="car-model-title">${car.model}</div>
        </td>
        <td style="font-weight: 700;">${car.year}</td>
        <td><span class="badge-category">${car.category}</span></td>
        <td>${statusHtml}</td>
        <td class="price-contado-cell">${car.price_contado || '$0'}</td>
        <td><span class="price-financiado-badge">${car.price_financiado || 'N/A'}</span></td>
        <td style="text-align: center;">${actionsHtml}</td>
      `;

      inventoryTableBody.appendChild(tr);
    });
  }

  // Handle Quick Status Change
  window.handleStatusChange = async function(page, newStatus) {
    try {
      const res = await fetch(`/api/vehicles/${page}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        await loadDashboardData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Error al actualizar estado', 'error');
    }
  };

  // ==========================================
  // LEADS CRM TABLE & ACTIONS
  // ==========================================

  function applyLeadsFilters() {
    state.filteredLeads = state.leads.filter(l => {
      const q = state.leadsFilters.search;
      const matchSearch = !q ||
        (l.client_name && l.client_name.toLowerCase().includes(q)) ||
        (l.client_phone && l.client_phone.includes(q)) ||
        (l.vehicle_name && l.vehicle_name.toLowerCase().includes(q)) ||
        (l.notes && l.notes.toLowerCase().includes(q));

      const matchSales = state.leadsFilters.sales === 'all' || (l.assigned_to && l.assigned_to.toLowerCase() === state.leadsFilters.sales.toLowerCase());
      const matchStatus = state.leadsFilters.status === 'all' || l.status === state.leadsFilters.status;

      return matchSearch && matchSales && matchStatus;
    });

    renderLeadsTable();
  }

  function renderLeadsTable() {
    leadsTableBody.innerHTML = '';

    if (state.filteredLeads.length === 0) {
      leadsTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
            No hay prospectos / leads registrados en esta sección.
          </td>
        </tr>
      `;
      return;
    }

    const isAdmin = state.user.role === 'admin';

    state.filteredLeads.forEach(lead => {
      const tr = document.createElement('tr');
      const leadStatus = lead.status || 'nuevo';
      
      // Highlight row if new
      if (leadStatus === 'nuevo') {
        tr.classList.add('row-new-lead');
      }

      // WhatsApp direct link
      const cleanPhone = (lead.client_phone || '').replace(/[^0-9]/g, '');
      const phoneFormatted = cleanPhone.length === 10 ? `52${cleanPhone}` : cleanPhone;
      const waMsg = encodeURIComponent(`Hola ${lead.client_name}, te saluda ${lead.assigned_name || 'tu asesor'} de Autohaus Chihuahua respecto a tu interés en el ${lead.vehicle_name || 'auto'}. ¿Cómo estás?`);
      const waUrl = `https://wa.me/${phoneFormatted}?text=${waMsg}`;

      // Status selector for quick follow-up
      const statusSelector = `
        <select class="status-pill-select lead-status-${leadStatus}" onchange="window.updateLeadStatus('${lead.id}', this.value)">
          <option value="nuevo" ${leadStatus === 'nuevo' ? 'selected' : ''}>⭐ Nuevo</option>
          <option value="contactado" ${leadStatus === 'contactado' ? 'selected' : ''}>📞 Contactado</option>
          <option value="cita" ${leadStatus === 'cita' ? 'selected' : ''}>🗓️ En Cita</option>
          <option value="vendido" ${leadStatus === 'vendido' ? 'selected' : ''}>🏆 Vendido</option>
          <option value="descartado" ${leadStatus === 'descartado' ? 'selected' : ''}>❌ Descartado</option>
        </select>
      `;

      let actionsHtml = `
        <div class="table-actions">
          <!-- WhatsApp Client -->
          <a href="${waUrl}" target="_blank" class="btn-action-icon btn-whatsapp-lead" title="Chatear con el cliente por WhatsApp">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.711 2.592 2.654-.697c1.002.589 1.99.9 3.036.9 3.182 0 5.768-2.587 5.769-5.766.001-3.182-2.585-5.782-5.999-5.782zm0 10.366c-.927 0-1.802-.276-2.571-.78l-.184-.11-1.905.5 5.09-1.859-.12-.191c-.553-.879-.884-1.854-.883-2.826.001-2.534 2.062-4.594 4.597-4.594 2.536 0 4.597 2.061 4.597 4.596-.001 2.535-2.062 4.594-4.597 4.594z"/></svg>
          </a>
          <!-- Edit Lead Note -->
          <button class="btn-action-icon" title="Editar notas o reasignar" onclick="window.editLead('${lead.id}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
      `;

      if (isAdmin) {
        actionsHtml += `
          <!-- Delete Lead -->
          <button class="btn-action-icon btn-delete" title="Eliminar lead" onclick="window.deleteLead('${lead.id}', '${lead.client_name}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        `;
      }

      actionsHtml += `</div>`;

      tr.innerHTML = `
        <td>
          <div style="font-weight: 800; color: #ffffff;">${lead.client_name} ${leadStatus === 'nuevo' ? '<span class="notification-badge-pulse" style="display:inline-flex; position:static; font-size:0.6rem; vertical-align:middle; margin-left:4px;">NUEVO</span>' : ''}</div>
          <div style="font-size: 0.74rem; color: #94a3b8;">${lead.client_email || 'Sin correo'}</div>
        </td>
        <td>
          <a href="${waUrl}" target="_blank" style="color: var(--brand-yellow); font-weight: 700; text-decoration: none;">
            📱 ${lead.client_phone}
          </a>
        </td>
        <td style="font-weight: 700; color: #cbd5e1;">${lead.vehicle_name || 'Interés General'}</td>
        <td>
          <span style="background: rgba(59, 130, 246, 0.25); color: #93c5fd; border: 1px solid #3b82f6; padding: 0.2rem 0.6rem; border-radius: 12px; font-weight: 800; font-size: 0.74rem;">
            👤 ${lead.assigned_name || lead.assigned_to}
          </span>
        </td>
        <td>${statusSelector}</td>
        <td style="max-width: 250px; font-size: 0.78rem; color: #cbd5e1; line-height: 1.4;">
          ${lead.notes ? `"${lead.notes}"` : '<span style="color: #64748b;">Sin notas</span>'}
        </td>
        <td style="text-align: center;">${actionsHtml}</td>
      `;

      leadsTableBody.appendChild(tr);
    });
  }

  // Quick Update Lead Status
  window.updateLeadStatus = async function(leadId, newStatus) {
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Lead actualizado a: ${newStatus.toUpperCase()}`, 'success');
        await loadDashboardData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Error al actualizar estado del lead', 'error');
    }
  };

  // ==========================================
  // MODAL HANDLERS: VEHICLES
  // ==========================================

  function openVehicleModal(carData = null) {
    vehicleForm.reset();
    coverPhotoPreview.innerHTML = '';
    galleryPhotosPreview.innerHTML = '';

    if (carData) {
      modalFormTitle.textContent = `Editar Vehículo: ${carData.brand} ${carData.model}`;
      editPageNumInput.value = carData.page;
      document.getElementById('carBrandInput').value = carData.brand || '';
      document.getElementById('carModelInput').value = carData.model || '';
      document.getElementById('carYearInput').value = carData.year || new Date().getFullYear();
      document.getElementById('carCategoryInput').value = carData.category || 'SEDAN & HATCHBACK';
      document.getElementById('carStatusInput').value = carData.status || 'disponible';
      document.getElementById('carPriceContadoInput').value = carData.price_contado || '';
      document.getElementById('carPriceFinanciadoInput').value = carData.price_financiado || '';
      document.getElementById('carSpecsInput').value = (carData.specs || []).join('\n');

      if (carData.cover_photo || carData.main_photo) {
        coverPhotoPreview.innerHTML = `
          <div class="upload-preview-item">
            <img src="../${carData.cover_photo || carData.main_photo}" />
          </div>
        `;
      }
    } else {
      modalFormTitle.textContent = 'Agregar Nuevo Vehículo al Catálogo';
      editPageNumInput.value = '';
      document.getElementById('carYearInput').value = new Date().getFullYear();
    }

    vehicleFormModal.classList.add('active');
  }

  function closeVehicleModal() {
    vehicleFormModal.classList.remove('active');
  }

  async function handleVehicleFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveVehicleBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      const formData = new FormData(vehicleForm);
      const isEdit = !!editPageNumInput.value;
      const url = isEdit ? `/api/vehicles/${editPageNumInput.value}` : '/api/vehicles';
      const method = isEdit ? 'PUT' : 'POST';

      formData.append('brand', document.getElementById('carBrandInput').value);
      formData.append('model', document.getElementById('carModelInput').value);
      formData.append('year', document.getElementById('carYearInput').value);
      formData.append('category', document.getElementById('carCategoryInput').value);
      formData.append('status', document.getElementById('carStatusInput').value);
      formData.append('price_contado', document.getElementById('carPriceContadoInput').value);
      formData.append('price_financiado', document.getElementById('carPriceFinanciadoInput').value);
      
      const specsRaw = document.getElementById('carSpecsInput').value.split('\n').map(s => s.trim()).filter(Boolean);
      formData.append('specs', JSON.stringify(specsRaw));

      const res = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${state.token}` },
        body: formData
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        closeVehicleModal();
        await loadDashboardData();
      } else {
        showToast(data.message || 'Error al guardar', 'error');
      }
    } catch (err) {
      showToast('Error de conexión al servidor', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar Vehículo';
    }
  }

  window.editVehicle = function(page) {
    const car = state.vehicles.find(v => v.page === page);
    if (car) openVehicleModal(car);
  };

  window.deleteVehicle = async function(page, name) {
    if (!confirm(`¿Estás seguro de eliminar "${name}" del catálogo? Esta acción no se puede deshacer.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/vehicles/${page}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        await loadDashboardData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Error al eliminar vehículo', 'error');
    }
  };

  // ==========================================
  // MODAL HANDLERS: LEADS (CRM)
  // ==========================================

  async function openLeadModal(leadData = null) {
    leadForm.reset();
    if (leadData) {
      leadModalTitle.textContent = `Editar Lead: ${leadData.client_name}`;
      editLeadId.value = leadData.id;
      document.getElementById('leadClientName').value = leadData.client_name || '';
      document.getElementById('leadClientPhone').value = leadData.client_phone || '';
      document.getElementById('leadClientEmail').value = leadData.client_email || '';
      document.getElementById('leadVehicleSelect').value = leadData.vehicle_page || '';
      document.getElementById('leadAssignedSelect').value = leadData.assigned_to || 'napo@autohaus.mx';
      document.getElementById('leadStatusSelect').value = leadData.status || 'nuevo';
      document.getElementById('leadNotes').value = leadData.notes || '';
    } else {
      leadModalTitle.textContent = 'Asignar Nuevo Lead (Turno Automático 1 a 1)';
      editLeadId.value = '';
      
      // Fetch who is next in turn to display in the select option
      try {
        const res = await fetch('/api/leads/next-turn', {
          headers: { 'Authorization': `Bearer ${state.token}` }
        });
        const data = await res.json();
        if (data.success && data.nextSalesperson) {
          const autoOpt = leadAssignedSelect.querySelector('option[value="auto"]');
          if (autoOpt) {
            autoOpt.textContent = `🔄 Automático (Siguiente en turno: ${data.nextSalesperson.name})`;
            leadAssignedSelect.value = 'auto';
          }
        }
      } catch (e) {
        console.error('Error fetching turn:', e);
      }
    }
    leadFormModal.classList.add('active');
  }

  function closeLeadModal() {
    leadFormModal.classList.remove('active');
  }

  async function handleLeadFormSubmit(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('saveLeadBtn');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      const isEdit = !!editLeadId.value;
      const url = isEdit ? `/api/leads/${editLeadId.value}` : '/api/leads';
      const method = isEdit ? 'PUT' : 'POST';

      const assignedSelect = document.getElementById('leadAssignedSelect');
      const assignedName = assignedSelect.options[assignedSelect.selectedIndex].text;

      const vehicleSelect = document.getElementById('leadVehicleSelect');
      const vehicleName = vehicleSelect.value ? vehicleSelect.options[vehicleSelect.selectedIndex].text : 'Interés General';

      const payload = {
        client_name: document.getElementById('leadClientName').value,
        client_phone: document.getElementById('leadClientPhone').value,
        client_email: document.getElementById('leadClientEmail').value,
        vehicle_page: vehicleSelect.value || null,
        vehicle_name: vehicleName,
        assigned_to: assignedSelect.value,
        assigned_name: assignedName,
        status: document.getElementById('leadStatusSelect').value,
        notes: document.getElementById('leadNotes').value
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${state.token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        closeLeadModal();
        await loadDashboardData();
      } else {
        showToast(data.message || 'Error al guardar lead', 'error');
      }
    } catch (e) {
      showToast('Error de conexión', 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = 'Guardar y Asignar Lead';
    }
  }

  window.editLead = function(leadId) {
    const lead = state.leads.find(l => l.id === leadId);
    if (lead) openLeadModal(lead);
  };

  window.deleteLead = async function(leadId, clientName) {
    if (!confirm(`¿Eliminar el prospecto de ${clientName}?`)) return;

    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${state.token}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        await loadDashboardData();
      } else {
        showToast(data.message, 'error');
      }
    } catch (e) {
      showToast('Error al eliminar lead', 'error');
    }
  };

  // Setup Image Dropzone
  function setupImageDropzone(dropzoneId, fileInputId, previewContainerId, isMultiple) {
    const dropzone = document.getElementById(dropzoneId);
    const fileInput = document.getElementById(fileInputId);
    const previewContainer = document.getElementById(previewContainerId);

    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        fileInput.files = e.dataTransfer.files;
        updatePreviews(fileInput.files, previewContainer, isMultiple);
      }
    });

    fileInput.addEventListener('change', () => {
      updatePreviews(fileInput.files, previewContainer, isMultiple);
    });
  }

  function updatePreviews(files, container, isMultiple) {
    if (!isMultiple) container.innerHTML = '';
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const div = document.createElement('div');
          div.className = 'upload-preview-item';
          div.innerHTML = `<img src="${e.target.result}" alt="Preview" />`;
          container.appendChild(div);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // Toast Notification
  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <span>${type === 'success' ? '✅' : '⚠️'}</span>
      <span>${message}</span>
    `;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // Start
  init();
});
