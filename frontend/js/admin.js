/* ==========================================================================
   IoT Saathi - Admin Panel Logic
   Vanilla JS | Token-based Auth | Full CRUD Component Management
   ========================================================================== */

(function () {
    'use strict';

    const API_BASE = '/api';
    const TOKEN_KEY = 'iot_saathi_admin_token';

    let adminToken = '';
    let allComponents = [];

    // ---- DOM Refs ----
    let loginSection, dashboardSection;
    let loginForm, loginPasswordInput, loginError, loginBtn;
    let dashboardHeader, statsRow, tableWrapper, tableBody;
    let mobileCardsContainer;
    let modalOverlay, modalCard, modalTitle, modalForm, modalSubmitBtn;
    let confirmOverlay, confirmTitle, confirmMsg, confirmYesBtn, confirmNoBtn;
    let toastEl;
    let statTotal, statActive, statInactive, statLowStock;

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
        try {
            const res = await fetch(`${API_BASE}/admin/verify`, {
                headers: { 'X-Admin-Token': token }
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    async function loginAdmin(password) {
        const res = await fetch(`${API_BASE}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Login failed');
        }
        return await res.json();
    }

    async function logoutAdmin() {
        try {
            await fetch(`${API_BASE}/admin/logout`, {
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
    // API Calls (Admin – protected)
    // =======================================================================
    async function fetchAllComponents() {
        const res = await fetch(`${API_BASE}/admin/components`, {
            headers: { 'X-Admin-Token': adminToken }
        });
        if (res.status === 401) { logoutAdmin(); throw new Error('Session expired'); }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    }

    async function apiCreateComponent(data) {
        const res = await fetch(`${API_BASE}/admin/components`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken
            },
            body: JSON.stringify(data)
        });
        if (res.status === 401) { logoutAdmin(); throw new Error('Session expired'); }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to create component');
        }
        return await res.json();
    }

    async function apiUpdateComponent(compId, data) {
        const res = await fetch(`${API_BASE}/admin/components/${compId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'X-Admin-Token': adminToken
            },
            body: JSON.stringify(data)
        });
        if (res.status === 401) { logoutAdmin(); throw new Error('Session expired'); }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.detail || 'Failed to update component');
        }
        return await res.json();
    }

    async function apiDeleteComponent(compId) {
        const res = await fetch(`${API_BASE}/admin/components/${compId}`, {
            method: 'DELETE',
            headers: { 'X-Admin-Token': adminToken }
        });
        if (res.status === 401) { logoutAdmin(); throw new Error('Session expired'); }
        if (!res.ok) throw new Error('Failed to delete component');
        return true;
    }

    async function apiToggleComponent(compId) {
        const res = await fetch(`${API_BASE}/admin/components/${compId}/toggle`, {
            method: 'PATCH',
            headers: { 'X-Admin-Token': adminToken }
        });
        if (res.status === 401) { logoutAdmin(); throw new Error('Session expired'); }
        if (!res.ok) throw new Error('Failed to toggle component');
        return await res.json();
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

        // Bind edit buttons
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

    async function refreshDashboard() {
        try {
            allComponents = await fetchAllComponents();
        } catch (e) {
            showToast('Failed to load components');
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

        // Populate form
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
        // Clear any error messages
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
                showToast('Component updated successfully!');
            } else {
                await apiCreateComponent(data);
                showToast('Component added successfully!');
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
        if (confirmMsg) confirmMsg.textContent = `Are you sure you want to permanently delete "${comp ? comp.name : compId}"? This cannot be undone.`;
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
            showToast('Component deleted');
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
    // Init
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

        // Login handler
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                if (loginError) loginError.classList.remove('show');
                const pw = loginPasswordInput?.value || '';
                if (!pw) {
                    if (loginError) { loginError.textContent = 'Password is required.'; loginError.classList.add('show'); }
                    return;
                }
                if (loginBtn) loginBtn.disabled = true;
                try {
                    const result = await loginAdmin(pw);
                    if (result.success && result.token) {
                        adminToken = result.token;
                        storeToken(adminToken);
                        showDashboard();
                        await refreshDashboard();
                    } else {
                        throw new Error(result.message || 'Login failed');
                    }
                } catch (err) {
                    if (loginError) {
                        loginError.textContent = err.message || 'Invalid credentials.';
                        loginError.classList.add('show');
                    }
                } finally {
                    if (loginBtn) loginBtn.disabled = false;
                }
            });
        }

        // Logout
        const btnLogout = document.getElementById('btn-admin-logout');
        if (btnLogout) btnLogout.addEventListener('click', logoutAdmin);

        // Add product
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
                    showToast(`✨ Added "${name}" directly to store!`);
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
