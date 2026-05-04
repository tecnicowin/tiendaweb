// --- CORE STATE ---
let inventory = JSON.parse(localStorage.getItem('pos_inventory')) || [];
let sales = JSON.parse(localStorage.getItem('pos_sales')) || [];
let inventoryLogs = JSON.parse(localStorage.getItem('pos_logs')) || [];
let currentCart = [];
let bcvData = JSON.parse(localStorage.getItem('pos_bcv')) || { rate: 38.50, date: "" };
let bcvRate = bcvData.rate;
let paymentSettings = JSON.parse(localStorage.getItem('pos_payment_settings')) || {
    pmBank: '', pmPhone: '', binanceId: '', paypalEmail: ''
};

// --- INITIALIZATION ---
// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    checkBCV();
    updateDashboard();
    renderInventory();
    renderSalesHistory();
    initEventListeners();
    loadSettings();
});

function initEventListeners() {
    // Inventory Form
    const productForm = document.getElementById('product-form');
    if (productForm) {
        productForm.addEventListener('submit', (e) => {
            e.preventDefault();
            try {
                const newProdData = {
                    code: document.getElementById('p-code').value,
                    name: document.getElementById('p-name').value,
                    cost: parseFloat(document.getElementById('p-cost').value || 0),
                    price: parseFloat(document.getElementById('p-price').value || 0),
                    stock: parseInt(document.getElementById('p-stock').value || 0),
                    iva: document.getElementById('p-iva').value,
                    image: document.getElementById('img-preview').querySelector('img')?.src || ''
                };
                
                if (!newProdData.name) throw new Error("El nombre es obligatorio");

                if (editingProductId) {
                    const index = inventory.findIndex(p => p.id === editingProductId);
                    if (index !== -1) {
                        inventory[index] = { ...inventory[index], ...newProdData };
                        logMovement(editingProductId, 'Edición Manual', 0);
                    }
                    editingProductId = null;
                } else {
                    const newProd = {
                        id: Date.now().toString(),
                        ...newProdData
                    };
                    inventory.push(newProd);
                    logMovement(newProd.id, 'Entrada Inicial', newProd.stock);
                }

                saveInventory();
                renderInventory();
                closeModal('modal-product');
                e.target.reset();
                document.getElementById('img-preview').innerHTML = '<i class="fas fa-image text-muted"></i>';
                document.querySelector('#modal-product h2').innerText = "Registrar Producto";
                
                showSection('inventory');
            } catch (err) {
                alert("Error: " + err.message);
            }
        });
    }

    // POS Search
    const posSearch = document.getElementById('pos-search');
    if (posSearch) {
        posSearch.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                const query = posSearch.value.trim();
                const prod = inventory.find(p => p.code === query || p.name.toLowerCase().includes(query.toLowerCase()));
                if (prod) {
                    addToCart(prod);
                    posSearch.value = '';
                }
            }
        });
    }

    // Inventory Search
    const invSearch = document.getElementById('inventory-search');
    if (invSearch) {
        invSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = inventory.filter(p => 
                p.name.toLowerCase().includes(query) || 
                (p.code && p.code.toLowerCase().includes(query))
            );
            renderInventory(filtered);
        });
    }
    // Settings Form
    const settingsForm = document.getElementById('settings-form');
    if (settingsForm) {
        settingsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            paymentSettings = {
                pmBank: document.getElementById('set-pm-bank').value,
                pmPhone: document.getElementById('set-pm-phone').value,
                binanceId: document.getElementById('set-binance-id').value,
                paypalEmail: document.getElementById('set-paypal-email').value
            };
            localStorage.setItem('pos_payment_settings', JSON.stringify(paymentSettings));
            alert("Configuración guardada correctamente");
        });
    }
}

function loadSettings() {
    const pmBank = document.getElementById('set-pm-bank');
    if (pmBank) {
        pmBank.value = paymentSettings.pmBank || '';
        document.getElementById('set-pm-phone').value = paymentSettings.pmPhone || '';
        document.getElementById('set-binance-id').value = paymentSettings.binanceId || '';
        document.getElementById('set-paypal-email').value = paymentSettings.paypalEmail || '';
        showConfigFields(document.getElementById('config-method-select').value);
    }
}

