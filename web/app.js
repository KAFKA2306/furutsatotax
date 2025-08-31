// YAMLパターンファイル読み込み
async function loadPattern() {
  const select = document.getElementById('patternSelect');
  if (!select.value) return;
  
  try {
    const response = await fetch(`data/${select.value}`);
    const yamlText = await response.text();
    const data = parseYaml(yamlText);
    
    // フォームに値を設定
    document.getElementById('salaryIncome').value = data['給与収入'] || 0;
    document.getElementById('sideIncome').value = data['副業収入'] || 0;
    document.getElementById('capitalGains').value = data['投資差益'] || 0;
    document.getElementById('expenseRate').value = data['経費率'] || 0;
    document.getElementById('socialInsurance').value = data['社会保険料'] || 0;
    document.getElementById('basicDeduction').value = data['基礎控除'] || 480000;
    document.getElementById('spouseDeduction').value = data['配偶者控除'] || 0;
    document.getElementById('dcMatching').value = data['dcマッチング拠出'] || 0;
    document.getElementById('ideco').value = data['iDeCo拠出'] || 0;
    document.getElementById('smallBusiness').value = data['小規模企業共済'] || 0;
    
  } catch (error) {
    alert('パターンファイルの読み込みに失敗しました: ' + error.message);
  }
}

// 簡易YAML解析
function parseYaml(yamlText) {
  const data = {};
  const lines = yamlText.split('\\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex !== -1) {
        const key = trimmed.substring(0, colonIndex).trim();
        const value = trimmed.substring(colonIndex + 1).trim();
        data[key] = isNaN(Number(value)) ? value : Number(value);
      }
    }
  }
  
  return data;
}

// 給与所得控除計算（2023年税制）
function salaryDeduction(income) {
  if (income <= 1625000) return Math.max(550000, income * 0.4);
  if (income <= 1800000) return income * 0.4 + 100000;
  if (income <= 3600000) return income * 0.3 + 280000;
  if (income <= 6600000) return income * 0.2 + 640000;
  if (income <= 8500000) return income * 0.1 + 1300000;
  return 1950000;
}

// 所得税計算（2023年税制）
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

function calculate() {
  // フォームから入力値取得
  const salaryIncome = parseFloat(document.getElementById('salaryIncome').value) || 0;
  const sideIncome = parseFloat(document.getElementById('sideIncome').value) || 0;
  const capitalGains = parseFloat(document.getElementById('capitalGains').value) || 0;
  const expenseRate = parseFloat(document.getElementById('expenseRate').value) || 0;
  const socialInsurance = parseFloat(document.getElementById('socialInsurance').value) || 0;
  const basicDeduction = parseFloat(document.getElementById('basicDeduction').value) || 480000;
  const spouseDeduction = parseFloat(document.getElementById('spouseDeduction').value) || 0;
  const dcMatching = parseFloat(document.getElementById('dcMatching').value) || 0;
  const ideco = parseFloat(document.getElementById('ideco').value) || 0;
  const smallBusiness = parseFloat(document.getElementById('smallBusiness').value) || 0;

  if (salaryIncome === 0 && sideIncome === 0 && capitalGains === 0) {
    alert('収入を入力してください');
    return;
  }

  // 計算過程
  const steps = [];
  
  // 1. 各収入の所得計算
  steps.push('■ 所得計算');
  
  // 給与所得
  const salaryDeductionAmount = salaryDeduction(salaryIncome);
  const netSalaryIncome = salaryIncome - salaryDeductionAmount;
  if (salaryIncome > 0) {
    steps.push(`給与所得 = ${formatMoney(salaryIncome)} - ${formatMoney(salaryDeductionAmount)} = ${formatMoney(netSalaryIncome)}`);
  }
  
  // 副業所得（雑所得）
  const netSideIncome = sideIncome * (1 - expenseRate);
  if (sideIncome > 0) {
    steps.push(`副業所得 = ${formatMoney(sideIncome)} × (1 - ${(expenseRate*100).toFixed(1)}%) = ${formatMoney(netSideIncome)}`);
  }
  
  // 投資差益（申告分離課税として扱わない場合）
  if (capitalGains > 0) {
    steps.push(`投資差益 = ${formatMoney(capitalGains)}`);
  }
  
  const totalIncome = netSalaryIncome + netSideIncome + capitalGains;
  steps.push(`合計所得 = ${formatMoney(totalIncome)}`);
  steps.push('');

  // 2. 所得控除計算
  const totalDeduction = socialInsurance + basicDeduction + spouseDeduction + dcMatching + ideco + smallBusiness;
  
  steps.push('■ 所得控除');
  if (socialInsurance > 0) steps.push(`社会保険料控除: ${formatMoney(socialInsurance)}`);
  if (basicDeduction > 0) steps.push(`基礎控除: ${formatMoney(basicDeduction)}`);
  if (spouseDeduction > 0) steps.push(`配偶者控除: ${formatMoney(spouseDeduction)}`);
  if (dcMatching > 0) steps.push(`dcマッチング: ${formatMoney(dcMatching)}`);
  if (ideco > 0) steps.push(`iDeCo: ${formatMoney(ideco)}`);
  if (smallBusiness > 0) steps.push(`小規模企業共済: ${formatMoney(smallBusiness)}`);
  steps.push(`所得控除合計 = ${formatMoney(totalDeduction)}`);
  steps.push('');

  // 3. 課税所得計算
  const taxableIncome = Math.max(0, totalIncome - totalDeduction);
  steps.push('■ 課税所得');
  steps.push(`課税所得 = ${formatMoney(totalIncome)} - ${formatMoney(totalDeduction)} = ${formatMoney(taxableIncome)}`);
  steps.push('');

  // 4. 税額計算
  const incomeTax = incomeTaxCalc(taxableIncome);
  const residentTax = Math.floor(taxableIncome * 0.1); // 住民税10%（概算）
  const totalTax = incomeTax + residentTax;
  
  steps.push('■ 税額計算');
  steps.push(`所得税 = ${formatMoney(incomeTax)}`);
  steps.push(`住民税 = ${formatMoney(residentTax)} (課税所得×10%)`);
  steps.push(`税額合計 = ${formatMoney(totalTax)}`);
  steps.push('');

  // 5. ふるさと納税限度額計算
  const limit = Math.floor((totalTax * 0.2) / 1000) * 1000;
  steps.push('■ ふるさと納税限度額');
  steps.push(`限度額 = ${formatMoney(totalTax)} × 20% = ${formatMoney(totalTax * 0.2)}`);
  steps.push(`→ 1000円単位切り下げ: ${formatMoney(limit)}`);

  // 結果表示
  document.getElementById('limit').textContent = `年間限度額: ${formatMoney(limit)}`;
  document.getElementById('breakdown').innerHTML = steps.map(step => 
    `<div class="step">${step}</div>`
  ).join('');
  document.getElementById('result').style.display = 'block';
}

function formatMoney(amount) {
  return amount.toLocaleString('ja-JP') + '円';
}