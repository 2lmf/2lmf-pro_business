/**
 * SHARK BUSINESS PWA - Core Logic
 * Integrates CRM (Inquiries/Offers) and Receipt Scanner (OCR)
 */

// --- CONFIG ---
const DEFAULT_GAS_URL = "https://script.google.com/macros/s/AKfycbx7PZ-H98VzXy8VlYv-p_p-p_p-p_p/exec"; // Placeholder
let GAS_URL = localStorage.getItem('SHARK_BUSINESS_GAS_URL') || DEFAULT_GAS_URL;

let state = {
    activeTab: 'dashboard',
    inquiries: [],
    receipts: [],
    stats: {
        revenue: 0,
        inquiriesCount: 0
    }
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    console.log("🦈 Shark Business PWA Init...");

    initNavigation();
    initScanner();
    initModal();

    // Initial Data Fetch
    refreshData();
});

// --- NAVIGATION ---
function initNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const targetTab = item.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
}

function switchTab(tabId) {
    state.activeTab = tabId;

    // UI Update: Nav
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelector(`.nav-item[data-tab="${tabId}"]`).classList.add('active');

    // UI Update: Content
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
}

// --- DATA SYNC ---
async function refreshData() {
    try {
        const response = await fetch(`${GAS_URL}?action=get_dashboard_data`);
        const result = await response.json();

        if (result.status === "success") {
            state.inquiries = result.inquiries || [];
            state.receipts = result.receipts || [];
            state.stats = result.stats || state.stats;

            renderDashboard();
            renderInquiries();
            renderReceiptHistory();
        }
    } catch (err) {
        console.error("Fetch Error:", err);
    }
}

// --- RENDERERS ---
function renderDashboard() {
    document.getElementById('monthlyRevenue').innerText = formatCurrency(state.stats.revenue);
    document.getElementById('openInquiries').innerText = state.stats.inquiriesCount;

    const list = document.getElementById('activityList');
    list.innerHTML = '';

    const activities = state.inquiries.slice(0, 5); // Show latest 5
    activities.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title">${item.name}</span>
                <span class="item-meta">${item.id} • ${item.subject}</span>
            </div>
            <div class="item-action">
                <i class="fas fa-chevron-right"></i>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderInquiries() {
    const list = document.getElementById('inquiryList');
    list.innerHTML = '';

    state.inquiries.forEach(item => {
        const div = document.createElement('div');
        div.className = 'inquiry-item';
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title">${item.name}</span>
                <span class="item-meta">${item.id} • ${item.amount} € • ${item.status}</span>
            </div>
            <div class="item-action" onclick="handleInquiryAction('${item.id}')">
                <i class="fas fa-paper-plane"></i>
            </div>
        `;
        list.appendChild(div);
    });
}

function renderReceiptHistory() {
    const list = document.getElementById('receiptHistory');
    list.innerHTML = '';

    state.receipts.forEach(item => {
        const div = document.createElement('div');
        div.className = 'history-item';
        div.innerHTML = `
            <div class="item-main">
                <span class="item-title">${item.dobavljac}</span>
                <span class="item-meta">${item.datum} • ${item.opis}</span>
            </div>
            <div class="item-amount">
                <b>${item.iznos} €</b>
            </div>
        `;
        list.appendChild(div);
    });
}

// --- SCANNER LOGIC ---
function initScanner() {
    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        showLoader("Skeniram račun...");

        try {
            const base64 = await toBase64(file);
            const content = base64.split(',')[1];

            const response = await fetch(GAS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: JSON.stringify({
                    action: "analyzeReceipt",
                    data: content,
                    mimeType: file.type
                })
            });

            const result = await response.json();
            if (result.status === "success") {
                openPreviewModal(result.data, result.fileName);
            }
        } catch (err) {
            alert("Greška pri skeniranju.");
        } finally {
            hideLoader();
        }
    });
}

// --- MODAL LOGIC ---
function initModal() {
    const modal = document.getElementById('previewModal');
    const inquiryModal = document.getElementById('inquiryModal');
    const closeBtns = document.querySelectorAll('.close-modal');

    closeBtns.forEach(btn => {
        btn.onclick = () => {
            modal.classList.remove('active');
            inquiryModal.classList.remove('active');
        };
    });

    document.getElementById('btnCancelScan').onclick = () => modal.classList.remove('active');
    document.getElementById('btnCloseInquiry').onclick = () => inquiryModal.classList.remove('active');

    document.getElementById('btnConfirmScan').onclick = async () => {
        modal.classList.remove('active');
        showLoader("Spremam...");
        // Logika za spremanje...
        await refreshData();
        hideLoader();
    };

    document.getElementById('btnSendOffer').onclick = () => sendAction('sendOffer');
    document.getElementById('btnSendInvoice').onclick = () => sendAction('sendInvoice');
}

function handleInquiryAction(id) {
    const item = state.inquiries.find(i => i.id === id);
    if (!item) return;

    state.selectedInquiryId = id;

    // Popuni Modal
    document.getElementById('detName').innerText = item.name;
    document.getElementById('detEmail').innerText = item.email;
    document.getElementById('detSubject').innerText = item.subject;
    document.getElementById('detAmount').innerText = item.amount + " €";

    document.getElementById('inquiryModal').classList.add('active');
}

async function sendAction(actionType) {
    const id = state.selectedInquiryId;
    if (!confirm(`Pokrenuti akciju ${actionType} za upit ${id}?`)) return;

    showLoader("Slanje...");
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: actionType,
                id: id
            })
        });
        const res = await response.json();
        alert(res.message || "Akcija uspješna!");
        document.getElementById('inquiryModal').classList.remove('active');
        refreshData();
    } catch (err) {
        alert("Greška pri slanju.");
    } finally {
        hideLoader();
    }
}
