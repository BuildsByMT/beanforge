// app.js - Client-Side Controller for BeanForge

// --- Global Application State ---
let state = {
  user: null,
  token: null,
  products: [],
  cart: [],
  likes: [],
  activeFilter: 'All'
};

const API_BASE = '/api';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Load Session from Local Storage
  const savedToken = localStorage.getItem('beanforge_token');
  const savedUser = localStorage.getItem('beanforge_user');
  
  if (savedToken && savedUser) {
    state.token = savedToken;
    state.user = JSON.parse(savedUser);
    updateNavForLoggedInUser();
  }

  // 2. Fetch Catalog Products (Universal)
  fetchProducts();

  // 3. Fetch User-Specific Info if authenticated
  if (state.token) {
    fetchUserLikes();
    fetchUserCart();
    fetchDashboardData();
  }

  // 4. Setup Scroll Event for Header
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  });
});

// --- API Request Helper (Includes Auth Token) ---
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  if (state.token) {
    headers['Authorization'] = `Bearer ${state.token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Something went wrong');
  }
  return data;
}

// --- Fetch Functions ---

async function fetchProducts() {
  const grid = document.getElementById('catalog-products-grid');
  try {
    const products = await apiRequest('/products');
    state.products = products;
    renderCatalog();
  } catch (error) {
    showToast(`Error fetching catalog: ${error.message}`, 'error');
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 2rem; color: #ff4d4d; margin-bottom: 10px;"></i>
        <p>Failed to load catalog. Please check your database connection.</p>
      </div>
    `;
  }
}

async function fetchUserLikes() {
  try {
    const likedIds = await apiRequest('/likes');
    state.likes = likedIds;
    updateLikeIcons();
  } catch (error) {
    console.error('Error fetching likes:', error);
  }
}

async function fetchUserCart() {
  try {
    const cartItems = await apiRequest('/cart');
    state.cart = cartItems;
    updateCartUI();
  } catch (error) {
    console.error('Error fetching cart:', error);
  }
}

async function fetchDashboardData() {
  if (!state.token) return;
  try {
    const orders = await apiRequest('/orders');
    renderOrders(orders);
    
    const quotes = await apiRequest('/quotes');
    renderQuotes(quotes);
  } catch (error) {
    console.error('Error fetching dashboard details:', error);
  }
}

// --- Rendering Functions ---

