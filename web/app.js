// 従属関係に基づく自動更新
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
  
  // 法的根拠に基づく自動計算
  
  // 1. 社会保険料（概算）- 厚生年金保険法
  const socialInsurance = Math.floor(salaryIncome * 0.15);
  document.getElementById('socialInsurance').value = socialInsurance;
  
  // 2. 配偶者控除 - 所得税法第83条
  const spouseDeduction = spouseIncome <= 1030000 && spouseIncome > 0 ? 380000 : 0;
  document.getElementById('spouseDeduction').value = spouseDeduction;
  
  // 3. dcマッチング拠出 - 確定拠出年金法第55条
  const dcMatching = Math.min(salaryIncome * 0.05, 660000);
  document.getElementById('dcMatching').value = dcMatching;

  // 4. 基礎控除（所得税側の自動判定）- 合計所得金額と年分に応じて判定
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

// 所得税の基礎控除（簡易版・年分対応）
function computeBasicDeductionIncomeTax(aggregateIncome, taxYear) {
  // 現行制度（令和2年分以降）: 48万/32万/16万/0（閾値: 2400/2450/2500万円）
  if (aggregateIncome <= 24000000) return 480000;
  if (aggregateIncome <= 24500000) return 320000;
  if (aggregateIncome <= 25000000) return 160000;
  return 0;
}

// 住民税の基礎控除（現行: 令和2年度以降）
function computeBasicDeductionResidentTax(aggregateIncome) {
  if (aggregateIncome <= 24000000) return 430000;
  if (aggregateIncome <= 24500000) return 290000;
  if (aggregateIncome <= 25000000) return 150000;
  return 0;
}

// 直接パターンデータ設定
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
  
  // 値設定
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
  
  // 従属フィールドを更新
  updateDependentFields();
  
  console.log('Pattern loaded:', select.value);
  console.log('Pattern data applied successfully');
}

// YAMLパターンファイル読み込み（バックアップ）
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
    
    // 基礎データ設定
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
    
    // 配偶者情報から配偶者控除を逆算
    const spouseDeduction = data['配偶者控除'] || 0;
    const spouseIncome = spouseDeduction > 0 ? 1000000 : 0; // 103万以下と仮定
    if (spouseIncomeInput) {
      spouseIncomeInput.value = spouseIncome;
    }
    
    // 従属フィールドを更新
    updateDependentFields();
    
    console.log('Pattern loaded successfully');
    
  } catch (error) {
    console.error('Pattern loading failed:', error);
    alert('パターンファイルの読み込みに失敗しました: ' + error.message);
  }
}

// 簡易YAML解析
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

// 給与所得控除計算（簡易・年分対応）
function salaryDeductionForYear(income, taxYear) {
  // 現行制度（令和2年分以降）
  // 国税庁 No.1410 給与所得控除: 下限55万円、上限195万円
  if (income <= 1625000) return Math.max(550000, income * 0.4);
  if (income <= 1800000) return income * 0.4 - 100000;
  if (income <= 3600000) return income * 0.3 + 80000;
  if (income <= 6600000) return income * 0.2 + 440000;
  if (income <= 8500000) return income * 0.1 + 1100000;
  return 1950000;
}

