/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.6 (CLEAN STATS - No Duplicates, No Zeroes, Pill UI Ready)
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
      
      return createJsonResponse({
        status: "success",
        inquiries: inquiries,
        stats: stats
      });
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
    if (action === 'analyzeReceipt') { return handleReceiptAnalysis(postData); }
    if (action === 'saveConfirmedData') { return handleSaveConfirmedReceipt(postData); }
    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: "POST_ERROR: " + err.toString() });
  }
}

// --- MODULE: ADVANCED STATS (v2.6) ---
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
  
  // Track processed document entries to avoid double counting bank entries
  var processedLines = {}; 

  data.forEach(function(row) {
    var duguje = parseFloat(row[7]) || 0;
    var potrazuje = parseFloat(row[8]) || 0;
    
    // Skip Zero Entries
    if (duguje === 0 && potrazuje === 0) return;

    var d = parseDate(row[0]);
    if (!d) return;

    var rowYear = d.getFullYear();
    var rowMonth = d.getMonth();
    var rowDay = d.getDate();
    
    var vrDok = String(row[1]);
    var dokument = String(row[4]); // Dokument ID
    var konto = String(row[5]);
    
    // UNIQUE KEY: Date + Doc + Konto + Amount
    var lineKey = row[0] + "_" + dokument + "_" + konto + "_" + duguje + "_" + potrazuje;
    if (processedLines[lineKey]) return; // Avoid duplicate lines
    processedLines[lineKey] = true;

    // REAL REVENUE: Bank (1000)
    if (rowYear === currentYear) {
      if (konto === "1000") {
        yearlyStats[rowMonth].revenue += duguje;
        yearlyStats[rowMonth].expenses += potrazuje;
      }
    }

    if (rowYear === currentYear && rowMonth === currentMonth) {
      if (konto === "1000") {
        monthlyStats[rowDay - 1].revenue += duguje;
        monthlyStats[rowDay - 1].expenses += potrazuje;
        totalRevenue += duguje;
        totalExpenses += potrazuje;
      }
    }

    // Recent Activities (Only high-level IRA/URA)
    if ((vrDok === "IRA" || vrDok === "URA") && (konto === "1200" || konto === "2200")) {
       recentActivities.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: vrDok,
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: vrDok === "IRA" ? potrazuje : duguje
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
      return createJsonResponse({ status: "success", message: "Ažurirano" });
    }
  }
  return createJsonResponse({ status: "error" });
}

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    var parts = val.split('.');
    if (parts.length >= 3) {
      var d = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10) - 1;
      var y = parseInt(parts[2].split(' ')[0], 10);
      return new Date(y, m, d);
    }
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

// Stubs for remaining logic
function recordDnevnikEntry(ss, date, vrsta, stranka, opis, dokument, entries) {}
function handleReceiptAnalysis(postData) { return createJsonResponse({ status: "success" }); }
function handleSaveConfirmedReceipt(postData) { return createJsonResponse({ status: "success" }); }
