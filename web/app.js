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
      const totalIncome = optional('totalIncome');
      if (totalIncome === null) throw new Error('総所得金額等を入力してください');
      const incomeTaxBasicDeduction = core.incomeTaxBasicDeduction(totalIncome, taxYear);
      const overridePercent = optional('specialRateOverride');
      const result = core.limitFromNotice({
        taxYear,
        totalIncome,
        taxableResidentGeneralIncome: Number(value('taxableResidentGeneralIncome')),
        incomeLevyBeforeTaxCredits: Number(value('incomeLevyBeforeTaxCredits')),
        adjustmentDeduction: Number(value('adjustmentDeduction')),
        humanDeductionDifference: Number(value('humanDeductionDifference')),
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
        salaryIncome: Number(value('salaryIncome')),
        otherAggregateIncome: Number(value('otherAggregateIncome')),
        residentOtherDeductions: Number(value('residentOtherDeductions')),
        humanDeductionDifference: Number(value('estimateHumanDifference')),
        hasSeparateTaxation: $('hasSeparateTaxation').checked,
        currentDonation: optional('estimateDonation'),
      });
      render(result, '収入からの概算');
    } catch (error) {
      showError(error);
    }
  }

  $('noticeTab').addEventListener('click', () => switchMode('notice'));
  $('estimateTab').addEventListener('click', () => switchMode('estimate'));
  $('noticeCalc').addEventListener('click', calculateNotice);
  $('estimateCalc').addEventListener('click', calculateEstimate);
})();
