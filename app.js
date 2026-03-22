/**
 * 2LMF PRO BUSINESS - FRONTEND CORE 🦈🚀
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbx4TQ6cFNr8X-fNRHE0Ai571pAioDeny_mSSrTVQm3OHbTKOhfIEDiKDFM2shZ5zDFLrA/exec";

let state = {
    inquiries: [],
    stats: { revenue: 0, expenses: 0, inquiriesCount: 0, yearlyStats: [], monthlyStats: [], recentActivities: [] },
    selectedInquiryId: null,
    charts: { yearly: null, monthly: null }
};

document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Aplikacija inicijalizirana.");
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

    // Provjeri trebaju li se grafikoni ponovno iscrtati (Resize fix)
    if (tabId === 'dashboard') {
        updateCharts();
    }
}

// --- DATA SYNC ---
async function refreshData() {
    console.log("🔄 Osvježavam podatke s GAS...");
    showLoader("Učitavanje...");
    try {
        // Dodajemo cache buster kako bismo izbjegli stare podatke
        const response = await fetch(`${GAS_URL}?action=get_dashboard_data&cb=${Date.now()}`);
        if (!response.ok) throw new Error("Mrežna greška (Status " + response.status + ")");

        const result = await response.json();
        console.log("✅ Podaci primljeni:", result);

        if (result.status === "success") {
            state.inquiries = result.inquiries || [];
            state.stats = result.stats || state.stats;

            renderDashboard();
            renderInquiries();
            // Charts will be updated inside renderDashboard or via delay
            setTimeout(updateCharts, 100);
        } else {
            console.error("❌ Greška u backendu:", result.message);
        }
    } catch (err) {
        console.error("❌ Fetch Error:", err);
    } finally {
        hideLoader();
    }
}

// --- RENDERERS ---
function renderDashboard() {
    const stats = state.stats;
    document.getElementById('monthlyRevenue').innerText = formatCurrency(stats.revenue || 0);
    document.getElementById('monthlyExpenses').innerText = formatCurrency(stats.expenses || 0);
    document.getElementById('openInquiries').innerText = stats.inquiriesCount || 0;
    document.getElementById('estimatedProfit').innerText = formatCurrency((stats.revenue || 0) - (stats.expenses || 0));

    const list = document.getElementById('activityList');
    if (!list) return;
    list.innerHTML = '';

    const activities = stats.recentActivities || [];
    if (activities.length === 0) {
        list.innerHTML = '<div class="item-meta">Nema nedavnih aktivnosti.</div>';
    }

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
    if (!stats.yearlyStats || stats.yearlyStats.length === 0) return;

    // Yearly Chart
    const yearlyEl = document.getElementById('yearlyChart');
    if (yearlyEl) {
        const yearlyCtx = yearlyEl.getContext('2d');
        if (state.charts.yearly) state.charts.yearly.destroy();
        state.charts.yearly = new Chart(yearlyCtx, {
            type: 'bar',
            data: {
                labels: ['S', 'V', 'O', 'T', 'S', 'L', 'S', 'K', 'R', 'L', 'S', 'P'], // Skraćeni nazivi mjeseci
                datasets: [
                    { label: 'Prihodi', data: stats.yearlyStats.map(m => m.revenue), backgroundColor: '#E67E22', borderRadius: 4 },
                    { label: 'Troškovi', data: stats.yearlyStats.map(m => m.expenses), backgroundColor: '#00F2FF', borderRadius: 4 }
                ]
            },
            options: chartOptions
        });
    }

    // Monthly Chart
    const monthlyEl = document.getElementById('monthlyChart');
    if (monthlyEl && stats.monthlyStats) {
        const monthlyCtx = monthlyEl.getContext('2d');
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
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#888899', font: { size: 9 } } },
        x: { grid: { display: false }, ticks: { color: '#888899', font: { size: 9 } } }
    },
    plugins: {
        legend: { display: false },
        tooltip: {
            backgroundColor: 'rgba(20, 20, 30, 0.9)',
            titleColor: '#fff',
            bodyColor: '#fff',
            borderColor: 'rgba(255,255,255,0.1)',
            borderWidth: 1
        }
    }
};

function renderInquiries() {
    const list = document.getElementById('inquiryList');
    if (!list) return;
    list.innerHTML = '';

    if (state.inquiries.length === 0) {
        list.innerHTML = '<div class="item-meta" style="padding: 20px; text-align:center;">Nema upita u tablici.</div>';
    }

    state.inquiries.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        div.innerHTML = `
            <div class="item-main" onclick="handleInquiryAction('${item.id}')">
                <span class="item-title">${item.name || "Nema imena"}</span>
                <span class="item-meta">${item.id} • ${item.subject || "Upit"} • <b>${item.status || "NOVO"}</b></span>
                <span class="item-meta">${item.amount || 0} €</span>
            </div>
            <div class="item-actions-row" style="display:flex; gap:10px; margin-top:8px;">
                <button class="btn-text" onclick="handleInquiryAction('${item.id}')" style="color:var(--accent-orange); font-size:0.75rem; font-weight:bold; letter-spacing: 0.5px;">DETALJI / PONUDA</button>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- OCR & SCANNER ---
function initScanner() {
    const fileInput = document.getElementById('fileInput');
    if (!fileInput) return;
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        showLoader("Analiza računa...");
        try {
            const base64 = await toBase64(file);
            const content = base64.split(',')[1];
            const response = await fetch(GAS_URL, {
                method: 'POST',
                mode: 'no-cors', // Sigurnije za GAS ali ne vidimo odgovor
                body: JSON.stringify({ action: "analyzeReceipt", data: content, mimeType: file.type })
            });
            alert("Slika je poslana na analizu. Provjeri za par sekundi na dashboardu.");
        } catch (err) { alert("Greška pri slanju!"); } finally { hideLoader(); }
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
    console.log("🔍 Otvaram akciju za ID:", id);
    const item = state.inquiries.find(i => String(i.id) === String(id));
    if (!item) {
        console.error("❌ Upit nije pronađen u state-u:", id);
        return;
    }
    state.selectedInquiryId = id;
    document.getElementById('detName').innerText = item.name || "-";
    document.getElementById('detEmail').innerText = item.email || "-";
    document.getElementById('detSubject').innerText = item.subject || "-";
    document.getElementById('detAmount').innerText = (item.amount || 0) + " €";
    document.getElementById('inquiryModal').classList.add('active');
}

async function runGasAction(action) {
    const id = state.selectedInquiryId;
    if (!id) return;
    showLoader("Slanje...");
    try {
        // GAS POST preporuka: text/plain da izbjegnemo preflight, ili mode no-cors
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({ action, id })
        });
        alert("Akcija pokrenuta! Provjeri status u tablici.");
        document.getElementById('inquiryModal').classList.remove('active');
    } catch (err) {
        console.error("GAS Error:", err);
        alert("Pokušano slanje... Provjeri tablicu (možda je proknjiženo unatoč poruci).");
    } finally { hideLoader(); }
}

// --- HELPERS ---
function formatCurrency(val) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(val); }
function toBase64(file) { return new Promise((r, j) => { const reader = new FileReader(); reader.readAsDataURL(file); reader.onload = () => r(reader.result); reader.onerror = e => j(e); }); }
function showLoader(m) {
    const el = document.getElementById('loader');
    if (el) { el.innerText = m; el.style.display = "block"; }
}
function hideLoader() {
    const el = document.getElementById('loader');
    if (el) el.style.display = "none";
}
