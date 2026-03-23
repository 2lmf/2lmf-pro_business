/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.8 (DEDUPLICATION + FIX STATS)
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
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    if (action === 'updateInquiry') { return handleUpdateInquiry(ss, postData); }
    if (action === 'sendOffer' || action === 'sendInvoice') { return createJsonResponse({ status: "success" }); }
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

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
  var recentRaw = [];
  
  // DEDUPLICATION Logic: Group by unique combination for Charts
  var chartProcessed = {};

  data.forEach(function(row) {
    var duguje = parseFloat(row[7]) || 0;
    var potrazuje = parseFloat(row[8]) || 0;
    if (duguje === 0 && potrazuje === 0) return;

    var d = parseDate(row[0]);
    if (!d) return;

    var vrDok = String(row[1]);
    var dokument = String(row[4]);
    var konto = String(row[5]);
    
    // CHART STATS (Only konto 1000, deduplicated by Doc + Amount)
    if (konto === "1000") {
      var key = d.getTime() + "_" + dokument + "_" + duguje + "_" + potrazuje;
      if (!chartProcessed[key]) {
        chartProcessed[key] = true;
        if (d.getFullYear() === currentYear) {
          yearlyStats[d.getMonth()].revenue += duguje;
          yearlyStats[d.getMonth()].expenses += potrazuje;
          if (d.getMonth() === currentMonth) {
            monthlyStats[d.getDate() - 1].revenue += duguje;
            monthlyStats[d.getDate() - 1].expenses += potrazuje;
            totalRevenue += duguje;
            totalExpenses += potrazuje;
          }
        }
      }
    }

    // ACTIVITY LOG (IRA/URA) - Grouped by Document to avoid multiple legs
    if ((vrDok === "IRA" && konto === "1200") || (vrDok === "URA" && konto === "2200")) {
      recentRaw.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: vrDok,
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: vrDok === "IRA" ? duguje : potrazuje,
        dok: dokument
      });
    }
  });

  // Unique activities by Doc
  var activityMap = {};
  recentRaw.forEach(function(item) {
    if (!activityMap[item.dok]) activityMap[item.dok] = item;
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
    recentActivities: Object.values(activityMap).reverse().slice(0, 30)
  };
}

function getInquiriesWithLimit(ss, limit) {
  var sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, limit).map(function(row) {
    return {
      date: String(row[0]), id: String(row[1]), name: String(row[2]),
      email: String(row[3]), phone: String(row[4]), subject: String(row[5]),
      amount: row[6] || 0, status: String(row[8]), jsonData: row[9] || "{}"
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
}

function parseDate(val) {
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    var parts = val.split('.');
    if (parts.length >= 3) {
      return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    }
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}
