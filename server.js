const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const dbPath = path.join(__dirname, "database.db");
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
  db.run("PRAGMA foreign_keys = ON;");
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        reject(err);
        return;
      }

      resolve(rows);
    });
  });
}

function createToken(user) {
  return jwt.sign(
    { userId: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "2h" }
  );
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "Authentication required." });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload;
    return next();
  } catch (_err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions." });
    }

    return next();
  };
}

app.post("/api/signup", async (req, res) => {
  const { username, password } = req.body;

  if (!username || typeof username !== "string" || username.trim().length < 3) {
    return res.status(400).json({ error: "Username must be at least 3 characters." });
  }

  if (!password || typeof password !== "string" || password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters." });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);
    const sql = "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)";
    const role = "consumer";

    db.run(sql, [username.trim(), passwordHash, role], function onCreate(err) {
      if (err) {
        if (err.message.includes("UNIQUE")) {
          return res.status(409).json({ error: "Username already exists." });
        }
        return res.status(500).json({ error: "Failed to create user." });
      }

      const token = createToken({ id: this.lastID, username: username.trim(), role });
      return res.status(201).json({ token, userId: this.lastID, username: username.trim(), role });
    });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to hash password." });
  }
});

app.post("/api/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const sql = "SELECT id, username, password_hash, role FROM users WHERE username = ?";
  db.get(sql, [username.trim()], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: "Failed to login." });
    }

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid credentials." });
    }

    const token = createToken({ id: user.id, username: user.username, role: user.role });
    return res.json({ token, userId: user.id, username: user.username, role: user.role });
  });
});

app.get("/api/suppliers", requireAuth, (_req, res) => {
  const sql = "SELECT id, name, contact_info FROM suppliers ORDER BY id ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch suppliers." });
    }
    return res.json(rows);
  });
});

app.post("/api/suppliers", requireAuth, (req, res) => {
  const { name, contact_info } = req.body;

  if (!name || !contact_info) {
    return res.status(400).json({ error: "Name and contact_info are required." });
  }

  const sql = "INSERT INTO suppliers (name, contact_info) VALUES (?, ?)";
  db.run(sql, [String(name).trim(), String(contact_info).trim()], function onInsert(err) {
    if (err) {
      return res.status(500).json({ error: "Failed to add supplier." });
    }
    return res.status(201).json({ id: this.lastID, name: String(name).trim(), contact_info: String(contact_info).trim() });
  });
});

app.delete("/api/suppliers/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid supplier id." });
  }

  db.run("DELETE FROM suppliers WHERE id = ?", [id], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: "Failed to delete supplier." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Supplier not found." });
    }
    return res.json({ message: "Supplier deleted." });
  });
});

app.get("/api/employees", requireAuth, (_req, res) => {
  const sql = "SELECT id, name, role, user_id FROM employees ORDER BY id ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch employees." });
    }
    return res.json(rows);
  });
});

app.post("/api/employees", requireAuth, (req, res) => {
  const { name, role, user_id } = req.body;
  if (!name || !role) {
    return res.status(400).json({ error: "Name and role are required." });
  }

  const parsedUserId = user_id == null ? null : Number(user_id);
  if (parsedUserId != null && (!Number.isInteger(parsedUserId) || parsedUserId <= 0)) {
    return res.status(400).json({ error: "user_id must be a positive integer when provided." });
  }

  const sql = "INSERT INTO employees (name, role, user_id) VALUES (?, ?, ?)";
  db.run(sql, [String(name).trim(), String(role).trim(), parsedUserId], function onInsert(err) {
    if (err) {
      return res.status(500).json({ error: "Failed to add employee." });
    }
    return res.status(201).json({ id: this.lastID, name: String(name).trim(), role: String(role).trim(), user_id: parsedUserId });
  });
});

app.delete("/api/employees/:id", requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid employee id." });
  }

  db.run("DELETE FROM employees WHERE id = ?", [id], function onDelete(err) {
    if (err) {
      return res.status(500).json({ error: "Failed to delete employee." });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: "Employee not found." });
    }
    return res.json({ message: "Employee deleted." });
  });
});

app.get("/api/customers", requireAuth, (_req, res) => {
  const sql = "SELECT id, username, role FROM users ORDER BY id ASC";
  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch customers." });
    }
    return res.json(rows);
  });
});

app.patch("/api/users/:id/role", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = Number(req.params.id);
  const roleRaw = String(req.body.role || "").trim().toLowerCase();

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  if (roleRaw !== "admin" && roleRaw !== "consumer") {
    return res.status(400).json({ error: "Role must be either 'admin' or 'consumer'." });
  }

  const normalizedRole = roleRaw;

  try {
    const updateResult = await dbRun(
      "UPDATE users SET role = ? WHERE id = ?",
      [normalizedRole, userId]
    );

    if (updateResult.changes === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    const updatedUser = await dbGet(
      "SELECT id, username, role FROM users WHERE id = ?",
      [userId]
    );

    return res.json({
      message: "User role updated successfully.",
      user: updatedUser
    });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to update user role." });
  }
});