function showConfigFields(method) {
    document.querySelectorAll('.config-group').forEach(g => g.style.display = 'none');
    if (method === 'pago_movil') document.getElementById('config-fields-pm').style.display = 'block';
    if (method === 'binance') document.getElementById('config-fields-binance').style.display = 'block';
    if (method === 'paypal') document.getElementById('config-fields-paypal').style.display = 'block';
}

function checkBCV() {
    const today = new Date().toISOString().split('T')[0];
    if (bcvData.date !== today) {
        const newRate = prompt(`Nueva Jornada: ${today}. Por favor, ingrese la Tasa BCV del día:`, bcvRate);
        if (newRate !== null) {
            bcvRate = parseFloat(newRate) || bcvRate;
            bcvData = { rate: bcvRate, date: today };
            localStorage.setItem('pos_bcv', JSON.stringify(bcvData));
        }
    }
    document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
}

// --- NAVIGATION ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    document.getElementById(`link-${sectionId}`)?.classList.add('active');
    
    const titles = {
        'dashboard': 'Dashboard',
        'inventory': 'Inventario',
        'pos': 'Facturación',
        'reports': 'Reportes',
        'settings': 'Ajustes'
    };
    document.getElementById('section-title').innerText = titles[sectionId] || sectionId;
    
    if(sectionId === 'inventory') renderInventory();
}

// --- MODALS ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- INVENTORY MANAGEMENT ---
let editingProductId = null;

