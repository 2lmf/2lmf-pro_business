/**
 * 2LMF PRO BUSINESS - FRONTEND CORE 🦈🚀
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbyFj_mX8E8Uj8R6_jE8_jE8_jE8_jE8_jE8_jE8/exec";

let state = {
    inquiries: [],
    receipts: [],
    stats: { revenue: 0, expenses: 0, inquiriesCount: 0, yearlyStats: [], monthlyStats: [], recentActivities: [] },
    selectedInquiryId: null,
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
}

function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

// --- DATA SYNC ---
async function refreshData() {
    showLoader("Sinkronizacija...");
    try {
        const response = await fetch(`${GAS_URL}?action=get_dashboard_data`);
        const result = await response.json();

        if (result.status === "success") {
            state.inquiries = result.inquiries || [];
            state.stats = result.stats || state.stats;

            renderDashboard();
            renderInquiries();
            updateCharts();
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    } finally {
        hideLoader();
    }
}

// --- RENDERERS ---
function renderDashboard() {
    const stats = state.stats;
    document.getElementById('monthlyRevenue').innerText = formatCurrency(stats.revenue);
    document.getElementById('monthlyExpenses').innerText = formatCurrency(stats.expenses);
    document.getElementById('openInquiries').innerText = stats.inquiriesCount;
    document.getElementById('estimatedProfit').innerText = formatCurrency(stats.revenue - stats.expenses);

    const list = document.getElementById('activityList');
    list.innerHTML = '';

    const activities = stats.recentActivities || [];
    activities.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        const colorClass = item.vrsta === "IRA" ? "var(--success)" : "var(--accent-cyan)";
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title" style="color: ${colorClass}">${item.vrsta}: ${item.stranka}</span>
                <span class="item-meta">${item.datum} • ${item.opis}</span>
            </div>
            <div class="item-action">
                <b>${formatCurrency(item.iznos)}</b>
            </div>
        `;
        list.appendChild(div);
    });
}

function updateCharts() {
    const stats = state.stats;

    // Yearly Chart
    const yearlyCtx = document.getElementById('yearlyChart').getContext('2d');
    if (state.charts.yearly) state.charts.yearly.destroy();

    state.charts.yearly = new Chart(yearlyCtx, {
        type: 'bar',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [
                { label: 'Prihodi', data: stats.yearlyStats.map(m => m.revenue), backgroundColor: '#E67E22', borderRadius: 5 },
                { label: 'Troškovi', data: stats.yearlyStats.map(m => m.expenses), backgroundColor: '#00F2FF', borderRadius: 5 }
            ]
        },
        options: chartOptions
    });

    // Monthly Chart
    const monthlyCtx = document.getElementById('monthlyChart').getContext('2d');
    if (state.charts.monthly) state.charts.monthly.destroy();

    state.charts.monthly = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: stats.monthlyStats.map(d => d.day),
            datasets: [
                { label: 'Prihodi', data: stats.monthlyStats.map(d => d.revenue), backgroundColor: '#E67E22' },
                { label: 'Troškovi', data: stats.monthlyStats.map(d => d.expenses), backgroundColor: '#00F2FF' }
            ]
        },
        options: chartOptions
    });
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899', font: { size: 10 } } },
        x: { grid: { display: false }, ticks: { color: '#888899', font: { size: 10 } } }
    },
    plugins: {
        legend: { display: false }
    }
};

function renderInquiries() {
    const list = document.getElementById('inquiryList');
    list.innerHTML = '';

    state.inquiries.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        div.innerHTML = `
            <div class="item-main" onclick="handleInquiryAction('${item.id}')">
                <span class="item-title">${item.name}</span>
                <span class="item-meta">${item.id} • ${item.subject} • <b>${item.status}</b></span>
                <span class="item-meta">${item.amount} €</span>
            </div>
            <div class="item-actions-row" style="display:flex; gap:10px; margin-top:8px;">
                <button class="btn-text" onclick="handleInquiryAction('${item.id}')" style="color:var(--accent-orange); font-size:0.7rem; font-weight:bold;">DETALJI / PONUDA</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- OCR & SCANNER ---
function initScanner() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoader("Analiza računa...");
        try {
            const base64 = await toBase64(file);
            const content = base64.split(',')[1];
            const response = await fetch(GAS_URL, {
                method: 'POST',
                body: JSON.stringify({ action: "analyzeReceipt", data: content, mimeType: file.type })
            });
            const result = await response.json();
            if (result.status === "success") openPreviewModal(result.data, result.fileName);
        } catch (err) { alert("Greška!"); } finally { hideLoader(); }
    });
}

// --- MODALS ---
function initModal() {
    const inquiryModal = document.getElementById('inquiryModal');
    const previewModal = document.getElementById('previewModal');

    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.onclick = () => { inquiryModal.classList.remove('active'); previewModal.classList.remove('active'); };
    });

    document.getElementById('btnSendOffer').onclick = () => runGasAction('sendOffer');
    document.getElementById('btnSendInvoice').onclick = () => runGasAction('sendInvoice');
}

function handleInquiryAction(id) {
    const item = state.inquiries.find(i => i.id === id);
    if (!item) return;
    state.selectedInquiryId = id;
    document.getElementById('detName').innerText = item.name;
    document.getElementById('detEmail').innerText = item.email;
    document.getElementById('detSubject').innerText = item.subject;
    document.getElementById('detAmount').innerText = item.amount + " €";
    document.getElementById('inquiryModal').classList.add('active');
}

async function runGasAction(action) {
    const id = state.selectedInquiryId;
    showLoader("Slanje...");
    try {
        const res = await fetch(GAS_URL, { method: 'POST', body: JSON.stringify({ action, id }) });
        const result = await res.json();
        alert(result.message);
        document.getElementById('inquiryModal').classList.remove('active');
    } catch (err) { alert("Greška!"); } finally { hideLoader(); }
}

// --- HELPERS ---
function formatCurrency(val) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(val); }
function toBase64(file) { return new Promise((r, j) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => r(reader.result); reader.onerror = e => j(e); }); }
function showLoader(m) { console.log("LOAD:", m); }
function hideLoader() { console.log("STOP"); }
