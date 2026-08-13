(() => {
  'use strict';

  const core = window.FurusatoTaxCore;
  if (!core) throw new Error('tax-core.js failed to load');

  const $ = (id) => document.getElementById(id);
  const value = (id) => $(id).value;
  const optional = (id) => {
    const v = value(id).trim();
    return v === '' ? null : Number(v);
  };
  const requiredNumber = (id, label) => {
    const v = value(id).trim();
    if (v === '') throw new Error(`${label}を入力してください`);
    const n = Number(v);
    if (!Number.isFinite(n)) throw new Error(`${label}を数値で入力してください`);
    return n;
  };
  const money = (amount) => `${Math.round(Number(amount)).toLocaleString('ja-JP')}円`;

  function showError(error) {
    $('result').style.display = 'none';
    $('error').textContent = error instanceof Error ? error.message : String(error);
    $('error').style.display = 'block';
  }

  function clearError() {
    $('error').textContent = '';
    $('error').style.display = 'none';
  }

  function render(result, modeLabel) {
    clearError();
    $('limit').textContent = money(result.theoreticalLimitYen);
    $('safeLimit').textContent = `1,000円単位で安全側に切ると ${money(result.safeLimit1000Yen)}`;

    const rows = [
      ['計算モード', modeLabel],
      ['調整控除後所得割額', money(result.adjustedIncomeLevy)],
      ['特例控除20%上限', money(result.specialCreditCap)],
      ['特例控除率 判定基礎', money(result.specialRateBasis)],
      ['適用した特例控除率', `${(result.specialCreditRate * 100).toFixed(3)}%`],
    ];
    if (result.currentDonation !== null) {
      rows.push(['寄附済額', money(result.currentDonation)]);
      rows.push(['理論上限までの残額', money(result.remainingToTheoretical)]);
      rows.push(['安全側上限までの残額', money(result.remainingToSafe)]);
    }

    $('resultRows').innerHTML = rows
      .map(([label, v]) => `<div>${label}</div><div>${v}</div>`)
      .join('');
    $('result').style.display = 'block';
  }

  function switchMode(mode) {
    const notice = mode === 'notice';
    $('noticePanel').style.display = notice ? 'block' : 'none';
    $('estimatePanel').style.display = notice ? 'none' : 'block';
    $('noticeTab').classList.toggle('active', notice);
    $('estimateTab').classList.toggle('active', !notice);
    clearError();
    $('result').style.display = 'none';
  }

  function calculateNotice() {
    try {
      const taxYear = Number(value('taxYear'));
      const incomeTaxBasicDeduction = requiredNumber('incomeTaxBasicDeduction', '所得税の基礎控除額');
      const overridePercent = optional('specialRateOverride');
      if ($('hasSpecialTaxationNotice').checked && overridePercent === null) {
        throw new Error(
          '分離課税・課税特例があるため、通常の特例控除率表では確定できません。' +
          '自治体等で確認した特例控除率を入力してください。'
        );
      }
      const result = core.limitFromNotice({
        taxYear,
        totalIncome: optional('totalIncome'),
        taxableResidentGeneralIncome: requiredNumber('taxableResidentGeneralIncome', '課税総所得金額'),
        incomeLevyBeforeTaxCredits: requiredNumber('incomeLevyBeforeTaxCredits', '税額控除前所得割額'),
        adjustmentDeduction: requiredNumber('adjustmentDeduction', '調整控除額'),
        humanDeductionDifference: requiredNumber('humanDeductionDifference', '所得税との人的控除額の差'),
        incomeTaxBasicDeduction,
        currentDonation: optional('currentDonation'),
        specialCreditRateOverride: overridePercent === null ? null : overridePercent / 100,
      });
      render(result, '住民税通知書（推奨）');
    } catch (error) {
      showError(error);
    }
  }

  function calculateEstimate() {
    try {
      const result = core.estimateFromIncome({
        taxYear: Number(value('estimateTaxYear')),
        salaryIncome: requiredNumber('salaryIncome', '給与収入'),
        otherAggregateIncome: requiredNumber('otherAggregateIncome', 'その他の総合課税所得'),
        residentOtherDeductions: requiredNumber('residentOtherDeductions', '住民税の所得控除'),
        humanDeductionDifference: requiredNumber('estimateHumanDifference', '所得税との人的控除額の差'),
        hasSeparateTaxation: $('hasSeparateTaxation').checked,
        currentDonation: optional('estimateDonation'),
      });
      render(result, '収入からの概算');
    } catch (error) {
      showError(error);
    }
  }

  async function setupSyntheticProfiles() {
    const estimatePanel = $('estimatePanel');
    const estimateGrid = estimatePanel.querySelector('.grid');
    const presetPanel = document.createElement('div');
    presetPanel.className = 'warning';

    const heading = document.createElement('strong');
    heading.textContent = '統計分布から合成例を入力';
    presetPanel.appendChild(heading);

    const note = document.createElement('div');
    note.className = 'help';
    note.style.marginTop = '6px';
    note.textContent = '給与階級の人数・構成比は国税庁「令和6年分 民間給与実態統計調査」に基づきます。入力される給与額・控除・その他所得は、特定個人に由来しない合成値です。';
    presetPanel.appendChild(note);

    const controls = document.createElement('div');
    controls.className = 'grid';
    controls.style.marginTop = '12px';

    const bucketField = document.createElement('div');
    bucketField.className = 'field';
    const bucketLabel = document.createElement('label');
    bucketLabel.htmlFor = 'syntheticIncomeBucket';
    bucketLabel.textContent = '給与階級（公的統計）';
    const bucketSelect = document.createElement('select');
    bucketSelect.id = 'syntheticIncomeBucket';
    bucketField.append(bucketLabel, bucketSelect);

    const variantField = document.createElement('div');
    variantField.className = 'field';
    const variantLabel = document.createElement('label');
    variantLabel.htmlFor = 'syntheticVariant';
    variantLabel.textContent = '税務条件（合成）';
    const variantSelect = document.createElement('select');
    variantSelect.id = 'syntheticVariant';
    variantField.append(variantLabel, variantSelect);

    controls.append(bucketField, variantField);
    presetPanel.appendChild(controls);

    const applyButton = document.createElement('button');
    applyButton.type = 'button';
    applyButton.className = 'calc';
    applyButton.style.marginTop = '12px';
    applyButton.textContent = 'この合成例を入力';
    presetPanel.appendChild(applyButton);

    const detail = document.createElement('div');
    detail.className = 'help';
    detail.style.marginTop = '8px';
    presetPanel.appendChild(detail);

    estimatePanel.insertBefore(presetPanel, estimateGrid);

    try {
      const response = await fetch('data/synthetic-income-profiles.json', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const catalog = await response.json();
      if (catalog.synthetic !== true || !Array.isArray(catalog.income_buckets) || !Array.isArray(catalog.variants)) {
        throw new Error('合成プロファイルの形式が不正です');
      }

      bucketSelect.replaceChildren(...catalog.income_buckets.map((bucket) => {
        const option = document.createElement('option');
        option.value = bucket.id;
        option.textContent = `${bucket.label}（構成比 ${Number(bucket.share_pct).toFixed(2)}%）`;
        return option;
      }));
      variantSelect.replaceChildren(...catalog.variants.map((variant) => {
        const option = document.createElement('option');
        option.value = variant.id;
        option.textContent = variant.label;
        return option;
      }));

      const updateDetail = () => {
        const bucket = catalog.income_buckets.find((item) => item.id === bucketSelect.value);
        const variant = catalog.variants.find((item) => item.id === variantSelect.value);
        if (!bucket || !variant) return;
        detail.textContent = `${bucket.label}: ${Number(bucket.population).toLocaleString('ja-JP')}人 / ${Number(bucket.share_pct).toFixed(2)}%。代表給与 ${money(bucket.example_salary_yen)}。条件「${variant.label}」も合成値で、人口比を表しません。`;
      };

      bucketSelect.addEventListener('change', updateDetail);
      variantSelect.addEventListener('change', updateDetail);
      updateDetail();

      applyButton.addEventListener('click', () => {
        const bucket = catalog.income_buckets.find((item) => item.id === bucketSelect.value);
        const variant = catalog.variants.find((item) => item.id === variantSelect.value);
        if (!bucket || !variant) return;
        $('salaryIncome').value = String(bucket.example_salary_yen);
        $('otherAggregateIncome').value = String(variant.other_aggregate_income_yen);
        $('residentOtherDeductions').value = String(variant.resident_other_deductions_yen);
        $('estimateHumanDifference').value = String(variant.human_deduction_difference_yen);
        $('hasSeparateTaxation').checked = Boolean(variant.has_separate_taxation);
        $('estimateDonation').value = '';
        clearError();
        $('result').style.display = 'none';
      });
    } catch (error) {
      bucketSelect.disabled = true;
      variantSelect.disabled = true;
      applyButton.disabled = true;
      detail.textContent = `合成例を読み込めませんでした: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  $('noticeTab').addEventListener('click', () => switchMode('notice'));
  $('estimateTab').addEventListener('click', () => switchMode('estimate'));
  $('noticeCalc').addEventListener('click', calculateNotice);
  $('estimateCalc').addEventListener('click', calculateEstimate);
  setupSyntheticProfiles();
})();
