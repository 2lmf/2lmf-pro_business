/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Verzija: 2.9.4 (EMAIL INTEGRATION + ORANGE SHARK)
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
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function doPost(e) {
  try {
    var postData = JSON.parse(e.postData.contents);
    var action = postData.action;
    var ss = SpreadsheetApp.openById(pwa_prop.getProperty("SHEET_ID") || pwa_sheet_id);
    
    if (action === 'updateInquiry') { return handleUpdateInquiry(ss, postData); }
    
    if (action === 'sendOffer' || action === 'sendInvoice') {
      var inquiry = getInquiryById(ss, postData.id);
      if (!inquiry) return createJsonResponse({ status: "error", message: "Upit nije pronađen" });
      var success = (action === 'sendOffer') ? sendInquiryOffer(ss, inquiry) : sendInquiryInvoice(ss, inquiry);
      return createJsonResponse({ status: success ? "success" : "error" });
    }
    
    return createJsonResponse({ status: "error" });
  } catch (err) { return createJsonResponse({ status: "error", message: err.toString() }); }
}

function calculateAdvancedStats(ss) {
  var sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  // SCAN LATEST 1000 ROWS
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
  var data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, limit).map(function(row) {
    return {
      date: String(row[0]), id: String(row[1]), name: String(row[2]),
      email: String(row[3]), subject: String(row[5]),
      amount: row[6] || 0, status: String(row[8]), jsonData: row[9] || "{}"
    };
  });
}

function getInquiryById(ss, id) {
  var data = getInquiriesWithLimit(ss, 500);
  return data.find(function(i) { return String(i.id) === String(id); });
}

// --- EMAIL ENGINE ---
function sendInquiryOffer(ss, inquiry) {
  return sendMailCore(ss, inquiry, "PONUDA");
}
function sendInquiryInvoice(ss, inquiry) {
  return sendMailCore(ss, inquiry, "RACUN");
}

function sendMailCore(ss, inquiry, type) {
  try {
    var items = [];
    try {
      var raw = JSON.parse(inquiry.jsonData || "{}");
      items = raw.stavke || raw.items || raw.products || [];
      if (Array.isArray(raw) && raw.length > 0) items = raw;
    } catch(e) { console.log("JSON Parse Error"); }
    
    var isHidro = inquiry.subject.toUpperCase().indexOf("HIDRO") !== -1;
    var result = generateProfessionalHtml(items, inquiry.name, inquiry.id, isHidro, type === "RACUN", inquiry.subject);
    var pdfBlob = HtmlService.createHtmlOutput(result.html).setTitle(type + "_" + inquiry.id).getAs('application/pdf');
    pdfBlob.setName(type + "_" + inquiry.id + ".pdf");
    
    var subject = (type === "RACUN" ? "Račun br. " : "Ponuda - ") + inquiry.id + " | 2LMF PRO";
    var attachments = [pdfBlob];
    var inlineImages = {};
    if (result.qrBlob) {
      result.qrBlob.setName("qrcode.png");
      inlineImages["qrcode"] = result.qrBlob;
    }

    var mailOptions = {
      to: inquiry.email,
      subject: subject,
      htmlBody: result.html.replace(result.qrDataUri, "cid:qrcode"),
      inlineImages: inlineImages,
      attachments: attachments,
      name: "2LMF PRO"
    };

    // Fallback logic: Zoho first, then Gmail
    var success = sendZohoEmail(mailOptions);
    if (!success) {
       MailApp.sendEmail(mailOptions);
       success = true;
    }
    
    if (success) {
      updateInquiryStatus(ss, inquiry.id, type === "RACUN" ? "RAČUN POSLAN" : "POSLANO");
    }
    return success;
  } catch(err) {
    console.log("Mail Engine Error: " + err);
    return false;
  }
}

function updateInquiryStatus(ss, id, status) {
  var sheet = ss.getSheetByName("Upiti");
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][1]) === String(id)) {
      sheet.getRange(i + 1, 9).setValue(status);
      break;
    }
  }
}

