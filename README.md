# ☕ BeanForge

> A premium, full-stack Coffee Procurement & Café Ordering System.

BeanForge is a digital hub designed for coffee enthusiasts, café clients, and B2B wholesale buyers. The application features a stunning responsive frontend interface that supports menu browsing, real-time item customization, cart actions, favorites tracking, and orders checkout. It is powered by a modular Node.js API backend and a MySQL database.

---

## 🌟 Key Features

- **🔒 Role-Based Authentication**: Secure customer registration and login with passwords hashed using `bcrypt` and authenticated using JSON Web Tokens (JWT).
- **📋 Menu & Interactive Discovery**: Browse premium coffee beans and café drinks, filterable by type, category, origin, and roast level.
- **❤️ Favorites Persistence**: Save/like favorite products linked to user accounts.
- **🛒 Dynamic Shopping Cart**: Add, increment, decrement, and clear cart items before checkouts.
- **📦 Café Ordering & Checkout**: Seamless order placement with intelligent categorization (e.g., bulk beans vs. immediate café drinks).
- **💼 B2B Wholesale Procurement Quotes**: Submit tailored wholesale quotes for coffee beans (in lbs) with optional specifications and status tracking.
- **📊 Interactive Admin Dashboard**: High-level system statistics (User, Order, and Product counts), comprehensive global orders tracking, and user list views for admins.

---

## 🛠️ Tech Stack

- **Frontend**: Vanilla HTML5, CSS3 (Modern Glassmorphism & custom variables), Vanilla JavaScript (SPA client-side router & API integration).
- **Backend**: Node.js custom Zero-Dependency local development server matching Vercel Serverless Function signatures.
- **Database**: MySQL (hosted on Railway or local server).
- **Security**: JWT (`jsonwebtoken`) for authorization; password hashing using `bcryptjs`.

---

## 📂 Project Structure

```
├── api/                  # Backend API routes (Serverless Functions)
│   ├── admin.js          # Admin dashboard metrics and tables list
│   ├── auth.js           # Authentication handler (register/login)
│   ├── authHelper.js     # JWT verification helper utility
│   ├── cart.js           # Shopping cart operations (GET/POST/PUT/DELETE)
│   ├── db.js             # MySQL database connection pool & query runner
│   ├── likes.js          # Favorites/Likes management
│   ├── orders.js         # Order processing and order history retrieval
│   ├── products.js       # Product retrieval and management (Admin add)
│   ├── quotes.js         # Wholesale procurement quote requests
│   └── test-db.js        # Diagnostic endpoint for database connectivity
├── public/               # Client-side static assets
│   ├── app.js            # SPA application controller & API client logic
│   ├── index.html        # Single HTML file structure (Dynamic views)
│   ├── style.css         # Custom modern Glassmorphic style sheet
│   └── hero_coffee_cup.png
├── .env                  # Environment Variables (Ignored in Git)
├── .gitignore            # Files excluded from git tracking
├── .vercelignore         # Files excluded from deployment
├── package.json          # Node dependencies & npm scripts
├── server.js             # Local hot-reloading development server
└── vercel.json           # Vercel deployment configuration
```

---

## 🗄️ Database Schema

BeanForge uses a relational MySQL database. Below is the SQL schema required to build and connect all 7 tables:

```sql
-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(255) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'customer',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table
CREATE TABLE IF NOT EXISTS products (
  product_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL, -- 'bean' or 'drink'
  category VARCHAR(255),
  origin VARCHAR(255),
  roast_level VARCHAR(255),
  price DECIMAL(10, 2) NOT NULL,
  description TEXT,
  image_url VARCHAR(500),
  is_available BOOLEAN DEFAULT TRUE
);

-- 3. Likes/Favorites Table
CREATE TABLE IF NOT EXISTS likes (
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  PRIMARY KEY (user_id, product_id),
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- 4. Cart Table
CREATE TABLE IF NOT EXISTS cart (
  cart_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- 5. Orders Table (Header)
CREATE TABLE IF NOT EXISTS orders (
  order_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  order_type VARCHAR(50) NOT NULL, -- 'bean' or 'drink'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 6. Order Items Table (Details)
CREATE TABLE IF NOT EXISTS order_items (
  item_id INT AUTO_INCREMENT PRIMARY KEY,
  order_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);

-- 7. Quotes Table (Wholesale requests)
CREATE TABLE IF NOT EXISTS quotes (
  quote_id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  product_id INT NOT NULL,
  quantity_lbs INT NOT NULL,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE
);
```

---

## ⚙️ Installation & Setup

### 1. Clone & Install Dependencies
Navigate to the root directory and install node packages:
```bash
npm install
```

### 2. Configure Environment Variables
Create a file named `.env` in the root folder (this file is gitignored to secure database credentials) and set the following parameters:
```env
# Database configuration (MySQL)
DB_HOST=your-db-host
DB_PORT=3306
DB_USER=your-db-user
DB_PASSWORD=your-db-password
DB_NAME=your-db-name

# JWT Configuration
JWT_SECRET=your-jwt-signing-secret

# Server Configuration (Optional)
PORT=3000
```

### 3. Run Development Server
Start the local server using the NPM script:
```bash
npm run dev
```
The server will boot up and be accessible locally at `http://localhost:3000`.

---

## 🚀 Production & Deployment

This application is fully optimized for **Vercel** serverless functions.
Deploy immediately by running:
```bash
vercel
```
Vercel will build the frontend files and dynamically route any request to `/api/*` to the respective file in the `/api` directory.
