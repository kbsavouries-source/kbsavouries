const defaultChartOfAccounts = [
    { account: "Cash", subAccount: "Current Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Equity", subAccount: "Equity", type: "Equity", normal: "Credit", statement: "Balance Sheet" },
    { account: "Legal & License Fees", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "Raw Material Inventory", subAccount: "Current Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Stationery Exp", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "Bank / UPI", subAccount: "Current Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Promotion", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "Accounts Payable", subAccount: "Current Liabilities", type: "Liabilities", normal: "Credit", statement: "Balance Sheet" },
    { account: "Accounts Receivable", subAccount: "Current Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Revenue", subAccount: "Revenue", type: "Revenue", normal: "Credit", statement: "Income Statement" },
    { account: "Purchases", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "COGS", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "Finished Goods Inventory", subAccount: "Current Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Packing Material", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" },
    { account: "Kitchen Equipment", subAccount: "Fixed Assets", type: "Assets", normal: "Debit", statement: "Balance Sheet" },
    { account: "Travelling Exp", subAccount: "Expense", type: "Expense", normal: "Debit", statement: "Income Statement" }
];

let chartOfAccounts = JSON.parse(localStorage.getItem('kb_chart_of_accounts')) || defaultChartOfAccounts;
let accountsData = JSON.parse(localStorage.getItem('kb_accounting_data')) || { journal: [] };

function showModal(title, message, isConfirm = false, onConfirm = null) {
    const modal = document.getElementById('custom-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalMsg = document.getElementById('modal-message');
    const btnPrimary = document.getElementById('modal-btn-primary');
    const btnCancel = document.getElementById('modal-btn-cancel');

    modalTitle.innerText = title;
    modalMsg.innerText = message;
    
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('active');
    });

    if (isConfirm) {
        btnCancel.style.display = 'inline-flex';
        btnPrimary.innerText = 'Confirm';
        btnPrimary.onclick = () => {
            closeModal();
            if (onConfirm) onConfirm();
        };
    } else {
        btnCancel.style.display = 'none';
        btnPrimary.innerText = 'Okay';
        btnPrimary.onclick = () => closeModal();
    }
}

