const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DB_FILE = path.join(__dirname, 'data.json');

// الوسائط (Middleware)
app.use(cors());
app.use(express.json());
// استضافة الملفات الثابتة من مجلد public
app.use(express.static('public')); 

// --- دوال التعامل مع ملف البيانات (JSON) ---
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        // إنشاء ملف بيانات افتراضي إذا لم يكن موجوداً
        const initialData = {
            visits: 0,
            orders: [],
            reviews: [],
            user: { username: 'admin', password: '123' }
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
        return initialData;
    }
    try {
        const data = fs.readFileSync(DB_FILE);
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading DB:", e);
        return { visits: 0, orders: [], reviews: [], user: { username: 'admin', password: '123' } };
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- تتبع زيارات الموقع ---
app.use((req, res, next) => {
    if (req.path === '/' && req.method === 'GET') {
        const db = readDB();
        db.visits = (db.visits || 0) + 1;
        writeDB(db);
    }
    next();
});

// --- 1. API تسجيل الدخول ---
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    
    if (username === db.user.username && password === db.user.password) {
        res.json({ success: true, token: 'mock_token', username: 'Admin' });
    } else {
        res.status(401).json({ success: false, message: 'بيانات الدخول غير صحيحة' });
    }
});

// --- 2. API إضافة طلب حجز (Booking) - تم التحديث ---
app.post('/api/bookings', (req, res) => {
    try {
        const db = readDB();
        
        // تجهيز البيانات الجديدة لتشمل كافة الحقول المحدثة
        const newOrder = {
            id: Date.now(), // استخدام Timestamp كمعرف فريد
            
            // البيانات الشخصية
            name: req.body.name,
            phone: req.body.phone,
            
            // تفاصيل النقل الجديدة
            moveDate: req.body.moveDate || 'غير محدد',
            serviceType: req.body.serviceType || 'نقل عفش',
            
            // تفاصيل الموقع
            fromLocation: req.body.fromLocation,
            fromFloor: req.body.fromFloor,
            toLocation: req.body.toLocation,
            toFloor: req.body.toFloor,
            
            // الملاحظات الإضافية
            msg: req.body.msg,
            
            // بيانات النظام
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        db.orders.push(newOrder);
        writeDB(db);
        console.log("✅ New Booking Saved:", newOrder.name, "| Service:", newOrder.serviceType);
        res.status(201).json({ message: 'Booking sent successfully' });
    } catch (error) {
        console.error("Error saving booking:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- 3. API إضافة تقييم (Review) ---
app.post('/api/reviews', (req, res) => {
    try {
        const db = readDB();
        const newReview = {
            id: Date.now(),
            name: req.body.reviewerName || req.body.name,
            rating: parseInt(req.body.ratingValue || req.body.rating),
            text: req.body.reviewerText || req.body.text,
            createdAt: new Date().toISOString()
        };
        db.reviews.push(newReview);
        writeDB(db);
        console.log("✅ New Review Saved:", newReview.name);
        res.status(201).json({ message: 'Review added successfully' });
    } catch (error) {
        console.error("Error saving review:", error);
        res.status(500).json({ message: 'Server error' });
    }
});

// --- 4. API جلب التقييمات (للصفحة الرئيسية) ---
app.get('/api/reviews', (req, res) => {
    const db = readDB();
    res.json(db.reviews);
});

// --- Admin APIs ---

// 5. API الإحصائيات
app.get('/api/admin/stats', (req, res) => {
    const db = readDB();
    res.json({
        orders: db.orders.filter(o => o.status === 'pending').length,
        reviews: db.reviews.length,
        visits: db.visits
    });
});

// 6. API جلب كل الطلبات
app.get('/api/admin/bookings', (req, res) => {
    const db = readDB();
    // ترتيب تنازلي حسب التاريخ (الأحدث أولاً)
    res.json(db.orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
});

// 7. API تغيير حالة الطلب
app.put('/api/admin/bookings/:id', (req, res) => {
    const { status } = req.body;
    const id = parseInt(req.params.id);
    const db = readDB();
    
    // البحث عن الطلب بالـ ID
    const orderIndex = db.orders.findIndex(o => o.id === id);
    
    if (orderIndex !== -1) {
        db.orders[orderIndex].status = status;
        writeDB(db);
        res.json({ message: 'Status updated' });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// 8. API حذف طلب
app.delete('/api/admin/bookings/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB();
    const initialLength = db.orders.length;
    
    db.orders = db.orders.filter(o => o.id !== id);
    
    if (db.orders.length < initialLength) {
        writeDB(db);
        res.json({ message: 'Deleted successfully' });
    } else {
        res.status(404).json({ message: 'Order not found' });
    }
});

// 9. API حذف تعليق
app.delete('/api/admin/reviews/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const db = readDB();
    const initialLength = db.reviews.length;
    
    db.reviews = db.reviews.filter(r => r.id !== id);
    
    if (db.reviews.length < initialLength) {
        writeDB(db);
        res.json({ message: 'Review deleted successfully' });
    } else {
        res.status(404).json({ message: 'Review not found' });
    }
});

// تشغيل السيرفر
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});