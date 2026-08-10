const assert = require('assert');
const core = require('../web/tax-core.js');

assert.strictEqual(core.salaryIncomeAfterDeduction(1_000_000, 2024), 450_000);
assert.strictEqual(core.salaryIncomeAfterDeduction(1_000_000, 2025), 350_000);
assert.strictEqual(core.salaryIncomeAfterDeduction(1_600_000, 2024), 1_050_000);
assert.strictEqual(core.salaryIncomeAfterDeduction(3_599_999, 2025), 2_437_200);
assert.strictEqual(core.incomeTaxBasicDeduction(10_000_000, 2025), 580_000);
assert.strictEqual(core.residentAdjustmentDeduction(6_600_000, 50_000), 2_500);

const basis = core.specialRateBasis({
  taxYear: 2025,
  taxableResidentGeneralIncome: 6_600_000,
  humanDeductionDifference: 50_000,
  incomeTaxBasicDeduction: 580_000,
});
assert.strictEqual(basis, 6_450_000);
assert.strictEqual(core.specialCreditRate(basis), 0.6958);
assert.strictEqual(core.specialCreditRate(6_950_000), 0.6958);
assert.strictEqual(core.specialCreditRate(6_950_001), 0.66517);

const result = core.limitFromNotice({
  taxYear: 2025,
  totalIncome: 8_000_000,
  taxableResidentGeneralIncome: 6_600_000,
  incomeLevyBeforeTaxCredits: 400_000,
  adjustmentDeduction: 2_500,
  humanDeductionDifference: 50_000,
  incomeTaxBasicDeduction: 580_000,
  currentDonation: 100_000,
});
assert.strictEqual(result.adjustedIncomeLevy, 397_500);
assert.strictEqual(result.specialRateBasis, 6_450_000);
assert.strictEqual(result.specialCreditRate, 0.6958);
assert.strictEqual(result.theoreticalLimitYen, 116_256);
assert.strictEqual(result.safeLimit1000Yen, 116_000);
assert.strictEqual(result.remainingToTheoretical, 16_256);

assert.throws(
  () => core.estimateFromIncome({
    taxYear: 2025,
    salaryIncome: 7_000_000,
    otherAggregateIncome: 0,
    residentOtherDeductions: 0,
    humanDeductionDifference: 50_000,
    hasSeparateTaxation: true,
  }),
  /通知書モード/
);
assert.throws(() => core.validateTaxYear(2027), /対応年分/);

console.log('web tax core: ok');
