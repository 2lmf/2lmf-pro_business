/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 5.0.0 (SHARK TRACK GPS PORT + ZOHO + PDF)
 */

function flushCache() {
  PropertiesService.getScriptProperties().setProperty("LAST_UPDATE", new Date().getTime().toString());
  SpreadsheetApp.getUi().alert("✅ Sustav je osvježen! Promjene će biti vidljive na mobitelu za par sekundi.");
}

/**
 * PRIREMA ZA SAAS: Generira QR kod za brzo povezivanje mobitela.
 */
function showSetupQR() {
  var url = ScriptApp.getService().getUrl();
  if (!url) {
    SpreadsheetApp.getUi().alert("❌ Prvo moraš napraviti 'New Deployment' kao Web App!");
    return;
  }
  
  var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=" + encodeURIComponent(url);
  var html = HtmlService.createHtmlOutput('<html><body style="text-align:center; font-family:sans-serif;">' +
    '<h3>Shark Setup QR</h3>' +
    '<img src="' + qrUrl + '" style="width:250px; border:10px solid #fff; box-shadow:0 4px 10px rgba(0,0,0,0.2);">' +
    '<p style="font-size:12px; color:#666;">Skeniraj ovo kvačicom/kamerom u Shark aplikaciji<br>ili kopiraj link ispod:</p>' +
    '<input type="text" value="' + url + '" style="width:90%; padding:5px; font-size:10px;" readonly>' +
    '</body></html>')
    .setWidth(350).setHeight(450);
    
  SpreadsheetApp.getUi().showModalDialog(html, "📱 Shark Business Connection");
}

var pwa_prop = PropertiesService.getScriptProperties();
var pwa_sheet_id = "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";

function doGet(e) {
  try {
    var action = e.parameter.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    var result;
    
    if (action === 'get_dashboard_data') {
      var inquiries = getInquiriesWithLimit(ss, 250); 
      var stats = calculateAdvancedStats(ss);
      result = { status: "success", inquiries: inquiries, stats: stats, locations: getLocations(ss) };
    }
    else if (action === 'get_products') {
      result = { status: "success", products: getProducts(ss) };
    }
    else if (action === 'get_locations') {
      result = { status: "success", locations: getLocations(ss) };
    }
    else {
      return HtmlService.createTemplateFromFile('index').evaluate()
                       .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
                       .setSandboxMode(HtmlService.SandboxMode.IFRAME)
                       .addMetaTag('viewport', 'width=device-width, initial-scale=1');
    }
    
    return createJsonResponse(result);
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('🦈 SHARK ADMIN')
    .addItem('🔄 Osvježi Cache', 'flushCache')
    .addSeparator()
    .addItem('📱 Postavi Mobitel (QR)', 'showSetupQR')
    .addToUi();
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    
    var result;
    if (action === 'updateInquiry') { result = handleUpdateInquiry(ss, postData); }
    else if (action === 'createInquiry') { result = handleCreateManualInquiry(ss, postData); }
    else if (action === 'saveLocation') { result = saveLocation(ss, postData); }
    else if (action === 'uploadPhoto') { result = uploadPhoto(postData); }
    else if (action === 'sendOffer' || action === 'sendInvoice') {
      var inquiry = getInquiryById(ss, postData.id);
      if (!inquiry) result = { status: "error", message: "Upit nije pronađen" };
      else {
        var success = (action === 'sendOffer') ? sendInquiryOffer(ss, inquiry) : sendInquiryInvoice(ss, inquiry);
        result = { status: success ? "success" : "error" };
      }
    }
    else { result = { status: "error", message: "Unknown action" }; }
    
    return createJsonResponse(result);
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function calculateAdvancedStats(ss) {
  var sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  var allData = sheetDnevnik ? sheetDnevnik.getDataRange().getValues() : [];
  var data = allData.length > 1000 ? allData.slice(-1000).reverse() : allData.slice(1).reverse();
  
  var today = new Date();
  var currentYear = today.getFullYear();
  var currentMonth = today.getMonth();
  var yearlyStats = Array.from({length: 12}, function(_, i) { return { month: i + 1, revenue: 0, expenses: 0 }; });
  var totals = { rm: 0, em: 0, ry: 0, ey: 0 };
  var recentRaw = [];
  var bankProcessed = {};

  data.forEach(function(row) {
    var duguje = parseFloat(row[7]) || 0;
    var potrazuje = parseFloat(row[8]) || 0;
    if (duguje === 0 && potrazuje === 0) return;
    var d = parseDate(row[0]); if (!d) return;
    var dokument = String(row[4]);
    var konto = String(row[5]);
    
    if (konto === "1000") {
      var key = d.getTime() + "_" + dokument + "_" + duguje + "_" + potrazuje;
      if (!bankProcessed[key]) {
        bankProcessed[key] = true;
        if (d.getFullYear() === currentYear) {
          yearlyStats[d.getMonth()].revenue += duguje;
          yearlyStats[d.getMonth()].expenses += potrazuje;
          totals.ry += duguje; totals.ey += potrazuje;
          if (d.getMonth() === currentMonth) { totals.rm += duguje; totals.em += potrazuje; }
        }
      }
    }
    var vrDok = String(row[1]).toUpperCase();
    if ((vrDok === "IRA" && (konto === "1200" || konto === "7500")) || (vrDok === "URA" && (konto === "2200" || konto.startsWith("4")))) {
      recentRaw.push({
        datum: Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy"),
        vrsta: vrDok, stranka: String(row[2]), opis: String(row[3]),
        iznos: vrDok === "IRA" ? duguje : potrazuje,
        dok: dokument, timestamp: d.getTime()
      });
    }
  });

  var activityMap = {};
  recentRaw.forEach(function(item) { if (!activityMap[item.dok]) activityMap[item.dok] = item; });

  return {
    revenue: totals.rm, expenses: totals.em,
    yearlyRevenue: totals.ry, yearlyExpenses: totals.ey,
    yearlyStats: yearlyStats,
    recentActivities: Object.values(activityMap).sort(function(a,b){ return b.timestamp - a.timestamp; }).slice(0, 60)
  };
}

function getInquiriesWithLimit(ss, limit) {
  var sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues().slice(1).reverse().slice(0, limit);
  return data.map(function(row) {
    return {
      date: String(row[0]), id: String(row[1]), name: String(row[2]),
      email: String(row[3]), subject: String(row[5]),
      amount: row[6] || 0, status: String(row[8]), jsonData: row[9] || "{}"
    };
  });
}

function getInquiryById(ss, id) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(id)) {
      return { date: String(data[i][0]), id: String(data[i][1]), name: String(data[i][2]), email: String(data[i][3]), subject: String(data[i][5]), amount: data[i][6] || 0, status: String(data[i][8]), jsonData: data[i][9] || "{}" };
    }
  }
}

