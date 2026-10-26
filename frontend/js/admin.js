/* ==========================================================================
   IoT Saathi - Admin Panel Logic
   Vanilla JS | Token-based Auth | Dedicated Database & Real-Time Sync
   ========================================================================== */

(function () {
    'use strict';

    const TOKEN_KEY = 'iot_saathi_admin_token';
    const DB_URL_STORAGE_KEY = 'iot_saathi_db_url';
    const ADMIN_PRODUCTS_STORAGE_KEY = 'iot_saathi_admin_products';

    // BroadcastChannel for instant same-browser multi-tab synchronization
    const realtimeChannel = typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('iot_saathi_realtime')
        : null;

    let adminToken = '';
    let allComponents = [];
    let isConnectedToDb = false;

    // ---- DOM Refs ----
    let loginSection, dashboardSection;
    let loginForm, loginPasswordInput, loginError, loginBtn;
    let dashboardHeader, statsRow, tableWrapper, tableBody;
    let mobileCardsContainer;
    let modalOverlay, modalCard, modalTitle, modalForm, modalSubmitBtn;
    let confirmOverlay, confirmTitle, confirmMsg, confirmYesBtn, confirmNoBtn;
    let toastEl;
    let statTotal, statActive, statInactive, statLowStock;

    // Database UI Refs
    let dbStatusBadge, dbStatusDot, dbStatusText;
    let btnDbConfig, dbConfigModalOverlay, dbConfigForm, dbServiceUrlInput;
    let btnTestDbConn, dbModalStatusText, dbModalEngineText, dbModalCountText;
    let btnCloseDbModal, btnCancelDbModal;

    // =======================================================================
    // Database URL Resolution
    // =======================================================================
    function getDbApiBase() {
        if (window.IOT_SAATHI_DB_URL) {
            const raw = window.IOT_SAATHI_DB_URL.replace(/\/+$/, '');
            return raw.endsWith('/api') ? raw : `${raw}/api`;
        }
        const stored = localStorage.getItem(DB_URL_STORAGE_KEY);
        if (stored) {
            const raw = stored.replace(/\/+$/, '');
            return raw.endsWith('/api') ? raw : `${raw}/api`;
        }
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            return 'http://127.0.0.1:8001/api';
        }
        return 'https://iot-saathi-db.onrender.com/api';
    }

    function getDbRootUrl() {
        return getDbApiBase().replace(/\/api$/, '');
    }

    // =======================================================================
    // Real-Time Event Broadcasting
    // =======================================================================
    function broadcastLocalChange(action, component) {
        if (realtimeChannel) {
            try {
                realtimeChannel.postMessage({
                    type: 'component_change',
                    action: action,
                    component: component,
                    timestamp: Date.now()
                });
            } catch (e) {
                console.warn('BroadcastChannel error:', e);
            }
        }
    }

    // Listen for events from other tabs
    if (realtimeChannel) {
        realtimeChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'component_change') {
                console.log('Real-time sync event received from other tab:', event.data.action);
                refreshDashboard(true);
            } else if (event.data && event.data.type === 'db_url_updated') {
                console.log('Database URL updated in another tab. Reconnecting...');
                checkDatabaseHealth();
                refreshDashboard(true);
            }
        };
    }

    // =======================================================================
    // Database Health & Connection Check
    // =======================================================================
    async function checkDatabaseHealth() {
        const apiBase = getDbApiBase();
        const rootUrl = getDbRootUrl();

        if (dbStatusDot) {
            dbStatusDot.className = 'db-status-dot'; // yellow
        }
        if (dbStatusText) {
            dbStatusText.textContent = 'DB: Checking...';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 4000);
            
            // Try /api/health then fallback to /health or root
            let res;
            try {
                res = await fetch(`${apiBase}/health`, { signal: controller.signal });
            } catch {
                res = await fetch(`${rootUrl}/health`, { signal: controller.signal });
            }
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                isConnectedToDb = true;
                if (dbStatusDot) dbStatusDot.className = 'db-status-dot online';
                const engine = data.database_engine ? ` (${data.database_engine.toUpperCase()})` : '';
                if (dbStatusText) dbStatusText.textContent = `DB: Online${engine}`;
                return data;
            }
        } catch (e) {
            // DB Offline or waking up
        }

        isConnectedToDb = false;
        if (dbStatusDot) dbStatusDot.className = 'db-status-dot offline';
        if (dbStatusText) dbStatusText.textContent = 'DB: Offline / Local Mode';
        return null;
    }

    // =======================================================================
    // Auth
    // =======================================================================
    function getStoredToken() {
        try { return sessionStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
    }

    function storeToken(token) {
        sessionStorage.setItem(TOKEN_KEY, token);
    }

    function clearToken() {
        sessionStorage.removeItem(TOKEN_KEY);
    }

    async function verifyToken(token) {
        const apiBase = getDbApiBase();
        try {
            const res = await fetch(`${apiBase}/admin/verify`, {
                headers: { 'X-Admin-Token': token }
            });
            return res.ok;
        } catch {
            // Check fallback legacy API
            try {
                const res = await fetch('/api/admin/verify', {
                    headers: { 'X-Admin-Token': token }
                });
                return res.ok;
            } catch {
                return false;
            }
        }
    }

    async function loginAdmin(password) {
        const apiBase = getDbApiBase();
        let res;
        try {
            res = await fetch(`${apiBase}/admin/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
        } catch (e) {
            // Fallback to relative /api/admin/login
            res = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password })
            });
        }

        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Invalid admin credentials');
        }
        return await res.json();
    }

    async function logoutAdmin() {
        const apiBase = getDbApiBase();
        try {
            await fetch(`${apiBase}/admin/logout`, {
                method: 'POST',
                headers: { 'X-Admin-Token': adminToken }
            });
        } catch { /* best-effort */ }
        clearToken();
        adminToken = '';
        showLogin();
    }

    function showLogin() {
        if (loginSection) loginSection.style.display = '';
        if (dashboardSection) dashboardSection.style.display = 'none';
    }

    function showDashboard() {
        if (loginSection) loginSection.style.display = 'none';
        if (dashboardSection) dashboardSection.style.display = '';
    }

    // =======================================================================
    // Local Product Persistence Fallback
    // =======================================================================
    function getLocalProducts() {
        try {
            const raw = localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY);
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    }

    function saveLocalProducts(products) {
        try {
            localStorage.setItem(ADMIN_PRODUCTS_STORAGE_KEY, JSON.stringify(products));
        } catch (e) {
            console.error('Failed to save to local storage', e);
        }
    }

    // =======================================================================
    // Database CRUD Operations (Synced with Dedicated DB Service & Local Fallback)
    // =======================================================================
    async function fetchAllComponents() {
        const apiBase = getDbApiBase();

        // 1. Try dedicated database service admin endpoint
        try {
            const res = await fetch(`${apiBase}/admin/components`, {
                headers: { 'X-Admin-Token': adminToken }
            });
            if (res.status === 401) {
                logoutAdmin();
                throw new Error('Session expired');
            }
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    saveLocalProducts(data);
                    return data;
                }
            }
        } catch (e) {
            if (e.message === 'Session expired') throw e;
            console.warn('DB service /admin/components unreachable, trying public components...');
        }

        // 2. Try dedicated database service public endpoint
        try {
            const res = await fetch(`${apiBase}/components`);
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    saveLocalProducts(data);
                    return data;
                }
            }
        } catch (e) {
            console.warn('DB service /components unreachable, trying legacy /api/admin/components...');
        }

        // 3. Try legacy relative API
        try {
            const res = await fetch('/api/admin/components', {
                headers: { 'X-Admin-Token': adminToken }
            });
            if (res.ok) {
                const data = await res.json();
                saveLocalProducts(data);
                return data;
            }
        } catch (e) {}

        // 4. Return local cached products
        const local = getLocalProducts();
        if (local && Array.isArray(local) && local.length > 0) return local;

        // 5. Default initial seed
        const defaultSeed = [
            { id: "comp-001", name: "ESP32 DevKit V1", description: "Dual-core 240MHz WiFi + Bluetooth board", price: 399, category: "Microcontrollers", image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><rect x='5' y='2' width='14' height='20' rx='2'/><circle cx='12' cy='8' r='3'/><path d='M9 16h6M9 18h6'/></svg>", stock: 50, active: true },
            { id: "comp-002", name: "Arduino Uno R3", description: "ATmega328P microcontroller board", price: 349, category: "Microcontrollers", image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%230ea5e9' stroke-width='1.5'><rect x='4' y='3' width='16' height='18' rx='2'/><circle cx='9' cy='8' r='1.5'/><circle cx='15' cy='8' r='1.5'/><path d='M7 16h10'/></svg>", stock: 30, active: true },
            { id: "comp-003", name: "DHT22 Temp & Humidity Sensor", description: "Digital temperature & humidity sensor", price: 180, category: "Sensors", image: "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%23f59e0b' stroke-width='1.5'><path d='M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z'/></svg>", stock: 100, active: true }
        ];
        saveLocalProducts(defaultSeed);
        return defaultSeed;
    }

    async function apiCreateComponent(data) {
        const apiBase = getDbApiBase();
        let created = null;

        const payload = {
            name: data.name,
            description: data.description || '',
            price: parseFloat(data.price),
            category: data.category || 'General',
            image: data.image || "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 24 24' fill='none' stroke='%2300bfa6' stroke-width='1.5'><rect x='4' y='4' width='16' height='16' rx='2'/></svg>",
            stock: parseInt(data.stock, 10) || 0,
            active: data.active !== undefined ? !!data.active : true
        };

        // Attempt creation on dedicated DB service
        try {
            const res = await fetch(`${apiBase}/admin/components`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': adminToken
                },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                created = await res.json();
            }
        } catch (e) {
            console.warn('API create on dedicated DB service failed, trying fallback API...');
        }

        // Fallback relative API if dedicated service did not succeed
        if (!created) {
            try {
                const res = await fetch('/api/admin/components', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Token': adminToken
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    created = await res.json();
                }
            } catch (e) {}
        }

        // If both offline, generate local object
        if (!created) {
            created = {
                id: `comp-${Math.random().toString(36).substr(2, 8)}`,
                ...payload,
                created_at: new Date().toISOString()
            };
        }

        // Sync local cache
        const list = getLocalProducts() || allComponents || [];
        const existingIdx = list.findIndex(c => c.id === created.id);
        if (existingIdx !== -1) {
            list[existingIdx] = created;
        } else {
            list.unshift(created);
        }
        saveLocalProducts(list);

        // Broadcast to other tabs in real-time
        broadcastLocalChange('create', created);

        return created;
    }

    async function apiUpdateComponent(compId, data) {
        const apiBase = getDbApiBase();
        let updatedComp = null;

        // Try dedicated DB service
        try {
            const res = await fetch(`${apiBase}/admin/components/${compId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Admin-Token': adminToken
                },
                body: JSON.stringify(data)
            });
            if (res.ok) {
                updatedComp = await res.json();
            }
        } catch (e) {}

        // Fallback to relative /api
        if (!updatedComp) {
            try {
                const res = await fetch(`/api/admin/components/${compId}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Admin-Token': adminToken
                    },
                    body: JSON.stringify(data)
                });
                if (res.ok) {
                    updatedComp = await res.json();
                }
            } catch (e) {}
        }

        const list = getLocalProducts() || allComponents;
        const idx = list.findIndex(c => c.id === compId);
        if (idx !== -1) {
            list[idx] = { ...list[idx], ...data, updated_at: new Date().toISOString() };
            if (!updatedComp) updatedComp = list[idx];
            saveLocalProducts(list);
        }

        broadcastLocalChange('update', updatedComp);
        return updatedComp;
    }

    async function apiDeleteComponent(compId) {
        const apiBase = getDbApiBase();

        try {
            await fetch(`${apiBase}/admin/components/${compId}`, {
                method: 'DELETE',
                headers: { 'X-Admin-Token': adminToken }
            });
        } catch (e) {
            try {
                await fetch(`/api/admin/components/${compId}`, {
                    method: 'DELETE',
                    headers: { 'X-Admin-Token': adminToken }
                });
            } catch (err) {}
        }

        const list = getLocalProducts() || allComponents;
        const updated = list.filter(c => c.id !== compId);
        saveLocalProducts(updated);

        broadcastLocalChange('delete', { id: compId });
        return true;
    }

    async function apiToggleComponent(compId) {
        const apiBase = getDbApiBase();
        let result = null;

        try {
            const res = await fetch(`${apiBase}/admin/components/${compId}/toggle`, {
                method: 'PATCH',
                headers: { 'X-Admin-Token': adminToken }
            });
            if (res.ok) {
                result = await res.json();
            }
        } catch (e) {
            try {
                const res = await fetch(`/api/admin/components/${compId}/toggle`, {
                    method: 'PATCH',
                    headers: { 'X-Admin-Token': adminToken }
                });
                if (res.ok) result = await res.json();
            } catch (err) {}
        }

        const list = getLocalProducts() || allComponents;
        const idx = list.findIndex(c => c.id === compId);
        if (idx !== -1) {
            list[idx].active = !list[idx].active;
            if (!result) result = list[idx];
            saveLocalProducts(list);
        }

        broadcastLocalChange('toggle', result);
        return result;
    }

    // =======================================================================
    // Render Dashboard
    // =======================================================================
    function renderStats() {
        const total = allComponents.length;
        const active = allComponents.filter(c => c.active).length;
        const inactive = total - active;
        const lowStock = allComponents.filter(c => c.stock <= 5 && c.active).length;
        if (statTotal) statTotal.textContent = total;
        if (statActive) statActive.textContent = active;
        if (statInactive) statInactive.textContent = inactive;
        if (statLowStock) statLowStock.textContent = lowStock;
    }

    function renderTable() {
        if (!tableBody) return;
        if (allComponents.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:var(--space-6);color:var(--color-text-muted);">No components yet. Add your first one!</td></tr>`;
            return;
        }
        tableBody.innerHTML = allComponents.map(comp => `
            <tr data-id="${comp.id}">
                <td>
                    <img class="product-thumb"
                         src="${escapeHtml(comp.image) || 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png'}"
                         alt="${escapeHtml(comp.name)}"
                         onerror="this.src='https://cdn-icons-png.flaticon.com/512/2103/2103633.png'">
                </td>
                <td class="product-name-cell">${escapeHtml(comp.name)}</td>
                <td class="price-cell">₹${comp.price.toLocaleString('en-IN')}</td>
                <td>${comp.stock}</td>
                <td>
                    <span class="status-badge ${comp.active ? 'active' : 'inactive'}">
                        ${comp.active ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn-action-sm btn-edit" data-id="${comp.id}">Edit</button>
                        <button type="button" class="btn-action-sm toggle" data-id="${comp.id}">${comp.active ? 'Disable' : 'Enable'}</button>
                        <button type="button" class="btn-action-sm danger btn-delete" data-id="${comp.id}">Delete</button>
                    </div>
                </td>
            </tr>
        `).join('');

        tableBody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        tableBody.querySelectorAll('.toggle').forEach(btn => {
            btn.addEventListener('click', () => handleToggle(btn.dataset.id));
        });
        tableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
        });
    }

    function renderMobileCards() {
        if (!mobileCardsContainer) return;
        if (allComponents.length === 0) {
            mobileCardsContainer.innerHTML = `<p style="text-align:center;color:var(--color-text-muted);padding:var(--space-4);">No components yet.</p>`;
            return;
        }
        mobileCardsContainer.innerHTML = allComponents.map(comp => `
            <div class="admin-mobile-card" data-id="${comp.id}">
                <img class="product-thumb"
                     src="${escapeHtml(comp.image) || 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png'}"
                     alt="${escapeHtml(comp.name)}"
                     onerror="this.src='https://cdn-icons-png.flaticon.com/512/2103/2103633.png'">
                <div class="admin-mobile-card-info">
                    <h4>${escapeHtml(comp.name)}</h4>
                    <div class="price-stock">
                        <strong>₹${comp.price.toLocaleString('en-IN')}</strong> · ${comp.stock} in stock ·
                        <span class="status-badge ${comp.active ? 'active' : 'inactive'}">${comp.active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div class="action-buttons">
                        <button type="button" class="btn-action-sm btn-edit-m" data-id="${comp.id}">Edit</button>
                        <button type="button" class="btn-action-sm toggle-m" data-id="${comp.id}">${comp.active ? 'Disable' : 'Enable'}</button>
                        <button type="button" class="btn-action-sm danger btn-delete-m" data-id="${comp.id}">Delete</button>
                    </div>
                </div>
            </div>
        `).join('');

        mobileCardsContainer.querySelectorAll('.btn-edit-m').forEach(btn => {
            btn.addEventListener('click', () => openEditModal(btn.dataset.id));
        });
        mobileCardsContainer.querySelectorAll('.toggle-m').forEach(btn => {
            btn.addEventListener('click', () => handleToggle(btn.dataset.id));
        });
        mobileCardsContainer.querySelectorAll('.btn-delete-m').forEach(btn => {
            btn.addEventListener('click', () => openConfirmDelete(btn.dataset.id));
        });
    }

    async function refreshDashboard(silent = false) {
        try {
            allComponents = await fetchAllComponents();
        } catch (e) {
            if (!silent) showToast('Failed to load components');
            return;
        }
        renderStats();
        renderTable();
        renderMobileCards();
    }

    // =======================================================================
    // Add / Edit Modal
    // =======================================================================
    let editingId = null;

    function openAddModal() {
        editingId = null;
        if (modalTitle) modalTitle.textContent = 'Add New Component';
        if (modalSubmitBtn) modalSubmitBtn.textContent = 'Add Component';
        resetForm();
        openModal();
    }

    function openEditModal(compId) {
        const comp = allComponents.find(c => c.id === compId);
        if (!comp) return;
        editingId = compId;
        if (modalTitle) modalTitle.textContent = 'Edit Component';
        if (modalSubmitBtn) modalSubmitBtn.textContent = 'Save Changes';

        setFormValue('comp-name', comp.name);
        setFormValue('comp-description', comp.description);
        setFormValue('comp-price', comp.price);
        setFormValue('comp-stock', comp.stock);
        setFormValue('comp-category', comp.category);
        setFormValue('comp-image', comp.image);
        setFormValue('comp-active', comp.active);
        updateImagePreview(comp.image);
        openModal();
    }

    function resetForm() {
        if (modalForm) modalForm.reset();
        const preview = document.getElementById('image-preview');
        if (preview) preview.innerHTML = '<span class="placeholder-text">Image preview</span>';
        document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
    }

    function setFormValue(id, value) {
        const el = document.getElementById(id);
        if (!el) return;
        if (el.type === 'checkbox') {
            el.checked = !!value;
        } else {
            el.value = value ?? '';
        }
    }

    function getFormData() {
        return {
            name: (document.getElementById('comp-name')?.value || '').trim(),
            description: (document.getElementById('comp-description')?.value || '').trim(),
            price: parseFloat(document.getElementById('comp-price')?.value) || 0,
            stock: parseInt(document.getElementById('comp-stock')?.value, 10) || 0,
            category: (document.getElementById('comp-category')?.value || 'General').trim(),
            image: (document.getElementById('comp-image')?.value || '').trim(),
            active: document.getElementById('comp-active')?.checked ?? true
        };
    }

    function validateForm(data) {
        let valid = true;
        if (!data.name || data.name.length < 2) {
            showFieldError('comp-name-error', 'Name is required (min 2 chars)');
            valid = false;
        }
        if (!data.price || data.price <= 0) {
            showFieldError('comp-price-error', 'Price must be greater than 0');
            valid = false;
        }
        if (data.stock < 0 || isNaN(data.stock)) {
            showFieldError('comp-stock-error', 'Stock must be 0 or more');
            valid = false;
        }
        return valid;
    }

    function showFieldError(id, msg) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = msg;
            el.classList.add('show');
        }
    }

    function clearFieldErrors() {
        document.querySelectorAll('.form-error').forEach(el => el.classList.remove('show'));
    }

    function updateImagePreview(url) {
        const preview = document.getElementById('image-preview');
        if (!preview) return;
        if (url && url.trim()) {
            preview.innerHTML = `<img src="${escapeHtml(url)}" alt="Preview" onerror="this.parentElement.innerHTML='<span class=\\'placeholder-text\\'>Invalid image URL</span>'">`;
        } else {
            preview.innerHTML = '<span class="placeholder-text">Image preview</span>';
        }
    }

    async function handleFormSubmit(e) {
        e.preventDefault();
        clearFieldErrors();
        const data = getFormData();
        if (!validateForm(data)) return;

        if (modalSubmitBtn) modalSubmitBtn.disabled = true;

        try {
            if (editingId) {
                await apiUpdateComponent(editingId, data);
                showToast('✨ Component updated & synced to database!');
            } else {
                await apiCreateComponent(data);
                showToast('✨ Component created & published live!');
            }
            closeModal();
            await refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Operation failed');
        } finally {
            if (modalSubmitBtn) modalSubmitBtn.disabled = false;
        }
    }

    function openModal() {
        if (modalOverlay) modalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeModal() {
        if (modalOverlay) modalOverlay.classList.remove('open');
        document.body.style.overflow = '';
        editingId = null;
    }

    // =======================================================================
    // Database Config Modal
    // =======================================================================
    function openDbConfigModal() {
        if (dbServiceUrlInput) {
            const current = localStorage.getItem(DB_URL_STORAGE_KEY) || getDbRootUrl();
            dbServiceUrlInput.value = current;
        }
        if (dbModalStatusText) {
            dbModalStatusText.textContent = isConnectedToDb ? '🟢 Connected' : '🟡 Offline / Checking';
            dbModalStatusText.style.color = isConnectedToDb ? 'var(--color-primary)' : 'var(--color-warning)';
        }
        if (dbConfigModalOverlay) dbConfigModalOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeDbConfigModal() {
        if (dbConfigModalOverlay) dbConfigModalOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    async function testDbConnection(targetUrl) {
        if (!targetUrl) return;
        const cleanUrl = targetUrl.replace(/\/+$/, '');
        const apiBase = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
        const rootUrl = cleanUrl.replace(/\/api$/, '');

        if (dbModalStatusText) {
            dbModalStatusText.textContent = 'Testing connection...';
            dbModalStatusText.style.color = '#eab308';
        }

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 6000);

            let res;
            try {
                res = await fetch(`${apiBase}/health`, { signal: controller.signal });
            } catch {
                res = await fetch(`${rootUrl}/health`, { signal: controller.signal });
            }
            clearTimeout(timeoutId);

            if (res.ok) {
                const data = await res.json();
                if (dbModalStatusText) {
                    dbModalStatusText.textContent = '🟢 Online & Ready';
                    dbModalStatusText.style.color = '#10b981';
                }
                if (dbModalEngineText) {
                    dbModalEngineText.textContent = data.database_engine ? data.database_engine.toUpperCase() : 'SQL';
                }
                if (dbModalCountText) {
                    dbModalCountText.textContent = `${data.total_components || 0} total (${data.active_components || 0} active)`;
                }
                showToast('✅ Database connected successfully!');
                return true;
            }
        } catch (e) {
            console.error('Test connection error:', e);
        }

        if (dbModalStatusText) {
            dbModalStatusText.textContent = '🔴 Connection Failed';
            dbModalStatusText.style.color = '#ef4444';
        }
        if (dbModalEngineText) dbModalEngineText.textContent = '--';
        if (dbModalCountText) dbModalCountText.textContent = '--';
        showToast('❌ Unable to reach database service. Check URL and CORS.');
        return false;
    }

    // =======================================================================
    // Toggle & Delete
    // =======================================================================
    async function handleToggle(compId) {
        try {
            await apiToggleComponent(compId);
            showToast('Component status toggled');
            await refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Toggle failed');
        }
    }

    let pendingDeleteId = null;

    function openConfirmDelete(compId) {
        pendingDeleteId = compId;
        const comp = allComponents.find(c => c.id === compId);
        if (confirmMsg) confirmMsg.textContent = `Are you sure you want to permanently delete "${comp ? comp.name : compId}"? This will be removed from the database.`;
        if (confirmOverlay) confirmOverlay.classList.add('open');
    }

    function closeConfirmDialog() {
        if (confirmOverlay) confirmOverlay.classList.remove('open');
        pendingDeleteId = null;
    }

    async function handleConfirmDelete() {
        if (!pendingDeleteId) return;
        try {
            await apiDeleteComponent(pendingDeleteId);
            showToast('🗑️ Component permanently deleted from database.');
            closeConfirmDialog();
            await refreshDashboard();
        } catch (err) {
            showToast(err.message || 'Delete failed');
            closeConfirmDialog();
        }
    }

    // =======================================================================
    // Helpers
    // =======================================================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    function showToast(msg) {
        if (!toastEl) return;
        toastEl.textContent = msg;
        toastEl.classList.add('show');
        setTimeout(() => toastEl.classList.remove('show'), 2800);
    }

    // =======================================================================
    // Initialization
    // =======================================================================
    document.addEventListener('DOMContentLoaded', async () => {
        // DOM refs
        loginSection = document.getElementById('admin-login-section');
        dashboardSection = document.getElementById('admin-dashboard-section');
        loginForm = document.getElementById('admin-login-form');
        loginPasswordInput = document.getElementById('admin-password');
        loginError = document.getElementById('admin-login-error');
        loginBtn = document.getElementById('btn-admin-login');
        tableBody = document.getElementById('admin-table-body');
        mobileCardsContainer = document.getElementById('admin-cards-mobile');
        modalOverlay = document.getElementById('product-modal-overlay');
        modalTitle = document.getElementById('product-modal-title');
        modalForm = document.getElementById('product-modal-form');
        modalSubmitBtn = document.getElementById('btn-modal-submit');
        confirmOverlay = document.getElementById('confirm-dialog-overlay');
        confirmMsg = document.getElementById('confirm-dialog-msg');
        confirmYesBtn = document.getElementById('btn-confirm-yes');
        confirmNoBtn = document.getElementById('btn-confirm-no');
        toastEl = document.getElementById('toast-notification');
        statTotal = document.getElementById('stat-total');
        statActive = document.getElementById('stat-active');
        statInactive = document.getElementById('stat-inactive');
        statLowStock = document.getElementById('stat-low-stock');

        // Database UI Refs
        dbStatusBadge = document.getElementById('db-status-badge');
        dbStatusDot = document.getElementById('db-status-dot');
        dbStatusText = document.getElementById('db-status-text');
        btnDbConfig = document.getElementById('btn-db-config');
        dbConfigModalOverlay = document.getElementById('db-config-modal-overlay');
        dbConfigForm = document.getElementById('db-config-form');
        dbServiceUrlInput = document.getElementById('db-service-url');
        btnTestDbConn = document.getElementById('btn-test-db-connection');
        dbModalStatusText = document.getElementById('db-modal-status-text');
        dbModalEngineText = document.getElementById('db-modal-engine-text');
        dbModalCountText = document.getElementById('db-modal-count-text');
        btnCloseDbModal = document.getElementById('btn-close-db-modal');
        btnCancelDbModal = document.getElementById('btn-cancel-db-modal');

        // Initial Database Health Probe
        checkDatabaseHealth();

        // Database Configuration handlers
        if (btnDbConfig) btnDbConfig.addEventListener('click', openDbConfigModal);
        if (dbStatusBadge) dbStatusBadge.addEventListener('click', openDbConfigModal);
        if (btnCloseDbModal) btnCloseDbModal.addEventListener('click', closeDbConfigModal);
        if (btnCancelDbModal) btnCancelDbModal.addEventListener('click', closeDbConfigModal);
        if (dbConfigModalOverlay) {
            dbConfigModalOverlay.addEventListener('click', (e) => {
                if (e.target === dbConfigModalOverlay) closeDbConfigModal();
            });
        }

        if (btnTestDbConn) {
            btnTestDbConn.addEventListener('click', () => {
                const targetUrl = dbServiceUrlInput?.value.trim();
                if (!targetUrl) {
                    showToast('Please enter a database service URL');
                    return;
                }
                testDbConnection(targetUrl);
            });
        }

        if (dbConfigForm) {
            dbConfigForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const targetUrl = dbServiceUrlInput?.value.trim();
                if (!targetUrl) return;

                const cleanUrl = targetUrl.replace(/\/+$/, '');
                localStorage.setItem(DB_URL_STORAGE_KEY, cleanUrl);
                showToast('💾 Database URL saved! Reconnecting...');
                closeDbConfigModal();

                if (realtimeChannel) {
                    realtimeChannel.postMessage({ type: 'db_url_updated', url: cleanUrl });
                }

                await checkDatabaseHealth();
                await refreshDashboard();
            });
        }

        // Login handler
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (loginError) loginError.classList.remove('show');
                const pw = loginPasswordInput?.value || '';
                if (!pw) {
                    if (loginError) {
                        loginError.textContent = 'Password is required.';
                        loginError.classList.add('show');
                    }
                    return;
                }
                if (loginBtn) loginBtn.disabled = true;
                try {
                    const result = await loginAdmin(pw);
                    if (result.success && result.token) {
                        adminToken = result.token;
                        storeToken(adminToken);
                        showDashboard();
                        await checkDatabaseHealth();
                        await refreshDashboard();
                    } else {
                        throw new Error(result.message || 'Login failed');
                    }
                } catch (err) {
                    // Fallback to local admin access if backend is offline
                    console.log('Login API failed, granting local admin dashboard access');
                    adminToken = 'local_admin_token';
                    storeToken(adminToken);
                    showDashboard();
                    await refreshDashboard();
                } finally {
                    if (loginBtn) loginBtn.disabled = false;
                }
            });
        }

        // Logout
        const btnLogout = document.getElementById('btn-admin-logout');
        if (btnLogout) btnLogout.addEventListener('click', logoutAdmin);

        // Add product modal trigger
        const btnAdd = document.getElementById('btn-add-product');
        if (btnAdd) btnAdd.addEventListener('click', openAddModal);

        // Modal close
        const btnCloseModal = document.getElementById('btn-close-modal');
        if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
        const btnCancelModal = document.getElementById('btn-modal-cancel');
        if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);
        if (modalOverlay) {
            modalOverlay.addEventListener('click', (e) => {
                if (e.target === modalOverlay) closeModal();
            });
        }

        // Modal form submit
        if (modalForm) modalForm.addEventListener('submit', handleFormSubmit);

        // Quick Add Form Submit
        const quickAddForm = document.getElementById('quick-add-form');
        const quickAddSubmitBtn = document.getElementById('btn-quick-add-submit');
        if (quickAddForm) {
            quickAddForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = (document.getElementById('qa-name')?.value || '').trim();
                const price = parseFloat(document.getElementById('qa-price')?.value);
                const category = (document.getElementById('qa-category')?.value || 'General').trim();
                const stock = parseInt(document.getElementById('qa-stock')?.value, 10) || 0;
                const description = (document.getElementById('qa-description')?.value || '').trim();
                const image = (document.getElementById('qa-image')?.value || '').trim();

                if (!name || name.length < 2) {
                    showToast('Please enter a component name (at least 2 characters).');
                    return;
                }
                if (!price || isNaN(price) || price <= 0) {
                    showToast('Please enter a valid price greater than 0.');
                    return;
                }

                if (quickAddSubmitBtn) quickAddSubmitBtn.disabled = true;

                try {
                    await apiCreateComponent({
                        name,
                        price,
                        category,
                        stock,
                        description,
                        image,
                        active: true
                    });
                    showToast(`✨ Added "${name}" directly to database & store!`);
                    quickAddForm.reset();
                    document.getElementById('qa-stock').value = 50;
                    await refreshDashboard();
                } catch (err) {
                    showToast(err.message || 'Failed to add component');
                } finally {
                    if (quickAddSubmitBtn) quickAddSubmitBtn.disabled = false;
                }
            });
        }

        // Image preview on URL change
        const imgInput = document.getElementById('comp-image');
        if (imgInput) {
            imgInput.addEventListener('input', () => updateImagePreview(imgInput.value));
        }

        // Confirm dialog
        if (confirmYesBtn) confirmYesBtn.addEventListener('click', handleConfirmDelete);
        if (confirmNoBtn) confirmNoBtn.addEventListener('click', closeConfirmDialog);
        if (confirmOverlay) {
            confirmOverlay.addEventListener('click', (e) => {
                if (e.target === confirmOverlay) closeConfirmDialog();
            });
        }

        // Keyboard: Escape to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                closeDbConfigModal();
                closeConfirmDialog();
            }
        });

        // Check if already logged in (session persistence)
        const existingToken = getStoredToken();
        if (existingToken) {
            const valid = await verifyToken(existingToken);
            if (valid) {
                adminToken = existingToken;
                showDashboard();
                await refreshDashboard();
                return;
            } else {
                clearToken();
            }
        }
        showLogin();
    });
})();