// --- ZOHO INTEGRATION ---
function sendZohoEmail(options) {
  try {
    var props = PropertiesService.getScriptProperties();
    var accountId = props.getProperty("ZOHO_ACCOUNT_ID") || "8195587000000002002";
    var refreshToken = "1000.f6545a5ca136ed9079358eaaa554e89e.d197a5edca672277508098a572885584";
    var clientId = "1000.A3PDPBPN8U2PUIDIWWJNQ1SEP1SA5B";
    var clientSecret = "81db097b1ccca18bbfa18297e9fc5a40b3caa799c4";
    
    var tokenUrl = "https://accounts.zoho.eu/oauth/v2/token";
    var tokenRes = UrlFetchApp.fetch(tokenUrl, {
      method: "post", payload: { refresh_token: refreshToken, client_id: clientId, client_secret: clientSecret, grant_type: "refresh_token" }
    });
    var accessToken = JSON.parse(tokenRes.getContentText()).access_token;
    if (!accessToken) return false;

    var apiBase = "https://mail.zoho.eu/api/accounts/" + accountId + "/messages";
    var payload = {
      fromAddress: '"2LMF PRO" <info@2lmf-pro.hr>',
      toAddress: options.to,
      subject: options.subject,
      content: options.htmlBody,
      mailFormat: "html"
    };

    var response = UrlFetchApp.fetch(apiBase, {
      method: "post", contentType: "application/json",
      headers: { Authorization: "Bearer " + accessToken },
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    return response.getResponseCode() === 200;
  } catch(e) { console.log("Zoho Fail: " + e); return false; }
}

// --- HTML GENERATOR ---
function generateProfessionalHtml(items, name, id, isHidro, isInvoice, subject) {
  var primaryColor = isHidro ? "#007bff" : "#E67E22";
  var total = 0;
  var itemsHtml = items.map(function(item) {
    var qty = parseFloat(item.kolicina || item.qty || 0);
    var price = parseFloat(item.cijena || item.price || 0);
    var lineTotal = qty * price; total += lineTotal;
    return `<tr><td style="padding:10px; border-bottom:1px solid #eee;">${item.naziv || item.name || "Stavka"}</td><td style="padding:10px; border-bottom:1px solid #eee; text-align:center;">${qty}</td><td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${price.toFixed(2)} €</td><td style="padding:10px; border-bottom:1px solid #eee; text-align:right;">${lineTotal.toFixed(2)} €</td></tr>`;
  }).join("");

  var qrDataUri = ""; var qrBlob = null;
  if (!isInvoice) {
    var amountCents = (Math.round(total * 100)).toString();
    var paddedAmount = ("000000000000000" + amountCents).substr(-15);
    var qrContent = "HRVHUB30\nEUR\n" + paddedAmount + "\n" + name.substring(0,30) + "\n-\n-\n2LMF PRO j.d.o.o.\nOrešje 7\n10090 Zagreb\nHR3123400091111213241\nHR00\n" + String(id || "Upit").substring(0, 22) + "\nOTHR\nUplata po ponudi";
    var qrUrl = "https://quickchart.io/qr?size=250&text=" + encodeURIComponent(qrContent);
    qrBlob = UrlFetchApp.fetch(qrUrl).getBlob();
    qrDataUri = "data:image/png;base64," + Utilities.base64Encode(qrBlob.getBytes());
  }

  var html = `<html><body style="font-family: Arial, sans-serif; padding: 20px; background:#f8f9fa;">
    <div style="max-width: 600px; margin: auto; background: #fff; padding: 30px; border-radius: 10px; border-top: 5px solid ${primaryColor};">
      <h1 style="color: #000; font-size: 24px; margin-bottom: 5px;">2LMF <span style="color:${primaryColor}">PRO</span></h1>
      <p style="font-size: 10px; color: #888; margin-top:0;">HIDRO & TERMO IZOLACIJA • FASADE • OGRADE</p>
      <hr style="border:0; border-top:1px solid #eee; margin:20px 0;">
      <h2 style="font-size: 18px; margin-bottom:20px;">${isInvoice ? "RAČUN" : "PONUDA"} br. ${id}</h2>
      <p><b>Kupac:</b> ${name}</p>
      <table style="width:100%; border-collapse:collapse; margin:20px 0;">
        <thead><tr style="background:${primaryColor}; color:#fff;"><th style="padding:10px; text-align:left;">Stavka</th><th style="padding:10px;">Kol.</th><th style="padding:10px; text-align:right;">Cijena</th><th style="padding:10px; text-align:right;">Ukupno</th></tr></thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <div style="text-align:right; font-size:20px; font-weight:bold; margin-top:20px;">UKUPNO: ${total.toFixed(2)} €</div>
      <p style="font-size:11px; color:#666; margin-top:20px;">Porezni obveznik nije u sustavu PDV-a, temeljem članka 90. Zakone o PDV-u.</p>
      ${qrDataUri ? `<div style="text-align:center; margin-top:30px;"><img src="${qrDataUri}" style="width:150px;"><p style="font-size:10px; color:#888;">SKENIRAJ I PLATI (HUB3)</p></div>` : ""}
      <div style="margin-top:40px; padding-top:20px; border-top:1px solid #eee; font-size:10px; color:#999; text-align:center;">
        2LMF PRO j.d.o.o. | Orešje 7, Zagreb | info@2lmf-pro.hr | +385 95 311 5007
      </div>
    </div>
  </body></html>`;
  return { html: html, qrDataUri: qrDataUri, qrBlob: qrBlob };
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
