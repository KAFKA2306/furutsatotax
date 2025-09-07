// Minimal UI simulation to reproduce auto-calculation without a browser
const fs = require('fs');
const vm = require('vm');

class Element {
  constructor(id, value = '', readonly = false, type = 'input') {
    this.id = id;
    this.value = value;
    this.readonly = readonly;
    this.type = type;
    this.checked = false;
  }
  hasAttribute(attr) {
    return attr === 'readonly' ? !!this.readonly : false;
  }
  addEventListener() {
    // no-op in simulation
  }
}

class DocumentMock {
  constructor() {
    this.map = new Map();
  }
  add(id, value = '', readonly = false, type = 'input') {
    const el = new Element(id, value, readonly, type);
    this.map.set(id, el);
    return el;
  }
  getElementById(id) {
    return this.map.get(id);
  }
  addEventListener() { /* noop */ }
}

function setupScenario({
  salary = 6000000,
  side = 0,
  capital = 0,
  expenseRate = 0,
  spouseIncome = 0,
  businessRevenue = 1200000,
  businessExpenses = 300000,
  bookkeeping = 'double',
  useETax = true,
  taxYear = 2025,
}) {
  const document = new DocumentMock();
  // inputs
  document.add('salaryIncome', String(salary));
  document.add('sideIncome', String(side));
  document.add('capitalGains', String(capital));
  document.add('expenseRate', String(expenseRate));
  document.add('spouseIncome', String(spouseIncome));
  document.add('businessRevenue', String(businessRevenue));
  document.add('businessExpenses', String(businessExpenses));
  const bookSel = document.add('bookkeepingMethod', bookkeeping, false, 'select');
  bookSel.value = bookkeeping;
  const etax = document.add('useETax', '', false, 'checkbox');
  etax.checked = !!useETax;
  const taxYearSel = document.add('taxYear', String(taxYear), false, 'select');
  taxYearSel.value = String(taxYear);
  // outputs (auto)
  document.add('socialInsurance', '0', true);
  document.add('spouseDeduction', '0', true);
  document.add('dcMatching', '0', true);
  document.add('basicDeduction', '480000', true);
  // result containers
  document.add('limit', '');
  document.add('breakdown', '');
  document.add('result', '');
  document.add('chartsSection', '');
  return document;
}

function loadApp(context) {
  const code = fs.readFileSync('web/app.js', 'utf8');
  vm.createContext(context);
  vm.runInContext(code, context);
}

function run() {
  const document = setupScenario({});
  const window = {};
  const context = { document, window, console };
  loadApp(context);
  // call updateDependentFields
  if (typeof context.updateDependentFields !== 'function') {
    throw new Error('updateDependentFields not found');
  }
  context.updateDependentFields();
  const out = {
    socialInsurance: document.getElementById('socialInsurance').value,
    spouseDeduction: document.getElementById('spouseDeduction').value,
    dcMatching: document.getElementById('dcMatching').value,
    basicDeduction: document.getElementById('basicDeduction').value,
  };
  console.log('AUTO_FIELDS', JSON.stringify(out));
}

run();

