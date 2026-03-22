/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.2 (Robust Date Parsing + Enhanced Analytics)
 */

const SCRIPT_PROP = PropertiesService.getScriptProperties();
const OPENAI_API_KEY = SCRIPT_PROP.getProperty("OPENAI_API_KEY");
const REAL_SHEET_ID = "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";

function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("SHEET_ID") || REAL_SHEET_ID);

    if (action === 'get_dashboard_data') {
      const inquiries = getInquiriesWithLimit(ss, 250); 
      const stats = calculateAdvancedStats(ss);
      
      return createJsonResponse({
        status: "success",
        inquiries: inquiries,
        stats: stats
      });
    }
    
    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === 'sendOffer' || action === 'sendInvoice') {
      return createJsonResponse({ status: "success", message: "Akcija pokrenuta za: " + postData.id });
    }

    if (action === 'analyzeReceipt') {
      return handleReceiptAnalysis(postData);
    }

    if (action === 'saveConfirmedData') {
      return handleSaveConfirmedReceipt(postData);
    }

    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// --- MODULE: ADVANCED STATS ---
function calculateAdvancedStats(ss) {
  const sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  const data = sheetDnevnik ? sheetDnevnik.getDataRange().getValues().slice(1) : [];
  
  const today = new Date();
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth();

  let yearlyStats = Array.from({length: 12}, (_, i) => ({ month: i + 1, revenue: 0, expenses: 0 }));
  let monthlyStats = Array.from({length: 31}, (_, i) => ({ day: i + 1, revenue: 0, expenses: 0 }));

  let totalRevenue = 0;
  let totalExpenses = 0;
  let recentActivities = [];

  data.forEach(row => {
    const rawDate = row[0];
    const d = parseDate(rawDate);
    if (!d) return;

    const rowYear = d.getFullYear();
    const rowMonth = d.getMonth();
    const rowDay = d.getDate();
    
    const konto = String(row[5]);
    const duguje = parseFloat(row[7]) || 0;
    const potrazuje = parseFloat(row[8]) || 0;
    const vrsta = String(row[1]);

    // YEARLY STATS
    if (rowYear === currentYear) {
      if (konto === "7500") yearlyStats[rowMonth].revenue += potrazuje;
      if (konto.startsWith("4")) yearlyStats[rowMonth].expenses += duguje;
    }

    // MONTHLY STATS (Current Month)
    if (rowYear === currentYear && rowMonth === currentMonth) {
      if (konto === "7500") {
        monthlyStats[rowDay - 1].revenue += potrazuje;
        totalRevenue += potrazuje;
      }
      if (konto.startsWith("4")) {
        monthlyStats[rowDay - 1].expenses += duguje;
        totalExpenses += duguje;
      }
    }

    // Recent Activities (IRA & URA)
    if (vrsta === "IRA" || vrsta === "URA") {
      recentActivities.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: vrsta,
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: vrsta === "IRA" ? potrazuje : duguje
      });
    }
  });

  const sheetUpiti = ss.getSheetByName("Upiti");
  const upitiData = sheetUpiti ? sheetUpiti.getDataRange().getValues().slice(1) : [];
  
  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    inquiriesCount: upitiData.filter(row => row[8] === "NOVO").length,
    yearlyStats: yearlyStats,
    monthlyStats: monthlyStats,
    recentActivities: recentActivities.reverse().slice(0, 20)
  };
}

function getInquiriesWithLimit(ss, limit) {
  const sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, limit).map(row => ({
    date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+1", "dd.MM.yyyy") : String(row[0]),
    id: String(row[1]),
    name: String(row[2]),
    email: String(row[3]),
    phone: String(row[4]),
    subject: String(row[5]),
    amount: row[6] || 0,
    status: String(row[8])
  }));
}

// --- UTILS ---
function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // Pokušaj DD.MM.YYYY
    const parts = val.split('.');
    if (parts.length >= 3) {
      const d = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10) - 1;
      const y = parseInt(parts[2].split(' ')[0], 10);
      const date = new Date(y, m, d);
      if (!isNaN(date.getTime())) return date;
    }
    // Pokušaj standardno
    const date = new Date(val);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// (OCR logic matches previous version)
function handleSaveConfirmedReceipt(postData) {
  const ss = SpreadsheetApp.openById(REAL_SHEET_ID);
  const data = postData.data;
  recordDnevnikEntry(ss, data.datum, "URA", data.dobavljac, "Ulazni račun: " + data.kategorija, "", [
    { konto: "4100", nazivKonta: "Trošak (" + data.kategorija + ")", duguje: data.iznos, potrazuje: 0 },
    { konto: "2200", nazivKonta: "Dobavljači u zemlji", duguje: 0, potrazuje: data.iznos }
  ]);
  return createJsonResponse({ status: "success" });
}

function recordDnevnikEntry(ss, date, vrsta, stranka, opis, dokument, entries) {
  const sheet = ss.getSheetByName("Dnevnik knjiženja");
  if (!sheet) return;
  entries.forEach(entry => {
    const nr = sheet.getLastRow() + 1;
    sheet.appendRow([date, vrsta, stranka, opis, dokument, entry.konto, entry.nazivKonta, entry.duguje, entry.potrazuje, ""]);
    sheet.getRange(nr, 10).setFormula('=H' + nr + '-I' + nr);
  });
}
