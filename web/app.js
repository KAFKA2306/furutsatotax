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

    tabList.setAttribute('role', 'tablist');
    tabList.setAttribute('aria-label', '計算方法');

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

  function calculateNotice() {
    try {
      const taxYear = Number(value('taxYear'));
      const incomeTaxBasicDeduction = requiredNumber('incomeTaxBasicDeduction', '所得税の基礎控除額');
      const overridePercent = optional('specialRateOverride');
      if ($('hasSpecialTaxationNotice').checked && overridePercent === null) {
        fieldError(
          'specialRateOverride',
          '分離課税・課税特例があるため、通常の特例控除率表では確定できません。自治体等で確認した特例控除率を入力してください。'
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
