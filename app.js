/**
 * 2LMF PRO BUSINESS - FRONTEND REVERSION 🦈⏪
 * Verzija: 2.9.5 (UI RESTORATION + SENDING FIX)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbx4TQ6cFNr8X-fNRHE0Ai571pAioDeny_mSSrTVQm3OHbTKOhfIEDiKDFM2shZ5zDFLrA/exec";

let state = {
    inquiries: [],
    stats: { revenue: 0, expenses: 0, yearlyRevenue: 0, yearlyExpenses: 0, yearlyStats: [], recentActivities: [] },
    selectedInquiry: null,
    charts: { yearly: null, monthly: null }
};

document.addEventListener('DOMContentLoaded', init);

async function init() {
    setupTabs();
    initModal();
    await refreshData();

    // Search listener
    const search = document.getElementById('inquirySearch');
    if (search) search.addEventListener('input', (e) => filterInquiries(e.target.value));

    setInterval(refreshData, 300000);
}

function setupTabs() {
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
    showLoader("Sinkronizacija...");
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

function renderActivities() {
    const list = document.getElementById('activityList');
    if (!list) return;
    list.innerHTML = state.stats.recentActivities.map(act => `
        <div class="activity-item">
            <div class="item-main">
                <span class="item-title">${act.stranka}</span>
                <span class="item-meta">${act.opis} (${act.datum})</span>
            </div>
            <div class="item-action">
                <span class="${act.vrsta.toLowerCase()}-amount">${act.vrsta === 'IRA' ? '+' : '-'}${formatCurrency(act.iznos)}</span>
            </div>
        </div>
    `).join('');
}

function renderInquiries(data = state.inquiries) {
    const list = document.getElementById('inquiryList');
    if (!list) return;
    list.innerHTML = data.map(item => `
        <div class="inquiry-item shadow-premium" onclick="handleInquiryAction('${item.id}')" style="cursor:pointer; margin-bottom:12px;">
            <div class="item-main">
                <span class="item-title">${item.name || "Bez imena"}</span>
                <span class="item-meta">${item.id.split('-')[0]} • ${item.subject}</span>
                <span class="item-meta">Status: <b style="color:var(--accent-orange)">${item.status}</b></span>
            </div>
            <div class="item-action" style="display:flex; flex-direction:column; align-items:flex-end; justify-content:center;">
                <b style="color:#fff;">${formatCurrency(item.amount)}</b>
                <button class="btn-pill-small" style="margin-top:5px;">DETALJI</button>
            </div>
        </div>
    `).join('');
}

function renderCharts() {
    const stats = state.stats;
    const ctxY = document.getElementById('yearlyChart');
    const ctxM = document.getElementById('monthlyChart');

    if (state.charts.yearly) state.charts.yearly.destroy();
    if (state.charts.monthly) state.charts.monthly.destroy();

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
        options: { ...chartOptions, plugins: { legend: { display: false } } }
    });
}

const chartOptions = {
    responsive: true, maintainAspectRatio: false,
    scales: {
        y: { display: false },
        x: { grid: { display: false }, ticks: { color: '#889', font: { size: 10 } } }
    },
    plugins: { legend: { display: false } }
};

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
        products = raw.stavke || raw.items || [];
        if (Array.isArray(raw) && raw.length > 0) products = raw;
    } catch (e) { }

    renderProductList(products);
    document.getElementById('btnSaveChanges').style.display = "none";
    document.getElementById('inquiryModal').classList.add('active');
}

function renderProductList(products) {
    const list = document.getElementById('productList');
    list.innerHTML = products.map((p, idx) => `
        <div class="p-item">
            <div class="p-name">${p.naziv || p.name || "Artikl"}</div>
            <div class="p-col-group">
                <span class="p-small-label">kol</span>
                <input type="number" class="p-input" value="${p.kolicina || 0}" onchange="updateLocalProduct(${idx}, 'qty', this.value)">
            </div>
            <div class="p-col-group">
                <span class="p-small-label">cij</span>
                <input type="number" class="p-input" value="${p.cijena || 0}" onchange="updateLocalProduct(${idx}, 'price', this.value)">
            </div>
        </div>
    `).join('');
}

function updateLocalProduct(idx, field, val) {
    const item = state.selectedInquiry;
    let raw = JSON.parse(item.jsonData || '{"stavke":[]}');
    let items = raw.stavke || raw.items || [];

    if (field === 'qty') items[idx].kolicina = parseFloat(val) || 0;
    if (field === 'price') items[idx].cijena = parseFloat(val) || 0;

    item.amount = items.reduce((sum, p) => sum + (p.kolicina * p.cijena), 0);
    item.jsonData = JSON.stringify({ stavke: items });

    document.getElementById('detAmount').innerText = formatCurrency(item.amount);
    document.getElementById('btnSaveChanges').style.display = "block";
}

async function saveInquiryChanges() {
    const item = state.selectedInquiry;
    showLoader("Spremanje...");
    try {
        await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action: "updateInquiry", id: item.id, amount: item.amount, jsonData: JSON.parse(item.jsonData) })
        });
        alert("Spremljeno!");
        document.getElementById('btnSaveChanges').style.display = "none";
        refreshData();
    } catch (e) { alert("Greška!"); }
    hideLoader();
}

function initModal() {
    const modal = document.getElementById('inquiryModal');
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
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, id }) });
        const data = await res.json();
        if (data.status === "success") {
            alert("Poslano uspješno!");
            document.getElementById('inquiryModal').classList.remove('active');
            refreshData();
        } else {
            alert("Greška pri slanju.");
        }
    } catch (e) { alert("Greška!"); }
    hideLoader();
}

function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i => (i.name || "").toLowerCase().includes(q) || (i.subject || "").toLowerCase().includes(q));
    renderInquiries(filtered);
}

function formatCurrency(v) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(v || 0); }
function showLoader(m) { const l = document.getElementById('loader'); if (l) { l.innerText = m; l.style.display = "block"; } }
function hideLoader() { const l = document.getElementById('loader'); if (l) l.style.display = "none"; }
