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

  // 4. Setup Scroll Event for Header & Scroll Spy
  window.addEventListener('scroll', () => {
    const header = document.getElementById('main-header');
    if (window.scrollY > 50) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
    handleScrollSpy();
  });

  // 5. Initialize Router
  handleRouting();
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
            Rs. ${Number(p.price).toLocaleString()}
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
    totalDisplay.textContent = 'Rs. 0';
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
        <div class="cart-item-price">Rs. ${Number(item.price).toLocaleString()} x ${item.quantity}</div>
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

  totalDisplay.textContent = `Rs. ${subtotal.toLocaleString()}`;
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
          Rs. ${Number(order.total_price).toLocaleString()}
        </div>
      </div>
      <div class="dash-item-footer">
        <button class="cancel-order-btn" onclick="handleCancelUserOrder(${order.order_id})">
          <i class="fa-regular fa-trash-can"></i> Cancel Order
        </button>
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
          <div style="font-weight: 700; color: var(--accent-gold); font-size: 1rem;">Rs. ${(Number(q.base_price) * q.quantity_lbs).toLocaleString()}</div>
        </div>
      </div>
      <div class="dash-item-footer">
        <button class="delete-quote-btn" onclick="handleDeleteUserQuote(${q.quote_id})">
          <i class="fa-regular fa-trash-can"></i> Delete Request
        </button>
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
  const previousCart = [...state.cart];
  
  // Optimistic UI Update
  if (newQty <= 0) {
    state.cart = state.cart.filter(item => item.product_id !== productId);
  } else {
    state.cart = state.cart.map(item => {
      if (item.product_id === productId) {
        return { ...item, quantity: newQty };
      }
      return item;
    });
  }
  updateCartUI();

  try {
    await apiRequest('/cart', {
      method: 'PUT',
      body: JSON.stringify({ product_id: productId, quantity: newQty })
    });
    
    // Refresh background data to ensure exact sync
    const cartItems = await apiRequest('/cart');
    state.cart = cartItems;
    updateCartUI();
  } catch (error) {
    state.cart = previousCart;
    updateCartUI();
    showToast(`Failed to update quantity: ${error.message}`, 'error');
  }
}