function closeModal() {
    const modal = document.getElementById('custom-modal');
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

function updateFileName(input) {
    const fileNameSpan = document.getElementById('file-chosen-name');
    if (input.files && input.files[0]) {
        fileNameSpan.innerText = input.files[0].name;
        fileNameSpan.style.color = "var(--text-primary)";
        fileNameSpan.style.fontWeight = "600";
    } else {
        fileNameSpan.innerText = "No file chosen";
        fileNameSpan.style.color = "var(--text-secondary)";
        fileNameSpan.style.fontWeight = "normal";
    }
}

function clearDateFilter(type) {
    if (type === 'journal') {
        document.getElementById('filter-from-date').value = '';
        document.getElementById('filter-to-date').value = '';
        renderJournal();
    } else if (type === 'ledger') {
        document.getElementById('ledger-from-date').value = '';
        document.getElementById('ledger-to-date').value = '';
        renderLedger();
    } else if (type === 'income') {
        document.getElementById('income-from-date').value = '';
        document.getElementById('income-to-date').value = '';
        renderIncomeStatement();
    } else if (type === 'balance') {
        document.getElementById('balance-to-date').value = '';
        renderBalanceSheet();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-IN', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    const todayStr = new Date().toISOString().split('T')[0];
    const dateEl = document.getElementById('j-date');
    if(dateEl) dateEl.value = todayStr;

    populateAccountDropdowns();
    renderChartOfAccounts();
    renderJournal();
    renderLedger();
    renderTrialBalance();
    renderIncomeStatement();
    renderBalanceSheet();
});

function toggleSidebar() {
    document.getElementById('sidebar').classList.toggle('open');
}

function switchTab(tabId, event) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
    
    document.getElementById('page-title').innerText = event.currentTarget.innerText;
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

function saveAllData() {
    localStorage.setItem('kb_chart_of_accounts', JSON.stringify(chartOfAccounts));
    localStorage.setItem('kb_accounting_data', JSON.stringify(accountsData));
    populateAccountDropdowns();
    renderChartOfAccounts();
    renderJournal();
    renderLedger();
    renderTrialBalance();
    renderIncomeStatement();
    renderBalanceSheet();
}

function populateAccountDropdowns() {
    const drSelect = document.getElementById('j-debit-account');
    const crSelect = document.getElementById('j-credit-account');
    const lSelect = document.getElementById('ledger-account-select');
    if (!drSelect || !crSelect || !lSelect) return;

    let options = chartOfAccounts.map(ac => `<option value="${ac.account}">${ac.account}</option>`).join('');
    drSelect.innerHTML = options;
    crSelect.innerHTML = options;
    lSelect.innerHTML = `<option value="ALL">-- All Transactions (Master Ledger) --</option>` + options;
}

function addNewAccount(e) {
    e.preventDefault();
    const newAcc = {
        account: document.getElementById('acc-name').value.trim(),
        subAccount: document.getElementById('acc-sub').value,
        type: document.getElementById('acc-type').value,
        normal: document.getElementById('acc-normal').value,
        statement: document.getElementById('acc-statement').value
    };

    if (chartOfAccounts.some(a => a.account.toLowerCase() === newAcc.account.toLowerCase())) {
        showModal('Duplicate Account', 'An account with this name already exists.');
        return;
    }

    chartOfAccounts.push(newAcc);
    saveAllData();
    document.getElementById('account-form').reset();
    showModal('Success', 'New account head added successfully!');
}

function deleteAccountHead(index) {
    const accName = chartOfAccounts[index].account;
    const isUsed = accountsData.journal.some(j => j.account === accName);

    if (isUsed) {
        showModal('Action Blocked', `Cannot delete "${accName}" because it has recorded transactions. Please delete those transaction entries first.`);
        return;
    }

    showModal('Confirm Deletion', `Are you sure you want to delete account head "${accName}"?`, true, () => {
        chartOfAccounts.splice(index, 1);
        saveAllData();
    });
}

function renderChartOfAccounts() {
    const tbody = document.getElementById('chart-table-body');
    if (!tbody) return;

    tbody.innerHTML = chartOfAccounts.map((ac, index) => `
        <tr>
            <td data-label="Account Name"><strong>${ac.account}</strong></td>
            <td data-label="Sub Account">${ac.subAccount}</td>
            <td data-label="Type">${ac.type}</td>
            <td data-label="Normal Balance">${ac.normal}</td>
            <td data-label="Financial Statement">${ac.statement}</td>
            <td data-label="Action"><button class="btn-danger" onclick="deleteAccountHead(${index})">Delete</button></td>
        </tr>
    `).join('');
}

function addJournalEntry(e) {
    e.preventDefault();
    const todayStr = new Date().toISOString().split('T')[0];
    const dateVal = document.getElementById('j-date').value;
    const debitAcc = document.getElementById('j-debit-account').value;
    const creditAcc = document.getElementById('j-credit-account').value;
    const amountVal = Number(document.getElementById('j-amount').value) || 0;
    const commentsVal = document.getElementById('j-comments').value;
    const fileInput = document.getElementById('j-bill');

    if (debitAcc === creditAcc) {
        showModal('Invalid Entry', 'Debit and Credit accounts cannot be the same in a single transaction.');
        return;
    }

    const txnId = 'TXN-' + Date.now();

    const processEntryWithFile = (fileDataUrl, fileName) => {
        const debitEntry = {
            id: txnId,
            date: dateVal,
            account: debitAcc,
            type: 'Debit',
            amount: amountVal,
            comments: commentsVal,
            billData: fileDataUrl || null,
            billName: fileName || null
        };

        const creditEntry = {
            id: txnId,
            date: dateVal,
            account: creditAcc,
            type: 'Credit',
            amount: amountVal,
            comments: commentsVal,
            billData: fileDataUrl || null,
            billName: fileName || null
        };

        accountsData.journal.push(debitEntry);
        accountsData.journal.push(creditEntry);

        saveAllData();
        document.getElementById('journal-form').reset();
        document.getElementById('j-date').value = todayStr;
        document.getElementById('file-chosen-name').innerText = "No file chosen";
        document.getElementById('file-chosen-name').style.color = "var(--text-secondary)";
        document.getElementById('file-chosen-name').style.fontWeight = "normal";
    };

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = function (uploadEvent) {
            processEntryWithFile(uploadEvent.target.result, fileInput.files[0].name);
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        processEntryWithFile(null, null);
    }
}

function deleteJournalItem(index) {
    const item = accountsData.journal[index];
    if (item.id) {
        accountsData.journal = accountsData.journal.filter(j => j.id !== item.id);
    } else {
        accountsData.journal.splice(index, 1);
    }
    saveAllData();
}

function renderJournal() {
    const tbody = document.getElementById('journal-table-body');
    if (!tbody) return;

    const fromDate = document.getElementById('filter-from-date').value;
    const toDate = document.getElementById('filter-to-date').value;

    let filtered = accountsData.journal.filter(j => {
        if (fromDate && j.date < fromDate) return false;
        if (toDate && j.date > toDate) return false;
        return true;
    });

    tbody.innerHTML = filtered.map((j, index) => {
        let debitVal = j.type === 'Debit' ? `₹${j.amount.toFixed(2)}` : '';
        let creditVal = j.type === 'Credit' ? `₹${j.amount.toFixed(2)}` : '';
        let billLink = j.billData ? `<a href="${j.billData}" target="_blank" style="color:var(--text-primary); font-weight:600; text-decoration:underline;">View Bill</a>` : '<span style="color:var(--text-secondary);">-</span>';
        
        let actualIndex = accountsData.journal.indexOf(j);
        return `
            <tr>
                <td data-label="Date">${j.date}</td>
                <td data-label="Account"><strong>${j.account}</strong></td>
                <td data-label="Debit">${debitVal}</td>
                <td data-label="Credit">${creditVal}</td>
                <td data-label="Comments">${j.comments}</td>
                <td data-label="Bill">${billLink}</td>
                <td data-label="Action"><button class="btn-danger" onclick="deleteJournalItem(${actualIndex})">Delete</button></td>
            </tr>
        `;
    }).join('');
}

function renderLedger() {
    const selectedAccount = document.getElementById('ledger-account-select').value;
    const tbody = document.getElementById('ledger-table-body');
    const closingEl = document.getElementById('ledger-closing-balance');
    if (!tbody) return;

    const fromDate = document.getElementById('ledger-from-date').value;
    const toDate = document.getElementById('ledger-to-date').value;

    let entries = selectedAccount === 'ALL' 
        ? accountsData.journal 
        : accountsData.journal.filter(j => j.account === selectedAccount);

    entries = entries.filter(j => {
        if (fromDate && j.date < fromDate) return false;
        if (toDate && j.date > toDate) return false;
        return true;
    });

    let rowsHtml = [];

    entries.forEach(j => {
        let dr = j.type === 'Debit' ? j.amount : 0;
        let cr = j.type === 'Credit' ? j.amount : 0;

        rowsHtml.push(`
            <tr>
                <td data-label="Date">${j.date}</td>
                <td data-label="Account Head"><strong>${j.account}</strong></td>
                <td data-label="Comments">${j.comments}</td>
                <td data-label="Debit">${dr ? '₹' + dr.toFixed(2) : ''}</td>
                <td data-label="Credit">${cr ? '₹' + cr.toFixed(2) : ''}</td>
            </tr>
        `);
    });

    tbody.innerHTML = rowsHtml.length ? rowsHtml.join('') : `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary); padding: 24px;">No transactions found</td></tr>`;
    
    let totalDr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
    let totalCr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
    closingEl.innerText = `Total Dr: ₹${totalDr.toFixed(2)} | Total Cr: ₹${totalCr.toFixed(2)}`;
}

function renderTrialBalance() {
    const tbody = document.getElementById('trial-table-body');
    const statusEl = document.getElementById('tb-status');
    if (!tbody) return;

    let totalDrAll = 0;
    let totalCrAll = 0;
    let totalBalanceAll = 0;
    let activeRowsCount = 0;

    let rows = [];

    chartOfAccounts.forEach(ac => {
        let entries = accountsData.journal.filter(j => j.account === ac.account);
        let totalDr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
        let totalCr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
        let balance = ac.normal === 'Debit' ? (totalDr - totalCr) : (totalCr - totalDr);

        if (totalDr === 0 && totalCr === 0 && balance === 0) return;

        activeRowsCount++;
        totalDrAll += totalDr;
        totalCrAll += totalCr;
        totalBalanceAll += balance;

        rows.push(`
            <tr>
                <td data-label="Account"><strong>${ac.account}</strong></td>
                <td data-label="Debit">₹${totalDr.toFixed(2)}</td>
                <td data-label="Credit">₹${totalCr.toFixed(2)}</td>
                <td data-label="Balance"><strong>₹${balance.toFixed(2)}</strong></td>
            </tr>
        `);
    });

    if (activeRowsCount === 0) {
        rows.push(`<tr><td colspan="4" style="text-align: center; color: var(--text-secondary); padding: 24px;">No active transactions recorded yet.</td></tr>`);
    } else {
        rows.push(`
            <tr style="background-color: var(--bg-subtle); font-weight: bold; border-top: 2px solid var(--border-color);">
                <td data-label="Account">Grand Total</td>
                <td data-label="Debit">₹${totalDrAll.toFixed(2)}</td>
                <td data-label="Credit">₹${totalCrAll.toFixed(2)}</td>
                <td data-label="Balance">₹${totalBalanceAll.toFixed(2)}</td>
            </tr>
        `);
    }

    tbody.innerHTML = rows.join('');
    
    let isBalanced = Math.abs(totalDrAll - totalCrAll) < 0.01;
    statusEl.innerText = isBalanced ? "Balanced ✅" : "Out of Balance ⚠️";
    statusEl.style.color = isBalanced ? "var(--success)" : "var(--danger)";
}

function getFilteredJournalForPeriod(fromDate, toDate) {
    return accountsData.journal.filter(j => {
        if (fromDate && j.date < fromDate) return false;
        if (toDate && j.date > toDate) return false;
        return true;
    });
}

function getNetProfitLoss(fromDate, toDate) {
    let totalRevenue = 0;
    let totalExpense = 0;
    let periodEntries = getFilteredJournalForPeriod(fromDate, toDate);

    chartOfAccounts.forEach(ac => {
        let entries = periodEntries.filter(j => j.account === ac.account);
        let dr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
        let cr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);

        if (ac.statement === 'Income Statement') {
            let balance = ac.normal === 'Credit' ? (cr - dr) : (dr - cr);
            if (ac.type === 'Revenue') totalRevenue += balance;
            if (ac.type === 'Expense') totalExpense += balance;
        }
    });

    return totalRevenue - totalExpense;
}

