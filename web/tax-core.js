(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.FurusatoTaxCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SUPPORTED_TAX_YEARS = new Set([2024, 2025, 2026]);
  const SPECIAL_RATE_TABLE = [
    [1_950_000, 0.84895],
    [3_300_000, 0.79790],
    [6_950_000, 0.69580],
    [9_000_000, 0.66517],
    [18_000_000, 0.56307],
    [40_000_000, 0.49160],
    [Infinity, 0.44055],
  ];

  function number(value, name, minimum = 0) {
    const result = Number(value ?? 0);
    if (!Number.isFinite(result)) throw new Error(`${name} は有限の数値で入力してください`);
    if (result < minimum) throw new Error(`${name} は ${minimum} 以上で入力してください`);
    return result;
  }

  function validateTaxYear(value) {
    const year = Number(value);
    if (!Number.isInteger(year) || !SUPPORTED_TAX_YEARS.has(year)) {
      throw new Error('対応年分は2024・2025・2026です。未対応年を別年度の税表で計算しません。');
    }
    return year;
  }

  function roundedQuarter(salary) {
    return Math.floor((salary / 4) / 1000) * 1000;
  }

  function salaryIncomeAfterDeduction(rawSalary, taxYear) {
    const year = validateTaxYear(taxYear);
    const salary = number(rawSalary, '給与収入');

    if (year === 2024) {
      if (salary <= 550999) return 0;
      if (salary <= 1625000) return salary - 550000;
      if (salary <= 1800000) return salary - (salary * 0.40 - 100000);
      if (salary < 3600000) return Math.max(0, roundedQuarter(salary) * 2.8 - 80000);
      if (salary < 6600000) return Math.max(0, roundedQuarter(salary) * 3.2 - 440000);
      if (salary < 8500000) return Math.max(0, salary * 0.9 - 1100000);
      return Math.max(0, salary - 1950000);
    }

    if (year === 2025) {
      if (salary <= 650999) return 0;
      if (salary < 1900000) return salary - 650000;
      if (salary < 3600000) return Math.max(0, roundedQuarter(salary) * 2.8 - 80000);
      if (salary < 6600000) return Math.max(0, roundedQuarter(salary) * 3.2 - 440000);
      if (salary < 8500000) return Math.max(0, salary * 0.9 - 1100000);
      return Math.max(0, salary - 1950000);
    }

    if (salary < 741000) return 0;
    if (salary < 2191000) return salary - 740000;
    if (salary < 2193000) return 1451000;
    if (salary < 2196000) return 1453000;
    if (salary < 2200000) return 1456000;
    if (salary < 3600000) return Math.max(0, roundedQuarter(salary) * 2.8 - 80000);
    if (salary < 6600000) return Math.max(0, roundedQuarter(salary) * 3.2 - 440000);
    if (salary < 8500000) return Math.max(0, salary * 0.9 - 1100000);
    return Math.max(0, salary - 1950000);
  }

  function incomeTaxBasicDeduction(rawIncome, taxYear) {
    const year = validateTaxYear(taxYear);
    const income = number(rawIncome, '合計所得金額');

    if (year === 2024) {
      if (income <= 24000000) return 480000;
      if (income <= 24500000) return 320000;
      if (income <= 25000000) return 160000;
      return 0;
    }
    if (year === 2025) {
      if (income <= 1320000) return 950000;
      if (income <= 3360000) return 880000;
      if (income <= 4890000) return 680000;
      if (income <= 6550000) return 630000;
      if (income <= 23500000) return 580000;
    } else {
      if (income <= 4890000) return 1040000;
      if (income <= 6550000) return 670000;
      if (income <= 23500000) return 620000;
    }
    if (income <= 24000000) return 480000;
    if (income <= 24500000) return 320000;
    if (income <= 25000000) return 160000;
    return 0;
  }

  function residentTaxBasicDeduction(rawIncome) {
    const income = number(rawIncome, '合計所得金額');
    if (income <= 24000000) return 430000;
    if (income <= 24500000) return 290000;
    if (income <= 25000000) return 150000;
    return 0;
  }

  function residentAdjustmentDeduction(rawTaxable, rawHumanDifference) {
    const taxable = number(rawTaxable, '課税総所得金額');
    const diff = number(rawHumanDifference, '人的控除額の差');
    if (diff === 0) return 0;
    if (taxable <= 2000000) return Math.min(diff, taxable) * 0.05;
    return Math.max(diff - (taxable - 2000000), 50000) * 0.05;
  }

  function specialRateBasis({
    taxYear,
    taxableResidentGeneralIncome,
    humanDeductionDifference,
    incomeTaxBasicDeduction,
  }) {
    const year = validateTaxYear(taxYear);
    const taxable = number(taxableResidentGeneralIncome, '課税総所得金額');
    const humanDiff = number(humanDeductionDifference, '人的控除額の差');
    const incomeBasic = number(incomeTaxBasicDeduction, '所得税基礎控除');
    let basis = taxable - humanDiff;
    if (year >= 2025) basis -= Math.max(incomeBasic - 480000, 0);
    return Math.max(0, basis);
  }

  function specialCreditRate(rawBasis) {
    const basis = number(rawBasis, '特例控除率判定基礎');
    for (const [ceiling, rate] of SPECIAL_RATE_TABLE) {
      if (basis <= ceiling) return rate;
    }
    throw new Error('特例控除率を判定できませんでした');
  }

  function limitFromNotice(input) {
    const taxYear = validateTaxYear(input.taxYear);
    const beforeCredits = number(input.incomeLevyBeforeTaxCredits, '税額控除前所得割額');
    const adjustment = number(input.adjustmentDeduction, '調整控除額');
    if (adjustment > beforeCredits) throw new Error('調整控除額が税額控除前所得割額を上回っています');

    const adjustedLevy = beforeCredits - adjustment;
    const rateBasis = specialRateBasis({
      taxYear,
      taxableResidentGeneralIncome: input.taxableResidentGeneralIncome,
      humanDeductionDifference: input.humanDeductionDifference,
      incomeTaxBasicDeduction: input.incomeTaxBasicDeduction,
    });

    let rate;
    if (input.specialCreditRateOverride !== undefined && input.specialCreditRateOverride !== null && input.specialCreditRateOverride !== '') {
      rate = number(input.specialCreditRateOverride, '特例控除率上書き', 0);
      if (!(rate > 0 && rate < 1)) throw new Error('特例控除率上書きは0より大きく1未満で入力してください');
    } else {
      rate = specialCreditRate(rateBasis);
    }

    const specialCreditCap = adjustedLevy * 0.20;
    let theoreticalLimit = specialCreditCap / rate + 2000;
    const totalIncome = input.totalIncome === undefined || input.totalIncome === null || input.totalIncome === ''
      ? null
      : number(input.totalIncome, '総所得金額等');
    if (totalIncome !== null) theoreticalLimit = Math.min(theoreticalLimit, totalIncome * 0.30);

    const theoreticalLimitYen = Math.floor(theoreticalLimit);
    const safeLimit1000Yen = Math.floor(theoreticalLimit / 1000) * 1000;
    const currentDonation = input.currentDonation === undefined || input.currentDonation === null || input.currentDonation === ''
      ? null
      : number(input.currentDonation, '寄附済額');

    return {
      taxYear,
      adjustedIncomeLevy: adjustedLevy,
      specialCreditCap,
      specialRateBasis: rateBasis,
      specialCreditRate: rate,
      theoreticalLimitYen,
      safeLimit1000Yen,
      currentDonation,
      remainingToTheoretical: currentDonation === null ? null : theoreticalLimitYen - currentDonation,
      remainingToSafe: currentDonation === null ? null : safeLimit1000Yen - currentDonation,
    };
  }

  function estimateFromIncome(input) {
    const taxYear = validateTaxYear(input.taxYear);
    if (input.hasSeparateTaxation) {
      throw new Error('申告分離課税・株式等がある場合、年収推計モードは使用できません。住民税通知書モードを使ってください。');
    }

    const salaryIncome = salaryIncomeAfterDeduction(input.salaryIncome, taxYear);
    const otherAggregateIncome = number(input.otherAggregateIncome, 'その他の総合課税所得');
    const totalIncome = salaryIncome + otherAggregateIncome;
    const residentBasic = residentTaxBasicDeduction(totalIncome);
    const residentOtherDeductions = number(input.residentOtherDeductions, '住民税の所得控除（基礎控除を除く）');
    const taxableResident = Math.max(0, totalIncome - residentBasic - residentOtherDeductions);
    const humanDiff = number(input.humanDeductionDifference, '人的控除額の差');
    const adjustment = residentAdjustmentDeduction(taxableResident, humanDiff);
    const incomeBasic = incomeTaxBasicDeduction(totalIncome, taxYear);

    return limitFromNotice({
      taxYear,
      incomeLevyBeforeTaxCredits: taxableResident * 0.10,
      adjustmentDeduction: adjustment,
      taxableResidentGeneralIncome: taxableResident,
      humanDeductionDifference: humanDiff,
      incomeTaxBasicDeduction: incomeBasic,
      totalIncome,
      currentDonation: input.currentDonation,
    });
  }

  return {
    SUPPORTED_TAX_YEARS,
    SPECIAL_RATE_TABLE,
    validateTaxYear,
    salaryIncomeAfterDeduction,
    incomeTaxBasicDeduction,
    residentTaxBasicDeduction,
    residentAdjustmentDeduction,
    specialRateBasis,
    specialCreditRate,
    limitFromNotice,
    estimateFromIncome,
  };
});