function renderCatalog() {
  const grid = document.getElementById('catalog-products-grid');
  grid.innerHTML = '';

  const filtered = state.products.filter(p => {
    if (state.activeFilter === 'All') return true;
    if (state.activeFilter === 'Coffee Beans') return p.type === 'bean';
    return p.category === state.activeFilter;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 40px 0;">
        <p>No products found in this category.</p>
      </div>
    `;
    return;
  }

  filtered.forEach(p => {
    const isLiked = state.likes.includes(p.product_id);
    const card = document.createElement('div');
    card.className = 'product-card glass-panel';
    card.id = `product-${p.product_id}`;

    // Quantity dropdown options
    let qtyOptions = '';
    for (let i = 1; i <= 10; i++) {
      qtyOptions += `<option value="${i}">${i}</option>`;
    }

    // Bean-specific actions vs Drink actions
    let actionHTML = '';
    if (p.type === 'bean') {
      actionHTML = `
        <div class="add-to-cart-container">
          <select class="qty-select" id="qty-select-${p.product_id}">${qtyOptions}</select>
          <button class="add-cart-btn" onclick="handleAddToCart(${p.product_id})">
            <i class="fa-solid fa-cart-plus"></i> Buy Bags
          </button>
        </div>
        <button class="request-quote-btn" onclick="openQuoteModal(${p.product_id}, '${p.name.replace(/'/g, "\\'")}')">
          <i class="fa-solid fa-file-invoice-dollar"></i> Request Quote
        </button>
      `;
    } else {
      actionHTML = `
        <div class="add-to-cart-container" style="width: 100%; justify-content: space-between;">
          <select class="qty-select" id="qty-select-${p.product_id}">${qtyOptions}</select>
          <button class="add-cart-btn" onclick="handleAddToCart(${p.product_id})" style="flex-grow: 1; margin-left: 10px;">
            <i class="fa-solid fa-mug-hot"></i> Add to Order
          </button>
        </div>
      `;
    }

    card.innerHTML = `
      <div class="product-image-container">
        <img class="product-img" src="${p.image_url}" alt="${p.name}" loading="lazy">
        <span class="product-badge">${p.type === 'bean' ? 'Wholesale Bean' : 'Retail Menu'}</span>
        <button class="like-btn ${isLiked ? 'liked' : ''}" onclick="handleToggleLike(${p.product_id})" id="like-btn-${p.product_id}">
          <i class="${isLiked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
        </button>
      </div>
      <div class="product-body">
        <div class="product-meta">
          <span>${p.category}</span>
          <span>${p.origin ? `<i class="fa-solid fa-location-dot"></i> ${p.origin}` : ''}</span>
        </div>
        <h3 class="product-title">${p.name}</h3>
        <p class="product-desc" title="${p.description}">${p.description || 'No description available.'}</p>
        <div class="product-footer">
          <div class="product-price">
            $${Number(p.price).toFixed(2)}
            <span>${p.type === 'bean' ? '/lb' : ''}</span>
          </div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 15px;">
          ${actionHTML}
        </div>
      </div>
    `;
    grid.appendChild(card);
  });
}

function updateLikeIcons() {
  state.products.forEach(p => {
    const btn = document.getElementById(`like-btn-${p.product_id}`);
    if (btn) {
      const isLiked = state.likes.includes(p.product_id);
      if (isLiked) {
        btn.classList.add('liked');
        btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      } else {
        btn.classList.remove('liked');
        btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      }
    }
  });
}

function updateCartUI() {
  const badgeCount = document.getElementById('cart-badge-count');
  const itemsContainer = document.getElementById('drawer-items-list');
  const totalDisplay = document.getElementById('cart-total-display');

  // Calculate total items
  const totalQty = state.cart.reduce((sum, item) => sum + item.quantity, 0);
  badgeCount.textContent = totalQty;

  if (state.cart.length === 0) {
    itemsContainer.innerHTML = `<p style="color: var(--text-muted); text-align: center; margin-top: 40px;">Your cart is currently empty.</p>`;
    totalDisplay.textContent = '$0.00';
    return;
  }

  itemsContainer.innerHTML = '';
  let subtotal = 0;

  state.cart.forEach(item => {
    const itemTotal = Number(item.price) * item.quantity;
    subtotal += itemTotal;

    const div = document.createElement('div');
    div.className = 'cart-item';
    div.innerHTML = `
      <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div class="cart-item-price">$${Number(item.price).toFixed(2)} x ${item.quantity}</div>
        <div class="cart-item-qty-actions">
          <button class="qty-btn" onclick="handleUpdateCartQty(${item.product_id}, ${item.quantity - 1})">-</button>
          <span style="font-size: 0.9rem; font-weight:600; min-width: 15px; text-align: center;">${item.quantity}</span>
          <button class="qty-btn" onclick="handleUpdateCartQty(${item.product_id}, ${item.quantity + 1})">+</button>
          <button class="remove-cart-item" onclick="handleRemoveCartItem(${item.product_id})" title="Remove item">
            <i class="fa-regular fa-trash-can"></i>
          </button>
        </div>
      </div>
    `;
    itemsContainer.appendChild(div);
  });

  totalDisplay.textContent = `$${subtotal.toFixed(2)}`;
}

function renderOrders(orders) {
  const container = document.getElementById('dashboard-orders-list');
  if (!orders || orders.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No orders placed yet.</p>`;
    return;
  }

  container.innerHTML = '';
  orders.forEach(order => {
    const dateStr = new Date(order.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const itemsList = order.items.map(item => `${item.product_name} (x${item.quantity})`).join(', ');

    const div = document.createElement('div');
    div.className = 'dash-item';
    div.innerHTML = `
      <div class="dash-item-header">
        <span>Order #${order.order_id} • ${dateStr}</span>
        <span class="status-badge status-${order.status}">${order.status.toUpperCase()}</span>
      </div>
      <div class="dash-item-body">
        <div style="max-width: 75%;">
          <div style="font-weight: 500; font-size: 0.95rem; margin-bottom: 4px;">${itemsList}</div>
          <div style="font-size: 0.8rem; color: var(--text-muted);">Type: ${order.order_type === 'bean' ? 'Wholesale Bean Delivery' : 'Café Pickup'}</div>
        </div>
        <div style="font-weight: 700; color: var(--accent-gold); font-size: 1.1rem;">
          $${Number(order.total_price).toFixed(2)}
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

function renderQuotes(quotes) {
  const container = document.getElementById('dashboard-quotes-list');
  if (!quotes || quotes.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 40px 0;">No quotes requested yet.</p>`;
    return;
  }

  container.innerHTML = '';
  quotes.forEach(q => {
    const dateStr = new Date(q.created_at).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric'
    });

    const div = document.createElement('div');
    div.className = 'dash-item';
    div.innerHTML = `
      <div class="dash-item-header">
        <span>Quote #${q.quote_id} • Requested: ${dateStr}</span>
        <span class="status-badge status-${q.status}">${q.status.toUpperCase()}</span>
      </div>
      <div class="dash-item-body">
        <div>
          <div style="font-weight: 600; font-size: 1rem; margin-bottom: 4px;">${q.product_name}</div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 4px;">Requested Volume: <strong style="color: white;">${q.quantity_lbs} lbs</strong></div>
          ${q.notes ? `<div style="font-size: 0.8rem; font-style: italic; color: var(--text-muted); border-left: 2px solid var(--accent-gold-dark); padding-left: 8px;">"${q.notes}"</div>` : ''}
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">Est. base price</div>
          <div style="font-weight: 700; color: var(--accent-gold); font-size: 1rem;">$${(Number(q.base_price) * q.quantity_lbs).toFixed(2)}</div>
        </div>
      </div>
    `;
    container.appendChild(div);
  });
}

