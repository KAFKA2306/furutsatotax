function updateDependentFields() {
  const salaryIncome = parseFloat(document.getElementById('salaryIncome').value) || 0;
  const spouseIncome = parseFloat(document.getElementById('spouseIncome').value) || 0;
  const sideIncome = parseFloat(document.getElementById('sideIncome').value) || 0;
  const capitalGains = parseFloat(document.getElementById('capitalGains').value) || 0;
  const expenseRate = parseFloat(document.getElementById('expenseRate').value) || 0;
  const businessRevenue = parseFloat((document.getElementById('businessRevenue') || {}).value) || 0;
  const businessExpenses = parseFloat((document.getElementById('businessExpenses') || {}).value) || 0;
  const bookkeepingMethod = ((document.getElementById('bookkeepingMethod') || {}).value) || 'none';
  const useETax = !!(document.getElementById('useETax') || {}).checked;
  const taxYear = parseInt((document.getElementById('taxYear') || {}).value || '2025', 10);
  const socialInsurance = Math.floor(salaryIncome * 0.15);
  document.getElementById('socialInsurance').value = socialInsurance;
  const spouseDeduction = spouseIncome <= 1030000 && spouseIncome > 0 ? 380000 : 0;
  document.getElementById('spouseDeduction').value = spouseDeduction;
  try {
    const employerMonthly = parseFloat((document.getElementById('employerDcMonthly') || {}).value) || 0;
    const hasDb = !!(document.getElementById('hasDb') || {}).checked;
    const months = Math.max(1, Math.min(12, parseInt(((document.getElementById('dcMonths') || {}).value) || '12', 10)));
    const statCap = hasDb ? 27500 : 55000;
    const maxEmployeeMonthly = Math.max(0, Math.min(employerMonthly, Math.max(0, statCap - employerMonthly)));
    const dcMatching = Math.floor(maxEmployeeMonthly * months);
    const dcInput = document.getElementById('dcMatching');
    if (dcInput) dcInput.value = dcMatching;
  } catch(e) {
    console.warn('dc matching auto failed:', e);
  }
  try {
    const salaryDed = salaryDeductionForYear(salaryIncome, taxYear);
    const netSalaryIncome = Math.max(0, salaryIncome - salaryDed);
    const netSideIncome = sideIncome * (1 - expenseRate);
    const bizProfitPre = Math.max(0, businessRevenue - businessExpenses);
    const blueBase = (function(){
      if (bookkeepingMethod === 'double') return useETax ? 650000 : 550000;
      if (bookkeepingMethod === 'simple') return 100000;
      return 0;
    })();
    const blueApplied = Math.min(bizProfitPre, blueBase);
    const businessIncome = bizProfitPre - blueApplied;
    const aggregateIncome = netSalaryIncome + netSideIncome + businessIncome + capitalGains;
    const basic = computeBasicDeductionIncomeTax(aggregateIncome, taxYear);
    const basicInput = document.getElementById('basicDeduction');
    if (basicInput && basicInput.hasAttribute('readonly')) {
      basicInput.value = basic;
    }
  } catch (e) {
    console.warn('updateDependentFields failed (non-fatal):', e);
  }
}
function computeBasicDeductionIncomeTax(aggregateIncome, taxYear) {
  if (aggregateIncome <= 24000000) return 480000;
  if (aggregateIncome <= 24500000) return 320000;
  if (aggregateIncome <= 25000000) return 160000;
  return 0;
}
function computeBasicDeductionResidentTax(aggregateIncome) {
  if (aggregateIncome <= 24000000) return 430000;
  if (aggregateIncome <= 24500000) return 290000;
  if (aggregateIncome <= 25000000) return 150000;
  return 0;
}
function loadPatternDirect() {
  const select = document.getElementById('patternSelect');
  if (!select.value) return;
  const patterns = {
    'a': { salary: 3000000, side: 0, capital: 0, expense: 0, spouse: 0, ideco: 0, small: 0 },
    'b': { salary: 4000000, side: 500000, capital: 0, expense: 0.3, spouse: 1000000, ideco: 144000, small: 0 },
    'c': { salary: 5500000, side: 0, capital: 1000000, expense: 0, spouse: 0, ideco: 276000, small: 700000 },
    'd': { salary: 8000000, side: 1200000, capital: 500000, expense: 0.4, spouse: 0, ideco: 144000, small: 840000 },
    'e': { salary: 6000000, side: 0, capital: 0, expense: 0, spouse: 0, ideco: 0, small: 0 },
    'f': { salary: 7000000, side: 800000, capital: 200000, expense: 0.2, spouse: 1000000, ideco: 0, small: 400000 }
  };
  const data = patterns[select.value];
  if (!data) return;
  document.getElementById('salaryIncome').value = data.salary;
  document.getElementById('sideIncome').value = data.side;
  document.getElementById('capitalGains').value = data.capital;
  document.getElementById('expenseRate').value = data.expense;
  document.getElementById('spouseIncome').value = data.spouse;
  document.getElementById('ideco').value = data.ideco;
  document.getElementById('smallBusiness').value = data.small;
  const bizRev = document.getElementById('businessRevenue');
  const bizExp = document.getElementById('businessExpenses');
  if (bizRev) bizRev.value = 0;
  if (bizExp) bizExp.value = 0;
  const bookSel = document.getElementById('bookkeepingMethod');
  if (bookSel) bookSel.value = 'none';
  const etaxChk = document.getElementById('useETax');
  if (etaxChk) etaxChk.checked = false;
  updateDependentFields();
  console.log('Pattern loaded:', select.value);
  console.log('Pattern data applied successfully');
}
async function loadPattern() {
  const select = document.getElementById('patternSelect');
  if (!select.value) return;
  try {
    console.log('Loading pattern:', select.value);
    const response = await fetch(`data/${select.value}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const yamlText = await response.text();
    console.log('YAML content:', yamlText);
    const data = parseYaml(yamlText);
    console.log('Parsed data:', data);
    const salaryInput = document.getElementById('salaryIncome');
    const sideInput = document.getElementById('sideIncome');
    const capitalInput = document.getElementById('capitalGains');
    const expenseInput = document.getElementById('expenseRate');
    const idecoInput = document.getElementById('ideco');
    const smallBusinessInput = document.getElementById('smallBusiness');
    const spouseIncomeInput = document.getElementById('spouseIncome');
    const bizRevInput = document.getElementById('businessRevenue');
    const bizExpInput = document.getElementById('businessExpenses');
    const bookSel = document.getElementById('bookkeepingMethod');
    const etaxChk = document.getElementById('useETax');
    if (salaryInput) salaryInput.value = data['給与収入'] || 0;
    if (sideInput) sideInput.value = data['副業収入'] || 0;
    if (capitalInput) capitalInput.value = data['投資差益'] || 0;
    if (expenseInput) expenseInput.value = data['経費率'] || 0;
    if (idecoInput) idecoInput.value = data['iDeCo拠出'] || 0;
    if (smallBusinessInput) smallBusinessInput.value = data['小規模企業共済'] || 0;
    if (bizRevInput) bizRevInput.value = data['事業収入'] || 0;
    if (bizExpInput) bizExpInput.value = data['事業経費'] || 0;
    if (bookSel) {
      const method = (data['記帳方法'] || 'none').toString();
      if (method.includes('複')) bookSel.value = 'double';
      else if (method.includes('簡')) bookSel.value = 'simple';
      else bookSel.value = 'none';
    }
    if (etaxChk) {
      const v = (data['e-Tax提出'] || '').toString().trim();
      etaxChk.checked = ['1','true','yes','y','on','有','あり','提出'].includes(v.toLowerCase());
    }
    const spouseDeduction = data['配偶者控除'] || 0;
    const spouseIncome = spouseDeduction > 0 ? 1000000 : 0;
    if (spouseIncomeInput) {
      spouseIncomeInput.value = spouseIncome;
    }
    updateDependentFields();
    console.log('Pattern loaded successfully');
  } catch (error) {
    console.error('Pattern loading failed:', error);
    alert('パターンファイルの読み込みに失敗しました: ' + error.message);
  }
}
function parseYaml(yamlText) {
  const data = {};
  const lines = yamlText.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && trimmed.includes(':') && !trimmed.startsWith('#')) {
      const [key, value] = trimmed.split(':').map(s => s.trim());
      const numValue = parseFloat(value);
      data[key] = isNaN(numValue) ? value : numValue;
    }
  }
  console.log('YAML parsed:', data);
  return data;
}
function salaryDeductionForYear(income, taxYear) {
  if (income <= 1625000) return Math.max(550000, income * 0.4);
  if (income <= 1800000) return income * 0.4 - 100000;
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}
function incomeTaxCalc(taxableIncome) {
  const brackets = [
    [0, 0.05, 0],
    [1950000, 0.1, 97500],
    [3300000, 0.2, 427500],
    [6950000, 0.23, 636000],
    [9000000, 0.33, 1536000],
    [18000000, 0.4, 2796000],
    [40000000, 0.45, 4796000]
  ];
  for (let i = brackets.length - 1; i >= 0; i--) {
    const [threshold, rate, deduction] = brackets[i];
    if (taxableIncome > threshold) {
      return Math.floor(taxableIncome * rate - deduction);
    }
  }
  return 0;
}
function incomeTaxMarginalRate(taxableIncome) {
  if (taxableIncome > 40000000) return 0.45;
  if (taxableIncome > 18000000) return 0.40;
  if (taxableIncome > 9000000) return 0.33;
  if (taxableIncome > 6950000) return 0.23;
  if (taxableIncome > 3300000) return 0.20;
  if (taxableIncome > 1950000) return 0.10;
  if (taxableIncome > 0) return 0.05;
  return 0;
}
function calculate() {
  const taxYear = parseInt((document.getElementById('taxYear') || {}).value || '2025', 10);
  const salaryIncome = parseFloat(document.getElementById('salaryIncome').value) || 0;
  const sideIncome = parseFloat(document.getElementById('sideIncome').value) || 0;
  const capitalGains = parseFloat(document.getElementById('capitalGains').value) || 0;
  const businessRevenue = parseFloat(document.getElementById('businessRevenue').value) || 0;
  const businessExpenses = parseFloat(document.getElementById('businessExpenses').value) || 0;
  const expenseRate = parseFloat(document.getElementById('expenseRate').value) || 0;
  const socialInsurance = parseFloat(document.getElementById('socialInsurance').value) || 0;
  const basicDeduction = parseFloat(document.getElementById('basicDeduction').value) || 480000;
  const spouseDeduction = parseFloat(document.getElementById('spouseDeduction').value) || 0;
  const ideco = parseFloat(document.getElementById('ideco').value) || 0;
  const smallBusiness = parseFloat(document.getElementById('smallBusiness').value) || 0;
  const bookkeepingMethod = ((document.getElementById('bookkeepingMethod') || {}).value) || 'none';
  const useETax = !!(document.getElementById('useETax') || {}).checked;
  const blueDeductionBase = (function(){
    if (bookkeepingMethod === 'double') return useETax ? 650000 : 550000;
    if (bookkeepingMethod === 'simple') return 100000;
    return 0;
  })();
  const dcMatching = parseFloat((document.getElementById('dcMatching') || {}).value) || 0;
  if (salaryIncome === 0 && sideIncome === 0 && capitalGains === 0 && businessRevenue === 0) {
    alert('収入を入力してください');
    return;
  }
  updateDependentFields();
  const steps = [];
  steps.push('■ 所得計算（所得税法第28条・第35条・第33条）');
  const salaryDeductionAmount = salaryDeductionForYear(salaryIncome, taxYear);
  const netSalaryIncome = salaryIncome - salaryDeductionAmount;
  if (salaryIncome > 0) {
    steps.push(`給与所得 = ${formatMoney(salaryIncome)} - ${formatMoney(salaryDeductionAmount)} = ${formatMoney(netSalaryIncome)}`);
  }
  const netSideIncome = sideIncome * (1 - expenseRate);
  if (sideIncome > 0) {
    steps.push(`副業所得 = ${formatMoney(sideIncome)} × (1 - ${(expenseRate*100).toFixed(1)}%) = ${formatMoney(netSideIncome)}`);
  }
  const businessProfitPre = Math.max(0, businessRevenue - businessExpenses);
  const blueApplied = Math.min(businessProfitPre, blueDeductionBase);
  const businessIncome = businessProfitPre - blueApplied;
  if (businessRevenue > 0 || businessExpenses > 0 || blueApplied > 0) {
    steps.push(`事業所得（控除前）= ${formatMoney(Math.max(0, businessRevenue - businessExpenses))}`);
    if (blueApplied > 0) {
      const label = bookkeepingMethod === 'double' ? (useETax ? '65万円' : '55万円') : (bookkeepingMethod === 'simple' ? '10万円' : '0円');
      steps.push(`青色申告特別控除: ${formatMoney(blueApplied)}（種別: ${label}／利益の範囲内で適用）`);
    }
    steps.push(`事業所得（控除後）= ${formatMoney(businessIncome)}`);
  }
  if (capitalGains > 0) {
    steps.push(`投資差益 = ${formatMoney(capitalGains)} ※総合課税として計算`);
  }
  const totalIncome = netSalaryIncome + netSideIncome + businessIncome + capitalGains;
  steps.push(`合計所得 = ${formatMoney(totalIncome)}`);
  steps.push('');
  const totalDeduction = socialInsurance + basicDeduction + spouseDeduction + dcMatching + ideco + smallBusiness;
  steps.push('■ 所得控除（各種控除法に基づく）');
  if (socialInsurance > 0) steps.push(`社会保険料控除: ${formatMoney(socialInsurance)} (厚生年金保険法)`);
  if (basicDeduction > 0) steps.push(`基礎控除: ${formatMoney(basicDeduction)} (所得税法第86条)`);
  if (spouseDeduction > 0) steps.push(`配偶者控除: ${formatMoney(spouseDeduction)} (所得税法第83条)`);
  if (dcMatching > 0) steps.push(`dcマッチング: ${formatMoney(dcMatching)} (確定拠出年金法第55条)`);
  if (ideco > 0) steps.push(`iDeCo: ${formatMoney(ideco)} (確定拠出年金法)`);
  if (smallBusiness > 0) steps.push(`小規模企業共済: ${formatMoney(smallBusiness)} (小規模企業共済法)`);
  steps.push(`所得控除合計 = ${formatMoney(totalDeduction)}`);
  steps.push('');
  const basicResident = computeBasicDeductionResidentTax(totalIncome);
  const totalDeductionIT = totalDeduction;
  const totalDeductionRT = socialInsurance + basicResident + spouseDeduction + dcMatching + ideco + smallBusiness;
  const taxableIncomeIT = Math.max(0, totalIncome - totalDeductionIT);
  const taxableIncomeRT = Math.max(0, totalIncome - totalDeductionRT);
  steps.push('■ 課税所得（所得税法第22条・住民税は所得割ベース）');
  steps.push(`課税所得（所得税）= ${formatMoney(totalIncome)} - ${formatMoney(totalDeductionIT)} = ${formatMoney(taxableIncomeIT)}`);
  steps.push(`課税所得（住民税）= ${formatMoney(totalIncome)} - ${formatMoney(totalDeductionRT)} = ${formatMoney(taxableIncomeRT)}`);
  steps.push('');
  const incomeTax = incomeTaxCalc(taxableIncomeIT);
  const residentTax = Math.floor(taxableIncomeRT * 0.1);
  const totalTax = incomeTax + residentTax;
  steps.push('■ 税額計算（所得税法第89条・地方税法第314条の2）');
  steps.push(`所得税 = ${formatMoney(incomeTax)} (累進税率適用)`);
  steps.push(`住民税 = ${formatMoney(residentTax)} (課税所得(住民税)×10%)`);
  steps.push(`税額合計 = ${formatMoney(totalTax)}`);
  steps.push('');
  const rate = incomeTaxMarginalRate(taxableIncomeIT);
  const denom = Math.max(0.01, 0.9 - rate * 1.021);
  const approxLimit = (residentTax * 0.2) / denom + 2000;
  const limit = Math.floor(approxLimit / 1000) * 1000;
  steps.push('■ ふるさと納税限度額（地方税法第37条の2・近似）');
  steps.push(`上限目安 ≒ (住民税所得割×20%) ÷ (90% − 所得税率×1.021) + 2,000円`);
  steps.push(`= (${formatMoney(residentTax)}×20%) ÷ (90% − ${(rate*100).toFixed(0)}%×1.021) + 2,000円`);
  steps.push(`→ 1000円単位切り下げ: ${formatMoney(limit)}`);
  document.getElementById('limit').textContent = `年間限度額: ${formatMoney(limit)}`;
  document.getElementById('breakdown').innerHTML = steps.map(step => 
    `<div class="step">${step}</div>`
  ).join('');
  document.getElementById('result').style.display = 'block';
  document.getElementById('chartsSection').style.display = 'block';
  renderCharts();
}
function formatMoney(amount) {
  return amount.toLocaleString('ja-JP') + '円';
}
function generateChartData() {
  const taxYear = parseInt((document.getElementById('taxYear') || {}).value || '2025', 10);
  const sideIncome = parseFloat(document.getElementById('sideIncome').value) || 0;
  const capitalGains = parseFloat(document.getElementById('capitalGains').value) || 0;
  const expenseRate = parseFloat(document.getElementById('expenseRate').value) || 0;
  const spouseIncome = parseFloat(document.getElementById('spouseIncome').value) || 0;
  const businessRevenue = parseFloat(document.getElementById('businessRevenue').value) || 0;
  const businessExpenses = parseFloat(document.getElementById('businessExpenses').value) || 0;
  const bookkeepingMethod = ((document.getElementById('bookkeepingMethod') || {}).value) || 'none';
  const useETax = !!(document.getElementById('useETax') || {}).checked;
  const employerDcMonthly = parseFloat((document.getElementById('employerDcMonthly') || {}).value) || 0;
  const hasDb = !!(document.getElementById('hasDb') || {}).checked;
  const dcMonths = Math.max(1, Math.min(12, parseInt(((document.getElementById('dcMonths') || {}).value) || '12', 10)));
  const blueDeduction = (function(){
    if (bookkeepingMethod === 'double') return useETax ? 650000 : 550000;
    if (bookkeepingMethod === 'simple') return 100000;
    return 0;
  })();
  const idecoAmount = parseFloat(document.getElementById('ideco').value) || 0;
  const smallBusinessAmount = parseFloat(document.getElementById('smallBusiness').value) || 0;
  const salaryRange = [];
  const taxWithoutDeductions = [];
  const taxWithDeductions = [];
  const dcMatchingEffects = [];
  const idecoEffects = [];
  const smallBusinessEffects = [];
  const furusatoLimits = [];
  const furusatoLimitsOriginal = [];
  for (let salary = 3000000; salary <= 12000000; salary += 500000) {
    salaryRange.push(salary / 10000);
    const basicCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate, 
                                           spouseIncome, 0, 0, 0, taxYear, businessRevenue, businessExpenses, blueDeduction);
    taxWithoutDeductions.push(basicCalc.totalTax);
    furusatoLimitsOriginal.push(basicCalc.furusatoLimit);
    const statCap = hasDb ? 27500 : 55000;
    const maxEmployeeMonthly = Math.max(0, Math.min(employerDcMonthly, Math.max(0, statCap - employerDcMonthly)));
    const dcMatching = Math.floor(maxEmployeeMonthly * dcMonths);
    const dcCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate,
                                        spouseIncome, dcMatching, idecoAmount, smallBusinessAmount, taxYear, businessRevenue, businessExpenses, blueDeduction);
    dcMatchingEffects.push(basicCalc.totalTax - dcCalc.totalTax);
    const idecoCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate,
                                           spouseIncome, dcMatching, idecoAmount, smallBusinessAmount, taxYear, businessRevenue, businessExpenses, blueDeduction);
    idecoEffects.push(dcCalc.totalTax - idecoCalc.totalTax);
    const smallBusinessCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate,
                                                   spouseIncome, dcMatching, idecoAmount, smallBusinessAmount, taxYear, businessRevenue, businessExpenses, blueDeduction);
    smallBusinessEffects.push(idecoCalc.totalTax - smallBusinessCalc.totalTax);
    taxWithDeductions.push(smallBusinessCalc.totalTax);
    furusatoLimits.push(smallBusinessCalc.furusatoLimit);
  }
  return {
    labels: salaryRange,
    datasets: {
      taxWithoutDeductions,
      taxWithDeductions,
      dcMatchingEffects,
      idecoEffects,
      smallBusinessEffects,
      furusatoLimits,
      furusatoLimitsOriginal
    }
  };
}
function calculateTaxForSalary(salaryIncome, sideIncome, capitalGains, expenseRate, spouseIncome, 
                              dcMatching, ideco, smallBusiness, taxYear,
                              businessRevenue = 0, businessExpenses = 0, blueDeduction = 0) {
  const salaryDeductionAmount = salaryDeductionForYear(salaryIncome, taxYear);
  const netSalaryIncome = salaryIncome - salaryDeductionAmount;
  const netSideIncome = sideIncome * (1 - expenseRate);
  const businessProfitPre = Math.max(0, businessRevenue - businessExpenses);
  const blueApplied = Math.min(businessProfitPre, blueDeduction || 0);
  const businessIncome = businessProfitPre - blueApplied;
  const totalIncome = netSalaryIncome + netSideIncome + businessIncome + capitalGains;
  const socialInsurance = Math.floor(salaryIncome * 0.15);
  const basicDeductionIT = computeBasicDeductionIncomeTax(totalIncome, taxYear);
  const basicDeductionRT = computeBasicDeductionResidentTax(totalIncome);
  const spouseDeduction = spouseIncome <= 1030000 && spouseIncome > 0 ? 380000 : 0;
  const totalDeductionIT = socialInsurance + basicDeductionIT + spouseDeduction + dcMatching + ideco + smallBusiness;
  const totalDeductionRT = socialInsurance + basicDeductionRT + spouseDeduction + dcMatching + ideco + smallBusiness;
  const taxableIncomeIT = Math.max(0, totalIncome - totalDeductionIT);
  const taxableIncomeRT = Math.max(0, totalIncome - totalDeductionRT);
  const incomeTax = incomeTaxCalc(taxableIncomeIT);
  const residentTax = Math.floor(taxableIncomeRT * 0.1);
  const totalTax = incomeTax + residentTax;
  const rate = incomeTaxMarginalRate(taxableIncomeIT);
  const denom = Math.max(0.01, 0.9 - rate * 1.021);
  const approxLimit = (residentTax * 0.2) / denom + 2000;
  const furusatoLimit = Math.floor(approxLimit / 1000) * 1000;
  return {
    totalIncome,
    taxableIncome: taxableIncomeIT,
    incomeTax,
    residentTax,
    totalTax,
    furusatoLimit
  };
}
const CHART_COLORS = {
  primary: '#4299e1',
  tax: '#e53e3e',
  deduction: '#38a169',
  furusato: '#9f7aea',
  dcMatching: '#f56565',
  ideco: '#48bb78',
  smallBusiness: '#ed8936',
  background: 'rgba(247, 250, 252, 0.8)'
};
let taxComparisonChart = null;
let savingsEffectChart = null;
let furusatoChart = null;
function renderCharts() {
  try {
    const data = generateChartData();
    if (typeof Chart !== 'undefined') {
      renderTaxComparisonChart(data);
      renderSavingsEffectChart(data);
      renderFurusatoChart(data);
    } else {
      fallbackRenderTaxComparison(data);
      fallbackRenderSavingsEffect(data);
      fallbackRenderFurusato(data);
    }
  } catch (e) {
    console.error('Chart rendering failed:', e);
  }
}
function getCanvas2D(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const ctx = el.getContext ? el.getContext('2d') : null;
  if (!ctx) return null;
  el.width = el.clientWidth || 800;
  el.height = el.clientHeight || 400;
  return ctx;
}
function fallbackRenderTaxComparison(data) {
  const ctx = getCanvas2D('taxComparisonChart');
  if (!ctx) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  const padding = 40;
  const labels = data.labels;
  const d1 = data.datasets.taxWithoutDeductions;
  const d2 = data.datasets.taxWithDeductions;
  const n = labels.length;
  const maxVal = Math.max(1, ...d1, ...d2);
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(padding, padding); ctx.lineTo(padding, H - padding); ctx.lineTo(W - padding, H - padding); ctx.stroke();
  const plotW = W - padding*2, plotH = H - padding*2;
  const groupW = plotW / n;
  const barW = groupW/3;
  for (let i=0;i<n;i++){
    const x0 = padding + i*groupW;
    const h1 = (d1[i]/maxVal)*plotH;
    ctx.fillStyle = CHART_COLORS.tax || '#e53e3e';
    ctx.fillRect(x0 + barW*0.5, H - padding - h1, barW, h1);
    const h2 = (d2[i]/maxVal)*plotH;
    ctx.fillStyle = CHART_COLORS.deduction || '#38a169';
    ctx.fillRect(x0 + barW*1.8, H - padding - h2, barW, h2);
  }
  ctx.fillStyle = '#555';
  ctx.fillText('税額（相対比較・簡易）', padding, padding - 10);
}
function fallbackRenderSavingsEffect(data) {
  const ctx = getCanvas2D('savingsEffectChart');
  if (!ctx) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  const padding = 40;
  const a = data.datasets.dcMatchingEffects;
  const b = data.datasets.idecoEffects;
  const c = data.datasets.smallBusinessEffects;
  const n = a.length;
  const maxVal = Math.max(1, ...a, ...b, ...c);
  const plotW = W - padding*2, plotH = H - padding*2;
  function drawLine(arr, color){
    ctx.strokeStyle = color; ctx.beginPath();
    for (let i=0;i<n;i++){
      const x = padding + (i/(n-1))*plotW;
      const y = H - padding - (arr[i]/maxVal)*plotH;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(padding, padding); ctx.lineTo(padding, H - padding); ctx.lineTo(W - padding, H - padding); ctx.stroke();
  drawLine(a, CHART_COLORS.dcMatching || '#f56565');
  drawLine(b, CHART_COLORS.ideco || '#48bb78');
  drawLine(c, CHART_COLORS.smallBusiness || '#ed8936');
  ctx.fillStyle = '#555'; ctx.fillText('年間節税額（相対比較・簡易）', padding, padding - 10);
}
function fallbackRenderFurusato(data) {
  const ctx = getCanvas2D('furusatoChart');
  if (!ctx) return;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  ctx.clearRect(0,0,W,H);
  const padding = 40;
  const a = data.datasets.furusatoLimitsOriginal;
  const b = data.datasets.furusatoLimits;
  const n = a.length;
  const maxVal = Math.max(1, ...a, ...b);
  const plotW = W - padding*2, plotH = H - padding*2;
  function drawLine(arr, color){
    ctx.strokeStyle = color; ctx.beginPath();
    for (let i=0;i<n;i++){
      const x = padding + (i/(n-1))*plotW;
      const y = H - padding - (arr[i]/maxVal)*plotH;
      if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.strokeStyle = '#333';
  ctx.beginPath(); ctx.moveTo(padding, padding); ctx.lineTo(padding, H - padding); ctx.lineTo(W - padding, H - padding); ctx.stroke();
  drawLine(a, '#cbd5e0');
  drawLine(b, CHART_COLORS.furusato || '#9f7aea');
  ctx.fillStyle = '#555'; ctx.fillText('ふるさと納税上限（相対比較・簡易）', padding, padding - 10);
}
function renderTaxComparisonChart(data) {
  const ctx = document.getElementById('taxComparisonChart');
  if (!ctx) return;
  if (taxComparisonChart) {
    taxComparisonChart.destroy();
  }
  taxComparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.labels.map(x => `${x}万円`),
      datasets: [
        {
          label: '制度適用前の税額',
          data: data.datasets.taxWithoutDeductions.map(x => Math.round(x / 10000)),
          backgroundColor: CHART_COLORS.tax,
          borderColor: CHART_COLORS.tax,
          borderWidth: 1
        },
        {
          label: '制度適用後の税額',
          data: data.datasets.taxWithDeductions.map(x => Math.round(x / 10000)),
          backgroundColor: CHART_COLORS.deduction,
          borderColor: CHART_COLORS.deduction,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: '📊 給与収入別税額比較（DCマッチング・iDeCo・小規模企業共済満額適用）',
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}万円`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '給与収入', font: { size: 14 } }
        },
        y: {
          title: { display: true, text: '年間税額（万円）', font: { size: 14 } },
          beginAtZero: true
        }
      }
    }
  });
}
function renderSavingsEffectChart(data) {
  const ctx = document.getElementById('savingsEffectChart');
  if (!ctx) return;
  if (savingsEffectChart) {
    savingsEffectChart.destroy();
  }
  savingsEffectChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels.map(x => `${x}万円`),
      datasets: [
        {
          label: 'DCマッチング効果',
          data: data.datasets.dcMatchingEffects.map(x => Math.round(x / 10000)),
          backgroundColor: 'rgba(245, 101, 101, 0.3)',
          borderColor: CHART_COLORS.dcMatching,
          borderWidth: 2,
          fill: true
        },
        {
          label: 'iDeCo効果',
          data: data.datasets.idecoEffects.map(x => Math.round(x / 10000)),
          backgroundColor: 'rgba(72, 187, 120, 0.3)',
          borderColor: CHART_COLORS.ideco,
          borderWidth: 2,
          fill: true
        },
        {
          label: '小規模企業共済効果',
          data: data.datasets.smallBusinessEffects.map(x => Math.round(x / 10000)),
          backgroundColor: 'rgba(237, 137, 54, 0.3)',
          borderColor: CHART_COLORS.smallBusiness,
          borderWidth: 2,
          fill: true
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: '💰 各制度の年間節税効果',
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}万円の節税`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '給与収入', font: { size: 14 } }
        },
        y: {
          title: { display: true, text: '年間節税額（万円）', font: { size: 14 } },
          beginAtZero: true
        }
      }
    }
  });
}
function renderFurusatoChart(data) {
  const ctx = document.getElementById('furusatoChart');
  if (!ctx) return;
  if (furusatoChart) {
    furusatoChart.destroy();
  }
  furusatoChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: data.labels.map(x => `${x}万円`),
      datasets: [
        {
          label: '制度適用前の限度額',
          data: data.datasets.furusatoLimitsOriginal.map(x => Math.round(x / 10000)),
          borderColor: '#cbd5e0',
          backgroundColor: 'rgba(203, 213, 224, 0.1)',
          borderWidth: 2,
          borderDash: [5, 5],
          fill: false
        },
        {
          label: '制度適用後の限度額',
          data: data.datasets.furusatoLimits.map(x => Math.round(x / 10000)),
          borderColor: CHART_COLORS.furusato,
          backgroundColor: 'rgba(159, 122, 234, 0.1)',
          borderWidth: 3,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: '🎁 ふるさと納税限度額の変化',
          font: { size: 16, weight: 'bold' },
          padding: 20
        },
        legend: {
          position: 'top',
          labels: { usePointStyle: true, padding: 15 }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return `${context.dataset.label}: ${context.parsed.y}万円`;
            }
          }
        }
      },
      scales: {
        x: {
          title: { display: true, text: '給与収入', font: { size: 14 } }
        },
        y: {
          title: { display: true, text: 'ふるさと納税限度額（万円）', font: { size: 14 } },
          beginAtZero: true
        }
      }
    }
  });
}
function setupChartControls() {
  document.getElementById('toggleTaxChart').addEventListener('click', function() {
    showChart('tax');
    updateToggleButtons('toggleTaxChart');
  });
  document.getElementById('toggleSavingsChart').addEventListener('click', function() {
    showChart('savings');
    updateToggleButtons('toggleSavingsChart');
  });
  document.getElementById('toggleFurusatoChart').addEventListener('click', function() {
    showChart('furusato');
    updateToggleButtons('toggleFurusatoChart');
  });
  document.getElementById('updateCharts').addEventListener('click', function() {
    if (document.getElementById('chartsSection').style.display !== 'none') {
      renderCharts();
    }
  });
}
function showChart(chartType) {
  document.getElementById('taxChartContainer').style.display = 'none';
  document.getElementById('savingsChartContainer').style.display = 'none';
  document.getElementById('furusatoChartContainer').style.display = 'none';
  const containers = {
    'tax': 'taxChartContainer',
    'savings': 'savingsChartContainer',
    'furusato': 'furusatoChartContainer'
  };
  if (containers[chartType]) {
    document.getElementById(containers[chartType]).style.display = 'block';
  }
}
function updateToggleButtons(activeId) {
  const buttons = ['toggleTaxChart', 'toggleSavingsChart', 'toggleFurusatoChart'];
  buttons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.toggle('inactive', id !== activeId);
    }
  });
}
document.addEventListener('DOMContentLoaded', function() {
  const select = document.getElementById('patternSelect');
  if (select) {
    select.addEventListener('change', loadPatternDirect);
  }
  const yearSel = document.getElementById('taxYear');
  if (yearSel) {
    yearSel.addEventListener('change', updateDependentFields);
  }
  const calcButton = document.getElementById('calcButton');
  if (calcButton) {
    calcButton.addEventListener('click', function(e){
      e.preventDefault();
      calculate();
    });
  }
  const onInputIds = ['salaryIncome','sideIncome','capitalGains','expenseRate','spouseIncome','businessRevenue','businessExpenses'];
  onInputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', updateDependentFields);
  });
  const onChangeIds = ['bookkeepingMethod','useETax'];
  onChangeIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateDependentFields);
  });
  setupChartControls();
  updateToggleButtons('toggleTaxChart');
  updateDependentFields();
});
