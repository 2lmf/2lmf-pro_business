/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Combined: CRM (Offers/Invoices) + Receipt Scanner (OCR) + Accounting
 * Real Sheet: 1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4
 */

// --- CONFIGURATION ---
const SCRIPT_PROP = PropertiesService.getScriptProperties();
const OPENAI_API_KEY = SCRIPT_PROP.getProperty("OPENAI_API_KEY");
const REAL_SHEET_ID = "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";

// --- BUSINESS LOGIC: MATERIAL CONFIGURATION ---
const MATERIAL_CONFIG = {
  "XPS": { buy_factor: 0.80, supplier: "RAVA" },
  "Kamena vuna": { buy_factor: 0.80, supplier: "RAVA" },
  "TPO": { buy_factor: 0.77, supplier: "RAVA" },
  "PVC": { buy_factor: 0.80, supplier: "RAVA" },
  "Diamond": { buy_factor: 0.74, supplier: "RAVA" },
  "Ruby": { buy_factor: 0.74, supplier: "RAVA" },
  "2D panel": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "3D panel": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "Montaža": { buy_factor: 0.00, supplier: "-" }
};

/**
 * API ENDPOINT: GET
 */
function doGet(e) {
  try {
    const action = e.parameter.action;
    const ss = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("SHEET_ID") || REAL_SHEET_ID);

    if (action === 'get_dashboard_data') {
      const inquiries = getLatestInquiries(ss);
      const stats = calculateStats(ss);
      
      return createJsonResponse({
        status: "success",
        inquiries: inquiries,
        stats: stats
      });
    }
    
    if (action === 'sync') {
      // Returns pending scan for review
      return createJsonResponse({ status: "success", data: {} });
    }

    return createJsonResponse({ status: "error", message: "Nepoznata akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

/**
 * API ENDPOINT: POST
 */
function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    if (action === 'sendOffer') {
      return createJsonResponse({ status: "success", message: "Ponuda generirana!" });
    }

    if (action === 'analyzeReceipt') {
      return handleReceiptAnalysis(postData);
    }

    if (action === 'saveConfirmedData') {
      return handleSaveConfirmedReceipt(postData);
    }

    return createJsonResponse({ status: "error", message: "Nepoznata POST akcija" });
  } catch (err) {
    return createJsonResponse({ status: "error", message: err.toString() });
  }
}

// --- MODULE: CRM & INQUIRIES ---

function getLatestInquiries(ss) {
  const sheet = ss.getSheetByName("Upiti");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  return data.reverse().slice(0, 20).map(row => ({
    date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+1", "dd.MM.yyyy") : row[0],
    id: row[1],
    name: row[2],
    email: row[3],
    subject: row[5],
    amount: row[6],
    status: row[8]
  }));
}

function calculateStats(ss) {
  const sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  const data = sheetDnevnik ? sheetDnevnik.getDataRange().getValues().slice(1) : [];
  
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  let revenue = 0;
  let expenses = 0;
  let recentActivities = [];

  data.forEach(row => {
    const d = new Date(row[0]);
    const isCurrentMonth = (d.getMonth() === currentMonth && d.getFullYear() === currentYear);
    const konto = String(row[5]);
    const duguje = parseFloat(row[7]) || 0;
    const potrazuje = parseFloat(row[8]) || 0;

    // Revenue Logic: Konto 7500 (Prihodi) Potražuje
    if (isCurrentMonth && konto === "7500") {
      revenue += potrazuje;
    }

    // Expense Logic: Klass 4 (Troškovi) Duguje
    if (isCurrentMonth && konto.startsWith("4")) {
      expenses += duguje;
    }

    // Capture recent activities for Dashboard (IRA and URA)
    if (row[1] === "IRA" || row[1] === "URA") {
      recentActivities.push({
        datum: d instanceof Date ? Utilities.formatDate(d, "GMT+1", "dd.MM.yyyy") : row[0],
        vrsta: row[1],
        stranka: row[2],
        opis: row[3],
        iznos: row[1] === "IRA" ? potrazuje : duguje,
        link: row[4]
      });
    }
  });

  const sheetUpiti = ss.getSheetByName("Upiti");
  const upitiData = sheetUpiti ? sheetUpiti.getDataRange().getValues().slice(1) : [];
  const openCount = upitiData.filter(row => row[8] === "NOVO").length;
  
  return {
    revenue: revenue,
    expenses: expenses,
    inquiriesCount: openCount,
    recentActivities: recentActivities.reverse().slice(0, 10)
  };
}

// --- MODULE: RECEIPT SCANNER & OCR ---

function handleReceiptAnalysis(postData) {
  const folderInId = SCRIPT_PROP.getProperty("FOLDER_IN_ID") || "1kpBzqrSHVWTaBi8kKIUXknKhRtoUEy5g";
  const folder = DriveApp.getFolderById(folderInId);
  const blob = Utilities.newBlob(Utilities.base64Decode(postData.data), postData.mimeType, `Shark_${Date.now()}.jpg`);
  const file = folder.createFile(blob);
  
  const aiData = getAiDataFromFile(file);
  return createJsonResponse({
    status: "success",
    fileName: file.getName(),
    data: aiData
  });
}

function getAiDataFromFile(file) {
  const url = "https://api.openai.com/v1/chat/completions";
  const base64Image = Utilities.base64Encode(file.getBlob().getBytes());
  const mimeType = file.getMimeType();
  
  const payload = {
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: "Ti si hrvatski računovođa. Izvuci: datum (DD.MM.YYYY), dobavljac, iznos, pdv, kategorija. JSON."
      },
      {
        role: "user", content: [
          { type: "text", text: "Analiziraj." },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } }
        ]
      }
    ]
  };

  const options = {
    method: "POST",
    headers: { "Authorization": "Bearer " + OPENAI_API_KEY, "Content-Type": "application/json" },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = JSON.parse(response.getContentText());
  return JSON.parse(json.choices[0].message.content);
}