app.delete("/api/users/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid user id." });
  }

  if (Number(req.user.userId) === userId) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  try {
    const deletion = await dbRun("DELETE FROM users WHERE id = ?", [userId]);
    if (deletion.changes === 0) {
      return res.status(404).json({ error: "User not found." });
    }

    return res.json({ message: "User removed successfully." });
  } catch (err) {
    const errorText = String((err && err.message) || "");
    if ((err && err.code === "SQLITE_CONSTRAINT") || errorText.includes("FOREIGN KEY")) {
      return res.status(400).json({ error: "Cannot remove this user because they are linked to existing records." });
    }

    return res.status(500).json({ error: "Failed to remove user." });
  }
});

app.post("/api/customers", requireAuth, (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "Name and email are required." });
  }

  const sql = "INSERT INTO customers (name, email) VALUES (?, ?)";
  db.run(sql, [String(name).trim(), String(email).trim()], function onInsert(err) {
    if (err) {
      if (err.message.includes("UNIQUE")) {
        return res.status(409).json({ error: "Email already exists." });
      }
      return res.status(500).json({ error: "Failed to add customer." });
    }
    return res.status(201).json({ id: this.lastID, name: String(name).trim(), email: String(email).trim() });
  });
});

app.delete("/api/customers/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ error: "Invalid customer id." });
  }

  if (Number(req.user.userId) === userId) {
    return res.status(400).json({ error: "You cannot delete your own account." });
  }

  try {
    const deletion = await dbRun("DELETE FROM users WHERE id = ?", [userId]);
    if (deletion.changes === 0) {
      return res.status(404).json({ error: "User not found." });
    }
    return res.json({ message: "Customer removed." });
  } catch (err) {
    const errorText = String((err && err.message) || "");
    if ((err && err.code === "SQLITE_CONSTRAINT") || errorText.includes("FOREIGN KEY")) {
      return res.status(400).json({ error: "Cannot remove this user because they are linked to existing records." });
    }
    return res.status(500).json({ error: "Failed to remove customer." });
  }
});

app.get("/api/orders", requireAuth, async (_req, res) => {
  try {
    const isAdmin = _req.user.role === "admin";
    const orderSqlAdmin = `
      SELECT
        o.id,
        o.user_id,
        o.customer_id,
        u.username AS customer_name,
        o.employee_id,
        e.name AS employee_name,
        o.order_date,
        o.status,
        o.total_amount
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN employees e ON e.id = o.employee_id
      ORDER BY o.order_date DESC, o.id DESC
    `;

    const orderSqlConsumer = `
      SELECT
        o.id,
        o.user_id,
        o.customer_id,
        u.username AS customer_name,
        o.employee_id,
        e.name AS employee_name,
        o.order_date,
        o.status,
        o.total_amount
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN employees e ON e.id = o.employee_id
      WHERE o.user_id = ?
      ORDER BY o.order_date DESC, o.id DESC
    `;

    const orders = await dbAll(isAdmin ? orderSqlAdmin : orderSqlConsumer, isAdmin ? [] : [_req.user.userId]);
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => {
        const itemsSql = `
          SELECT
            oi.id,
            oi.order_id,
            oi.product_id,
            p.name AS product_name,
            oi.quantity,
            oi.price_at_time_of_purchase
          FROM order_items oi
          JOIN products p ON p.id = oi.product_id
          WHERE oi.order_id = ?
          ORDER BY oi.id ASC
        `;

        const items = await dbAll(itemsSql, [order.id]);
        return {
          ...order,
          items
        };
      })
    );

    return res.json(ordersWithItems);
  } catch (_err) {
    return res.status(500).json({ error: "Failed to fetch orders." });
  }
});

