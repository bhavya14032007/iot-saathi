/* ==========================================================================
   IoT Saathi - E-Tron Component Store & Cart Logic
   Vanilla JS | LocalStorage Cart | WhatsApp Order Flow
   ========================================================================== */

(function () {
    'use strict';

    // ---- Configuration ----
    // WhatsApp number: loaded from the backend /api/config endpoint,
    // falling back to a sensible default that matches backend/.env
    const FALLBACK_WHATSAPP_NUMBER = '919389860087';
    const API_BASE = '/api';
    const CART_STORAGE_KEY = 'iot_saathi_cart';

    let whatsappNumber = FALLBACK_WHATSAPP_NUMBER;
    let allComponents = [];
    let activeCategory = 'All';

    // ---- DOM Refs (resolved after DOMContentLoaded) ----
    let storeGrid, filterBar, cartDrawer, cartOverlay, cartItemsList, cartFooter;
    let cartTotalValue, cartCountBadge, btnPlaceOrder, toastEl;

    // =======================================================================
    // Cart State (persisted to localStorage)
    // =======================================================================
    function loadCart() {
        try {
            const raw = localStorage.getItem(CART_STORAGE_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    }

    function saveCart(cart) {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }

    function getCart() {
        return loadCart();
    }

    function addToCart(component) {
        const cart = getCart();
        const existing = cart.find(item => item.id === component.id);
        if (existing) {
            existing.qty += 1;
        } else {
            cart.push({
                id: component.id,
                name: component.name,
                price: component.price,
                image: component.image,
                qty: 1,
                stock: component.stock
            });
        }
        saveCart(cart);
        renderCartBadge();
        renderCartDrawer();
    }

    function updateCartQty(compId, delta) {
        const cart = getCart();
        const item = cart.find(i => i.id === compId);
        if (!item) return;
        item.qty += delta;
        if (item.qty < 1) {
            removeFromCart(compId);
            return;
        }
        // Don't exceed stock
        const comp = allComponents.find(c => c.id === compId);
        if (comp && item.qty > comp.stock) {
            item.qty = comp.stock;
        }
        saveCart(cart);
        renderCartDrawer();
        renderCartBadge();
    }

    function removeFromCart(compId) {
        let cart = getCart();
        cart = cart.filter(i => i.id !== compId);
        saveCart(cart);
        renderCartDrawer();
        renderCartBadge();
    }

    function clearCart() {
        localStorage.removeItem(CART_STORAGE_KEY);
        renderCartDrawer();
        renderCartBadge();
    }

    function getCartTotal() {
        return getCart().reduce((sum, item) => sum + item.price * item.qty, 0);
    }

    function getCartItemCount() {
        return getCart().reduce((sum, item) => sum + item.qty, 0);
    }

    // =======================================================================
    // API
    // =======================================================================
    async function fetchComponents() {
        try {
            const res = await fetch(`${API_BASE}/store/components`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error('Failed to fetch components:', err);
            return [];
        }
    }

    async function fetchWhatsAppNumber() {
        try {
            const res = await fetch(`${API_BASE}/config/whatsapp`);
            if (res.ok) {
                const data = await res.json();
                if (data.number) whatsappNumber = data.number;
            }
        } catch {
            // fallback already set
        }
    }

    // =======================================================================
    // Render: Product Grid
    // =======================================================================
    function getCategories(components) {
        const cats = new Set(components.map(c => c.category));
        return ['All', ...Array.from(cats).sort()];
    }

    function renderFilterBar(components) {
        if (!filterBar) return;
        const cats = getCategories(components);
        filterBar.innerHTML = '';
        cats.forEach(cat => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `filter-chip${cat === activeCategory ? ' active' : ''}`;
            btn.textContent = cat;
            btn.setAttribute('aria-pressed', cat === activeCategory);
            btn.addEventListener('click', () => {
                activeCategory = cat;
                renderFilterBar(components);
                renderProductGrid(components);
            });
            filterBar.appendChild(btn);
        });
    }

    function renderProductGrid(components) {
        if (!storeGrid) return;
        const filtered = activeCategory === 'All'
            ? components
            : components.filter(c => c.category === activeCategory);

        if (filtered.length === 0) {
            storeGrid.innerHTML = `
                <div class="store-empty-state" style="grid-column: 1 / -1;">
                    <h3>No components found</h3>
                    <p>Try a different category or check back later.</p>
                </div>`;
            return;
        }

        storeGrid.innerHTML = filtered.map(comp => {
            const outOfStock = comp.stock <= 0;
            const cart = getCart();
            const inCart = cart.find(i => i.id === comp.id);
            return `
            <article class="product-card" data-id="${comp.id}">
                <img class="product-card-img"
                     src="${escapeHtml(comp.image) || 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png'}"
                     alt="${escapeHtml(comp.name)}"
                     loading="lazy"
                     onerror="this.src='https://cdn-icons-png.flaticon.com/512/2103/2103633.png'">
                <div class="product-card-body">
                    <span class="product-category-badge">${escapeHtml(comp.category)}</span>
                    <h3>${escapeHtml(comp.name)}</h3>
                    <p class="product-desc">${escapeHtml(comp.description)}</p>
                </div>
                <div class="product-card-footer">
                    <div>
                        <span class="product-price"><span class="currency">₹</span>${comp.price.toLocaleString('en-IN')}</span>
                        <span class="product-stock ${outOfStock ? 'out-of-stock' : ''}">
                            ${outOfStock ? 'Out of Stock' : `${comp.stock} in stock`}
                        </span>
                    </div>
                    <button type="button"
                            class="btn-add-cart${inCart ? ' added' : ''}"
                            data-id="${comp.id}"
                            ${outOfStock ? 'disabled' : ''}
                            aria-label="Add ${escapeHtml(comp.name)} to cart">
                        ${inCart ? '✓ In Cart' : '🛒 Add to Cart'}
                    </button>
                </div>
            </article>`;
        }).join('');

        // Bind add-to-cart buttons
        storeGrid.querySelectorAll('.btn-add-cart:not([disabled])').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                const comp = allComponents.find(c => c.id === id);
                if (!comp) return;
                addToCart(comp);
                showToast(`${comp.name} added to cart!`);
                // Update button state
                e.currentTarget.classList.add('added');
                e.currentTarget.textContent = '✓ In Cart';
            });
        });
    }

    // =======================================================================
    // Render: Cart Drawer
    // =======================================================================
    function renderCartDrawer() {
        if (!cartItemsList || !cartFooter || !cartTotalValue || !btnPlaceOrder) return;
        const cart = getCart();

        if (cart.length === 0) {
            cartItemsList.innerHTML = `
                <div class="cart-empty-state">
                    <span class="cart-empty-icon">🛒</span>
                    <h3>Your cart is empty</h3>
                    <p>Browse the store and add components to get started.</p>
                </div>`;
            cartFooter.style.display = 'none';
            return;
        }

        cartFooter.style.display = '';
        cartItemsList.innerHTML = cart.map(item => `
            <div class="cart-item" data-id="${item.id}">
                <img class="cart-item-img"
                     src="${escapeHtml(item.image) || 'https://cdn-icons-png.flaticon.com/512/2103/2103633.png'}"
                     alt="${escapeHtml(item.name)}"
                     onerror="this.src='https://cdn-icons-png.flaticon.com/512/2103/2103633.png'">
                <div class="cart-item-info">
                    <h4>${escapeHtml(item.name)}</h4>
                    <span class="cart-item-price">₹${item.price.toLocaleString('en-IN')}</span>
                    <div class="cart-item-controls">
                        <button type="button" class="qty-btn qty-minus" data-id="${item.id}" aria-label="Decrease quantity">−</button>
                        <span class="qty-value">${item.qty}</span>
                        <button type="button" class="qty-btn qty-plus" data-id="${item.id}" aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <button type="button" class="btn-remove-item" data-id="${item.id}" aria-label="Remove ${escapeHtml(item.name)} from cart">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/></svg>
                </button>
            </div>
        `).join('');

        cartTotalValue.textContent = `₹${getCartTotal().toLocaleString('en-IN')}`;

        // Bind qty buttons
        cartItemsList.querySelectorAll('.qty-minus').forEach(btn => {
            btn.addEventListener('click', () => updateCartQty(btn.dataset.id, -1));
        });
        cartItemsList.querySelectorAll('.qty-plus').forEach(btn => {
            btn.addEventListener('click', () => updateCartQty(btn.dataset.id, 1));
        });
        cartItemsList.querySelectorAll('.btn-remove-item').forEach(btn => {
            btn.addEventListener('click', () => {
                removeFromCart(btn.dataset.id);
                showToast('Item removed from cart');
            });
        });
    }

    function renderCartBadge() {
        if (!cartCountBadge) return;
        const count = getCartItemCount();
        cartCountBadge.textContent = count > 0 ? count : '';
        cartCountBadge.setAttribute('data-count', count);
        if (count > 0) {
            cartCountBadge.classList.add('bump');
            setTimeout(() => cartCountBadge.classList.remove('bump'), 350);
        }
    }

    function openCart() {
        if (cartDrawer) cartDrawer.classList.add('open');
        if (cartOverlay) cartOverlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeCart() {
        if (cartDrawer) cartDrawer.classList.remove('open');
        if (cartOverlay) cartOverlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    // =======================================================================
    // WhatsApp Order
    // =======================================================================
    function generateOrderMessage() {
        const cart = getCart();
        if (cart.length === 0) return '';
        let msg = 'Hello IoT Saathi, I want to place an order:\n\n';
        cart.forEach((item, idx) => {
            msg += `${idx + 1}. ${item.name}\n`;
            msg += `   Quantity: ${item.qty}\n`;
            msg += `   Price: ₹${item.price.toLocaleString('en-IN')} each\n\n`;
        });
        msg += `Total: ₹${getCartTotal().toLocaleString('en-IN')}\n\n`;
        msg += 'Please confirm availability and delivery details.';
        return msg;
    }

    function placeOrderViaWhatsApp() {
        const cart = getCart();
        if (cart.length === 0) {
            showToast('Your cart is empty!');
            return;
        }

        // Validate stock
        for (const item of cart) {
            const comp = allComponents.find(c => c.id === item.id);
            if (comp && comp.stock <= 0) {
                showToast(`${item.name} is out of stock. Please remove it.`);
                return;
            }
            if (comp && item.qty > comp.stock) {
                showToast(`Only ${comp.stock} units of ${item.name} available.`);
                return;
            }
        }

        const message = generateOrderMessage();
        const encodedMsg = encodeURIComponent(message);
        const url = `https://wa.me/${whatsappNumber}?text=${encodedMsg}`;

        // Open WhatsApp in a new tab — user can review before sending
        window.open(url, '_blank', 'noopener,noreferrer');

        // Clear cart after the redirect is initiated
        clearCart();
        closeCart();
        // Re-render product grid to reset "In Cart" badges
        renderProductGrid(allComponents);
        showToast('Order sent to WhatsApp! Review and send the message.');
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
        storeGrid = document.getElementById('store-product-grid');
        filterBar = document.getElementById('store-filter-bar');
        cartDrawer = document.getElementById('cart-drawer');
        cartOverlay = document.getElementById('cart-overlay');
        cartItemsList = document.getElementById('cart-items-list');
        cartFooter = document.getElementById('cart-drawer-footer');
        cartTotalValue = document.getElementById('cart-total-value');
        cartCountBadge = document.getElementById('cart-count-badge');
        btnPlaceOrder = document.getElementById('btn-place-order');
        toastEl = document.getElementById('toast-notification');

        // Cart drawer toggle
        const btnOpenCart = document.getElementById('btn-open-cart');
        if (btnOpenCart) btnOpenCart.addEventListener('click', openCart);
        const btnCloseCart = document.getElementById('btn-close-cart');
        if (btnCloseCart) btnCloseCart.addEventListener('click', closeCart);
        if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

        // Place order
        if (btnPlaceOrder) btnPlaceOrder.addEventListener('click', placeOrderViaWhatsApp);

        // Keyboard: Escape to close cart
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeCart();
        });

        // Show loading
        if (storeGrid) {
            storeGrid.innerHTML = `
                <div class="store-loading-state" style="grid-column: 1 / -1;">
                    <div class="spinner"></div>
                    <p>Loading components...</p>
                </div>`;
        }

        // Fetch data
        await fetchWhatsAppNumber();
        allComponents = await fetchComponents();

        // Render
        renderFilterBar(allComponents);
        renderProductGrid(allComponents);
        renderCartDrawer();
        renderCartBadge();
    });
})();
