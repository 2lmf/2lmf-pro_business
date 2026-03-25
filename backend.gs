/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.9.3 (DEEP SCAN + PREMIUM SCANNER SYNC)
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
      var locations = getLocations(ss);
      return createJsonResponse({ status: "success", inquiries: inquiries, stats: stats, locations: locations });
    }
    if (action === 'get_locations') {
      return createJsonResponse({ status: "success", locations: getLocations(ss) });
    }
    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    if (action === 'updateInquiry') { return handleUpdateInquiry(ss, postData); }
    if (action === 'saveLocation') { return saveLocation(ss, postData); }
    if (action === 'uploadPhoto') { return uploadPhoto(postData); }
    if (action === 'sendOffer' || action === 'sendInvoice') { return createJsonResponse({ status: "success" }); }
    return createJsonResponse({ status: "error" });
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function calculateAdvancedStats(ss) {
  var sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  // INCREASE SCAN TO 1000 rows to find more IRA/URA
  var data = sheetDnevnik ? sheetDnevnik.getDataRange().getValues().slice(1).reverse().slice(0, 1000) : [];
  
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();

  var yearlyStats = Array.from({length: 12}, function(_, i) { return { month: i + 1, revenue: 0, expenses: 0 }; });
  var totalRevenueMonth = 0;
  var totalExpensesMonth = 0;
  var totalRevenueYear = 0;
  var totalExpensesYear = 0;

  var recentRaw = [];
  var bankProcessed = {};

  data.forEach(function(row) {
    var duguje = parseFloat(row[7]) || 0;
    var potrazuje = parseFloat(row[8]) || 0;
    if (duguje === 0 && potrazuje === 0) return;

    var d = parseDate(row[0]);
    if (!d) return;

    var dokument = String(row[4]);
    var konto = String(row[5]);
    
    // Total stats (Konto 1000)
    if (konto === "1000") {
      var key = d.getTime() + "_" + dokument + "_" + duguje + "_" + potrazuje;
      if (!bankProcessed[key]) {
        bankProcessed[key] = true;
        if (d.getFullYear() === currentYear) {
          yearlyStats[d.getMonth()].revenue += duguje;
          yearlyStats[d.getMonth()].expenses += potrazuje;
          totalRevenueYear += duguje;
          totalExpensesYear += potrazuje;
          if (d.getMonth() === currentMonth) {
            totalRevenueMonth += duguje;
            totalExpensesMonth += potrazuje;
          }
        }
      }
    }

    var vrDok = String(row[1]);
    if ((vrDok === "IRA" && konto === "1200") || (vrDok === "URA" && konto === "2200")) {
      recentRaw.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: vrDok,
        stranka: String(row[2]),
        opis: String(row[3]),
        iznos: vrDok === "IRA" ? duguje : potrazuje,
        dok: dokument,
        timestamp: d.getTime()
      });
    }
  });

  // Unique activities by Doc, reverse to get latest
  var activityMap = {};
  recentRaw.forEach(function(item) {
    if (!activityMap[item.dok]) activityMap[item.dok] = item;
  });

  return {
    revenue: totalRevenueMonth,
    expenses: totalExpensesMonth,
    yearlyRevenue: totalRevenueYear,
    yearlyExpenses: totalExpensesYear,
    yearlyStats: yearlyStats,
    recentActivities: Object.values(activityMap).sort(function(a,b){ return b.timestamp - a.timestamp; }).slice(0, 60)
  };
}

function getInquiriesWithLimit(ss, limit) {
  var sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, limit).map(function(row) {
    return {
      date: String(row[0]), id: String(row[1]), name: String(row[2]),
      email: String(row[3]), subject: String(row[5]),
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
    if (parts.length >= 3) return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return null;
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}

function uploadPhoto(data) {
  try {
    var folderName = "Shark Business Slike";
    var folder;
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }

    var base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', data.filename || ('site_' + Date.now() + '.jpg'));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    var fileUrl = file.getUrl();
    
    // Update the last saved location with this photo link
    var ssId = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName('Lokacije');
    if (sheet) {
      sheet.getRange(sheet.getLastRow(), 7).setValue(fileUrl); 
    }

    return createJsonResponse({ status: "success", url: fileUrl });
  } catch (e) {
    return createJsonResponse({ status: "error", message: e.toString() });
  }
}

// --- LOCATIONS MODULE ---
function saveLocation(ss, data) {
  var sheet = ss.getSheetByName('Lokacije');
  if (!sheet) {
    sheet = ss.insertSheet('Lokacije');
    sheet.appendRow(['Datum', 'Sat', 'Lat', 'Lng', 'Maps Link', 'Bilješka']);
    sheet.getRange(1, 1, 1, 6).setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
  }

  var now = new Date();
  var datum = Utilities.formatDate(now, 'GMT+1', 'dd.MM.yyyy');
  var sat = Utilities.formatDate(now, 'GMT+1', 'HH:mm');
  var lat = data.lat;
  var lng = data.lng;
  var mapsLink = "https://www.google.com/maps?q=" + lat + "," + lng;
  var note = data.note || '';

  sheet.appendRow([datum, sat, lat, lng, mapsLink, note]);
  
  // Create hyperlink for maps
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow, 5).setFormula('=HYPERLINK("' + mapsLink + '","📍 Otvori")');

  return createJsonResponse({ status: "success" });
}

function getLocations(ss) {
  var sheet = ss.getSheetByName('Lokacije');
  if (!sheet || sheet.getLastRow() <= 1) return [];
  
  var data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().map(function(row) {
    return {
      datum: row[0],
      sat: row[1],
      lat: row[2],
      lng: row[3],
      mapsLink: row[4],
      biljeska: row[5]
    };
  });
}
