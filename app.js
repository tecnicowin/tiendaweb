// --- CORE STATE ---
let inventory = JSON.parse(localStorage.getItem('pos_inventory')) || [];
let sales = JSON.parse(localStorage.getItem('pos_sales')) || [];
let inventoryLogs = JSON.parse(localStorage.getItem('pos_logs')) || [];
let currentCart = [];
let bcvRate = 38.50;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updateDashboard();
    renderInventory();
    renderSalesHistory();
});

// --- NAVIGATION ---
function showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(sectionId).classList.add('active');
    document.getElementById(`link-${sectionId}`)?.classList.add('active');
    document.getElementById('section-title').innerText = sectionId.charAt(0).toUpperCase() + sectionId.slice(1);
    
    if(sectionId === 'inventory') renderInventory();
}

// --- MODALS ---
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

// --- INVENTORY MANAGEMENT ---
document.getElementById('product-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const newProd = {
        id: Date.now().toString(),
        code: document.getElementById('p-code').value,
        name: document.getElementById('p-name').value,
        cost: parseFloat(document.getElementById('p-cost').value || 0),
        price: parseFloat(document.getElementById('p-price').value || 0),
        stock: parseInt(document.getElementById('p-stock').value || 0),
        iva: document.getElementById('p-iva').value,
        image: document.getElementById('img-preview').querySelector('img')?.src || ''
    };
    
    inventory.push(newProd);
    logMovement(newProd.id, 'Entrada Inicial', newProd.stock);
    saveInventory();
    renderInventory();
    closeModal('modal-product');
    e.target.reset();
    document.getElementById('img-preview').innerHTML = '<i class="fas fa-image text-muted"></i>';
    
    alert("¡Producto guardado exitosamente!");
    showSection('dashboard');
});

function renderInventory() {
    const tbody = document.getElementById('inventory-table-body');
    tbody.innerHTML = inventory.map(p => `
        <tr>
            <td><img src="${p.image || 'https://via.placeholder.com/40'}" class="product-img"></td>
            <td>${p.code || 'N/A'}</td>
            <td>${p.name}</td>
            <td>$${p.cost.toFixed(2)}</td>
            <td class="text-emerald">$${p.price.toFixed(2)}</td>
            <td>${p.stock}</td>
            <td>
                <button onclick="editProduct('${p.id}')" class="btn btn-secondary" style="padding: 5px 10px;"><i class="fas fa-edit"></i></button>
                <button onclick="deleteProduct('${p.id}')" class="btn btn-secondary" style="padding: 5px 10px; color: #ef4444;"><i class="fas fa-trash"></i></button>
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
            document.getElementById('img-preview').innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 12px;">`;
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
const posSearch = document.getElementById('pos-search');
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
    html5QrCode = new Html5Qrcode("reader");
    const config = { 
        fps: 20, 
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.0
    };
    
    html5QrCode.start({ facingMode: "environment" }, config, (decodedText) => {
        if (mode === 'inventory') {
            document.getElementById('p-code').value = decodedText;
            stopScanner();
            if (window.navigator.vibrate) window.navigator.vibrate(100);
            return;
        }

        const now = Date.now();
        // Cooldown de 2 segundos para el mismo código para evitar duplicados
        if (decodedText === lastScannedCode && (now - lastScannedTime) < 2000) return;
        
        const prod = inventory.find(p => p.code === decodedText);
        if (prod) {
            addToCart(prod);
            lastScannedCode = decodedText;
            lastScannedTime = now;
            
            // Feedback visual/haptico
            if (window.navigator.vibrate) window.navigator.vibrate(100);
            
            // Mostrar aviso temporal de "Producto añadido"
            showScanToast(prod.name);
        }
    }).catch(err => console.error(err));
}

function showScanToast(name) {
    const toast = document.createElement('div');
    toast.innerText = `✅ ${name} añadido`;
    toast.style = "position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: var(--primary); color: white; padding: 10px 20px; border-radius: 50px; z-index: 2000; animation: fadeIn 0.3s;";
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
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
function processSale() {
    if (currentCart.length === 0) return;
    
    const subtotal = currentCart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    const totalUsd = subtotal * 1.16;
    const method = document.getElementById('payment-method').value;
    
    const sale = {
        id: Date.now(),
        date: new Date().toISOString(),
        items: [...currentCart],
        subtotal: subtotal,
        totalUsd: totalUsd,
        totalBs: totalUsd * bcvRate,
        rate: bcvRate,
        method: method
    };
    
    sales.push(sale);
    localStorage.setItem('pos_sales', JSON.stringify(sales));
    
    // Update Stock
    currentCart.forEach(cartItem => {
        const invItem = inventory.find(p => p.id === cartItem.id);
        if (invItem) {
            invItem.stock -= cartItem.qty;
            logMovement(invItem.id, 'Venta', -cartItem.qty);
        }
    });
    saveInventory();
    
    // Generate Invoice PDF
    generateInvoice(sale);
    
    // Reset
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
    doc.line(5, 30, 75, 30);
    
    let y = 35;
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
    const newRate = prompt("Ingrese nueva tasa BCV:", bcvRate);
    if (newRate && !isNaN(newRate)) {
        bcvRate = parseFloat(newRate);
        document.getElementById('bcv-rate').innerText = `${bcvRate.toFixed(2)} Bs.`;
        renderCart();
    }
}