// --- Interaction Handlers ---

function filterCatalog(category, button) {
  state.activeFilter = category;
  
  // Set active class on button
  const buttons = document.querySelectorAll('.filter-btn');
  buttons.forEach(btn => btn.classList.remove('active'));
  button.classList.add('active');
  
  renderCatalog();
}

async function handleToggleLike(productId) {
  if (!state.token) {
    showToast('Please sign in to favorite products', 'warning');
    openAuthModal('login');
    return;
  }

  try {
    const result = await apiRequest('/likes', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId })
    });

    if (result.liked) {
      state.likes.push(productId);
      showToast('Added to favorites', 'success');
    } else {
      state.likes = state.likes.filter(id => id !== productId);
      showToast('Removed from favorites', 'info');
    }
    updateLikeIcons();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

async function handleAddToCart(productId) {
  if (!state.token) {
    showToast('Please sign in to order products', 'warning');
    openAuthModal('login');
    return;
  }

  const select = document.getElementById(`qty-select-${productId}`);
  const quantity = select ? parseInt(select.value, 10) : 1;

  try {
    const result = await apiRequest('/cart', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, quantity })
    });
    
    showToast(result.message || 'Added to cart', 'success');
    fetchUserCart();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

async function handleUpdateCartQty(productId, newQty) {
  try {
    const result = await apiRequest('/cart', {
      method: 'PUT',
      body: JSON.stringify({ product_id: productId, quantity: newQty })
    });
    
    fetchUserCart();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

async function handleRemoveCartItem(productId) {
  try {
    const result = await apiRequest(`/cart?product_id=${productId}`, {
      method: 'DELETE'
    });
    
    showToast('Item removed from cart', 'info');
    fetchUserCart();
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  }
}

async function checkoutCart() {
  if (state.cart.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  try {
    const result = await apiRequest('/orders', {
      method: 'POST'
    });
    
    showToast('Order placed successfully!', 'success');
    toggleCartDrawer(false);
    
    // Refresh cart and dashboard
    fetchUserCart();
    fetchDashboardData();
  } catch (error) {
    showToast(`Checkout failed: ${error.message}`, 'error');
  }
}

// --- Quote Modal ---

function openQuoteModal(productId, productName) {
  if (!state.token) {
    showToast('Please sign in to request wholesale quotes', 'warning');
    openAuthModal('login');
    return;
  }

  document.getElementById('quote-product-id').value = productId;
  document.getElementById('quote-product-name').value = productName;
  document.getElementById('quote-quantity').value = 50;
  document.getElementById('quote-notes').value = '';
  
  document.getElementById('quote-modal').classList.add('open');
}

function closeQuoteModal() {
  document.getElementById('quote-modal').classList.remove('open');
}

async function submitQuoteRequest(event) {
  event.preventDefault();
  
  const productId = parseInt(document.getElementById('quote-product-id').value, 10);
  const qty = parseInt(document.getElementById('quote-quantity').value, 10);
  const notes = document.getElementById('quote-notes').value;

  if (qty < 50) {
    showToast('Wholesale orders require a minimum of 50 lbs', 'warning');
    return;
  }

  try {
    const result = await apiRequest('/quotes', {
      method: 'POST',
      body: JSON.stringify({
        product_id: productId,
        quantity_lbs: qty,
        notes
      })
    });
    
    showToast('Wholesale quote submitted!', 'success');
    closeQuoteModal();
    fetchDashboardData();
  } catch (error) {
    showToast(`Quote submission failed: ${error.message}`, 'error');
  }
}

// --- Auth Modal & Session Actions ---

function openAuthModal(mode = 'login') {
  switchAuthTab(mode);
  document.getElementById('auth-modal').classList.add('open');
}

function closeAuthModal() {
  document.getElementById('auth-modal').classList.remove('open');
}

function switchAuthTab(mode) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const title = document.getElementById('auth-modal-title');

  if (mode === 'login') {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    title.textContent = 'Sign In to BeanForge';
  } else {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    title.textContent = 'Create a BeanForge Account';
  }
}

async function handleAuthSubmit(event, action) {
  event.preventDefault();

  let body = {};
  if (action === 'register') {
    body.username = document.getElementById('signup-username').value;
    body.email = document.getElementById('signup-email').value;
    body.password = document.getElementById('signup-password').value;
  } else {
    body.email = document.getElementById('login-email').value;
    body.password = document.getElementById('login-password').value;
  }

  try {
    const data = await apiRequest(`/auth?action=${action}`, {
      method: 'POST',
      body: JSON.stringify(body)
    });

    // Save tokens and user
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('beanforge_token', data.token);
    localStorage.setItem('beanforge_user', JSON.stringify(data.user));

    showToast(data.message || 'Authentication successful!', 'success');
    closeAuthModal();

    // Reset forms
    document.getElementById('login-form').reset();
    document.getElementById('signup-form').reset();

    // Reload layout and fetch user details
    updateNavForLoggedInUser();
    fetchUserLikes();
    fetchUserCart();
    fetchDashboardData();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function updateNavForLoggedInUser() {
  const container = document.getElementById('auth-actions-container');
  const userLinks = document.querySelectorAll('.user-only');

  userLinks.forEach(link => link.style.display = 'block');

  if (state.user) {
    const initial = state.user.username ? state.user.username.charAt(0).toUpperCase() : 'U';
    container.innerHTML = `
      <div class="user-profile" onclick="handleLogoutToggle()" title="Click to Sign Out">
        <div class="user-avatar">${initial}</div>
        <span style="font-size: 0.9rem; font-weight: 500;">${state.user.username}</span>
        <i class="fa-solid fa-right-from-bracket" style="font-size: 0.8rem; color: var(--text-muted); margin-left: 5px;"></i>
      </div>
    `;
  }
}

function handleLogoutToggle() {
  if (confirm('Are you sure you want to sign out?')) {
    logoutUser();
  }
}

function logoutUser() {
  state.token = null;
  state.user = null;
  state.likes = [];
  state.cart = [];
  
  localStorage.removeItem('beanforge_token');
  localStorage.removeItem('beanforge_user');

  // Reset navbar elements
  const container = document.getElementById('auth-actions-container');
  container.innerHTML = `<button class="auth-btn" onclick="openAuthModal('login')">Sign In</button>`;

  const userLinks = document.querySelectorAll('.user-only');
  userLinks.forEach(link => link.style.display = 'none');

  setView('home');
  showToast('Logged out successfully', 'info');
  
  // Refresh standard catalog view
  renderCatalog();
  updateCartUI();
}

// --- View Panel Routing ---

function setView(viewName) {
  const homeView = document.getElementById('home-view');
  const dashView = document.getElementById('dashboard-view');
  const navHome = document.querySelector('header a[href="#"]');
  const navDash = document.querySelector('header a[href="#dashboard"]');

  if (viewName === 'dashboard') {
    homeView.style.display = 'none';
    dashView.style.display = 'block';
    
    if (navHome) navHome.classList.remove('active');
    if (navDash) navDash.classList.add('active');
    
    // Fetch latest dashboard records
    fetchDashboardData();
  } else {
    homeView.style.display = 'block';
    dashView.style.display = 'none';
    
    if (navHome) navHome.classList.add('active');
    if (navDash) navDash.classList.remove('active');
  }
}

// --- Cart Drawer toggler ---

function toggleCartDrawer(isOpen) {
  const drawer = document.getElementById('shopping-cart-drawer');
  if (isOpen) {
    drawer.classList.add('open');
    if (state.token) {
      fetchUserCart();
    }
  } else {
    drawer.classList.remove('open');
  }
}

// --- Toast / Visual Notifications Helper ---

function showToast(message, type = 'info') {
  const container = document.getElementById('notification-toast-container');
  
  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let icon = 'fa-circle-info';
  if (type === 'success') {
    icon = 'fa-circle-check';
    toast.style.borderColor = '#28a745';
  } else if (type === 'warning') {
    icon = 'fa-triangle-exclamation';
    toast.style.borderColor = '#ffc107';
  } else if (type === 'error') {
    icon = 'fa-circle-exclamation';
    toast.style.borderColor = '#dc3545';
  }

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  // Auto-remove toast
  setTimeout(() => {
    toast.style.animation = 'slideInToast 0.3s ease reverse forwards';
    setTimeout(() => {
      if (toast.parentNode === container) {
        container.removeChild(toast);
      }
    }, 300);
  }, 3000);
}
