/**
 * 2LMF PRO BUSINESS - UNIFIED BACKEND CORE 🦈💼
 * Combined: CRM (Offers/Invoices) + Receipt Scanner (OCR) + Accounting
 * Real Sheet: 1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4
 */

// --- CONFIGURATION ---
const SCRIPT_PROP = PropertiesService.getScriptProperties();
const OPENAI_API_KEY = SCRIPT_PROP.getProperty("OPENAI_API_KEY");
const REAL_SHEET_ID = "1YmRZMeomWxAmfi6rsLN6qKrHrrAeHOnGVbnfsZXP3w4";

// --- BUSINESS LOGIC: MATERIAL CONFIGURATION (Full Sync) ---
const MATERIAL_CONFIG = {
  "XPS": { buy_factor: 0.80, supplier: "RAVA" },
  "Kamena vuna": { buy_factor: 0.80, supplier: "RAVA" },
  "TPO": { buy_factor: 0.77, supplier: "RAVA" },
  "PVC": { buy_factor: 0.80, supplier: "RAVA" },
  "Diamond": { buy_factor: 0.74, supplier: "RAVA" },
  "Ruby": { buy_factor: 0.74, supplier: "RAVA" },
  "Vapor": { buy_factor: 0.74, supplier: "RAVA" },
  "Alu-Termo": { buy_factor: 0.74, supplier: "RAVA" },
  "OSB": { buy_factor: 0.80, supplier: "RAVA" },
  "Insta Stik": { buy_factor: 0.74, supplier: "RAVA" },
  "Ethafoam": { buy_factor: 0.74, supplier: "RAVA" },
  "PE Folija": { buy_factor: 0.70, supplier: "RAVA" },
  "Čepasta": { buy_factor: 0.70, supplier: "RAVA" },
  "Paropropusno": { buy_factor: 0.74, supplier: "RAVA" },
  "EPS": { buy_factor: 0.80, supplier: "RAVA" },
  "Žbuka": { buy_factor: 0.74, supplier: "RAVA" },
  "Uniterm": { buy_factor: 0.74, supplier: "RAVA" },
  "Grund": { buy_factor: 0.74, supplier: "RAVA" },
  "Profil": { buy_factor: 0.74, supplier: "RAVA" },
  "Mrežica": { buy_factor: 0.74, supplier: "RAVA" },
  "2D panel": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "3D panel": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "Stup": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "Pješačka vrata": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "Sidreni vijci": { buy_factor: 0.77, supplier: "Dobavljač Ograde" },
  "Aquamat": { buy_factor: 0.77, supplier: "Isomat" },
  "Isoflex": { buy_factor: 0.77, supplier: "Isomat" },
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
      const receipts = getLatestReceipts(ss);
      const stats = calculateStats(ss);
      
      return createJsonResponse({
        status: "success",
        inquiries: inquiries,
        receipts: receipts,
        stats: stats
      });
    }
    
    // Standard Receipt Sync
    if (action === 'sync') {
      return handleReceiptSync();
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
      return createJsonResponse({ status: "success", message: "Ponuda uspješno proslijeđena u Generator!" });
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
  return data.reverse().slice(0, 50).map(row => ({
    date: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+1", "dd.MM.yyyy") : row[0],
    id: row[1],
    name: row[2],
    email: row[3],
    phone: row[4],
    subject: row[5],
    amount: row[6],
    status: row[8]
  }));
}

function calculateStats(ss) {
  const sheetDnevnik = ss.getSheetByName("Dnevnik knjiženja");
  const data = sheetDnevnik ? sheetDnevnik.getDataRange().getValues().slice(1) : [];
  
  // Mjesečni prihodi (Svi IZVODI gdje konto 1000 DUGUJE)
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  const revenue = data.reduce((sum, row) => {
    const d = new Date(row[0]);
    if (d.getMonth() === currentMonth && d.getFullYear() === currentYear && row[5] == "1000") {
      return sum + (parseFloat(row[7]) || 0);
    }
    return sum;
  }, 0);

  const sheetUpiti = ss.getSheetByName("Upiti");
  const upitiData = sheetUpiti ? sheetUpiti.getDataRange().getValues().slice(1) : [];
  const openCount = upitiData.filter(row => row[8] === "NOVO").length;
  
  return {
    revenue: revenue,
    inquiriesCount: openCount
  };
}

// --- MODULE: RECEIPT SCANNER & OCR ---

function getLatestReceipts(ss) {
  const sheet = ss.getSheetByName("Dnevnik knjiženja");
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues().slice(1);
  return data.filter(row => row[1] === "URA").reverse().slice(0, 15).map(row => ({
    datum: row[0] instanceof Date ? Utilities.formatDate(row[0], "GMT+1", "dd.MM.yyyy") : row[0],
    dobavljac: row[2],
    opis: row[3],
    iznos: row[7],
    link: row[4] ? (row[4].toString().match(/"([^"]+)"/) ? row[4].match(/"([^"]+)"/)[1] : "") : ""
  }));
}

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
        content: "Ti si stručnjak za hrvatsko računovodstvo. Izvuci: datum (DD.MM.YYYY), dobavljac, iznos, pdv, kategorija ('Gorivo', 'Materijal', 'Ured', 'Ostalo'). Vrati JSON."
      },
      {
        role: "user", content: [
          { type: "text", text: "Analiziraj račun." },
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
  
  // Log to Dnevnik knjiženja (MATCHING REAL COLUMNS)
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
    var lastRow = sheet.getLastRow();
    var nextRow = lastRow + 1;
    
    // ["Datum", "Vrsta dokumenta", "Stranka", "Opis", "Dokument", "Konto", "Naziv konta", "Duguje", "Potrazuje", "saldo"]
    sheet.appendRow([
      date, 
      vrsta, 
      stranka, 
      opis, 
      dokument ? '=HYPERLINK("' + dokument + '"; "🔎 Vidi")' : "", 
      entry.konto, 
      entry.nazivKonta, 
      entry.duguje || 0, 
      entry.potrazuje || 0,
      "" // Formula slot
    ]);
    
    // Set Saldo Formula: =H(row) - I(row)
    sheet.getRange(nextRow, 10).setFormula('=H' + nextRow + '-I' + nextRow);
  });
}
