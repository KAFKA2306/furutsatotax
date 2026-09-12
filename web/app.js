(() => {
  'use strict';

  const python = window.FurusatoTaxPython;
  if (!python) throw new Error('tax-python.js failed to load');

  const $ = (id) => document.getElementById(id);
  const value = (id) => $(id).value;
  const optional = (id) => {
    const v = value(id).trim();
    return v === '' ? null : Number(v);
  };
  const fieldError = (id, message) => {
    const field = $(id);
    field.setAttribute('aria-invalid', 'true');
    field.focus();
    throw new Error(message);
  };
  const requiredNumber = (id, label) => {
    const v = value(id).trim();
    if (v === '') fieldError(id, `${label}を入力してください`);
    const n = Number(v);
    if (!Number.isFinite(n)) fieldError(id, `${label}を数値で入力してください`);
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

  function clearFieldError(event) {
    event.currentTarget.removeAttribute('aria-invalid');
  }

  function renderNextAction(result) {
    let action = $('resultNextAction');
    if (!action) {
      action = document.createElement('a');
      action.id = 'resultNextAction';
      action.className = 'primary-link';
      action.style.display = 'inline-block';
      action.style.marginTop = '18px';
      action.style.textDecoration = 'none';
      $('result').appendChild(action);
    }

    const remaining = result.currentDonation === null
      ? result.safeLimit1000Yen
      : Math.max(0, result.remainingToSafe);
    action.href = 'rewards.html';
    action.textContent = remaining > 0
      ? `残り ${money(remaining)} の返礼品を比較する →`
      : '返礼品の単価を比較する →';
    action.setAttribute('aria-label', `${action.textContent}。計算結果を確認してから返礼品比較へ進みます`);
  }

  function browserResult(result) {
    return {
      theoreticalLimitYen: result.theoretical_limit_yen,
      safeLimit1000Yen: result.safe_limit_1000_yen,
      adjustedIncomeLevy: result.adjusted_resident_income_levy,
      specialCreditCap: result.special_credit_cap,
      specialRateBasis: result.special_credit_rate_basis,
      specialCreditRate: result.special_credit_rate,
      currentDonation: result.current_donation,
      remainingToTheoretical: result.remaining_to_theoretical,
      remainingToSafe: result.remaining_to_safe,
    };
  }

  function render(rawResult, modeLabel) {
    const result = browserResult(rawResult);
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
    renderNextAction(result);
    $('result').style.display = 'block';
    $('result').focus({ preventScroll: true });
    $('result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function switchMode(mode) {
    const notice = mode === 'notice';
    $('noticePanel').style.display = notice ? 'block' : 'none';
    $('estimatePanel').style.display = notice ? 'none' : 'block';
    $('noticeTab').classList.toggle('active', notice);
    $('estimateTab').classList.toggle('active', !notice);
    $('noticeTab').setAttribute('aria-selected', String(notice));
    $('estimateTab').setAttribute('aria-selected', String(!notice));
    $('noticeTab').tabIndex = notice ? 0 : -1;
    $('estimateTab').tabIndex = notice ? -1 : 0;
    clearError();
    $('result').style.display = 'none';
  }

  function setupModeTabs() {
    const tabList = document.querySelector('.mode-tabs');
    const tabs = [$('noticeTab'), $('estimateTab')];
    const panels = [$('noticePanel'), $('estimatePanel')];
    const modes = ['notice', 'estimate'];

    document.querySelector('.top .help').textContent = '手元の資料に合わせて計算方法を選びます。住民税通知書があれば実額計算を優先します。';
    document.querySelector('.notice').innerHTML = '<strong>まず、住民税通知書が手元にあるか確認してください。</strong><br>ある場合は通知書の実額で計算します。ない場合は収入から概算できます。';
    $('noticeTab').textContent = '通知書がある → 実額で計算（推奨）';
    $('estimateTab').textContent = '通知書がない → 収入から概算';
    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', '手元の資料から計算方法を選ぶ');

    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-controls', panels[index].id);
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      panels[index].tabIndex = 0;

      tab.addEventListener('keydown', (event) => {
        let nextIndex = null;
        if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
        if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'Home') nextIndex = 0;
        if (event.key === 'End') nextIndex = tabs.length - 1;
        if (nextIndex === null) return;

        event.preventDefault();
        switchMode(modes[nextIndex]);
        tabs[nextIndex].focus();
      });
    });

    switchMode('notice');
  }

  async function calculateNotice() {
    try {
      const overridePercent = optional('specialRateOverride');
      if ($('hasSpecialTaxationNotice').checked && overridePercent === null) {
        fieldError(
          'specialRateOverride',
          '分離課税・課税特例があるため、通常の特例控除率表では確定できません。自治体等で確認した特例控除率を入力してください。'
        );
      }
      const result = await python.calculate({
        mode: 'notice',
        tax_year: Number(value('taxYear')),
        total_income: optional('totalIncome'),
        resident_taxable_general_income: requiredNumber('taxableResidentGeneralIncome', '課税総所得金額'),
        resident_income_levy_before_tax_credits: requiredNumber('incomeLevyBeforeTaxCredits', '税額控除前所得割額'),
        resident_adjustment_deduction: requiredNumber('adjustmentDeduction', '調整控除額'),
        human_deduction_difference: requiredNumber('humanDeductionDifference', '所得税との人的控除額の差'),
        basic_deduction_income: requiredNumber('incomeTaxBasicDeduction', '所得税の基礎控除額'),
        current_donation: optional('currentDonation'),
        special_credit_rate_override: overridePercent === null ? null : overridePercent / 100,
      });
      render(result, '住民税通知書（推奨）');
    } catch (error) {
      showError(error);
    }
  }

  async function calculateEstimate() {
    try {
      const result = await python.calculate({
        mode: 'estimate',
        tax_year: Number(value('estimateTaxYear')),
        salary_income: requiredNumber('salaryIncome', '給与収入'),
        side_income: requiredNumber('otherAggregateIncome', 'その他の総合課税所得'),
        expense_rate: 0,
        other_common_deductions: requiredNumber('residentOtherDeductions', '住民税の所得控除'),
        human_deduction_difference: requiredNumber('estimateHumanDifference', '所得税との人的控除額の差'),
        separately_taxed_income: $('hasSeparateTaxation').checked ? 1 : 0,
        current_donation: optional('estimateDonation'),
      });
      render(result, '収入からの概算');
    } catch (error) {
      showError(error);
    }
  }

  setupModeTabs();
  document.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('input', clearFieldError);
    field.addEventListener('change', clearFieldError);
  });
  $('noticeTab').addEventListener('click', () => switchMode('notice'));
  $('estimateTab').addEventListener('click', () => switchMode('estimate'));
  $('noticeCalc').addEventListener('click', calculateNotice);
  $('estimateCalc').addEventListener('click', calculateEstimate);
})();