function handleUpdateInquiry(ss, postData) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getDataRange().getValues();
  var id = String(postData.id);
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === id) {
      sheet.getRange(i + 1, 7).setValue(postData.amount);
      if (postData.jsonData) sheet.getRange(i + 1, 10).setValue(JSON.stringify(postData.jsonData));
      return { status: "success" };
    }
  }
}

function sendInquiryOffer(ss, inquiry) { return sendMailCore(ss, inquiry, "PONUDA"); }
function sendInquiryInvoice(ss, inquiry) { return sendMailCore(ss, inquiry, "RACUN"); }

function sendMailCore(ss, inquiry, type) {
  try {
    var items = [];
    try {
      var raw = JSON.parse(inquiry.jsonData || "{}");
      items = raw.stavke || raw.items || raw.products || [];
      if (Array.isArray(raw) && raw.length > 0) items = raw;
    } catch(e) {}
    
    var isHidro = inquiry.subject.toUpperCase().indexOf("HIDRO") !== -1;
    var result = generateProfessionalHtml(items, inquiry.name, inquiry.id, isHidro, type === "RACUN", inquiry.subject);
    var pdfBlob = HtmlService.createHtmlOutput(result.html).setTitle(type + "_" + inquiry.id).getAs('application/pdf');
    pdfBlob.setName(type + "_" + inquiry.id + ".pdf");
    
    var mailOptions = {
      to: inquiry.email,
      subject: (type === "RACUN" ? "Račun br. " : "Ponuda - ") + inquiry.id + " | 2LMF PRO",
      htmlBody: result.html.replace(result.qrDataUri, "cid:qrcode"),
      inlineImages: { "qrcode": result.qrBlob },
      attachments: [pdfBlob],
      name: "2LMF PRO"
    };
    if (result.qrBlob) {
      result.qrBlob.setName("QR_Kod_Placanje.png");
      mailOptions.attachments.push(result.qrBlob);
    }

    var success = sendZohoEmail(mailOptions);
    if (!success) { MailApp.sendEmail(mailOptions); success = true; }
    if (success) updateInquiryStatus(ss, inquiry.id, type === "RACUN" ? "RAČUN POSLAN" : "POSLANO");
    return success;
  } catch(err) { return false; }
}