app.post("/api/orders", requireAuth, async (req, res) => {
  const { customer_id, employee_id, items } = req.body;

  const customerId = Number(customer_id);
  const employeeId = Number(employee_id);

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return res.status(400).json({ error: "customer_id must be a positive integer." });
  }

  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    return res.status(400).json({ error: "employee_id must be a positive integer." });
  }

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "items must be a non-empty array." });
  }

  const normalizedItems = new Map();
  for (const item of items) {
    const productId = Number(item.product_id);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(productId) || productId <= 0) {
      return res.status(400).json({ error: "Each item needs a valid product_id." });
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Each item needs a positive integer quantity." });
    }

    const existingQty = normalizedItems.get(productId) || 0;
    normalizedItems.set(productId, existingQty + quantity);
  }

  let transactionStarted = false;
  try {
    await dbRun("BEGIN IMMEDIATE TRANSACTION");
    transactionStarted = true;

    const customer = await dbGet("SELECT id, name FROM customers WHERE id = ?", [customerId]);
    if (!customer) {
      throw new Error("Customer not found.");
    }

    const employee = await dbGet("SELECT id, name FROM employees WHERE id = ?", [employeeId]);
    if (!employee) {
      throw new Error("Employee not found.");
    }

    const lineItems = [];
    let totalAmount = 0;

    for (const [productId, quantity] of normalizedItems.entries()) {
      const product = await dbGet(
        "SELECT id, name, price, stock_quantity FROM products WHERE id = ?",
        [productId]
      );

      if (!product) {
        throw new Error(`Product ${productId} not found.`);
      }

      if (product.stock_quantity < quantity) {
        throw new Error(`Insufficient stock for ${product.name}.`);
      }

      const lineTotal = Number(product.price) * quantity;
      totalAmount += lineTotal;
      lineItems.push({
        product_id: product.id,
        product_name: product.name,
        quantity,
        price_at_time_of_purchase: Number(product.price)
      });
    }

    totalAmount = Number(totalAmount.toFixed(2));
    const orderDate = new Date().toISOString();
    const orderStatus = "Pending";

    const insertedOrder = await dbRun(
      "INSERT INTO orders (user_id, customer_id, employee_id, order_date, status, total_amount) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.userId, customerId, employeeId, orderDate, orderStatus, totalAmount]
    );

    for (const lineItem of lineItems) {
      await dbRun(
        "INSERT INTO order_items (order_id, product_id, quantity, price_at_time_of_purchase) VALUES (?, ?, ?, ?)",
        [insertedOrder.lastID, lineItem.product_id, lineItem.quantity, lineItem.price_at_time_of_purchase]
      );

      const stockUpdate = await dbRun(
        "UPDATE products SET stock_quantity = stock_quantity - ? WHERE id = ? AND stock_quantity >= ?",
        [lineItem.quantity, lineItem.product_id, lineItem.quantity]
      );

      if (stockUpdate.changes === 0) {
        throw new Error(`Failed stock update for product ${lineItem.product_id}.`);
      }
    }

    await dbRun("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      id: insertedOrder.lastID,
      user_id: req.user.userId,
      customer_id: customerId,
      customer_name: customer.name,
      employee_id: employeeId,
      employee_name: employee.name,
      order_date: orderDate,
      status: orderStatus,
      total_amount: totalAmount,
      items: lineItems
    });
  } catch (err) {
    if (transactionStarted) {
      try {
        await dbRun("ROLLBACK");
      } catch (_rollbackErr) {
        return res.status(500).json({ error: "Order failed and rollback did not complete cleanly." });
      }
    }

    const knownError = String(err.message || "");
    if (knownError.includes("not found") || knownError.includes("Insufficient stock")) {
      return res.status(400).json({ error: knownError });
    }

    return res.status(500).json({ error: "Failed to create order." });
  }
});

app.patch("/api/orders/:id/pay", requireAuth, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ error: "Invalid order id." });
  }

  try {
    const order = await dbGet(
      "SELECT id, user_id, status FROM orders WHERE id = ?",
      [orderId]
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    const isAdmin = req.user.role === "admin";
    const isOwner = Number(order.user_id) === Number(req.user.userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: "Forbidden: insufficient permissions." });
    }

    if (order.status === "Paid") {
      return res.json({ id: order.id, status: "Paid", message: "Order is already paid." });
    }

    await dbRun(
      "UPDATE orders SET status = 'Paid' WHERE id = ? AND status = 'Pending'",
      [orderId]
    );

    return res.json({ id: order.id, status: "Paid", message: "Order marked as paid." });
  } catch (_err) {
    return res.status(500).json({ error: "Failed to update order payment status." });
  }
});

app.get("/api/products", (_req, res) => {
  const sql = "SELECT id, name, price, stock_quantity, supplier_id FROM products ORDER BY id ASC";

  db.all(sql, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: "Failed to fetch products." });
    }

    return res.json(rows);
  });
});

