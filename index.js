const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static file paths
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

app.use('/data', express.static(path.join(__dirname, '../data')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});




// Ensure folders exist
['../uploads/items', '../uploads/slideshow', '../data'].forEach(folder => {
  const dir = path.join(__dirname, folder);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Multer setup
const itemStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, '../uploads/items')),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const slideshowStorage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, path.join(__dirname, '../uploads/slideshow')),
  filename: (_, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const uploadItem = multer({ storage: itemStorage });
const uploadSlideshow = multer({ storage: slideshowStorage });

// JSON utility
const loadJSON = (filePath) => {
  try {
    if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, '[]');
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.error('Failed to read JSON:', filePath, err);
    return [];
  }
};
const saveJSON = (filePath, data) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Failed to save JSON:', filePath, err);
  }
};

// Paths
const ITEMS_PATH = path.join(__dirname, '../data/items.json');
const SLIDESHOW_PATH = path.join(__dirname, '../data/slideshow.json');
const ORDERS_PATH = path.join(__dirname, '../data/orders.json');
const BUYERS_PATH = path.join(__dirname, '../data/buyers.json');
const STOCK_LOG_PATH = path.join(__dirname, '../data/out-of-stock.log');
// Routes

// Upload item
app.post('/api/upload-item', uploadItem.array('photos'), (req, res) => {
  const { name, model, quality, description, price, crypto1, crypto2, coinType, stock } = req.body; // ✅ added stock
  const photos = req.files.map(file => '/uploads/items/' + file.filename);
  const items = loadJSON(ITEMS_PATH);

  const newItem = {
    id: Date.now(),
    name,
    model,
    quality,
    description,
    price,
    coinType,
    stock: parseInt(stock) || 0, // ✅ now stock is defined
    photos
  };

  items.push(newItem);
  saveJSON(ITEMS_PATH, items);
  res.json({ success: true });
});


// Delete item
app.post('/api/delete-item', (req, res) => {
  const { id } = req.body;
  const items = loadJSON(ITEMS_PATH);
  const item = items.find(i => i.id == id);
  if (!item) return res.status(404).json({ error: 'Item not found' });

  item.photos.forEach(photoPath => {
    const fullPath = path.join(__dirname, '../' + photoPath);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  });

  const updated = items.filter(i => i.id != id);
  saveJSON(ITEMS_PATH, updated);
  res.json({ success: true });
});

// Upload slideshow
app.post('/api/upload-slideshow', uploadSlideshow.single('media'), (req, res) => {
  const file = req.file;
  const slideshow = loadJSON(SLIDESHOW_PATH);
  slideshow.push({ id: Date.now(), path: '/uploads/slideshow/' + file.filename });
  saveJSON(SLIDESHOW_PATH, slideshow);
  res.json({ success: true });
});

// Delete slideshow
app.post('/api/delete-slideshow', (req, res) => {
  const { id } = req.body;
  const slideshow = loadJSON(SLIDESHOW_PATH);
  const entry = slideshow.find(s => s.id == id);
  if (!entry) return res.status(404).json({ error: 'Slideshow not found' });

  const filePath = path.join(__dirname, '../' + entry.path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  const updated = slideshow.filter(s => s.id != id);
  saveJSON(SLIDESHOW_PATH, updated);
  res.json({ success: true });
});

// Fetch data
app.get('/api/items', (_, res) => res.json(loadJSON(ITEMS_PATH)));
app.get('/api/slideshow', (_, res) => res.json(loadJSON(SLIDESHOW_PATH)));
app.get('/api/orders', (_, res) => res.json(loadJSON(ORDERS_PATH)));

// Save order
app.post('/api/save-order', (req, res) => {
  const { items } = req.body;
  const orders = loadJSON(ORDERS_PATH);
  orders.push({ timestamp: new Date().toISOString(), items });
  saveJSON(ORDERS_PATH, orders);
  res.json({ success: true });
});

// Save buyer details
app.post('/api/buyers', (req, res) => {
  const buyer = req.body;
  const buyers = loadJSON(BUYERS_PATH);
  buyers.push({ ...buyer, timestamp: new Date().toISOString() });
  saveJSON(BUYERS_PATH, buyers);
  res.sendStatus(200);
});

// Serve buyers.json for control panel access
app.get('/buyers.json', (req, res) => {
  res.sendFile(path.join(__dirname, '../data/buyers.json'));
});

// Send email confirmation
app.post('/api/send-confirmation', async (req, res) => {
  const { email, itemName } = req.body;

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL,
        pass: process.env.EMAIL_PASS
      }
    });

    await transporter.sendMail({
      from: process.env.EMAIL,
      to: email,
      subject: 'Payment Confirmation',
      html: `<h2>Congratulations!</h2><p>Your payment for <b>${itemName}</b> was successful.</p>`
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Email error:', err);
    res.status(500).json({ error: 'Failed to send email.' });
  }
});



