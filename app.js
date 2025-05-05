// App state
let ledgerEntries = [];
let accountBalances = {};
let definedAccounts = {};
let settings = {
  currencySymbol: "$",
  decimalPlaces: 2,
  dateFormat: "YYYY-MM-DD",
  fiscalYearStart: "1",
  entriesPerPage: 10,
  debugMode: false,
  strictValidation: false
};

window.onload = function () {
  setupTabs();
  setupLedgerForm();
  setupAccountsForm();
  setupReportButtons();
  setupChat();
  setupSettings();
  setupImportExport();
};

function setupTabs() {
  const buttons = document.querySelectorAll("nav button");
  const sections = document.querySelectorAll(".tab");
  buttons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      sections.forEach(sec => sec.classList.toggle("hidden", sec.id !== tab));
    });
  });
}

function setupLedgerForm() {
  document.getElementById("entry-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const entry = {
      date: document.getElementById("entry-date").value,
      event: document.getElementById("entry-event").value,
      account: document.getElementById("entry-account").value,
      offset: document.getElementById("entry-offset").value,
      debit: parseFloat(document.getElementById("entry-debit").value) || 0,
      credit: parseFloat(document.getElementById("entry-credit").value) || 0,
      category: document.getElementById("entry-category").value
    };

    if ((entry.debit && entry.credit) || (!entry.debit && !entry.credit)) {
      alert("Enter either debit or credit, not both.");
      return;
    }

    ledgerEntries.push(entry);
    recalculateAccountBalances();
    refreshLedgerTable();
    refreshAccountTable();
    document.getElementById("entry-form").reset();
  });
}