function renderIncomeStatement() {
    const revBody = document.getElementById('income-revenue-body');
    const expBody = document.getElementById('income-expense-body');
    const netProfitEl = document.getElementById('net-profit-val');
    if (!revBody || !expBody) return;

    const fromDate = document.getElementById('income-from-date').value;
    const toDate = document.getElementById('income-to-date').value;
    let periodEntries = getFilteredJournalForPeriod(fromDate, toDate);

    let revHtml = [];
    let expHtml = [];
    let totRev = 0;
    let totExp = 0;

    chartOfAccounts.forEach(ac => {
        if (ac.statement === 'Income Statement') {
            let entries = periodEntries.filter(j => j.account === ac.account);
            let dr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
            let cr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
            let balance = ac.normal === 'Credit' ? (cr - dr) : (dr - cr);

            if (balance === 0) return;

            if (ac.type === 'Revenue') {
                totRev += balance;
                revHtml.push(`<tr><td>${ac.account}</td><td>₹${balance.toFixed(2)}</td></tr>`);
            } else if (ac.type === 'Expense') {
                totExp += balance;
                expHtml.push(`<tr><td>${ac.account}</td><td>₹${balance.toFixed(2)}</td></tr>`);
            }
        }
    });

    revBody.innerHTML = revHtml.length ? revHtml.join('') : `<tr><td colspan="2" style="text-align:center; color:var(--text-secondary);">No revenues recorded for this period</td></tr>`;
    expBody.innerHTML = expHtml.length ? expHtml.join('') : `<tr><td colspan="2" style="text-align:center; color:var(--text-secondary);">No expenses recorded for this period</td></tr>`;

    let netProfit = totRev - totExp;
    netProfitEl.innerText = `₹${netProfit.toFixed(2)}`;
    netProfitEl.style.color = netProfit >= 0 ? "var(--success)" : "var(--danger)";
}

