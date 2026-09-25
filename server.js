const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Папка для хранения данных
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const DB_FILE = path.join(DATA_DIR, 'db.json');

// Структура базы данных
const DEFAULT_DB = {
    employees: [
        { id: 1, name: 'Садрединов В.А', password: '130425', icon: '👤' },
        { id: 2, name: 'Иванов И.И.', password: '1111', icon: '👨' },
        { id: 3, name: 'Петров П.П.', password: '2222', icon: '🧑' }
    ],
    shops: [
        { id: 1, name: 'ТОО «Солнечный»', buyer: 'Петров П.П.' },
        { id: 2, name: 'ИП «Дружба»', buyer: 'Сидоров С.С.' },
        { id: 3, name: 'ТОО «Алма»', buyer: 'Козлова А.А.' }
    ],
    stock: [
        { id: 1, name: 'Молоко 3.2%', price: 85, qty: 15, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🥛'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🥛', desc: 'Свежее молоко 3.2%' },
        { id: 2, name: 'Колбаса Докторская', price: 350, qty: 10, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🌭'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🌭', desc: 'Колбаса Докторская ГОСТ' },
        { id: 3, name: 'Хлеб Бородинский', price: 45, qty: 12, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🍞'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🍞', desc: 'Хлеб Бородинский' },
        { id: 4, name: 'Сметана 20%', price: 120, qty: 8, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🥄'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🥄', desc: 'Сметана 20%' },
        { id: 5, name: 'Масло Сливочное', price: 280, qty: 6, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🧈'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🧈', desc: 'Масло Сливочное' },
        { id: 6, name: 'Сыр Российский', price: 450, qty: 5, images: ['https://via.placeholder.com/400/e6ffe6/00cc00?text=🧀'], image: 'https://via.placeholder.com/400/e6ffe6/00cc00?text=🧀', desc: 'Сыр Российский' }
    ],
    einvoices: {},
    shiftArchive: [],
    nextId: 7,
    nextEmployeeId: 4,
    nextShopId: 4,
    nextShiftId: 1
};

// Загрузка базы
function loadDB() {
    try {
        if (fs.existsSync(DB_FILE)) {
            return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
        }
    } catch (e) { console.error('Ошибка чтения db.json:', e); }
    return JSON.parse(JSON.stringify(DEFAULT_DB));
}

// Сохранение базы
function saveDB(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (e) { console.error('Ошибка сохранения db.json:', e); }
}

let db = loadDB();

// Middleware
app.use(express.json({ limit: '20mb' }));
app.use(express.static(__dirname));

// ============ API ============

// Получить всё состояние сразу
app.get('/api/state', (req, res) => {
    res.json(db);
});

// Обновить всё состояние
app.post('/api/state', (req, res) => {
    try {
        db = { ...db, ...req.body };
        saveDB(db);
        res.json({ ok: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Обновить отдельную часть (employees/shops/stock/einvoices/shiftArchive)
app.post('/api/update/:section', (req, res) => {
    const section = req.params.section;
    if (!['employees', 'shops', 'stock', 'einvoices', 'shiftArchive'].includes(section)) {
        return res.status(400).json({ error: 'Unknown section' });
    }
    db[section] = req.body;
    saveDB(db);
    res.json({ ok: true, [section]: db[section] });
});

// Изменить количество товара (delta может быть отрицательным)
app.post('/api/stock/delta', (req, res) => {
    const { id, delta } = req.body;
    const item = db.stock.find(s => s.id === id);
    if (!item) return res.status(404).json({ error: 'Item not found' });
    item.qty = Math.max(0, item.qty + delta);
    saveDB(db);
    res.json({ ok: true, item });
});

// Обновить или создать накладную
app.post('/api/einvoice/:id', (req, res) => {
    const id = req.params.id;
    db.einvoices[id] = { ...req.body, updatedAt: new Date().toISOString() };
    
    // Ограничим до 500 накладных
    const keys = Object.keys(db.einvoices);
    if (keys.length > 500) {
        keys.sort((a, b) => (db.einvoices[a].date || '').localeCompare(db.einvoices[b].date || ''));
        for (let i = 0; i < keys.length - 500; i++) delete db.einvoices[keys[i]];
    }
    
    saveDB(db);
    res.json({ ok: true, einvoice: db.einvoices[id] });
});

// Получить одну накладную
app.get('/api/einvoice/:id', (req, res) => {
    const inv = db.einvoices[req.params.id];
    if (!inv) return res.status(404).json({ error: 'Not found' });
    res.json(inv);
});

// Главная страница
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ AAS Маркет запущен на порту ${PORT}`);
    console.log(`   Данные: ${DB_FILE}`);
});