// 所得税計算（所得税法第89条・2023年税制）
function incomeTaxCalc(taxableIncome) {
  const brackets = [
    [0, 0.05, 0],           // ~195万: 5%
    [1950000, 0.1, 97500],  // ~330万: 10%
    [3300000, 0.2, 427500], // ~695万: 20%
    [6950000, 0.23, 636000], // ~900万: 23%
    [9000000, 0.33, 1536000], // ~1800万: 33%
    [18000000, 0.4, 2796000], // ~4000万: 40%
    [40000000, 0.45, 4796000] // 4000万超: 45%
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
  // 限界税率のみ返す（復興特別所得税は別途乗算）
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
  // フォームから入力値取得
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
  
  // dcマッチング拠出は法定上限で自動計算
  const dcMatching = Math.min(salaryIncome * 0.05, 660000);

  if (salaryIncome === 0 && sideIncome === 0 && capitalGains === 0 && businessRevenue === 0) {
    alert('収入を入力してください');
    return;
  }

  // 最新の従属フィールドを更新
  updateDependentFields();

  // 計算過程（法的根拠付き）
  const steps = [];
  
  // 1. 各収入の所得計算
  steps.push('■ 所得計算（所得税法第28条・第35条・第33条）');
  
  // 給与所得
  const salaryDeductionAmount = salaryDeductionForYear(salaryIncome, taxYear);
  const netSalaryIncome = salaryIncome - salaryDeductionAmount;
  if (salaryIncome > 0) {
    steps.push(`給与所得 = ${formatMoney(salaryIncome)} - ${formatMoney(salaryDeductionAmount)} = ${formatMoney(netSalaryIncome)}`);
  }
  
  // 副業所得（雑所得）
  const netSideIncome = sideIncome * (1 - expenseRate);
  if (sideIncome > 0) {
    steps.push(`副業所得 = ${formatMoney(sideIncome)} × (1 - ${(expenseRate*100).toFixed(1)}%) = ${formatMoney(netSideIncome)}`);
  }
  
  // 事業所得（青色申告特別控除を適用）
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

  // 投資差益（総合課税）
  if (capitalGains > 0) {
    steps.push(`投資差益 = ${formatMoney(capitalGains)} ※総合課税として計算`);
  }
  
  const totalIncome = netSalaryIncome + netSideIncome + businessIncome + capitalGains;
  steps.push(`合計所得 = ${formatMoney(totalIncome)}`);
  steps.push('');

  // 2. 所得控除計算（各法的根拠付き）
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

  // 3. 課税所得計算
  const basicResident = computeBasicDeductionResidentTax(totalIncome);
  const totalDeductionIT = totalDeduction; // 表示用（所得税側の基礎控除）
  const totalDeductionRT = socialInsurance + basicResident + spouseDeduction + dcMatching + ideco + smallBusiness;
  const taxableIncomeIT = Math.max(0, totalIncome - totalDeductionIT);
  const taxableIncomeRT = Math.max(0, totalIncome - totalDeductionRT);
  steps.push('■ 課税所得（所得税法第22条・住民税は所得割ベース）');
  steps.push(`課税所得（所得税）= ${formatMoney(totalIncome)} - ${formatMoney(totalDeductionIT)} = ${formatMoney(taxableIncomeIT)}`);
  steps.push(`課税所得（住民税）= ${formatMoney(totalIncome)} - ${formatMoney(totalDeductionRT)} = ${formatMoney(taxableIncomeRT)}`);
  steps.push('');

  // 4. 税額計算
  const incomeTax = incomeTaxCalc(taxableIncomeIT);
  const residentTax = Math.floor(taxableIncomeRT * 0.1); // 住民税10%（概算）
  const totalTax = incomeTax + residentTax;
  
  steps.push('■ 税額計算（所得税法第89条・地方税法第314条の2）');
  steps.push(`所得税 = ${formatMoney(incomeTax)} (累進税率適用)`);
  steps.push(`住民税 = ${formatMoney(residentTax)} (課税所得(住民税)×10%)`);
  steps.push(`税額合計 = ${formatMoney(totalTax)}`);
  steps.push('');

  // 5. ふるさと納税限度額計算（近似式）
  // 上限目安 ≒ {(住民税所得割額×20%) ÷ (90% − 所得税率×1.021)} + 2,000円
  const rate = incomeTaxMarginalRate(taxableIncomeIT);
  const denom = Math.max(0.01, 0.9 - rate * 1.021);
  const approxLimit = (residentTax * 0.2) / denom + 2000;
  const limit = Math.floor(approxLimit / 1000) * 1000;
  steps.push('■ ふるさと納税限度額（地方税法第37条の2・近似）');
  steps.push(`上限目安 ≒ (住民税所得割×20%) ÷ (90% − 所得税率×1.021) + 2,000円`);
  steps.push(`= (${formatMoney(residentTax)}×20%) ÷ (90% − ${(rate*100).toFixed(0)}%×1.021) + 2,000円`);
  steps.push(`→ 1000円単位切り下げ: ${formatMoney(limit)}`);

  // 結果表示
  document.getElementById('limit').textContent = `年間限度額: ${formatMoney(limit)}`;
  document.getElementById('breakdown').innerHTML = steps.map(step => 
    `<div class="step">${step}</div>`
  ).join('');
  document.getElementById('result').style.display = 'block';
  
  // グラフセクションを表示
  document.getElementById('chartsSection').style.display = 'block';
  
  // 初回グラフ描画
  renderCharts();
}

function formatMoney(amount) {
  return amount.toLocaleString('ja-JP') + '円';
}

// グラフ用データ生成関数
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
  
  // 給与収入レンジ：300万〜1200万円（50万円刻み）
  for (let salary = 3000000; salary <= 12000000; salary += 500000) {
    salaryRange.push(salary / 10000); // 万円単位で表示
    
    // 基本計算（制度適用なし）
    const basicCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate, 
                                           spouseIncome, 0, 0, 0, taxYear, businessRevenue, businessExpenses, blueDeduction);
    taxWithoutDeductions.push(basicCalc.totalTax);
    furusatoLimitsOriginal.push(basicCalc.furusatoLimit);
    
    // DCマッチング満額適用
    const dcMatching = Math.min(salary * 0.05, 660000);
    const dcCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate,
                                        spouseIncome, dcMatching, idecoAmount, smallBusinessAmount, taxYear, businessRevenue, businessExpenses, blueDeduction);
    
    // 各制度の節税効果計算
    dcMatchingEffects.push(basicCalc.totalTax - dcCalc.totalTax);
    
    // iDeCo効果（DCマッチング込み）
    const idecoCalc = calculateTaxForSalary(salary, sideIncome, capitalGains, expenseRate,
                                           spouseIncome, dcMatching, idecoAmount, smallBusinessAmount, taxYear, businessRevenue, businessExpenses, blueDeduction);
    idecoEffects.push(dcCalc.totalTax - idecoCalc.totalTax);
    
    // 小規模企業共済効果（DCマッチング+iDeCo込み）
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

