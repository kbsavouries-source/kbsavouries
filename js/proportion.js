// Default seed data (Persists and updates automatically in localStorage)
const defaultDatabase = {
  "Poha Crunch": [
    { name: "Thin Poha (Flattened Rice)", percentage: 65.0 },
    { name: "Roasted Peanuts", percentage: 15.0 },
    { name: "Roasted Channa Dal", percentage: 8.0 },
    { name: "Edible Oil", percentage: 6.0 },
    { name: "Curry Leaves & Seasoning", percentage: 6.0 }
  ],
  "Sunnundalu": [
    { name: "Whole Urad Dal", percentage: 60.0 },
    { name: "Jaggery Powder", percentage: 35.0 },
    { name: "Pure Ghee", percentage: 5.0 }
  ]
};

let database = {};
let currentProductName = "";

document.addEventListener('DOMContentLoaded', () => {
  loadDatabase();
  populateProductDropdown();
  loadSelectedProduct();
});

// Load from LocalStorage or seed defaults
function loadDatabase() {
  const saved = localStorage.getItem('kb_bom_database');
  if (saved) {
    try {
      database = JSON.parse(saved);
    } catch (e) {
      database = defaultDatabase;
    }
  } else {
    database = defaultDatabase;
    saveDatabase();
  }
}

function saveDatabase() {
  localStorage.setItem('kb_bom_database', JSON.stringify(database));
}

// Populate product dropdown
function populateProductDropdown() {
  const select = document.getElementById('productSelect');
  select.innerHTML = '';
  
  const products = Object.keys(database);
  if (products.length === 0) {
    database["Sample Product"] = [{ name: "Raw Material 1", percentage: 100 }];
    saveDatabase();
  }

  Object.keys(database).forEach(product => {
    const opt = document.createElement('option');
    opt.value = product;
    opt.textContent = product;
    select.appendChild(opt);
  });

  if (!currentProductName || !database[currentProductName]) {
    currentProductName = Object.keys(database)[0];
  }
  select.value = currentProductName;
}

// Load selected product recipe
function loadSelectedProduct() {
  const select = document.getElementById('productSelect');
  currentProductName = select.value;
  document.getElementById('recipeTitle').textContent = `Recipe Mapping for "${currentProductName}"`;
  calculateProportions();
}

// Add New Product
function promptAddProduct() {
  const name = prompt("Enter new Finished Inventory Product Name:");
  if (name && name.trim()) {
    const cleanName = name.trim();
    if (!database[cleanName]) {
      database[cleanName] = [
        { name: "Base Raw Material", percentage: 80 },
        { name: "Secondary Material", percentage: 20 }
      ];
      saveDatabase();
      currentProductName = cleanName;
      populateProductDropdown();
      loadSelectedProduct();
    } else {
      alert("Product already exists.");
    }
  }
}

// Delete Current Product
function deleteCurrentProduct() {
  const products = Object.keys(database);
  if (products.length <= 1) {
    alert("You must keep at least one finished inventory product.");
    return;
  }

  if (confirm(`Are you sure you want to delete "${currentProductName}"?`)) {
    delete database[currentProductName];
    saveDatabase();
    currentProductName = Object.keys(database)[0];
    populateProductDropdown();
    loadSelectedProduct();
  }
}

// Render Table & Calculate Yields
function calculateProportions() {
  const targetWeight = parseFloat(document.getElementById('targetWeight').value) || 0;
  const unit = document.getElementById('weightUnit').value;
  const tableBody = document.getElementById('ingredientTableBody');
  const validationBadge = document.getElementById('validationBadge');
  
  const totalInGrams = unit === 'kg' ? targetWeight * 1000 : targetWeight;

  tableBody.innerHTML = '';
  let totalPercent = 0;

  const recipe = database[currentProductName] || [];

  recipe.forEach((ing, index) => {
    totalPercent += ing.percentage;
    const itemGrams = totalInGrams * (ing.percentage / 100);

    let displayQty = unit === 'kg' 
      ? `${(itemGrams / 1000).toFixed(3)} kg (${itemGrams.toFixed(1)} g)` 
      : `${itemGrams.toFixed(1)} g`;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>
        <input type="text" class="input-cell" value="${ing.name}" onchange="updateIngredientName(${index}, this.value)">
      </td>
      <td>
        <input type="number" class="ratio-cell" value="${ing.percentage}" step="0.1" min="0" max="100" onchange="updateIngredientPercent(${index}, this.value)"> %
      </td>
      <td><strong>${displayQty}</strong></td>
      <td style="text-align: center;">
        <button type="button" class="btn-delete" onclick="deleteIngredient(${index})">Delete</button>
      </td>
    `;
    tableBody.appendChild(row);
  });

  document.getElementById('totalPercentDisplay').textContent = `${totalPercent.toFixed(1)}%`;
  
  if (unit === 'kg') {
    document.getElementById('totalYieldDisplay').textContent = `${targetWeight.toFixed(2)} KG (${totalInGrams.toFixed(0)} g)`;
  } else {
    document.getElementById('totalYieldDisplay').textContent = `${targetWeight.toFixed(0)} g (${(targetWeight / 1000).toFixed(3)} KG)`;
  }

  if (Math.abs(totalPercent - 100) > 0.01) {
    validationBadge.className = 'badge badge-invalid';
    validationBadge.textContent = `⚠ ${totalPercent.toFixed(1)}% (Must = 100%)`;
  } else {
    validationBadge.className = 'badge badge-valid';
    validationBadge.textContent = '✓ 100% Ratio Valid';
  }
}

// Inline editing handlers
function updateIngredientName(index, val) {
  if (database[currentProductName] && database[currentProductName][index]) {
    database[currentProductName][index].name = val;
    saveDatabase();
  }
}

function updateIngredientPercent(index, val) {
  const num = parseFloat(val);
  if (!isNaN(num) && database[currentProductName] && database[currentProductName][index]) {
    database[currentProductName][index].percentage = num;
    saveDatabase();
    calculateProportions();
  }
}

function addIngredient() {
  const nameInput = document.getElementById('newIngName');
  const percentInput = document.getElementById('newIngPercent');

  const name = nameInput.value.trim();
  const percentage = parseFloat(percentInput.value);

  if (!name || isNaN(percentage)) {
    alert("Please enter a valid ingredient name and ratio percentage.");
    return;
  }

  database[currentProductName].push({ name, percentage });
  saveDatabase();

  nameInput.value = '';
  percentInput.value = '';
  calculateProportions();
}

function deleteIngredient(index) {
  database[currentProductName].splice(index, 1);
  saveDatabase();
  calculateProportions();
}