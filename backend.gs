/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.7 (PRECISION STATS + CORRECT IRA/URA MAPPING)
 */

var pwa_prop = PropertiesService.getScriptProperties();
var pwa_sheet_id = "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";

function doGet(e) {
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);

    if (action === 'get_dashboard_data') {
      var inquiries = getInquiriesWithLimit(ss, 250); 
      var stats = calculateAdvancedStats(ss);
      return createJsonResponse({ status: "success", inquiries: inquiries, stats: stats });
    }
    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "GAS_ERROR: " + err.toString() });
  }
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    if (action === 'updateInquiry') { return handleUpdateInquiry(ss, postData); }
    if (action === 'sendOffer' || action === 'sendInvoice') { return createJsonResponse({ status: "success", message: "Pokrenuto!" }); }
    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "POST_ERROR: " + err.toString() });
  }
}

// --- MODULE: ADVANCED STATS (v2.7) ---
function calculateAdvancedStats(ss) {
  var sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  var data = sheetDnevnik ? sheetDnevnik.getDataRange().getValues().slice(1) : [];
  
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();

  var yearlyStats = Array.from({length: 12}, function(_, i) { return { month: i + 1, revenue: 0, expenses: 0 }; });
  var monthlyStats = Array.from({length: 31}, function(_, i) { return { day: i + 1, revenue: 0, expenses: 0 }; });

  var totalRevenue = 0;
  var totalExpenses = 0;
  var recentActivities = [];
  
  // Track processed document IDs to avoid double counting across multiple legs (e.g. Bank and Revenue)
  var processedRevenueDocs = {}; 
  var processedExpenseDocs = {};

  data.forEach(function(row) {
    var duguje = parseFloat(row[7]) || 0;
    var potrazuje = parseFloat(row[8]) || 0;
    if (duguje === 0 && potrazuje === 0) return;

    var d = parseDate(row[0]);
    if (!d) return;

    var rowYear = d.getFullYear();
    var rowMonth = d.getMonth();
    var rowDay = d.getDate();
    
    var vrDok = String(row[1]);
    var dokument = String(row[4]); 
    var konto = String(row[5]);
    
    // REVENUE Logic: Track only 1000 Bank IN (Duguje) OR 7500 Revenue OUT (Potražuje)
    // To avoid "duplo", we pick ONE source. Karlo wants "Dnevnik" logic.
    // Let's use Konto 1000 (Žiro) as the "Real" truth for Cash Flow.
    if (konto === "1000") {
      if (rowYear === currentYear) {
        yearlyStats[rowMonth].revenue += duguje;
        yearlyStats[rowMonth].expenses += potrazuje;
      }
      if (rowYear === currentYear && rowMonth === currentMonth) {
        monthlyStats[rowDay - 1].revenue += duguje;
        monthlyStats[rowDay - 1].expenses += potrazuje;
        totalRevenue += duguje;
        totalExpenses += potrazuje;
      }
    }

    // Recent Activities (IRA & URA)
    // IRA: 1200 Duguje / 7500 Potražuje. We take 1200 Duguje.
    // URA: 2200 Potražuje / 4000 Duguje. We take 2200 Potražuje.
    if (vrDok === "IRA" && konto === "1200") {
      recentActivities.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: "IRA",
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: duguje // Corrected: IRA 1200 is Duguje
      });
    }
    if (vrDok === "URA" && konto === "2200") {
      recentActivities.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: "URA",
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: potrazuje // Corrected: URA 2200 is Potrazuje
      });
    }
  });

  var sheetUpiti = ss.getSheetByName("Upiti");
  var upitiRows = sheetUpiti ? sheetUpiti.getDataRange().getValues().slice(1) : [];
  var offerEst = upitiRows.reduce(function(sum, row) {
    var d = parseDate(row[0]);
    if (d && d.getMonth() === currentMonth && d.getFullYear() === currentYear && (row[8] === "NOVO" || row[8] === "PONUDA")) {
      return sum + (parseFloat(row[6]) || 0);
    }
    return sum;
  }, 0);
  
  return {
    revenue: totalRevenue,
    expenses: totalExpenses,
    offerEstimation: offerEst,
    inquiriesCount: upitiRows.filter(function(row) { return row[8] === "NOVO"; }).length,
    yearlyStats: yearlyStats,
    monthlyStats: monthlyStats,
    recentActivities: recentActivities.reverse().slice(0, 30)
  };
}

function getInquiriesWithLimit(ss, limit) {
  var sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, limit).map(function(row) {
    return {
      date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+1", "dd.MM.yyyy") : String(row[0]),
      id: String(row[1]),
      name: String(row[2]),
      email: String(row[3]),
      phone: String(row[4]),
      subject: String(row[5]),
      amount: row[6] || 0,
      status: String(row[8]),
      jsonData: row[9] || "{}"
    };
  });
}

function handleUpdateInquiry(ss, postData) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getDataRange().getValues();
  var id = String(postData.id);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === id) {
      sheet.getRange(i + 1, 7).setValue(postData.amount);
      if (postData.jsonData) sheet.getRange(i + 1, 10).setValue(JSON.stringify(postData.jsonData));
      return createJsonResponse({ status: "success" });
    }
  }
  return createJsonResponse({ status: "error" });
}

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    var parts = val.split('.');
    if (parts.length >= 3) {
      try {
        var d = parseInt(parts[0], 10);
        var m = parseInt(parts[1], 10) - 1;
        var y = parseInt(parts[2].split(' ')[0], 10);
        return new Date(y, m, d);
      } catch(e) { return null; }
    }
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// OCR & Other stubs
function recordDnevnikEntry(ss, date, vrsta, stranka, opis, dokument, entries) {}
function handleReceiptAnalysis(postData) { return createJsonResponse({ status: "success" }); }
function handleSaveConfirmedReceipt(postData) { return createJsonResponse({ status: "success" }); }
