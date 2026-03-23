/**
 * 2LMF PRO BUSINESS - FRONTEND REFRESH 🦈📊
 * Verzija: 2.9.9 (PRODUCT MODAL FIX + LABELS)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbx4TQ6cFNr8X-fNRHE0Ai571pAioDeny_mSSrTVQm3OHbTKOhfIEDiKDFM2shZ5zDFLrA/exec";

let state = {
    inquiries: [],
    stats: { revenue: 0, expenses: 0, yearlyRevenue: 0, yearlyExpenses: 0, yearlyStats: [], recentActivities: [] },
    selectedInquiry: null,
    charts: { yearly: null, monthly: null },
    catalog: [],
    cart: []
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    initNavigation();
    initModal();
    initScanner();
    initCatalog();
    await refreshData();

    const search = document.getElementById('inquirySearch');
    if (search) search.addEventListener('input', (e) => filterInquiries(e.target.value));

    // Global exposure for inline onclick
    window.handleInquiryAction = handleInquiryAction;

    setInterval(refreshData, 300000);
}

function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const target = document.getElementById(`tab-${id}`);
    if (target) target.classList.add('active');

    const nav = document.querySelector(`[data-tab="${id}"]`);
    if (nav) nav.classList.add('active');
}

async function refreshData() {
    showLoader("Učitavanje...");
    try {
        const res = await fetch(`${GAS_URL}?action=get_dashboard_data`);
        const data = await res.json();
        if (data.status === 'success') {
            state.inquiries = data.inquiries;
            state.stats = data.stats;
            renderAll();
        }
    } catch (err) { console.error("Error:", err); }
    hideLoader();
}

function renderAll() {
    renderStats();
    renderCharts();
    renderActivities();
    renderInquiries();
}

function renderStats() {
    document.getElementById('monthlyRevenue').textContent = formatCurrency(state.stats.revenue);
    document.getElementById('monthlyExpenses').textContent = formatCurrency(state.stats.expenses);
    document.getElementById('yearlyRevenueDisplay').textContent = formatCurrency(state.stats.yearlyRevenue);
    document.getElementById('yearlyExpensesDisplay').textContent = formatCurrency(state.stats.yearlyExpenses);
}

function renderCharts() {
    const stats = state.stats;
    const ctxY = document.getElementById('yearlyChart');
    const ctxM = document.getElementById('monthlyChart');
    if (!ctxY || !ctxM) return;

    if (state.charts.yearly) state.charts.yearly.destroy();
    if (state.charts.monthly) state.charts.monthly.destroy();

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255,255,255,0.05)' },
                ticks: {
                    color: '#889',
                    font: { size: 10 },
                    callback: function (value) { return value + ' €'; }
                }
            },
            x: { grid: { display: false }, ticks: { color: '#889', font: { size: 10 } } }
        },
        plugins: { legend: { display: false } }
    };

    state.charts.yearly = new Chart(ctxY.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [
                { label: 'Prihodi', data: stats.yearlyStats.map(m => m.revenue), backgroundColor: 'rgba(46, 204, 113, 0.9)', borderRadius: 4 },
                { label: 'Rashodi', data: stats.yearlyStats.map(m => m.expenses), backgroundColor: 'rgba(0, 242, 255, 0.9)', borderRadius: 4 }
            ]
        },
        options: chartOptions
    });

    state.charts.monthly = new Chart(ctxM.getContext('2d'), {
        type: 'bar',
        data: {
            labels: ['Prihodi', 'Rashodi'],
            datasets: [{
                data: [stats.revenue, stats.expenses],
                backgroundColor: ['rgba(46, 204, 113, 1)', 'rgba(0, 242, 255, 1)'],
                borderRadius: 10
            }]
        },
        options: chartOptions
    });
}

function renderActivities() {
    const list = document.getElementById('activityList');
    if (!list) return;
    list.innerHTML = state.stats.recentActivities.map(act => `
        <div class="activity-item" style="display:flex; justify-content:space-between; padding:12px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
            <div class="item-main">
                <span style="font-weight:700; font-size:0.9rem;">${act.stranka}</span>
                <span style="font-size:0.7rem; color:#889;">${act.opis} (${act.datum})</span>
            </div>
            <div style="font-weight:800; color:${act.vrsta === 'IRA' ? '#2ecc71' : '#00f2ff'};">
                ${act.vrsta === 'IRA' ? '+' : '-'}${formatCurrency(act.iznos)}
            </div>
        </div>
    `).join('');
}

function renderInquiries(data = state.inquiries) {
    const list = document.getElementById('inquiryList');
    if (!list) return;
    list.innerHTML = data.map(item => `
        <div class="inquiry-item shadow-premium" onclick="handleInquiryAction('${item.id}')" style="cursor:pointer; margin-bottom:12px; display:flex; justify-content:space-between; padding:15px; background:rgba(255,255,255,0.02); border-radius:15px; border:1px solid var(--glass-border);">
            <div class="item-main">
                <span class="item-title">${item.name || "Bez imena"}</span>
                <span class="item-meta">${item.id.split('-')[0]} • ${item.subject}</span>
                <span class="item-meta">Status: <b style="color:var(--accent-orange)">${item.status}</b></span>
            </div>
            <div class="item-action" style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
                <b style="color:#fff;">${formatCurrency(item.amount)}</b>
                <button class="btn-pill-small" style="margin-top:5px; transform:scale(0.8);">DETALJI</button>
            </div>
        </div>
    `).join('');
}

function handleInquiryAction(id) {
    const item = state.inquiries.find(i => String(i.id) === String(id));
    if (!item) return;
    state.selectedInquiry = item;

    document.getElementById('detName').innerText = item.name || "-";
    document.getElementById('detEmail').innerText = item.email || "-";
    document.getElementById('detAmount').innerText = formatCurrency(item.amount);

    renderProducts(item);

    document.getElementById('inquiryModal').classList.add('active');
}

function renderProducts(item) {
    const list = document.getElementById('productList');
    if (!list) return;

    let products = [];
    try {
        const raw = JSON.parse(item.jsonData || "{}");
        products = raw.stavke || raw.items || raw.products || [];
        if (Array.isArray(raw)) products = raw;
    } catch (e) { console.error("JSON parse error", e); }

    if (products.length === 0) {
        list.innerHTML = `<div style="color:#889; font-size:0.8rem;">Nema stavki u ovoj ponudi.</div>`;
        return;
    }

    list.innerHTML = products.map((p, idx) => `
        <div class="p-item" style="display:flex; align-items:flex-end; gap:10px; background:rgba(255,255,255,0.04); padding:10px; border-radius:12px; margin-bottom:10px;">
            <div class="p-name" style="flex:1; font-size:0.85rem;">${p.naziv || p.name || "Stavka"}</div>
            <div class="p-col-group" style="display:flex; flex-direction:column; align-items:center;">
                <span style="font-size:0.6rem; color:#889;">kol</span>
                <input type="number" class="p-input" value="${p.kolicina || p.qty || 1}" style="width:50px; background:#000; border:1px solid var(--accent-orange); color:var(--accent-orange); text-align:center; border-radius:5px;">
            </div>
            <div class="p-col-group" style="display:flex; flex-direction:column; align-items:center;">
                <span style="font-size:0.6rem; color:#889;">cijena</span>
                <input type="number" class="p-input" value="${p.cijena || p.price || 0}" style="width:70px; background:#000; border:1px solid var(--accent-orange); color:var(--accent-orange); text-align:center; border-radius:5px;">
            </div>
        </div>
    `).join('');
}

function initModal() {
    const modal = document.getElementById('inquiryModal');
    if (!modal) return;

    // Zatvaranje modala
    document.querySelectorAll('.close-modal').forEach(b => {
        b.onclick = () => {
            modal.classList.remove('active');
            document.getElementById('catalogModal').classList.remove('active');
            document.getElementById('checkoutModal').classList.remove('active');
        };
    });

    const btnOffer = document.getElementById('btnSendOffer');
    const btnInvoice = document.getElementById('btnSendInvoice');

    if (btnOffer) {
        btnOffer.onclick = (e) => {
            e.preventDefault();
            sendWithFeedback('btnSendOffer', 'sendOffer');
        };
    }

    if (btnInvoice) {
        btnInvoice.onclick = (e) => {
            e.preventDefault();
            sendWithFeedback('btnSendInvoice', 'sendInvoice');
        };
    }
}

async function sendWithFeedback(btnId, action) {
    if (!state.selectedInquiry) return;
    const btn = document.getElementById(btnId);
    const originalText = btn.innerHTML;
    const isOffer = action === 'sendOffer';

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ŠALJEM...';
    btn.style.background = isOffer ? 'var(--accent-orange)' : 'var(--accent-cyan)';
    btn.style.color = '#000';

    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: action, id: state.selectedInquiry.id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            btn.innerHTML = '<i class="fas fa-check"></i> POSLANO!';
            btn.style.background = 'var(--success)';
            btn.style.border = '2px solid var(--success)';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                btn.style.background = '#000';
                btn.style.color = isOffer ? 'var(--accent-orange)' : 'var(--accent-cyan)';
                btn.style.border = `2px solid ${isOffer ? 'var(--accent-orange)' : 'var(--accent-cyan)'}`;
                refreshData();
            }, 3000);
        } else {
            throw new Error(data.message);
        }
    } catch (e) {
        btn.innerHTML = '<i class="fas fa-times"></i> GREŠKA';
        btn.style.background = 'var(--danger)';
        btn.style.border = '2px solid var(--danger)';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.disabled = false;
            btn.style.background = '#000';
            btn.style.color = isOffer ? 'var(--accent-orange)' : 'var(--accent-cyan)';
            btn.style.border = `2px solid ${isOffer ? 'var(--accent-orange)' : 'var(--accent-cyan)'}`;
        }, 3000);
    }
}

function initScanner() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.onchange = () => alert("Skeniranje u obradi...");
}

function initCatalog() {
    const btnNew = document.getElementById('btnNewInquiry');
    if (btnNew) btnNew.onclick = openCatalog;

    const btnClose = document.getElementById('btnCloseCatalog');
    if (btnClose) btnClose.onclick = () => document.getElementById('catalogModal').classList.remove('active');

    const search = document.getElementById('catalogSearch');
    if (search) search.oninput = (e) => {
        const q = e.target.value.toLowerCase();
        const filtered = state.catalog.filter(p => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
        renderCatalog(filtered);
    };

    document.getElementById('btnViewCart').onclick = openCheckout;
    document.getElementById('btnCloseCheckout').onclick = () => document.getElementById('checkoutModal').classList.remove('active');
    document.getElementById('btnSubmitOffer').onclick = submitOffer;
}

async function openCatalog() {
    showLoader("Učitavanje kataloga...");
    try {
        const res = await fetch(`${GAS_URL}?action=get_products`);
        const data = await res.json();
        if (data.status === 'success') {
            state.catalog = data.products;
            if (state.catalog.length === 0) {
                alert("Katalog je prazan! Provjeri postoji li sheet 'Proizvodi' ili 'Cjenik' u tvom Google Sheetu.");
                return;
            }
            renderCategories();
            renderCatalog(data.products);
            document.getElementById('catalogModal').classList.add('active');
        }
    } catch (e) { alert("Greška pri učitavanju kataloga"); }
    hideLoader();
}

function renderCategories() {
    const cats = ["Ograde", "Hidro", "Termo", "Fasade"];
    const container = document.getElementById('categoryFilters');
    container.innerHTML = `<div class="pill active" onclick="renderCatalog(state.catalog); document.querySelectorAll('.pill').forEach(p=>p.classList.remove('active')); this.classList.add('active');">Sve</div>`;
    cats.forEach(c => {
        const div = document.createElement('div');
        div.className = 'pill';
        div.innerText = c;
        div.onclick = () => {
            const filtered = state.catalog.filter(p => (p.category || "").toUpperCase().includes(c.toUpperCase()));
            renderCatalog(filtered);
            document.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
            div.classList.add('active');
        };
        container.appendChild(div);
    });
}

function renderCatalog(items) {
    const list = document.getElementById('catalogList');
    list.innerHTML = items.map(p => {
        const cartItem = state.cart.find(c => c.sku === p.sku);
        const qty = cartItem ? cartItem.qty : 0;
        return `
            <div class="catalog-card shadow-premium">
                <div class="p-name">${p.name}</div>
                <div class="p-meta">SKU: ${p.sku} | Jedinica: ${p.unit}</div>
                <div class="p-actions">
                    <div class="p-price">${formatCurrency(p.price)}</div>
                    <div class="qty-control">
                        <button class="qty-btn" onclick="updateCart('${p.sku}', -1)">-</button>
                        <span style="font-weight:700; width:20px; text-align:center;">${qty}</span>
                        <button class="qty-btn" onclick="updateCart('${p.sku}', 1)">+</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.updateCart = function (sku, delta) {
    const prod = state.catalog.find(p => p.sku === sku);
    if (!prod) return;

    let cartItem = state.cart.find(c => c.sku === sku);
    if (!cartItem) {
        if (delta > 0) state.cart.push({ ...prod, qty: 1 });
    } else {
        cartItem.qty += delta;
        if (cartItem.qty <= 0) state.cart = state.cart.filter(c => c.sku !== sku);
    }

    updateCartUI();
    renderCatalog(state.catalog); // Osvježi brojeve na karticama
};

function updateCartUI() {
    const count = state.cart.reduce((acc, current) => acc + current.qty, 0);
    document.getElementById('cartCount').innerText = count;
}

function openCheckout() {
    if (state.cart.length === 0) return alert("Košarica je prazna!");

    const list = document.getElementById('checkoutList');
    let total = 0;
    list.innerHTML = state.cart.map(item => {
        const lineTotal = item.price * item.qty;
        total += lineTotal;
        return `
            <div class="p-item" style="display:flex; align-items:flex-end; gap:10px; background:rgba(255,255,255,0.04); padding:10px; border-radius:12px; margin-bottom:10px;">
                <div class="p-name" style="flex:1; font-size:0.8rem;">${item.name}</div>
                <div style="display:flex; gap:5px;">
                    <input type="number" value="${item.qty}" onchange="updateCartItemQty('${item.sku}', this.value)" style="width:40px; background:#000; border:1px solid var(--accent-orange); color:#fff; text-align:center; border-radius:5px;">
                    <input type="number" value="${item.price}" onchange="updateCartItemPrice('${item.sku}', this.value)" style="width:60px; background:#000; border:1px solid var(--accent-orange); color:#fff; text-align:center; border-radius:5px;">
                </div>
            </div>
        `;
    }).join('');

    document.getElementById('chkTotal').innerText = formatCurrency(total);
    document.getElementById('checkoutModal').classList.add('active');
}

window.updateCartItemQty = (sku, val) => {
    const item = state.cart.find(c => c.sku === sku);
    if (item) item.qty = parseFloat(val) || 0;
    recalcCheckoutTotal();
};

window.updateCartItemPrice = (sku, val) => {
    const item = state.cart.find(c => c.sku === sku);
    if (item) item.price = parseFloat(val) || 0;
    recalcCheckoutTotal();
};

function recalcCheckoutTotal() {
    const total = state.cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
    document.getElementById('chkTotal').innerText = formatCurrency(total);
}

async function submitOffer() {
    const name = document.getElementById('chkName').value;
    const email = document.getElementById('chkEmail').value;
    const subject = document.getElementById('chkSubject').value;

    if (!name || !email) return alert("Ime i Email su obavezni!");

    showLoader("Kreiranje ponude...");
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'createInquiry',
                name: name,
                email: email,
                subject: subject || "Nova ponuda iz aplikacije",
                items: state.cart.map(i => ({ sku: i.sku, naziv: i.name, kolicina: i.qty, cijena: i.price }))
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert("Ponuda uspješno kreirana i poslana! (ID: " + data.id + ")");
            state.cart = [];
            updateCartUI();
            document.getElementById('checkoutModal').classList.remove('active');
            document.getElementById('catalogModal').classList.remove('active');
            refreshData();
        }
    } catch (e) { alert("Greška pri slanju ponude."); }
    hideLoader();
}

function formatCurrency(v) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(v || 0); }
function showLoader(m) { const l = document.getElementById('loader'); if (l) { l.innerText = m; l.style.display = "block"; } }
function hideLoader() { const l = document.getElementById('loader'); if (l) l.style.display = "none"; }
function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i => (i.name || "").toLowerCase().includes(q) || (i.subject || "").toLowerCase().includes(q));
    renderInquiries(filtered);
}