function renderBalanceSheet() {
    const assetBody = document.getElementById('bs-assets-body');
    const liabEquityBody = document.getElementById('bs-liab-equity-body');
    const bsStatus = document.getElementById('bs-status');
    if (!assetBody || !liabEquityBody) return;

    const toDate = document.getElementById('balance-to-date').value;
    // Balance Sheet is cumulative up to the 'To' date
    let cumulativeEntries = getFilteredJournalForPeriod('', toDate);

    let assetRows = [];
    let liabEquityRows = [];
    let totalAssets = 0;
    let totalLiabEquity = 0;

    chartOfAccounts.forEach(ac => {
        if (ac.statement === 'Balance Sheet') {
            let entries = cumulativeEntries.filter(j => j.account === ac.account);
            let dr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
            let cr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
            let balance = ac.normal === 'Debit' ? (dr - cr) : (cr - dr);

            if (balance === 0) return;

            if (ac.type === 'Assets') {
                totalAssets += balance;
                assetRows.push(`<tr><td><strong>${ac.account}</strong></td><td>${ac.subAccount}</td><td>₹${balance.toFixed(2)}</td></tr>`);
            } else if (ac.type === 'Liabilities' || ac.type === 'Equity') {
                totalLiabEquity += balance;
                liabEquityRows.push(`<tr><td><strong>${ac.account}</strong></td><td>${ac.subAccount}</td><td>₹${balance.toFixed(2)}</td></tr>`);
            }
        }
    });

    let netProfit = getNetProfitLoss('', toDate);
    totalLiabEquity += netProfit;
    liabEquityRows.push(`<tr><td><strong>Retained Earnings / Net Profit</strong></td><td>Equity</td><td>₹${netProfit.toFixed(2)}</td></tr>`);

    assetBody.innerHTML = assetRows.length ? assetRows.join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">No asset accounts with balance</td></tr>`;
    liabEquityBody.innerHTML = liabEquityRows.length ? liabEquityRows.join('') : `<tr><td colspan="3" style="text-align:center; color:var(--text-secondary);">No liability/equity accounts with balance</td></tr>`;

    let isBalanced = Math.abs(totalAssets - totalLiabEquity) < 0.01;
    bsStatus.innerText = isBalanced ? "Balanced ✅" : "Out of Balance ⚠️";
    bsStatus.style.color = isBalanced ? "var(--success)" : "var(--danger)";
}

