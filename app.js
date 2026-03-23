/**
 * 2LMF PRO BUSINESS - FRONTEND CORE 🦈🚀
 * Verzija: 2.9.4 (EMAIL INTEGRATION + ORANGE SHARK)
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
    setupEventListeners();
    await refreshData();
    setInterval(refreshData, 300000);
}

function setupEventListeners() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
        filterInquiries(e.target.value);
    });

    document.getElementById('closeModal').addEventListener('click', hideModal);

    // NEW: Handle Send Buttons inside Modal
    document.getElementById('btnSendOffer').addEventListener('click', () => handleInquiryAction('sendOffer'));
    document.getElementById('btnSendInvoice').addEventListener('click', () => handleInquiryAction('sendInvoice'));
}

async function refreshData() {
    showLoading();
    try {
        const res = await fetch(`${GAS_URL}?action=get_dashboard_data`);
        const data = await res.json();
        if (data.status === 'success') {
            state.inquiries = data.inquiries;
            state.stats = data.stats;
            renderAll();
        }
    } catch (err) { console.error("Refresh Error:", err); }
    hideLoading();
}

function renderAll() {
    renderStats();
    renderCharts();
    renderInquiries(state.inquiries);
    renderActivities();
}

function renderStats() {
    document.getElementById('monthlyRevenue').textContent = formatEuro(state.stats.revenue);
    document.getElementById('monthlyExpenses').textContent = formatEuro(state.stats.expenses);
    document.getElementById('yearlyRevenue').textContent = formatEuro(state.stats.yearlyRevenue);
    document.getElementById('yearlyExpenses').textContent = formatEuro(state.stats.yearlyExpenses);
}

function renderInquiries(list) {
    const container = document.getElementById('inquiriesList');
    container.innerHTML = list.map(inq => `
        <div class="inquiry-card glass-card" onclick="showInquiryDetails('${inq.id}')">
            <div class="inquiry-header">
                <span class="inquiry-id">#${inq.id.split('-')[0]}</span>
                <span class="status-pill status-${inq.status.toLowerCase().replace(' ', '-')}">${inq.status}</span>
            </div>
            <div class="inquiry-body">
                <h3>${inq.name}</h3>
                <p>${inq.subject}</p>
            </div>
            <div class="inquiry-footer">
                <span class="inquiry-date">${inq.date}</span>
                <span class="inquiry-amount">${formatEuro(inq.amount)}</span>
            </div>
        </div>
    `).join('');
}

function renderActivities() {
    const container = document.getElementById('activitiesList');
    container.innerHTML = state.stats.recentActivities.map(act => `
        <div class="activity-item">
            <div class="activity-icon ${act.vrsta.toLowerCase()}">
                <i class="fas ${act.vrsta === 'IRA' ? 'fa-arrow-up' : 'fa-arrow-down'}"></i>
            </div>
            <div class="activity-info">
                <h4>${act.stranka}</h4>
                <p>${act.opis} (${act.datum})</p>
            </div>
            <div class="activity-amount ${act.vrsta.toLowerCase()}">${act.vrsta === 'IRA' ? '+' : '-'}${formatEuro(act.iznos)}</div>
        </div>
    `).join('');
}

function showInquiryDetails(id) {
    const inq = state.inquiries.find(i => i.id === id);
    if (!inq) return;
    state.selectedInquiry = inq;

    const details = document.getElementById('inquiryDetails');
    let items = [];
    try {
        const raw = JSON.parse(inq.jsonData);
        items = raw.stavke || raw.items || [];
        if (Array.isArray(raw) && raw.length > 0) items = raw;
    } catch (e) { }

    const itemsHtml = items.map(item => `
        <div class="item-row">
            <span class="item-name">${item.naziv || 'Artikl'}</span>
            <div class="item-vals">
                <div class="val-group">
                   <label>kol</label>
                   <input type="number" value="${item.kolicina || 1}" class="item-qty">
                </div>
                <div class="val-group">
                   <label>cijena</label>
                   <input type="number" value="${item.cijena || 0}" class="item-price">
                </div>
            </div>
        </div>
    `).join('');

    details.innerHTML = `
        <div class="modal-header-info">
            <h2>${inq.name}</h2>
            <p>${inq.email}</p>
            <p class="subject-line">Predmet: ${inq.subject}</p>
        </div>
        <div class="items-list">${itemsHtml}</div>
        <div class="modal-total">Ukupno: ${formatEuro(inq.amount)}</div>
    `;

    document.getElementById('inquiryModal').classList.add('active');
}

async function handleInquiryAction(action) {
    if (!state.selectedInquiry) return;
    showLoading();
    try {
        const res = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: action,
                id: state.selectedInquiry.id
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            alert("✅ Uspješno poslano!");
            hideModal();
            refreshData();
        } else {
            alert("❌ Greška pri slanju.");
        }
    } catch (err) { alert("Greška: " + err); }
    hideLoading();
}

function renderCharts() {
    const ctxY = document.getElementById('yearlyChart').getContext('2d');
    const ctxM = document.getElementById('monthlyChart').getContext('2d');

    if (state.charts.yearly) state.charts.yearly.destroy();
    if (state.charts.monthly) state.charts.monthly.destroy();

    state.charts.yearly = new Chart(ctxY, {
        type: 'line',
        data: {
            labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
            datasets: [
                { label: 'Prihodi', data: state.stats.yearlyStats.map(s => s.revenue), borderColor: '#00f2fe', tension: 0.4, fill: true, backgroundColor: 'rgba(0, 242, 254, 0.1)' },
                { label: 'Rashodi', data: state.stats.yearlyStats.map(s => s.expenses), borderColor: '#f5af19', tension: 0.4 }
            ]
        },
        options: chartOptions
    });

    state.charts.monthly = new Chart(ctxM, {
        type: 'bar',
        data: {
            labels: ['Prihodi', 'Rashodi'],
            datasets: [{
                data: [state.stats.revenue, state.stats.expenses],
                backgroundColor: ['#00f2fe', '#f5af19']
            }]
        },
        options: chartOptions
    });
}

const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: { y: { display: false }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } }
};

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');
}

function filterInquiries(query) {
    const q = query.toLowerCase();
    const filtered = state.inquiries.filter(i => i.name.toLowerCase().includes(q) || i.subject.toLowerCase().includes(q));
    renderInquiries(filtered);
}

function hideModal() { document.getElementById('inquiryModal').classList.remove('active'); }
function showLoading() { document.getElementById('loader').classList.add('active'); }
function hideLoading() { document.getElementById('loader').classList.remove('active'); }
function formatEuro(val) { return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(val); }