function handleSaveConfirmedReceipt(postData) {
  const data = postData.data;
  const fileName = postData.fileName;
  const ss = SpreadsheetApp.openById(SCRIPT_PROP.getProperty("SHEET_ID") || REAL_SHEET_ID);
  
  const folderIn = DriveApp.getFolderById(SCRIPT_PROP.getProperty("FOLDER_IN_ID") || "1kpBzqrSHVWTaBi8kKIUXknKhRtoUEy5g");
  const folderOut = DriveApp.getFolderById(SCRIPT_PROP.getProperty("FOLDER_OUT_ID") || "1N7XfCy5s0XnLrCJaBB2QxhJ3gH6eya_a");
  const files = folderIn.getFilesByName(fileName);
  let fileUrl = "";
  if (files.hasNext()) {
    const file = files.next();
    fileUrl = file.getUrl();
    file.moveTo(folderOut);
  }
  
  recordDnevnikEntry(ss, data.datum, "URA", data.dobavljac, "Ulazni račun: " + data.kategorija, fileUrl, [
    { konto: "4100", nazivKonta: "Trošak (" + data.kategorija + ")", duguje: data.iznos, potrazuje: 0 },
    { konto: "2200", nazivKonta: "Dobavljači u zemlji", duguje: 0, potrazuje: data.iznos }
  ]);

  return createJsonResponse({ status: "success" });
}

// --- SHARED HELPERS ---

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
}

function recordDnevnikEntry(ss, date, vrsta, stranka, opis, dokument, entries) {
  const sheet = ss.getSheetByName("Dnevnik knjiženja");
  if (!sheet) return;
  
  entries.forEach(entry => {
    const lastRow = sheet.getLastRow();
    const nextRow = lastRow + 1;
    sheet.appendRow([
      date, vrsta, stranka, opis, 
      dokument ? '=HYPERLINK("' + dokument + '"; "🔎 Vidi")' : "", 
      entry.konto, entry.nazivKonta, entry.duguje, entry.potrazuje,
      ""
    ]);
    sheet.getRange(nextRow, 10).setFormula('=H' + nextRow + '-I' + nextRow);
  });
}
