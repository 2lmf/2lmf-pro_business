/**
 * 2LMF PRO BUSINESS - FRONTEND CORE 🦈🚀
 * Verzija: 2.9 (YEARLY TOTALS + SIMPLIFIED CHART + PILL ALIGN)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbx4TQ6cFNr8X-fNRHE0Ai571pAioDeny_mSSrTVQm3OHbTKOhfIEDiKDFM2shZ5zDFLrA/exec";

let state = {
    inquiries: [],
    stats: { revenue: 0, expenses: 0, yearlyRevenue: 0, yearlyExpenses: 0, yearlyStats: [], recentActivities: [] },
    selectedInquiry: null,
    charts: { yearly: null, monthly: null }
};

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initScanner();
    initModal();
    refreshData();
});

// --- NAVIGATION ---
function initNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = item.getAttribute('data-tab');
            switchTab(tabId);
        });
    });
    const search = document.getElementById('inquirySearch');
    if (search) search.addEventListener('input', (e) => filterInquiries(e.target.value));
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    const navItem = document.querySelector(`[data-tab="${tabId}"]`);
    if (navItem) navItem.classList.add('active');

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add('active');

    if (tabId === 'dashboard') setTimeout(updateCharts, 400);
}

// --- DATA SYNC ---
async function refreshData() {
    showLoader("Učitavanje v2.9...");
    try {
        const response = await fetch(`${GAS_URL}?action=get_dashboard_data&cb=${Date.now()}`);
        const result = await response.json();
        if (result.status === "success") {
            state.inquiries = result.inquiries || [];
            state.stats = result.stats || state.stats;
            renderDashboard();
            renderInquiries();
            setTimeout(updateCharts, 600);
        }
    } catch (err) { console.error("Fetch Error:", err); } finally { hideLoader(); }
}

// --- RENDERERS ---
function renderDashboard() {
    const stats = state.stats;
    document.getElementById('monthlyRevenue').innerText = formatCurrency(stats.revenue);
    document.getElementById('monthlyExpenses').innerText = formatCurrency(stats.expenses);

    // NEW YEARLY CARDS
    const yrDisp = document.getElementById('yearlyRevenueDisplay');
    if (yrDisp) yrDisp.innerText = formatCurrency(stats.yearlyRevenue);

    const yeDisp = document.getElementById('yearlyExpensesDisplay');
    if (yeDisp) yeDisp.innerText = formatCurrency(stats.yearlyExpenses);

    const list = document.getElementById('activityList');
    list.innerHTML = '';
    (stats.recentActivities || []).forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item shadow-premium';
        div.style.marginBottom = "12px";
        const color = item.vrsta === "IRA" ? "var(--success)" : "var(--accent-cyan)";
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title" style="color:${color}">${item.vrsta}: ${item.stranka}</span>
                <span class="item-meta">${item.datum} • ${item.opis}</span>
            </div>
            <div class="item-action"><b style="color:#fff;">${formatCurrency(item.iznos)}</b></div>
        `;
        list.appendChild(div);
    });
}

function updateCharts() {
    const stats = state.stats;
    if (!stats.yearlyStats || stats.yearlyStats.length === 0) return;

    // 1. YEARLY LINE/BAR
    const yEl = document.getElementById('yearlyChart');
    if (yEl) {
        if (state.charts.yearly) state.charts.yearly.destroy();
        state.charts.yearly = new Chart(yEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['S', 'V', 'O', 'T', 'S', 'L', 'S', 'K', 'R', 'L', 'S', 'P'],
                datasets: [
                    { label: 'Prihodi', data: stats.yearlyStats.map(m => m.revenue), backgroundColor: 'rgba(46, 204, 113, 0.9)', borderRadius: 4 },
                    { label: 'Troškovi', data: stats.yearlyStats.map(m => m.expenses), backgroundColor: 'rgba(0, 242, 255, 0.9)', borderRadius: 4 }
                ]
            },
            options: chartOptions
        });
    }

    // 2. SIMPLIFIED MONTHLY (2 Bars)
    const mEl = document.getElementById('monthlyChart');
    if (mEl) {
        if (state.charts.monthly) state.charts.monthly.destroy();
        state.charts.monthly = new Chart(mEl.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['PRIHODI (MJ)', 'TROŠKOVI (MJ)'],
                datasets: [{
                    label: 'Iznos (€)',
                    data: [stats.revenue, stats.expenses],
                    backgroundColor: ['rgba(46, 204, 113, 1)', 'rgba(0, 242, 255, 1)'],
                    borderRadius: 10
                }]
            },
            options: {
                ...chartOptions,
                plugins: { legend: { display: false } }
            }
        });
    }
}

const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#889', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#889', font: { size: 10 } } }
    },
    plugins: { legend: { display: false } }
};

function renderInquiries(data = state.inquiries) {
    const list = document.getElementById('inquiryList');
    if (!list) return;
    list.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item shadow-premium';
        div.onclick = () => handleInquiryAction(item.id);
        div.style.cursor = "pointer";

        div.innerHTML = `
            <div class="item-main">
                <span class="item-title">${item.name || "Bez imena"}</span>
                <span class="item-meta">${item.id} • ${item.subject || "Upit"}</span>
                <span class="item-meta">Status: <b style="color:var(--accent-orange)">${item.status}</b></span>
            </div>
            <div class="item-action" style="flex-direction:column; align-items:flex-end;">
                <b style="font-size:1.15rem; color:#fff; margin-bottom:10px;">${formatCurrency(item.amount)}</b>
                <button class="btn-pill-small">DETALJI</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i =>
        (i.name || "").toLowerCase().includes(q) || (i.id || "").toLowerCase().includes(q) || (i.subject || "").toLowerCase().includes(q)
    );
    renderInquiries(filtered);
}

// --- MODAL ---
function handleInquiryAction(id) {
    const item = state.inquiries.find(i => String(i.id) === String(id));
    if (!item) return;
    state.selectedInquiry = item;

    document.getElementById('detName').innerText = item.name || "-";
    document.getElementById('detEmail').innerText = item.email || "-";
    document.getElementById('detAmount').innerText = formatCurrency(item.amount);

    let products = [];
    try {
        const raw = JSON.parse(item.jsonData || "{}");
        products = raw.stavke || raw.items || raw.products || [];
        if (Array.isArray(raw) && raw.length > 0) products = raw;
    } catch (e) { console.error("JSON Error", id); }

    renderProductList(products);
    document.getElementById('btnSaveChanges').style.display = "none";
    document.getElementById('inquiryModal').classList.add('active');
}

function renderProductList(products) {
    const list = document.getElementById('productList');
    list.innerHTML = '';
    if (products.length === 0) {
        list.innerHTML = '<div class="item-meta">Nema definiranih artikla.</div>';
        return;
    }
    products.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'p-item';
        div.innerHTML = `
            <div class="p-name">${p.naziv || p.name || p.title || "Artikl"}</div>
            <div class="p-col-group">
                <span class="p-small-label">kol</span>
                <input type="number" class="p-input p-qty" value="${p.kolicina || p.qty || 0}" onchange="updateProduct(${idx}, 'qty', this.value)">
            </div>
            <div class="p-col-group">
                <span class="p-small-label">cij</span>
                <input type="number" class="p-input p-price" value="${p.cijena || p.price || 0}" onchange="updateProduct(${idx}, 'price', this.value)">
            </div>
        `;
        list.appendChild(div);
    });
}

function updateProduct(idx, field, val) {
    const item = state.selectedInquiry;
    let raw = JSON.parse(item.jsonData || '{"stavke":[]}');
    if (!raw.stavke) raw.stavke = raw.items || raw.products || [];

    if (field === 'qty') {
        if (raw.stavke[idx]) raw.stavke[idx].kolicina = parseFloat(val) || 0;
    }
    if (field === 'price') {
        if (raw.stavke[idx]) raw.stavke[idx].cijena = parseFloat(val) || 0;
    }

    let total = raw.stavke.reduce((sum, p) => sum + ((p.kolicina || 0) * (p.cijena || 0)), 0);
    item.amount = total;
    item.jsonData = JSON.stringify({ stavke: raw.stavke });

    document.getElementById('detAmount').innerText = formatCurrency(total);
    document.getElementById('btnSaveChanges').style.display = "block";
}

async function saveInquiryChanges() {
    const item = state.selectedInquiry;
    showLoader("Spremanje...");
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateInquiry", id: item.id, amount: item.amount, jsonData: JSON.parse(item.jsonData) })
        });
        const result = await res.json();
        if (result.status === "success") {
            alert("Spremljeno!");
            document.getElementById('btnSaveChanges').style.display = "none";
            refreshData();
        }
    } catch (e) { alert("Greška!"); } finally { hideLoader(); }
}

function initModal() {
    const modal = document.getElementById('inquiryModal');
    if (!modal) return;
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => modal.classList.remove('active'));
    document.getElementById('btnCloseInquiry').onclick = () => modal.classList.remove('active');
    document.getElementById('btnSaveChanges').onclick = saveInquiryChanges;
    document.getElementById('btnSendOffer').onclick = () => runGasAction('sendOffer');
    document.getElementById('btnSendInvoice').onclick = () => runGasAction('sendInvoice');
}

async function runGasAction(action) {
    const id = state.selectedInquiry.id;
    showLoader("Slanje...");
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, id }) });
        alert("Pokrenuto!");
    } catch (e) { alert("Greška!"); } finally { hideLoader(); }
}

function formatCurrency(v) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(v || 0); }
function showLoader(m) { const l = document.getElementById('loader'); if (l) { l.innerText = m; l.style.display = "block"; } }
function hideLoader() { const l = document.getElementById('loader'); if (l) l.style.display = "none"; }
function initScanner() { }