function exportCSV(type) {
    let csv = "";
    let filename = `kb_savouries_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'journal') {
        const fromDate = document.getElementById('filter-from-date').value;
        const toDate = document.getElementById('filter-to-date').value;
        let entries = getFilteredJournalForPeriod(fromDate, toDate);
        if (!entries.length) {
            showModal('Export Notice', 'No transaction entries found for export.');
            return;
        }
        csv = "Date,Account,Type,Amount,Comments\n";
        entries.forEach(j => {
            csv += `${j.date},"${j.account}",${j.type},${j.amount},"${j.comments}"\n`;
        });
    } else if (type === 'chart') {
        csv = "Account Name,Sub Account,Type,Normal Balance,Financial Statement\n";
        chartOfAccounts.forEach(ac => {
            csv += `"${ac.account}","${ac.subAccount}","${ac.type}","${ac.normal}","${ac.statement}"\n`;
        });
    } else if (type === 'ledger') {
        const selectedAccount = document.getElementById('ledger-account-select').value;
        const fromDate = document.getElementById('ledger-from-date').value;
        const toDate = document.getElementById('ledger-to-date').value;
        let entries = selectedAccount === 'ALL' ? accountsData.journal : accountsData.journal.filter(j => j.account === selectedAccount);
        entries = entries.filter(j => {
            if (fromDate && j.date < fromDate) return false;
            if (toDate && j.date > toDate) return false;
            return true;
        });
        if (!entries.length) {
            showModal('Export Notice', 'No ledger entries found for export.');
            return;
        }
        csv = "Date,Account Head,Comments,Debit,Credit\n";
        entries.forEach(j => {
            let dr = j.type === 'Debit' ? j.amount : 0;
            let cr = j.type === 'Credit' ? j.amount : 0;
            csv += `${j.date},"${j.account}","${j.comments}",${dr},${cr}\n`;
        });
    } else if (type === 'trial') {
        csv = "Account,Debit,Credit,Balance\n";
        chartOfAccounts.forEach(ac => {
            let entries = accountsData.journal.filter(j => j.account === ac.account);
            let totalDr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
            let totalCr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
            let balance = ac.normal === 'Debit' ? (totalDr - totalCr) : (totalCr - totalDr);
            if (totalDr > 0 || totalCr > 0 || balance !== 0) {
                csv += `"${ac.account}",${totalDr},${totalCr},${balance}\n`;
            }
        });
    } else if (type === 'income') {
        const fromDate = document.getElementById('income-from-date').value;
        const toDate = document.getElementById('income-to-date').value;
        let periodEntries = getFilteredJournalForPeriod(fromDate, toDate);
        csv = "Section,Account Head,Amount\n";
        chartOfAccounts.forEach(ac => {
            if (ac.statement === 'Income Statement') {
                let entries = periodEntries.filter(j => j.account === ac.account);
                let dr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
                let cr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
                let balance = ac.normal === 'Credit' ? (cr - dr) : (dr - cr);
                if (balance !== 0) {
                    csv += `"${ac.type}","${ac.account}",${balance}\n`;
                }
            }
        });
    } else if (type === 'balance') {
        const toDate = document.getElementById('balance-to-date').value;
        let cumulativeEntries = getFilteredJournalForPeriod('', toDate);
        csv = "Section,Account Head,Sub Account,Balance\n";
        chartOfAccounts.forEach(ac => {
            if (ac.statement === 'Balance Sheet') {
                let entries = cumulativeEntries.filter(j => j.account === ac.account);
                let dr = entries.filter(j => j.type === 'Debit').reduce((sum, j) => sum + j.amount, 0);
                let cr = entries.filter(j => j.type === 'Credit').reduce((sum, j) => sum + j.amount, 0);
                let balance = ac.normal === 'Debit' ? (dr - cr) : (cr - dr);
                if (balance !== 0) {
                    csv += `"${ac.type}","${ac.account}","${ac.subAccount}",${balance}\n`;
                }
            }
        });
    }

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    a.click();
}