function updateInquiryStatus(ss, id, status) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(id)) { sheet.getRange(i + 1, 9).setValue(status); break; }
  }
}

function sendZohoEmail(options) {
  try {
    var props = PropertiesService.getScriptProperties();
    var accountId = props.getProperty("ZOHO_ACCOUNT_ID") || "8195587000000002002";
    var refreshToken = "1000.f6545a5ca136ed9079358eaaa554e89e.d197a5edca672277508098a572885584";
    var clientId = "1000.A3PDPBPN8U2PUIDIWWJNQ1SEP1SA5B";
    var clientSecret = "81db097b1ccca18bbfa18297e9fc5a40b3caa799c4";
    
    var tokenUrl = "https://accounts.zoho.eu/oauth/v2/token";
    var tokenRes = UrlFetchApp.fetch(tokenUrl, { method: "post", payload: { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" } });
    var accessToken = JSON.parse(tokenRes.getContentText()).access_token;
    if (!accessToken) return false;

    var response = UrlFetchApp.fetch("https://mail.zoho.eu/api/accounts/" + accountId + "/messages", {
      method: "post", contentType: "application/json", headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify({ fromAddress: '"2LMF PRO" <info@2lmf-pro.hr>', toAddress: options.to, subject: options.subject, content: options.htmlBody, mailFormat: "html" }), muteHttpExceptions: true
    });
    return response.getResponseCode() === 200;
  } catch(e) { return false; }
}

function generateProfessionalHtml(items, name, id, isHidro, isInvoice, subject) {
  var primaryColor = isHidro ? "#007bff" : "#E67E22";
  var total = 0;
  var itemsHtml = items.map(function(item) {
    var qty = parseFloat(item.kolicina || item.qty || 0);
    var price = parseFloat(item.cijena || item.price || 0);
    var lineTotal = qty * price; total += lineTotal;
    var unit = item.unit || item.jedinica || "kom";
    return `<tr><td style="padding:12px; border-bottom:1px solid #eee;">${item.naziv || item.name || "Stavka"}</td><td style="padding:12px; border-bottom:1px solid #eee; text-align:center;">${price.toFixed(2).replace('.', ',')} €</td><td style="padding:12px; border-bottom:1px solid #eee; text-align:center;">${qty.toFixed(2).replace('.', ',')} ${unit}</td><td style="padding:12px; border-bottom:1px solid #eee; text-align:right; font-weight:bold;">${lineTotal.toFixed(2).replace('.', ',')} €</td></tr>`;
  }).join("");

  var qrDataUri = ""; var qrBlob = null;
  var qrContent = "BCD\n002\n1\nSCT\n\n2LMF PRO j.d.o.o.\nHR3123400091111213241\nEUR" + total.toFixed(2) + "\n\n\nUplata po ponudi " + (id || "");
  var qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=" + encodeURIComponent(qrContent);
  
  try {
    var resp = UrlFetchApp.fetch(qrUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() === 200) {
      qrBlob = resp.getBlob();
      qrDataUri = "data:image/png;base64," + Utilities.base64Encode(qrBlob.getBytes());
    }
  } catch(e) { Logger.log("QR Error: " + e.toString()); }

  var dateStr = Utilities.formatDate(new Date(), "GMT+1", "dd.MM.yyyy., HH:mm");

  var html = `<html><body><div style="max-width: 800px; margin: auto; padding: 40px; border: 1px solid #eee;">
      <h1 style="font-family:'Orbitron';">2LMF <span style="color:${primaryColor}">PRO</span></h1>
      <p>Kupac: ${name}</p>
      <p>Datum: ${dateStr}</p>
      <table style="width:100%;">${itemsHtml}</table>
      <h2>Ukupno: ${total.toFixed(2).replace('.', ',')} €</h2>
      <img src="${qrUrl}" style="width:160px;">
    </div></body></html>`;
  return { html: html, qrDataUri: qrDataUri, qrBlob: qrBlob };
}

function getProducts(ss) {
  var sheetNames = ["Proizvodi", "Cjenik", "CJENIK", "Katalog", "Products"];
  var sheet = null;
  for (var i = 0; i < sheetNames.length; i++) {
    sheet = ss.getSheetByName(sheetNames[i]);
    if (sheet) break;
  }
  if (!sheet) return [];
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  return data.slice(1).map(function(row) {
    return { sku: String(row[0]), name: String(row[1]), unit: String(row[2]), price: parseFloat(row[4]) || 0, category: String(row[7]) };
  });
}

function handleCreateManualInquiry(ss, postData) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getRange("B:B").getValues();
  var maxNum = 0;
  for (var i = 1; i < data.length; i++) {
    var val = String(data[i][0]).trim();
    if (val.charAt(0).toUpperCase() === 'U') {
      var numPart = val.substring(1).replace(/\D/g, ''); 
      var num = parseInt(numPart) || 0;
      if (num > maxNum) maxNum = num;
    }
  }
  var id = "U" + ("00000" + (maxNum + 1)).slice(-5);
  var dateStr = Utilities.formatDate(new Date(), "GMT+1", "dd.MM.yyyy., HH:mm");
  var total = 0;
  postData.items.forEach(function(it) {
    var p = parseFloat(String(it.cijena || it.price || 0).replace(',', '.'));
    var q = parseFloat(String(it.kolicina || it.qty || 1).replace(',', '.'));
    total += (p * q);
  });
  sheet.appendRow([dateStr, id, postData.name, postData.email, "", postData.subject, total, "", "NOVO", JSON.stringify({ stavke: postData.items })]);
  if (postData.email && postData.email.indexOf("@") !== -1) {
    var inquiry = { id: id, name: postData.name, email: postData.email, subject: postData.subject, amount: total, jsonData: JSON.stringify({ stavke: postData.items }) };
    sendInquiryOffer(ss, inquiry);
  }
  return { status: "success", id: id };
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

// --- SHARK TRACK GPS PORTED FUNCTIONS ---
function saveLocation(ss, data) {
  try {
    let sheet = ss.getSheetByName('Lokacije');
    if (!sheet) {
      sheet = ss.insertSheet('Lokacije');
      sheet.appendRow(['Datum', 'Sat', 'Lat', 'Lng', 'Maps Link', 'Bilješka', 'Foto Link']);
      sheet.getRange(1, 1, 1, 7).setBackground('#1a1a2e').setFontColor('#ffffff').setFontWeight('bold');
    }
    var now = new Date();
    var datum = Utilities.formatDate(now, 'Europe/Zagreb', 'dd.MM.yyyy');
    var sat = Utilities.formatDate(now, 'Europe/Zagreb', 'HH:mm');
    var mapsLink = "https://www.google.com/maps?q=" + data.lat + "," + data.lng;
    sheet.appendRow([datum, sat, data.lat, data.lng, mapsLink, data.note || '', '']);
    sheet.getRange(sheet.getLastRow(), 5).setFormula('=HYPERLINK("' + mapsLink + '","📍 Otvori")');
    return { success: true, status: "success" };
  } catch (e) { return { success: false, status: "error", message: e.toString() }; }
}

function getLocations(ss) {
  try {
    var sheet = ss.getSheetByName('Lokacije');
    if (!sheet || sheet.getLastRow() <= 1) return [];
    var data = sheet.getDataRange().getValues().slice(1);
    return data.reverse().map(function(row) {
      return { datum: row[0], sat: row[1], lat: row[2], lng: row[3], mapsLink: row[4], biljeska: row[5], fotoLink: row[6] };
    });
  } catch (e) { return []; }
}

function uploadPhoto(data) {
  try {
    var folderName = "Shark Business Slike";
    var folder;
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) folder = folders.next();
    else folder = DriveApp.createFolder(folderName);

    var base64Data = data.imageBase64.replace(/^data:image\/\w+;base64,/, '');
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), 'image/jpeg', data.filename || ('site_' + Date.now() + '.jpg'));
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    var fileUrl = file.getUrl();
    
    var ssId = PropertiesService.getScriptProperties().getProperty("SHEET_ID") || "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";
    var ss = SpreadsheetApp.openById(ssId);
    var sheet = ss.getSheetByName('Lokacije');
    if (sheet) sheet.getRange(sheet.getLastRow(), 7).setValue(fileUrl); 

    return { success: true, status: "success", url: fileUrl };
  } catch (e) { return { success: false, status: "error", message: e.toString() }; }
}