function refreshLedgerTable() {
  const tbody = document.querySelector("#ledger-table tbody");
  tbody.innerHTML = "";
  let totalDebit = 0, totalCredit = 0;
  ledgerEntries.forEach((entry, index) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${entry.date}</td>
      <td>${entry.event}</td>
      <td>${entry.account}</td>
      <td>${entry.offset}</td>
      <td>${format(entry.debit)}</td>
      <td>${format(entry.credit)}</td>
      <td><button onclick="deleteEntry(${index})">❌</button></td>
    `;
    tbody.appendChild(tr);
    totalDebit += entry.debit;
    totalCredit += entry.credit;
  });
  document.getElementById("total-debit").textContent = format(totalDebit);
  document.getElementById("total-credit").textContent = format(totalCredit);
}

function deleteEntry(index) {
  if (confirm("Delete this entry?")) {
    ledgerEntries.splice(index, 1);
    recalculateAccountBalances();
    refreshLedgerTable();
    refreshAccountTable();
  }
}

function format(value) {
  return `${settings.currencySymbol}${value.toFixed(settings.decimalPlaces)}`;
}

function recalculateAccountBalances() {
  accountBalances = {};
  ledgerEntries.forEach(entry => {
    if (!accountBalances[entry.account]) accountBalances[entry.account] = 0;
    if (!accountBalances[entry.offset]) accountBalances[entry.offset] = 0;
    accountBalances[entry.account] += entry.debit - entry.credit;
    accountBalances[entry.offset] += entry.credit - entry.debit;
  });
}

function setupAccountsForm() {
  document.getElementById("account-form").addEventListener("submit", function (e) {
    e.preventDefault();
    const name = document.getElementById("account-name").value;
    const type = document.getElementById("account-type").value;
    const allowNegative = document.getElementById("allow-negative").checked;
    definedAccounts[name] = { type, allowNegative };
    refreshAccountTable();
    document.getElementById("account-form").reset();
  });
}

function refreshAccountTable() {
  const tbody = document.querySelector("#accounts-table tbody");
  tbody.innerHTML = "";
  Object.entries(definedAccounts).forEach(([name, details]) => {
    const tr = document.createElement("tr");
    const balance = accountBalances[name] || 0;
    tr.innerHTML = `
      <td>${name}</td>
      <td>${details.type}</td>
      <td>${format(balance)}</td>
      <td>${details.allowNegative ? "Yes" : "No"}</td>
      <td><button onclick="deleteAccount('${name}')">❌</button></td>
    `;
    tbody.appendChild(tr);
  });
}

function deleteAccount(name) {
  if (confirm(`Delete account ${name}?`)) {
    if (ledgerEntries.some(entry => entry.account === name || entry.offset === name)) {
      alert("Cannot delete an account with transactions.");
      return;
    }
    delete definedAccounts[name];
    delete accountBalances[name];
    refreshAccountTable();
  }
}

function setupReportButtons() {
  document.getElementById("generate-income").addEventListener("click", generateIncomeStatement);
  // Add similar bindings for balance sheet and cashflow as needed
}

function generateIncomeStatement() {
  const from = document.getElementById("income-date-from").value;
  const to = document.getElementById("income-date-to").value;
  const div = document.getElementById("income-statement-report");
  const rev = totalByType("revenue", from, to);
  const exp = totalByType("expense", from, to);
  const net = rev - exp;
  div.innerHTML = `
    <h4>Income Statement</h4>
    <p>Revenue: ${format(rev)}</p>
    <p>Expenses: ${format(exp)}</p>
    <p><strong>Net Income: ${format(net)}</strong></p>
  `;
}

function totalByType(type, from, to) {
  return ledgerEntries.filter(e => {
    const inRange = (!from || e.date >= from) && (!to || e.date <= to);
    const match = definedAccounts[e.account]?.type === type || definedAccounts[e.offset]?.type === type;
    return inRange && match;
  }).reduce((sum, e) => {
    const matchAcct = definedAccounts[e.account]?.type === type ? e.debit - e.credit : 0;
    const matchOff = definedAccounts[e.offset]?.type === type ? e.credit - e.debit : 0;
    return sum + matchAcct + matchOff;
  }, 0);
}

function setupChat() {
  document.getElementById("chat-btn").addEventListener("click", () => {
    const input = document.getElementById("chat-input");
    const msg = input.value.trim();
    const log = document.getElementById("chat-log");
    if (!msg) return;
    log.innerHTML += `<div><strong>You:</strong> ${msg}</div>`;
    let response = "I'm not sure how to answer that.";
    if (!isNaN(Number(msg))) response = `Math result: ${eval(msg)}`;
    else if (msg.toLowerCase().includes("debit")) response = "Debits increase assets and expenses. Credits increase liabilities, equity, and revenue.";
    else if (msg.toLowerCase().includes("income statement")) response = "Revenue - Expenses = Net Income.";
    log.innerHTML += `<div><strong>GPT:</strong> ${response}</div>`;
    input.value = "";
    log.scrollTop = log.scrollHeight;
  });
}

function setupSettings() {
  document.getElementById("save-settings-btn").addEventListener("click", () => {
    settings.currencySymbol = document.getElementById("currency-symbol-setting").value || "$";
    settings.decimalPlaces = parseInt(document.getElementById("decimal-places").value) || 2;
    settings.dateFormat = document.getElementById("date-format").value || "YYYY-MM-DD";
    settings.fiscalYearStart = document.getElementById("fiscal-year-start").value || "1";
    settings.entriesPerPage = parseInt(document.getElementById("entries-per-page").value) || 10;
    settings.debugMode = document.getElementById("debug-mode").checked;
    settings.strictValidation = document.getElementById("validate-entries").checked;
    alert("Settings saved.");
  });
}

function setupImportExport() {
  document.getElementById("export-json-btn").addEventListener("click", () => {
    download("ledger.json", JSON.stringify(ledgerEntries, null, 2));
  });

  document.getElementById("export-csv-btn").addEventListener("click", () => {
    const csv = ledgerEntries.map(e => `${e.date},${e.event},${e.account},${e.offset},${e.debit},${e.credit},${e.category}`).join("\n");
    download("ledger.csv", csv);
  });

  document.getElementById("import-btn").addEventListener("click", () => {
    document.getElementById("file-import").click();
  });

  document.getElementById("file-import").addEventListener("change", e => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = () => {
      try {
        ledgerEntries = JSON.parse(reader.result);
        recalculateAccountBalances();
        refreshLedgerTable();
        refreshAccountTable();
        alert("Import successful");
      } catch {
        alert("Invalid file");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("clear-data-btn").addEventListener("click", () => {
    if (confirm("Clear all data?")) {
      ledgerEntries = [];
      accountBalances = {};
      definedAccounts = {};
      refreshLedgerTable();
      refreshAccountTable();
    }
  });
}

function download(filename, content) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  a.download = filename;
  a.click();
}