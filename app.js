/**
 * 2LMF PRO BUSINESS - FRONTEND CORE 🦈🚀
 * Verzija: 2.5 (Real Revenue + Editable Products)
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbx4TQ6cFNr8X-fNRHE0Ai571pAioDeny_mSSrTVQm3OHbTKOhfIEDiKDFM2shZ5zDFLrA/exec";

let state = {
    inquiries: [],
    stats: { revenue: 0, expenses: 0, offerEstimation: 0, inquiriesCount: 0, yearlyStats: [], monthlyStats: [], recentActivities: [] },
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

    document.getElementById('inquirySearch').addEventListener('input', (e) => {
        filterInquiries(e.target.value);
    });
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    if (tabId === 'dashboard') setTimeout(updateCharts, 200);
}

// --- DATA SYNC ---
async function refreshData() {
    showLoader("Učitavanje...");
    try {
        const response = await fetch(`${GAS_URL}?action=get_dashboard_data&cb=${Date.now()}`);
        const result = await response.json();
        if (result.status === "success") {
            state.inquiries = result.inquiries || [];
            state.stats = result.stats || state.stats;
            renderDashboard();
            renderInquiries();
            setTimeout(updateCharts, 300);
        }
    } catch (err) { console.error("Error:", err); } finally { hideLoader(); }
}

// --- RENDERERS ---
function renderDashboard() {
    const stats = state.stats;
    document.getElementById('monthlyRevenue').innerText = formatCurrency(stats.revenue);
    document.getElementById('monthlyExpenses').innerText = formatCurrency(stats.expenses);
    document.getElementById('offerEstimation').innerText = formatCurrency(stats.offerEstimation);
    document.getElementById('openInquiries').innerText = stats.inquiriesCount;

    const list = document.getElementById('activityList');
    list.innerHTML = '';
    (stats.recentActivities || []).forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        const color = item.vrsta === "IRA" ? "var(--success)" : "var(--accent-cyan)";
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title" style="color:${color}">${item.vrsta}: ${item.stranka}</span>
                <span class="item-meta">${item.datum} • ${item.opis}</span>
            </div>
            <div class="item-action"><b>${formatCurrency(item.iznos)}</b></div>
        `;
        list.appendChild(div);
    });
}

function updateCharts() {
    const stats = state.stats;
    if (!stats.yearlyStats) return;

    // Yearly
    const yCtx = document.getElementById('yearlyChart').getContext('2d');
    if (state.charts.yearly) state.charts.yearly.destroy();
    state.charts.yearly = new Chart(yCtx, {
        type: 'bar',
        data: {
            labels: ['S', 'V', 'O', 'T', 'S', 'L', 'S', 'K', 'R', 'L', 'S', 'P'],
            datasets: [
                { label: 'Naplaćeno', data: stats.yearlyStats.map(m => m.revenue), backgroundColor: 'rgba(46, 204, 113, 0.8)', borderRadius: 5 },
                { label: 'Isplaćeno', data: stats.yearlyStats.map(m => m.expenses), backgroundColor: 'rgba(0, 242, 255, 0.8)', borderRadius: 5 }
            ]
        },
        options: chartOptions
    });

    // Monthly
    const mCtx = document.getElementById('monthlyChart').getContext('2d');
    if (state.charts.monthly) state.charts.monthly.destroy();
    state.charts.monthly = new Chart(mCtx, {
        type: 'bar',
        data: {
            labels: stats.monthlyStats.map(d => d.day),
            datasets: [
                { label: 'Prihodi', data: stats.monthlyStats.map(d => d.revenue), backgroundColor: 'rgba(46, 204, 113, 0.7)' },
                { label: 'Troškovi', data: stats.monthlyStats.map(d => d.expenses), backgroundColor: 'rgba(0, 242, 255, 0.7)' }
            ]
        },
        options: chartOptions
    });
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
    list.innerHTML = '';
    data.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item shadow-premium';
        div.style.marginBottom = "12px";
        div.innerHTML = `
            <div class="item-main" onclick="handleInquiryAction('${item.id}')">
                <span class="item-title">${item.name}</span>
                <span class="item-meta">${item.id} • ${item.subject}</span>
                <span class="item-meta">Status: <b style="color:var(--accent-orange)">${item.status}</b></span>
            </div>
            <div class="item-action" style="flex-direction:column; align-items:flex-end;">
                <b style="font-size:1.1rem;">${formatCurrency(item.amount)}</b>
                <button class="btn-text" style="color:var(--accent-cyan); margin-top:5px; font-weight:bold; font-size:0.75rem;">DETALJI / UREDI</button>
            </div>
        `;
        list.appendChild(div);
    });
}

function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i =>
        i.name.toLowerCase().includes(q) || i.id.toLowerCase().includes(q) || i.subject.toLowerCase().includes(q)
    );
    renderInquiries(filtered);
}

// --- EDITABLE MODAL LOGIC ---
function handleInquiryAction(id) {
    const item = state.inquiries.find(i => String(i.id) === String(id));
    if (!item) return;
    state.selectedInquiry = item;

    document.getElementById('detName').innerText = item.name;
    document.getElementById('detEmail').innerText = item.email;
    document.getElementById('detAmount').innerText = formatCurrency(item.amount);

    // Parse JSON
    let products = [];
    try {
        const raw = JSON.parse(item.jsonData);
        products = raw.stavke || [];
    } catch (e) { console.error("JSON Error"); }

    renderProductList(products);
    document.getElementById('btnSaveChanges').style.display = "none";
    document.getElementById('inquiryModal').classList.add('active');
}

function renderProductList(products) {
    const list = document.getElementById('productList');
    list.innerHTML = '';
    if (products.length === 0) {
        list.innerHTML = '<div class="item-meta">Nema definiranih stavki.</div>';
        return;
    }

    products.forEach((p, idx) => {
        const div = document.createElement('div');
        div.className = 'p-item';
        div.innerHTML = `
            <div class="p-name">${p.naziv || p.name}</div>
            <input type="number" class="p-input p-qty" value="${p.kolicina || p.qty}" onchange="updateProduct(${idx}, 'qty', this.value)">
            <input type="number" class="p-input p-price" value="${p.cijena || p.price}" onchange="updateProduct(${idx}, 'price', this.value)">
        `;
        list.appendChild(div);
    });
}

function updateProduct(idx, field, val) {
    const item = state.selectedInquiry;
    let raw = JSON.parse(item.jsonData);
    if (!raw.stavke) raw.stavke = [];

    if (field === 'qty') raw.stavke[idx].kolicina = parseFloat(val);
    if (field === 'price') raw.stavke[idx].cijena = parseFloat(val);

    // Recalculate total
    let total = raw.stavke.reduce((sum, p) => sum + (p.kolicina * p.cijena), 0);
    item.amount = total;
    item.jsonData = JSON.stringify(raw);

    document.getElementById('detAmount').innerText = formatCurrency(total);
    document.getElementById('btnSaveChanges').style.display = "block";
}

async function saveInquiryChanges() {
    const item = state.selectedInquiry;
    showLoader("Spremanje...");
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: "updateInquiry",
                id: item.id,
                amount: item.amount,
                jsonData: JSON.parse(item.jsonData)
            })
        });
        const result = await res.json();
        if (result.status === "success") {
            alert("Izmjene spremljene!");
            document.getElementById('btnSaveChanges').style.display = "none";
            refreshData();
        }
    } catch (e) { alert("Greška pri spremanju!"); } finally { hideLoader(); }
}

// --- MODALS ---
function initModal() {
    const m = document.getElementById('inquiryModal');
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => m.classList.remove('active'));
    document.getElementById('btnCloseInquiry').onclick = () => m.classList.remove('active');
    document.getElementById('btnSaveChanges').onclick = saveInquiryChanges;

    document.getElementById('btnSendOffer').onclick = () => runGasAction('sendOffer');
    document.getElementById('btnSendInvoice').onclick = () => runGasAction('sendInvoice');
}

async function runGasAction(action) {
    const id = state.selectedInquiry.id;
    showLoader("Slanje...");
    try {
        await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, id }) });
        alert("Akcija uspješna!");
    } catch (e) { alert("Greška!"); } finally { hideLoader(); }
}

// --- HELPERS ---
function formatCurrency(v) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(v || 0); }
function showLoader(m) { const l = document.getElementById('loader'); if (l) { l.innerText = m; l.style.display = "block"; } }
function hideLoader() { const l = document.getElementById('loader'); if (l) l.style.display = "none"; }
function initScanner() { /* matches v2.4+ */ }
function toBase64(f) { return new Promise((r, j) => { const rd = new FileReader(); rd.readAsDataURL(f); rd.onload = () => r(rd.result); }); }