async function handleRemoveCartItem(productId) {
  const previousCart = [...state.cart];
  
  // Optimistic UI Update
  state.cart = state.cart.filter(item => item.product_id !== productId);
  updateCartUI();

  try {
    await apiRequest(`/cart?product_id=${productId}`, {
      method: 'DELETE'
    });
    
    showToast('Item removed from cart', 'info');
    const cartItems = await apiRequest('/cart');
    state.cart = cartItems;
    updateCartUI();
  } catch (error) {
    state.cart = previousCart;
    updateCartUI();
    showToast(`Failed to remove item: ${error.message}`, 'error');
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

function openAuthModal(mode = 'login', triggerNavigate = true) {
  switchAuthTab(mode);
  document.getElementById('auth-modal').classList.add('open');
  if (triggerNavigate) {
    navigateTo(mode === 'login' ? '/login' : '/signup');
  }
}

function closeAuthModal(triggerNavigate = true) {
  document.getElementById('auth-modal').classList.remove('open');
  if (triggerNavigate) {
    const path = window.location.pathname;
    if (path === '/login' || path === '/signup') {
      navigateTo('/home');
    }
  }
}

function switchAuthTab(mode) {
  const loginForm = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');
  const title = document.getElementById('auth-modal-title');

  if (mode === 'login') {
    loginForm.style.display = 'block';
    signupForm.style.display = 'none';
    title.textContent = 'Sign In to BeanForge';
    if (window.location.pathname === '/signup') {
      window.history.replaceState(null, '', '/login');
    }
  } else {
    loginForm.style.display = 'none';
    signupForm.style.display = 'block';
    title.textContent = 'Create a BeanForge Account';
    if (window.location.pathname === '/login') {
      window.history.replaceState(null, '', '/signup');
    }
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
  const adminLinks = document.querySelectorAll('.admin-only');

  userLinks.forEach(link => link.style.display = 'block');
  
  if (state.user && state.user.role === 'admin') {
    adminLinks.forEach(link => link.style.display = 'block');
  } else {
    adminLinks.forEach(link => link.style.display = 'none');
  }

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
  showCustomConfirm(
    'Sign Out',
    'Are you sure you want to sign out of your BeanForge account?',
    () => { logoutUser(); }
  );
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

  const adminLinks = document.querySelectorAll('.admin-only');
  adminLinks.forEach(link => link.style.display = 'none');

  navigateTo('/home');
  showToast('Logged out successfully', 'info');
  
  // Refresh standard catalog view
  renderCatalog();
  updateCartUI();
}

// --- Client-Side Router ---

const routes = {
  '/': () => showRouteView('home'),
  '/home': () => showRouteView('home'),
  '/catalog': () => showRouteView('home', 'catalog'),
  '/features': () => showRouteView('home', 'features'),
  '/contact': () => showRouteView('home', 'contact'),
  '/dashboard': () => showRouteView('dashboard'),
  '/admin': () => showRouteView('admin'),
  '/login': () => showRouteView('login'),
  '/signup': () => showRouteView('signup')
};

// Navigate to a new path using History API
function navigateTo(path) {
  window.history.pushState(null, '', path);
  handleRouting();
}

// Handle routing based on current window location
function handleRouting() {
  const path = window.location.pathname;
  const routeAction = routes[path] || routes['/'];
  routeAction();
}

// Global click event listener for client-side routing of internal links
document.addEventListener('click', (e) => {
  const anchor = e.target.closest('a');
  if (anchor && anchor.href) {
    const targetUrl = new URL(anchor.href, window.location.origin);
    // Check if the link target is on our domain
    if (targetUrl.origin === window.location.origin) {
      const pathname = targetUrl.pathname;
      // If the pathname matches a defined route, handle it client-side
      if (routes[pathname]) {
        e.preventDefault();
        navigateTo(pathname);
      }
    }
  }
});

// Sync routing when browser back/forward buttons are clicked
window.addEventListener('popstate', handleRouting);

// Show the selected view (equivalent to old setView, but with routing context)
function showRouteView(viewName, sectionId = null) {
  const homeView = document.getElementById('home-view');
  const dashView = document.getElementById('dashboard-view');
  const adminView = document.getElementById('admin-view');
  
  // Close mobile navigation dropdown on view change
  closeMobileMenu();

  // Close the modal unless we are explicitly navigating to login/signup
  if (viewName !== 'login' && viewName !== 'signup') {
    closeAuthModal(false); // pass false to prevent routing feedback loop
  }

  // Reset navigation active state
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => link.classList.remove('active'));

  if (viewName === 'admin') {
    if (!state.token || !state.user || state.user.role !== 'admin') {
      showToast('Forbidden: Admin access required', 'error');
      navigateTo('/home');
      return;
    }
    homeView.style.display = 'none';
    dashView.style.display = 'none';
    adminView.style.display = 'block';
    
    const navAdmin = document.querySelector('header a[href="/admin"]');
    if (navAdmin) navAdmin.classList.add('active');
    
    fetchAdminData();
  } else if (viewName === 'dashboard') {
    if (!state.token) {
      showToast('Please sign in to access your dashboard', 'warning');
      navigateTo('/login');
      return;
    }
    homeView.style.display = 'none';
    dashView.style.display = 'block';
    adminView.style.display = 'none';
    
    const navDash = document.querySelector('header a[href="/dashboard"]');
    if (navDash) navDash.classList.add('active');
    
    fetchDashboardData();
  } else if (viewName === 'login' || viewName === 'signup') {
    // Show auth modal, keep underlying view active
    if (homeView.style.display === 'none' && dashView.style.display === 'none' && adminView.style.display === 'none') {
      homeView.style.display = 'block';
    }
    openAuthModal(viewName === 'login' ? 'login' : 'signup', false);
  } else {
    // Show home view
    homeView.style.display = 'block';
    dashView.style.display = 'none';
    adminView.style.display = 'none';
    
    let activePath = '/home';
    if (sectionId) {
      activePath = `/${sectionId}`;
    }
    const navLink = document.querySelector(`header a[href="${activePath}"]`);
    if (navLink) navLink.classList.add('active');
    
    if (sectionId) {
      const element = document.getElementById(sectionId);
      if (element) {
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }
}

// Legacy setView compatibility wrapper
function setView(viewName) {
  navigateTo(`/${viewName}`);
}

// --- Admin Panel API Actions ---

async function fetchAdminData() {
  if (!state.token || !state.user || state.user.role !== 'admin') return;

  try {
    const data = await apiRequest('/admin');
    
    // 1. Stats card counts
    document.getElementById('admin-stat-users').textContent = data.stats.users;
    document.getElementById('admin-stat-orders').textContent = data.stats.orders;
    document.getElementById('admin-stat-products').textContent = data.stats.products;

    // 2. User Directory Table
    const usersList = document.getElementById('admin-users-list');
    usersList.innerHTML = '';
    
    if (!data.users || data.users.length === 0) {
      usersList.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px 0;">No registered users found.</td></tr>';
    } else {
      data.users.forEach(u => {
        const tr = document.createElement('tr');
        const roleLabel = u.role === 'admin' ? 'ADMIN' : 'CUSTOMER';
        const roleBadgeClass = u.role === 'admin' ? 'status-preparing' : 'status-delivered';
        
        tr.innerHTML = `
          <td>${u.user_id}</td>
          <td><strong style="color: white;">${u.username}</strong></td>
          <td>${u.email}</td>
          <td><span class="status-badge ${roleBadgeClass}" style="font-size: 0.72rem;">${roleLabel}</span></td>
        `;
        usersList.appendChild(tr);
      });
    }

    // 3. Platform Orders Table
    const ordersList = document.getElementById('admin-orders-list');
    ordersList.innerHTML = '';
    
    if (!data.orders || data.orders.length === 0) {
      ordersList.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 20px 0;">No platform orders placed yet.</td></tr>';
    } else {
      data.orders.forEach(o => {
        const dateStr = new Date(o.created_at).toLocaleDateString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        const typeLabel = o.order_type === 'bean' ? 'WHOLESALE' : 'RETAIL';
        
        const statusSelect = `
          <select class="admin-status-select" onchange="handleAdminUpdateStatus(${o.order_id}, this.value)">
            <option value="pending" ${o.status === 'pending' ? 'selected' : ''}>PENDING</option>
            <option value="preparing" ${o.status === 'preparing' ? 'selected' : ''}>PREPARING</option>
            <option value="delivered" ${o.status === 'delivered' ? 'selected' : ''}>DELIVERED</option>
            <option value="approved" ${o.status === 'approved' ? 'selected' : ''}>APPROVED</option>
            <option value="completed" ${o.status === 'completed' ? 'selected' : ''}>COMPLETED</option>
            <option value="cancelled" ${o.status === 'cancelled' ? 'selected' : ''}>CANCELLED</option>
          </select>
        `;
        
        const actionsHTML = `
          <div style="white-space: nowrap;">
            <button class="admin-action-btn edit-btn" onclick="openAdminEditOrderModal(${o.order_id}, '${o.order_type}', ${o.total_price}, '${o.status}')" title="Edit Order Details">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button class="admin-action-btn delete-btn" onclick="openAdminDeleteOrderModal(${o.order_id})" title="Delete Order">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        `;

        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>#${o.order_id}</td>
          <td>
            <strong>${o.user_name}</strong><br>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${o.user_email}</span>
          </td>
          <td>
            <span style="font-size: 0.88rem; color: var(--text-main); font-weight: 500;">${o.items_summary || 'No items detail'}</span><br>
            <small style="color: var(--text-muted);">${dateStr}</small>
          </td>
          <td><span class="product-badge" style="position: static; font-size: 0.75rem; display: inline-block;">${typeLabel}</span></td>
          <td style="font-weight: 700; color: var(--accent-gold); font-size: 1.05rem;">Rs. ${Number(o.total_price).toLocaleString()}</td>
          <td>${statusSelect}</td>
          <td>${actionsHTML}</td>
        `;
        ordersList.appendChild(tr);
      });
    }
  } catch (error) {
    showToast(`Failed to fetch admin dashboard records: ${error.message}`, 'error');
  }
}

function toggleRoastInput(type) {
  const group = document.getElementById('prod-roast-group');
  if (type === 'bean') {
    group.style.display = 'block';
  } else {
    group.style.display = 'none';
    document.getElementById('prod-roast').value = 'N/A';
  }
}

async function handleAddProductSubmit(event) {
  event.preventDefault();

  if (!state.token || !state.user || state.user.role !== 'admin') {
    showToast('Forbidden: Admin access required', 'error');
    return;
  }

  const name = document.getElementById('prod-name').value;
  const type = document.getElementById('prod-type').value;
  const category = document.getElementById('prod-category').value;
  const price = parseFloat(document.getElementById('prod-price').value);
  const origin = document.getElementById('prod-origin').value || null;
  const roast_level = document.getElementById('prod-roast').value || 'N/A';
  const rawImage = document.getElementById('prod-image').value;
  const description = document.getElementById('prod-desc').value || null;

  // Assign fallback non-copyright images from unsplash if left blank
  let image_url = rawImage;
  if (!image_url) {
    image_url = type === 'bean'
      ? 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?auto=format&fit=crop&w=600&q=80'
      : 'https://images.unsplash.com/photo-1510591509098-f4fdc6d0ff04?auto=format&fit=crop&w=600&q=80';
  }

  try {
    await apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify({
        name,
        type,
        category,
        price,
        origin,
        roast_level: type === 'bean' ? roast_level : null,
        image_url,
        is_available: true
      })
    });

    showToast('Coffee product added successfully to catalog!', 'success');
    document.getElementById('admin-add-product-form').reset();
    toggleRoastInput('drink'); // hide roast group again
    
    // Refresh public catalog & admin dashboard
    fetchProducts();
    fetchAdminData();
  } catch (error) {
    showToast(`Failed to add product: ${error.message}`, 'error');
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

// --- Mobile Navigation Menu Toggle ---
function toggleMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  if (navLinks) {
    navLinks.classList.toggle('open');
    const isOpen = navLinks.classList.contains('open');
    if (toggleBtn) {
      toggleBtn.innerHTML = isOpen ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    }
  }
}

function closeMobileMenu() {
  const navLinks = document.querySelector('.nav-links');
  const toggleBtn = document.getElementById('mobile-nav-toggle');
  if (navLinks && navLinks.classList.contains('open')) {
    navLinks.classList.remove('open');
    if (toggleBtn) {
      toggleBtn.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
  }
}

// --- Customer Order & Quote Dashboard Deletion handlers ---
async function handleCancelUserOrder(orderId) {
  showCustomConfirm(
    'Cancel Order',
    `Are you sure you want to cancel and delete order #${orderId}?`,
    async () => {
      try {
        await apiRequest(`/orders?order_id=${orderId}`, {
          method: 'DELETE'
        });
        showToast(`Order #${orderId} has been successfully cancelled and deleted.`, 'success');
        fetchDashboardData();
      } catch (error) {
        showToast(`Failed to cancel order: ${error.message}`, 'error');
      }
    },
    true
  );
}

async function handleDeleteUserQuote(quoteId) {
  showCustomConfirm(
    'Delete Quote Request',
    `Are you sure you want to permanently delete wholesale quote request #${quoteId}?`,
    async () => {
      try {
        await apiRequest(`/quotes?quote_id=${quoteId}`, {
          method: 'DELETE'
        });
        showToast(`Quote request #${quoteId} has been successfully deleted.`, 'success');
        fetchDashboardData();
      } catch (error) {
        showToast(`Failed to delete quote: ${error.message}`, 'error');
      }
    },
    true
  );
}

// --- Admin Order CRUD operations controllers ---
async function handleAdminUpdateStatus(orderId, newStatus) {
  try {
    await apiRequest('/admin', {
      method: 'PUT',
      body: JSON.stringify({ order_id: orderId, status: newStatus })
    });
    showToast(`Order #${orderId} status updated to ${newStatus.toUpperCase()}`, 'success');
    fetchAdminData();
  } catch (error) {
    showToast(`Failed to update order status: ${error.message}`, 'error');
  }
}

function openAdminEditOrderModal(orderId, orderType, totalPrice, status) {
  document.getElementById('edit-order-id').value = orderId;
  document.getElementById('edit-order-id-display').value = `#${orderId}`;
  document.getElementById('edit-order-type').value = orderType;
  document.getElementById('edit-order-price').value = totalPrice;
  document.getElementById('edit-order-status').value = status;
  
  document.getElementById('admin-edit-order-modal').classList.add('open');
}

function closeAdminEditOrderModal() {
  document.getElementById('admin-edit-order-modal').classList.remove('open');
}

async function handleAdminEditOrderSubmit(event) {
  event.preventDefault();
  const orderId = parseInt(document.getElementById('edit-order-id').value, 10);
  const orderType = document.getElementById('edit-order-type').value;
  const totalPrice = parseFloat(document.getElementById('edit-order-price').value);
  const status = document.getElementById('edit-order-status').value;

  try {
    await apiRequest('/admin', {
      method: 'PUT',
      body: JSON.stringify({
        order_id: orderId,
        order_type: orderType,
        total_price: totalPrice,
        status: status
      })
    });
    showToast(`Order #${orderId} details updated successfully`, 'success');
    closeAdminEditOrderModal();
    fetchAdminData();
  } catch (error) {
    showToast(`Failed to edit order details: ${error.message}`, 'error');
  }
}

function openAdminDeleteOrderModal(orderId) {
  document.getElementById('delete-order-id-display').textContent = `#${orderId}`;
  const confirmBtn = document.getElementById('confirm-delete-order-btn');
  confirmBtn.onclick = () => handleAdminDeleteOrder(orderId);
  
  document.getElementById('admin-delete-order-modal').classList.add('open');
}

function closeAdminDeleteOrderModal() {
  document.getElementById('admin-delete-order-modal').classList.remove('open');
}

async function handleAdminDeleteOrder(orderId) {
  try {
    await apiRequest(`/admin?order_id=${orderId}`, {
      method: 'DELETE'
    });
    showToast(`Order #${orderId} deleted successfully from database`, 'success');
    closeAdminDeleteOrderModal();
    fetchAdminData();
  } catch (error) {
    showToast(`Failed to delete order: ${error.message}`, 'error');
  }
}

// --- Scroll Spy dynamic navigation highlighter ---
function handleScrollSpy() {
  const homeView = document.getElementById('home-view');
  if (!homeView || homeView.style.display === 'none') return;

  const sections = [
    { id: 'home', element: document.querySelector('.hero') },
    { id: 'features', element: document.getElementById('features') },
    { id: 'catalog', element: document.getElementById('catalog') },
    { id: 'contact', element: document.getElementById('contact') }
  ];

  const scrollPosition = window.scrollY + 160; // offset for the fixed main header height

  let activeSectionId = 'home';
  for (const section of sections) {
    if (section.element) {
      const top = section.element.offsetTop;
      const height = section.element.offsetHeight;
      if (scrollPosition >= top && scrollPosition < top + height) {
        activeSectionId = section.id;
      }
    }
  }

  // Update navbar links active styling
  const navLinks = document.querySelectorAll('.nav-links a');
  navLinks.forEach(link => {
    link.classList.remove('active');
    const href = link.getAttribute('href');
    if (href === '/home' && activeSectionId === 'home') {
      link.classList.add('active');
    } else if (href === `/${activeSectionId}`) {
      link.classList.add('active');
    }
  });
}

// --- Custom Confirmation Modal Controllers ---
let confirmCallback = null;

function showCustomConfirm(title, message, onConfirm, isWarning = false) {
  const modal = document.getElementById('custom-confirm-modal');
  const modalTitle = document.getElementById('confirm-modal-title');
  const modalMsg = document.getElementById('confirm-modal-message');
  const icon = document.getElementById('confirm-modal-icon');
  const okBtn = document.getElementById('confirm-modal-ok-btn');

  if (!modal || !modalTitle || !modalMsg || !icon || !okBtn) return;

  modalTitle.textContent = title;
  modalMsg.textContent = message;

  if (isWarning) {
    icon.className = 'fa-solid fa-triangle-exclamation';
    icon.style.color = '#ff4d4d';
    okBtn.style.background = '#dc3545';
    okBtn.style.borderColor = '#dc3545';
  } else {
    icon.className = 'fa-solid fa-circle-question';
    icon.style.color = 'var(--accent-gold)';
    okBtn.style.background = 'var(--accent-gold-dark)';
    okBtn.style.borderColor = 'var(--accent-gold-dark)';
  }

  confirmCallback = onConfirm;
  modal.classList.add('open');
}

function closeCustomConfirm(confirmed = false) {
  const modal = document.getElementById('custom-confirm-modal');
  if (modal) {
    modal.classList.remove('open');
  }
  
  if (confirmed && typeof confirmCallback === 'function') {
    confirmCallback();
  }
  confirmCallback = null;
}

// Add standard confirm event listener once DOM loaded
document.addEventListener('DOMContentLoaded', () => {
  const okBtn = document.getElementById('confirm-modal-ok-btn');
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      closeCustomConfirm(true);
    });
  }
});