// Reduce stock from frontend
app.post('/api/update-stock', (req, res) => {
  const { cart } = req.body;
  const allItems = loadJSON(ITEMS_PATH);

  cart.forEach(purchased => {
    const item = allItems.find(i => i.id == purchased.id);
    if (item && item.stock !== undefined) {
      item.stock = Math.max(0, item.stock - (purchased.qty || 1));
      if (item.stock === 0) {
        const logMsg = `${new Date().toISOString()} - ${item.name} is out of stock (via /api/update-stock)\n`;
        fs.appendFileSync(STOCK_LOG_PATH, logMsg);
        console.log(`⚠️ STOCK 0 (update-stock): ${item.name}`);
      }
    }
  });

  saveJSON(ITEMS_PATH, allItems);
  res.json({ success: true });
});



app.delete('/api/delete-buyer/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const buyersPath = path.join(__dirname, '../data/buyers.json');
  let buyers = loadJSON(buyersPath);

  if (isNaN(index) || index < 0 || index >= buyers.length) {
    return res.status(400).json({ error: 'Invalid index' });
  }

  buyers.splice(index, 1); // Remove buyer
  saveJSON(buyersPath, buyers);

  res.status(200).json({ message: `Buyer at index ${index} deleted.` });
});


app.delete('/api/clear-buyers', (req, res) => {
  const buyersPath = path.join(__dirname, '../data/buyers.json');
  saveJSON(buyersPath, []); // Clear the file
  res.status(200).json({ message: 'All buyers cleared.' });
});



const INQUIRIES_PATH = path.join(__dirname, '../data/inquiries.json');
const SUPPORT_PATH = path.join(__dirname, '../data/support.json');

// Receive inquiry form
app.post('/api/inquiry', (req, res) => {
  const inquiry = req.body;
  const list = loadJSON(INQUIRIES_PATH);
  list.push({ ...inquiry, timestamp: new Date().toISOString() });
  saveJSON(INQUIRIES_PATH, list);
  res.status(200).json({ success: true });
});

// Receive support ticket
app.post('/api/support', (req, res) => {
  const ticket = req.body;
  const list = loadJSON(SUPPORT_PATH);
  list.push({ ...ticket, timestamp: new Date().toISOString() });
  saveJSON(SUPPORT_PATH, list);
  res.status(200).json({ success: true });
});
app.delete('/api/delete-inquiry/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const list = loadJSON(INQUIRIES_PATH);
  if (index < 0 || index >= list.length) return res.status(400).json({ error: 'Invalid index' });

  list.splice(index, 1);
  saveJSON(INQUIRIES_PATH, list);
  res.status(200).json({ message: 'Inquiry deleted' });
});

app.delete('/api/delete-support/:index', (req, res) => {
  const index = parseInt(req.params.index);
  const list = loadJSON(SUPPORT_PATH);
  if (index < 0 || index >= list.length) return res.status(400).json({ error: 'Invalid index' });

  list.splice(index, 1);
  saveJSON(SUPPORT_PATH, list);
  res.status(200).json({ message: 'Support ticket deleted' });
});


// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});