app.post("/api/products", requireAuth, requireRole("admin"), async (req, res) => {
  const { name, price, stock_quantity, supplier_name } = req.body;

  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "A valid product name is required." });
  }

  if (!supplier_name || typeof supplier_name !== "string" || supplier_name.trim().length === 0) {
    return res.status(400).json({ error: "A valid supplier name is required." });
  }

  const parsedPrice = Number(price);
  const parsedStock = Number(stock_quantity);

  if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
    return res.status(400).json({ error: "Price must be a non-negative number." });
  }

  if (!Number.isInteger(parsedStock) || parsedStock < 0) {
    return res.status(400).json({ error: "Stock quantity must be a non-negative integer." });
  }

  const normalizedName = name.trim();
  const normalizedSupplierName = supplier_name.trim();
  let transactionStarted = false;

  try {
    await dbRun("BEGIN IMMEDIATE TRANSACTION");
    transactionStarted = true;

    const existingSupplier = await dbGet(
      "SELECT id, name FROM suppliers WHERE LOWER(name) = LOWER(?) LIMIT 1",
      [normalizedSupplierName]
    );

    let supplierId;
    let supplierName;
    if (existingSupplier) {
      supplierId = existingSupplier.id;
      supplierName = existingSupplier.name;
    } else {
      const supplierInsert = await dbRun(
        "INSERT INTO suppliers (name, contact_info) VALUES (?, ?)",
        [normalizedSupplierName, "Added from product form"]
      );
      supplierId = supplierInsert.lastID;
      supplierName = normalizedSupplierName;
    }

    const productInsert = await dbRun(
      "INSERT INTO products (name, price, stock_quantity, supplier_id) VALUES (?, ?, ?, ?)",
      [normalizedName, parsedPrice, parsedStock, supplierId]
    );

    await dbRun("COMMIT");
    transactionStarted = false;

    return res.status(201).json({
      id: productInsert.lastID,
      name: normalizedName,
      price: parsedPrice,
      stock_quantity: parsedStock,
      supplier_id: supplierId,
      supplier_name: supplierName
    });
  } catch (_err) {
    if (transactionStarted) {
      try {
        await dbRun("ROLLBACK");
      } catch (_rollbackErr) {
        return res.status(500).json({ error: "Failed to add product and rollback transaction." });
      }
    }

    return res.status(500).json({ error: "Failed to add product." });
  }
});

app.patch("/api/products/:id", requireAuth, (req, res) => {
  const productId = Number(req.params.id);
  const { action, quantity } = req.body;

  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ error: "Invalid product id." });
  }

  const parsedQty = Number(quantity || 1);
  if (!Number.isInteger(parsedQty) || parsedQty <= 0) {
    return res.status(400).json({ error: "Quantity must be a positive integer." });
  }

  if (action !== "increment" && action !== "decrement") {
    return res.status(400).json({ error: "Action must be increment or decrement." });
  }

  if (action === "increment" && req.user.role !== "admin") {
    return res.status(403).json({ error: "Only admins can increase stock." });
  }

  const signedQty = action === "increment" ? parsedQty : -parsedQty;

  const updateSql = `
    UPDATE products
    SET stock_quantity = stock_quantity + ?
    WHERE id = ? AND stock_quantity + ? >= 0
  `;

  db.run(updateSql, [signedQty, productId, signedQty], function onUpdate(err) {
    if (err) {
      return res.status(500).json({ error: "Failed to update stock." });
    }

    if (this.changes === 0) {
      const checkSql = "SELECT id FROM products WHERE id = ?";
      db.get(checkSql, [productId], (checkErr, row) => {
        if (checkErr) {
          return res.status(500).json({ error: "Failed to verify product." });
        }

        if (!row) {
          return res.status(404).json({ error: "Product not found." });
        }

        return res.status(409).json({ error: "Insufficient stock for this operation." });
      });
      return;
    }

    const selectSql = "SELECT id, name, price, stock_quantity, supplier_id FROM products WHERE id = ?";
    db.get(selectSql, [productId], (selectErr, updatedRow) => {
      if (selectErr) {
        return res.status(500).json({ error: "Failed to fetch updated product." });
      }

      return res.json(updatedRow);
    });
  });
});

app.delete("/api/products/:id", requireAuth, requireRole("admin"), async (req, res) => {
  const productId = Number(req.params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: "Invalid product id." });
  }

  try {
    const inOrderItem = await dbGet(
      "SELECT id FROM order_items WHERE product_id = ? LIMIT 1",
      [productId]
    );

    if (inOrderItem) {
      return res.status(400).json({
        message: "Cannot delete this product because it is part of existing customer orders."
      });
    }

    const deletion = await dbRun("DELETE FROM products WHERE id = ?", [productId]);
    if (deletion.changes === 0) {
      return res.status(404).json({ message: "Product not found." });
    }

    return res.json({ message: "Product deleted successfully." });
  } catch (err) {
    const errorText = String((err && err.message) || "");
    if ((err && err.code === "SQLITE_CONSTRAINT") || errorText.includes("FOREIGN KEY")) {
      return res.status(400).json({
        message: "Cannot delete this product because it is part of existing customer orders."
      });
    }

    return res.status(500).json({ message: "Failed to delete product." });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

process.on("SIGINT", () => {
  db.close(() => {
    process.exit(0);
  });
});
