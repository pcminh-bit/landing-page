const { google } = require("googleapis");

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH;

async function getAuthClient() {
  const auth = new google.auth.GoogleAuth({
    keyFile: CREDENTIALS_PATH,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return auth.getClient();
}

async function appendToSheet(tabName, values) {
  try {
    if (!SHEET_ID || !CREDENTIALS_PATH) {
      console.log("Google Sheets not configured, skipping.");
      return;
    }
    const auth = await getAuthClient();
    const sheets = google.sheets({ version: "v4", auth });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${tabName}!A:Z`,
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [values] },
    });
    console.log(`✓ Appended to sheet: ${tabName}`);
  } catch (err) {
    console.error(`Google Sheets error (${tabName}):`, err.message);
  }
}

module.exports = { appendToSheet };
