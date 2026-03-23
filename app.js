/**
 * 2LMF PRO BUSINESS - FRONTEND REFRESH 🦈📊
 * Verzija: 2.9.8 (CHART EUR FIX + NAV STABILITY)
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
    initNavigation();
    initModal();
    initScanner();
    await refreshData();

    const search = document.getElementById('inquirySearch');
    if (search) search.addEventListener('input', (e) => filterInquiries(e.target.value));

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
    console.log("Switching to tab:", id);
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
                    callback: function (value) { return value + ' €'; } // EUR na Y-osi
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
    document.getElementById('inquiryModal').classList.add('active');
}

function initModal() {
    const modal = document.getElementById('inquiryModal');
    if (!modal) return;
    document.querySelectorAll('.close-modal').forEach(b => b.onclick = () => modal.classList.remove('active'));
    document.getElementById('btnCloseInquiry').onclick = () => modal.classList.remove('active');
}

function initScanner() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.onchange = () => alert("Skeniranje u obradi...");
}

function formatCurrency(v) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(v || 0); }
function showLoader(m) { const l = document.getElementById('loader'); if (l) { l.innerText = m; l.style.display = "block"; } }
function hideLoader() { const l = document.getElementById('loader'); if (l) l.style.display = "none"; }
function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i => (i.name || "").toLowerCase().includes(q) || (i.subject || "").toLowerCase().includes(q));
    renderInquiries(filtered);
}