function editProduct(id) {
    const prod = inventory.find(p => p.id === id);
    if (!prod) return;

    editingProductId = id;
    openModal('modal-product');
    
    document.getElementById('p-code').value = prod.code || '';
    document.getElementById('p-name').value = prod.name || '';
    document.getElementById('p-cost').value = prod.cost || 0;
    document.getElementById('p-price').value = prod.price || 0;
    document.getElementById('p-stock').value = prod.stock || 0;
    document.getElementById('p-iva').value = prod.iva || "16";
    
    if (prod.image) {
        document.getElementById('img-preview').innerHTML = `<img src="${prod.image}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
    }
    
    document.querySelector('#modal-product h2').innerText = "Editar Producto";
}

function deleteProduct(id) {
    if (confirm("¿Estás seguro de eliminar este producto?")) {
        inventory = inventory.filter(p => p.id !== id);
        saveInventory();
        renderInventory();
    }
}

function renderInventory(data = inventory) {
    const tbody = document.getElementById('inventory-body');
    tbody.innerHTML = data.map(p => `
        <tr>
            <td><img src="${p.image || 'https://via.placeholder.com/45'}" class="product-img"></td>
            <td><span class="text-muted" style="font-size: 0.8rem;">${p.code || 'N/A'}</span></td>
            <td style="font-weight: 600;">${p.name}</td>
            <td class="text-emerald">$${p.price.toFixed(2)}</td>
            <td>
                <span class="btn ${p.stock <= 5 ? 'btn-secondary text-amber' : 'btn-secondary'}" style="padding: 4px 10px; cursor: default;">
                    ${p.stock}
                </span>
            </td>
            <td>
                <button onclick="addStock('${p.id}')" class="btn btn-primary" style="padding: 6px 12px; font-size: 0.8rem;">
                    <i class="fas fa-plus"></i>
                </button>
            </td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button onclick="editProduct('${p.id}')" class="btn btn-secondary" style="padding: 8px;"><i class="fas fa-edit"></i></button>
                    <button onclick="deleteProduct('${p.id}')" class="btn btn-secondary" style="padding: 8px; color: #ef4444;"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
}

function saveInventory() {
    localStorage.setItem('pos_inventory', JSON.stringify(inventory));
    localStorage.setItem('pos_logs', JSON.stringify(inventoryLogs));
    updateDashboard();
}

function logMovement(productId, type, qty) {
    const prod = inventory.find(p => p.id === productId);
    inventoryLogs.push({
        date: new Date().toISOString(),
        productName: prod ? prod.name : 'Desconocido',
        type: type,
        qty: qty
    });
}

function previewImage(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            img.onload = function() {
                // Crear un canvas para redimensionar la imagen
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 300;
                const MAX_HEIGHT = 300;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convertir a base64 comprimido (JPEG 0.7)
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
                document.getElementById('img-preview').innerHTML = `<img src="${compressedBase64}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
            }
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// --- EXCEL IMPORT ---
function importExcel(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet);
        
        json.forEach(row => {
            inventory.push({
                id: Date.now().toString() + Math.random(),
                code: row.Codigo || row.code || '',
                name: row.Nombre || row.name || 'Sin nombre',
                cost: parseFloat(row.Costo || row.cost || 0),
                price: parseFloat(row.Precio || row.price || row.Venta || 0),
                stock: parseInt(row.Stock || row.stock || 0),
                image: ''
            });
        });
        saveInventory();
        renderInventory();
        alert('Importación completada');
    };
    reader.readAsArrayBuffer(file);
}

// --- POS LOGIC ---
// (Listeners moved to initEventListeners)

function addToCart(prod) {
    const existing = currentCart.find(item => item.id === prod.id);
    if (existing) {
        existing.qty++;
    } else {
        currentCart.push({ ...prod, qty: 1 });
    }
    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('cart-table-body');
    let subtotal = 0;
    let totalIva = 0;
    
    tbody.innerHTML = currentCart.map((item, index) => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        
        // Calcular IVA individual
        const itemIvaRate = parseFloat(item.iva || 16) / 100;
        totalIva += lineTotal * itemIvaRate;

        return `
            <tr>
                <td>${item.name} ${item.iva == 0 ? '<small>(Exento)</small>' : ''}</td>
                <td>$${item.price.toFixed(2)}</td>
                <td>
                    <input type="number" value="${item.qty}" min="1" onchange="updateQty(${index}, this.value)" style="width: 50px; background: transparent; color: white; border: 1px solid var(--border); border-radius: 4px;">
                </td>
                <td>$${lineTotal.toFixed(2)}</td>
                <td><button onclick="removeFromCart(${index})" style="background: transparent; border: none; color: #ef4444; cursor: pointer;"><i class="fas fa-times"></i></button></td>
            </tr>
        `;
    }).join('');
    
    const totalUsd = subtotal + totalIva;
    const totalBs = totalUsd * bcvRate;
    
    document.getElementById('pos-subtotal').innerText = `$${subtotal.toFixed(2)}`;
    document.getElementById('pos-iva').innerText = `$${totalIva.toFixed(2)}`;
    document.getElementById('pos-total-usd').innerText = `$${totalUsd.toFixed(2)}`;
    document.getElementById('pos-total-bs').innerText = `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`;
}

function updateQty(index, val) {
    currentCart[index].qty = parseInt(val);
    renderCart();
}

function removeFromCart(index) {
    currentCart.splice(index, 1);
    renderCart();
}

// --- BARCODE SCANNER ---
let html5QrCode;
let lastScannedCode = "";
let lastScannedTime = 0;

function startScanner(mode = 'pos') {
    openModal('modal-scanner');
    
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            initScanner(mode);
        }).catch(() => {
            initScanner(mode);
        });
    } else {
        initScanner(mode);
    }
}

function initScanner(mode) {
    html5QrCode = new Html5Qrcode("reader");
    const config = { 
        fps: 30,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0
    };
    
    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        const cleanCode = decodedText.trim();
        
        if (mode === 'inventory') {
            document.getElementById('p-code').value = cleanCode;
            stopScanner();
            if (window.navigator.vibrate) window.navigator.vibrate(100);
            return;
        }

        const now = Date.now();
        if (cleanCode === lastScannedCode && (now - lastScannedTime) < 1500) return;
        
        const prod = inventory.find(p => p.code === cleanCode);
        
        if (prod) {
            addToCart(prod);
            lastScannedCode = cleanCode;
            lastScannedTime = now;
            if (window.navigator.vibrate) window.navigator.vibrate(100);
            showScanToast(prod.name, 'success');
        } else {
            lastScannedCode = cleanCode;
            lastScannedTime = now;
            showScanToast(`Código ${cleanCode} no registrado`, 'error');
            if (window.navigator.vibrate) window.navigator.vibrate([50, 50, 50]);
        }
    }).catch(err => {
        console.error("Error al iniciar cámara:", err);
        alert("No se pudo acceder a la cámara. Asegúrate de dar permisos HTTPS.");
    });
}

function showScanToast(message, type = 'success') {
    const toast = document.createElement('div');
    const color = type === 'success' ? 'var(--primary)' : '#ef4444';
    toast.innerHTML = type === 'success' ? `✅ ${message}` : `❌ ${message}`;
    toast.style = `position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: ${color}; color: white; padding: 12px 24px; border-radius: 50px; z-index: 2000; animation: fadeIn 0.3s; box-shadow: 0 4px 15px rgba(0,0,0,0.3); font-weight: 600;`;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function stopScanner() {
    if (html5QrCode) {
        html5QrCode.stop().then(() => {
            closeModal('modal-scanner');
        });
    } else {
        closeModal('modal-scanner');
    }
}

// --- SALES PROCESSING ---
function openPaymentModal() {
    if (currentCart.length === 0) return;
    
    let subtotal = 0;
    let totalIva = 0;
    currentCart.forEach(item => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        const itemIvaRate = parseFloat(item.iva || 16) / 100;
        totalIva += lineTotal * itemIvaRate;
    });
    
    const totalUsd = subtotal + totalIva;
    const totalBs = totalUsd * bcvRate;
    
    document.getElementById('modal-total-usd').innerText = `$${totalUsd.toFixed(2)}`;
    document.getElementById('modal-total-bs').innerText = `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`;
    
    document.getElementById('payment-reference').value = '';
    document.getElementById('confirm-payment-method').value = 'efectivo_usd';
    toggleReferenceInput();
    
    openModal('modal-payment');
}

function toggleReferenceInput() {
    const method = document.getElementById('confirm-payment-method').value;
    const refContainer = document.getElementById('reference-container');
    const digitalMethods = ['pago_movil', 'paypal', 'binance'];
    refContainer.style.display = digitalMethods.includes(method) ? 'block' : 'none';
}

function finalizeSale() {
    const method = document.getElementById('confirm-payment-method').value;
    const reference = document.getElementById('payment-reference').value.trim();
    const digitalMethods = ['pago_movil', 'paypal', 'binance'];
    
    if (digitalMethods.includes(method) && !reference) {
        alert("Por favor, ingrese el número de referencia del pago.");
        return;
    }
    
    processSale(method, reference);
    closeModal('modal-payment');
}

function processSale(method, reference = '') {
    if (currentCart.length === 0) return;
    
    let subtotal = 0;
    let totalIva = 0;
    currentCart.forEach(item => {
        const lineTotal = item.price * item.qty;
        subtotal += lineTotal;
        const itemIvaRate = parseFloat(item.iva || 16) / 100;
        totalIva += lineTotal * itemIvaRate;
    });
    
    const totalUsd = subtotal + totalIva;
    
    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: [...currentCart],
        subtotal: subtotal,
        totalUsd: totalUsd,
        totalBs: totalUsd * bcvRate,
        rate: bcvRate,
        method: method,
        reference: reference
    };
    
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));
    
    currentCart.forEach(cartItem => {
        const invItem = inventory.find(p => p.id === cartItem.id);
        if (invItem) {
            invItem.stock -= cartItem.qty;
            logMovement(invItem.id, 'Venta', -cartItem.qty);
        }
    });
    saveInventory();
    
    generateInvoice(sale);
    
    currentCart = [];
    renderCart();
    updateDashboard();
    renderSalesHistory();
    alert('Venta procesada con éxito');
}

// --- DASHBOARD & REPORTS ---
function updateDashboard() {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(today));
    
    const totalUsd = todaySales.reduce((acc, s) => acc + s.totalUsd, 0);
    const totalBs = todaySales.reduce((acc, s) => acc + s.totalBs, 0);
    
    document.getElementById('stat-sales-today').innerText = `$${totalUsd.toFixed(2)}`;
    document.getElementById('stat-caja-total').innerText = `${totalBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`;
    document.getElementById('stat-stock-total').innerText = inventory.reduce((acc, p) => acc + p.stock, 0);

    // Cierre por Métodos (Dashboard)
    const methodTotals = {
        'efectivo_usd': { label: 'Efectivo $', usd: 0, bs: 0, icon: 'fa-dollar-sign' },
        'efectivo_bs': { label: 'Efectivo Bs', usd: 0, bs: 0, icon: 'fa-money-bill-wave' },
        'pago_movil': { label: 'Pago Móvil', usd: 0, bs: 0, icon: 'fa-mobile-alt' },
        'binance': { label: 'Binance Pay', usd: 0, bs: 0, icon: 'fa-coins' },
        'paypal': { label: 'Paypal', usd: 0, bs: 0, icon: 'fa-brands fa-paypal' }
    };

    todaySales.forEach(sale => {
        if (methodTotals[sale.method]) {
            methodTotals[sale.method].usd += sale.totalUsd;
            methodTotals[sale.method].bs += sale.totalBs;
        }
    });

    const closureGrid = document.getElementById('closure-cards-grid');
    if (closureGrid) {
        closureGrid.innerHTML = Object.values(methodTotals).map(m => `
            <div class="stat-card" style="padding: 1.25rem; border-left: 4px solid var(--primary); background: var(--bg-card);">
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                    <i class="fas ${m.icon}" style="color: var(--primary); font-size: 1rem;"></i>
                    <span class="text-muted" style="font-size: 0.7rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">${m.label}</span>
                </div>
                <div style="font-size: 1.3rem; font-weight: 800; margin-bottom: 2px;">$${m.usd.toFixed(2)}</div>
                <div class="text-emerald" style="font-size: 0.8rem; font-weight: 600;">${m.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.</div>
            </div>
        `).join('');
    }
}

function renderSalesHistory() {
    const tbody = document.getElementById('sales-history-body');
    tbody.innerHTML = sales.slice().reverse().map(s => `
        <tr>
            <td>${new Date(s.date).toLocaleString()}</td>
            <td>Cliente Genérico</td>
            <td>$${s.totalUsd.toFixed(2)}</td>
            <td>${s.totalBs.toLocaleString('es-VE')} Bs.</td>
            <td>${s.method.replace('_', ' ').toUpperCase()}</td>
            <td>
                <button onclick="generateInvoiceById(${s.id})" class="btn btn-secondary" style="padding: 5px 10px;"><i class="fas fa-file-pdf"></i></button>
            </td>
        </tr>
    `).join('');
}

// --- PDF GENERATION ---
const { jsPDF } = window.jspdf;

function generateInvoice(sale) {
    const doc = new jsPDF({ format: [80, 150] }); // Format Ticket
    doc.setFontSize(10);
    doc.text("TIENDA PRO", 40, 10, { align: "center" });
    doc.setFontSize(8);
    doc.text(`Fecha: ${new Date(sale.date).toLocaleString()}`, 10, 20);
    doc.text(`Tasa BCV: ${sale.rate} Bs.`, 10, 25);
    if (sale.reference) {
        doc.text(`Ref: ${sale.reference}`, 10, 30);
        y = 40;
    } else {
        y = 35;
    }
    doc.line(5, y - 5, 75, y - 5);
    
    sale.items.forEach(item => {
        doc.text(`${item.name} x${item.qty}`, 10, y);
        doc.text(`$${(item.price * item.qty).toFixed(2)}`, 70, y, { align: "right" });
        y += 5;
    });
    
    doc.line(5, y, 75, y);
    y += 7;
    doc.setFontSize(10);
    doc.text(`TOTAL USD: $${sale.totalUsd.toFixed(2)}`, 70, y, { align: "right" });
    y += 5;
    doc.text(`TOTAL BS: ${sale.totalBs.toLocaleString()} Bs.`, 70, y, { align: "right" });
    
    doc.save(`Factura_${sale.id}.pdf`);
}

function generateInvoiceById(id) {
    const sale = sales.find(s => s.id === id);
    if (sale) generateInvoice(sale);
}

// --- UTILS ---
function updateRate() {
    const today = new Date().toISOString().split('T')[0];
    const newRate = prompt("Ingrese nueva tasa BCV:", bcvRate);
    if (newRate && !isNaN(newRate)) {
        bcvRate = parseFloat(newRate);
        bcvData = { rate: bcvRate, date: today };
        localStorage.setItem('pos_bcv', JSON.stringify(bcvData));
        document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
        renderCart();
    }
}
function generateDailyReport() {
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(today));
    
    if (todaySales.length === 0) {
        alert("No hay ventas registradas el día de hoy.");
        return;
    }

    const totals = {
        efectivo_usd: { label: 'Efectivo $', usd: 0, bs: 0 },
        efectivo_bs: { label: 'Efectivo Bs', usd: 0, bs: 0 },
        pago_movil: { label: 'Pago Móvil', usd: 0, bs: 0 },
        paypal: { label: 'Paypal', usd: 0, bs: 0 },
        binance: { label: 'Binance', usd: 0, bs: 0 }
    };

    let grandTotalUsd = 0;
    let grandTotalBs = 0;

    todaySales.forEach(s => {
        if (totals[s.method]) {
            totals[s.method].usd += s.totalUsd;
            totals[s.method].bs += s.totalBs;
            grandTotalUsd += s.totalUsd;
            grandTotalBs += s.totalBs;
        }
    });

    const summaryDiv = document.getElementById('daily-closure-summary');
    summaryDiv.style.display = 'block';
    
    let html = `
        <div class="stat-card" style="border: 1px solid var(--primary);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="margin: 0;">Resumen Cierre de Caja (${new Date().toLocaleDateString()})</h3>
                <button class="btn btn-secondary" onclick="this.parentElement.parentElement.parentElement.style.display='none'">Cerrar</button>
            </div>
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));">
    `;

    for (const key in totals) {
        const t = totals[key];
        html += `
            <div style="padding: 1rem; background: var(--glass); border-radius: 12px; border: 1px solid var(--border);">
                <span class="text-muted" style="font-size: 0.8rem;">${t.label}</span>
                <div style="font-weight: 700; margin-top: 5px;">$${t.usd.toFixed(2)}</div>
                <div class="text-emerald" style="font-size: 0.8rem;">${t.bs.toLocaleString()} Bs.</div>
            </div>
        `;
    }

    html += `
            </div>
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid var(--border); display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">TOTAL GENERAL:</span>
                <div style="text-align: right;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary);">$${grandTotalUsd.toFixed(2)}</div>
                    <div class="text-muted">${grandTotalBs.toLocaleString()} Bs.</div>
                </div>
            </div>
            <div style="margin-top: 1rem; font-size: 0.8rem;" class="text-muted">
                <strong>Datos de Pago:</strong> PM: ${paymentSettings.pmBank} | Bin: ${paymentSettings.binanceId}
            </div>
        </div>
    `;

    summaryDiv.innerHTML = html;
}

function generateDailyPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const today = new Date().toISOString().split('T')[0];
    const todaySales = sales.filter(s => s.date.startsWith(today));
    
    doc.setFontSize(20);
    doc.setTextColor(16, 185, 129);
    doc.text("REPORTE DE CIERRE DE CAJA", 105, 20, { align: "center" });
    
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Fecha del Cierre: ${new Date().toLocaleDateString()}`, 20, 30);
    doc.text(`Tasa de Cambio (BCV): ${bcvRate} Bs.`, 20, 35);
    
    const methodTotals = {
        'efectivo_usd': { label: 'Efectivo $', usd: 0, bs: 0 },
        'efectivo_bs': { label: 'Efectivo Bs', usd: 0, bs: 0 },
        'pago_movil': { label: 'Pago Móvil', usd: 0, bs: 0 },
        'binance': { label: 'Binance Pay', usd: 0, bs: 0 },
        'paypal': { label: 'Paypal', usd: 0, bs: 0 }
    };

    let grandUsd = 0;
    let grandBs = 0;

    todaySales.forEach(s => {
        if (methodTotals[s.method]) {
            methodTotals[s.method].usd += s.totalUsd;
            methodTotals[s.method].bs += s.totalBs;
            grandUsd += s.totalUsd;
            grandBs += s.totalBs;
        }
    });

    const tableData = Object.values(methodTotals).map(m => [
        m.label,
        `$${m.usd.toFixed(2)}`,
        `${m.bs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`
    ]);

    doc.autoTable({
        startY: 45,
        head: [['Forma de Pago', 'Total USD', 'Total Bs']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [16, 185, 129] }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');
    doc.text("TOTAL GENERAL DE CAJA:", 20, finalY);
    doc.setTextColor(0);
    doc.text(`$${grandUsd.toFixed(2)}`, 140, finalY);
    doc.setFontSize(11);
    doc.text(`${grandBs.toLocaleString('es-VE', { minimumFractionDigits: 2 })} Bs.`, 140, finalY + 7);

    doc.save(`Cierre_${today}.pdf`);
}