// 給与収入に対する税額計算（内部関数）
function calculateTaxForSalary(salaryIncome, sideIncome, capitalGains, expenseRate, spouseIncome, 
                              dcMatching, ideco, smallBusiness, taxYear,
                              businessRevenue = 0, businessExpenses = 0, blueDeduction = 0) {
  // 所得計算
  const salaryDeductionAmount = salaryDeductionForYear(salaryIncome, taxYear);
  const netSalaryIncome = salaryIncome - salaryDeductionAmount;
  const netSideIncome = sideIncome * (1 - expenseRate);
  const businessProfitPre = Math.max(0, businessRevenue - businessExpenses);
  const blueApplied = Math.min(businessProfitPre, blueDeduction || 0);
  const businessIncome = businessProfitPre - blueApplied;
  const totalIncome = netSalaryIncome + netSideIncome + businessIncome + capitalGains;
  
  // 控除計算
  const socialInsurance = Math.floor(salaryIncome * 0.15);
  const basicDeductionIT = computeBasicDeductionIncomeTax(totalIncome, taxYear);
  const basicDeductionRT = computeBasicDeductionResidentTax(totalIncome);
  const spouseDeduction = spouseIncome <= 1030000 && spouseIncome > 0 ? 380000 : 0;
  const totalDeductionIT = socialInsurance + basicDeductionIT + spouseDeduction + dcMatching + ideco + smallBusiness;
  const totalDeductionRT = socialInsurance + basicDeductionRT + spouseDeduction + dcMatching + ideco + smallBusiness;
  
  // 課税所得・税額計算
  const taxableIncomeIT = Math.max(0, totalIncome - totalDeductionIT);
  const taxableIncomeRT = Math.max(0, totalIncome - totalDeductionRT);
  const incomeTax = incomeTaxCalc(taxableIncomeIT);
  const residentTax = Math.floor(taxableIncomeRT * 0.1);
  const totalTax = incomeTax + residentTax;
  
  // ふるさと納税限度額（近似式）
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

// Chart.js用カラーパレット
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

// グラフインスタンス保持用
let taxComparisonChart = null;
let savingsEffectChart = null;
let furusatoChart = null;

// 3つのグラフを描画
function renderCharts() {
  try {
    if (typeof Chart === 'undefined') {
      // Chart.js 未ロード時はグラフ描画をスキップ（計算結果表示は維持）
      return;
    }
    const data = generateChartData();
    // 1. 税額比較グラフ（積み上げ棒グラフ）
    renderTaxComparisonChart(data);
    // 2. 節税効果グラフ（エリアグラフ）
    renderSavingsEffectChart(data);
    // 3. ふるさと納税限度額グラフ（線グラフ）
    renderFurusatoChart(data);
  } catch (e) {
    console.error('Chart rendering failed:', e);
    // グラフ描画の失敗は致命的ではないため、黙ってスキップ
  }
}

// 1. 税額比較グラフ
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

// 2. 節税効果グラフ
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

// 3. ふるさと納税限度額グラフ
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

// グラフ表示制御
function setupChartControls() {
  // グラフ切り替えボタン
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
  
  // グラフ更新ボタン
  document.getElementById('updateCharts').addEventListener('click', function() {
    if (document.getElementById('chartsSection').style.display !== 'none') {
      renderCharts();
    }
  });
}

function showChart(chartType) {
  // すべてのグラフコンテナを非表示
  document.getElementById('taxChartContainer').style.display = 'none';
  document.getElementById('savingsChartContainer').style.display = 'none';
  document.getElementById('furusatoChartContainer').style.display = 'none';
  
  // 選択されたグラフを表示
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
  // すべてのトグルボタンを非アクティブに
  const buttons = ['toggleTaxChart', 'toggleSavingsChart', 'toggleFurusatoChart'];
  buttons.forEach(id => {
    const btn = document.getElementById(id);
    if (btn) {
      btn.classList.toggle('inactive', id !== activeId);
    }
  });
}

// 初期化時にイベントをバインド（CSP下でのinline禁止にも対応）
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
  // 入力変更で自動反映（主要フィールド）
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
  
  // グラフコントロールセットアップ
  setupChartControls();
  
  // デフォルトで税額比較グラフを選択
  updateToggleButtons('toggleTaxChart');
  
  updateDependentFields();
});
