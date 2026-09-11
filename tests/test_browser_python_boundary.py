import contextlib
import http.server
import importlib.util
import pathlib
import socketserver
import sys
import threading
import unittest

from playwright.sync_api import sync_playwright


ROOT = pathlib.Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
SPEC = importlib.util.spec_from_file_location("pyodide_api_browser_expected", SCRIPTS / "pyodide_api.py")
assert SPEC and SPEC.loader
api = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(api)


class StaticHandler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        if clean.startswith("/python/"):
            return str(SCRIPTS / clean.removeprefix("/python/"))
        relative = clean.lstrip("/") or "index.html"
        return str(WEB / relative)

    def log_message(self, format: str, *args) -> None:
        return


class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True


class BrowserPythonBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.server = ReusableTCPServer(("127.0.0.1", 0), StaticHandler)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base_url = f"http://127.0.0.1:{cls.server.server_address[1]}"
        cls.playwright = sync_playwright().start()
        cls.browser = cls.playwright.chromium.launch(headless=True)
        cls.page = cls.browser.new_page()
        cls.page.set_default_timeout(120_000)
        cls.page.goto(cls.base_url, wait_until="domcontentloaded")

    @classmethod
    def tearDownClass(cls) -> None:
        with contextlib.suppress(Exception):
            cls.browser.close()
        with contextlib.suppress(Exception):
            cls.playwright.stop()
        cls.server.shutdown()
        cls.server.server_close()
        cls.thread.join(timeout=5)

    def browser_calculate(self, payload: dict) -> dict:
        return self.page.evaluate(
            "async (payload) => await window.FurusatoTaxPython.calculate(payload)", payload
        )

    def test_notice_and_estimate_match_canonical_python_for_all_supported_years(self) -> None:
        for year, basic in ((2024, 480_000), (2025, 580_000), (2026, 620_000)):
            with self.subTest(mode="notice", year=year):
                payload = {
                    "mode": "notice",
                    "tax_year": year,
                    "resident_income_levy_before_tax_credits": 400_000,
                    "resident_adjustment_deduction": 2_500,
                    "resident_taxable_general_income": 6_600_000,
                    "human_deduction_difference": 50_000,
                    "basic_deduction_income": basic,
                    "current_donation": 40_000,
                }
                self.assertEqual(self.browser_calculate(payload), api.calculate(payload))

            with self.subTest(mode="estimate", year=year):
                payload = {
                    "mode": "estimate",
                    "tax_year": year,
                    "salary_income": 5_000_000,
                    "side_income": 0,
                    "expense_rate": 0,
                    "other_common_deductions": 600_000,
                    "human_deduction_difference": 50_000,
                    "current_donation": 20_000,
                }
                self.assertEqual(self.browser_calculate(payload), api.calculate(payload))

    def test_fail_close_cases_cross_the_real_browser_python_boundary(self) -> None:
        cases = (
            ({"mode": "estimate", "tax_year": 2027}, "Unsupported tax_year"),
            (
                {
                    "mode": "estimate",
                    "tax_year": 2026,
                    "salary_income": 5_000_000,
                    "human_deduction_difference": 50_000,
                    "separately_taxed_income": 1,
                },
                "Separately taxed income",
            ),
            (
                {
                    "mode": "estimate",
                    "tax_year": 2026,
                    "salary_income": 5_000_000,
                    "human_deduction_difference": 50_000,
                    "business_revenue": 100_000,
                    "business_expenses": 200_000,
                },
                "Business losses are not modeled",
            ),
        )
        for payload, expected in cases:
            with self.subTest(expected=expected):
                with self.assertRaisesRegex(Exception, expected):
                    self.browser_calculate(payload)

    def test_public_ui_uses_python_result(self) -> None:
        self.page.select_option("#taxYear", "2025")
        self.page.fill("#incomeTaxBasicDeduction", "580000")
        self.page.fill("#taxableResidentGeneralIncome", "6600000")
        self.page.fill("#incomeLevyBeforeTaxCredits", "400000")
        self.page.fill("#adjustmentDeduction", "2500")
        self.page.fill("#humanDeductionDifference", "50000")
        self.page.click("#noticeCalc")
        self.page.wait_for_selector("#result", state="visible")
        self.assertIn("116,000円", self.page.locator("#safeLimit").inner_text())
        self.assertEqual(self.page.locator("#error").inner_text(), "")

    def test_javascript_contains_transport_not_tax_policy(self) -> None:
        app = (WEB / "app.js").read_text(encoding="utf-8")
        transport = (WEB / "tax-core.js").read_text(encoding="utf-8")
        self.assertNotIn("FurusatoTaxCore", app)
        self.assertNotIn("limitFromNotice", app)
        self.assertNotIn("estimateFromIncome", app)
        for forbidden in (
            "SPECIAL_RATE_TABLE",
            "SPECIAL_CREDIT_RATE_TABLE",
            "salaryIncomeAfterDeduction",
            "incomeTaxBasicDeduction",
            "residentAdjustmentDeduction",
        ):
            self.assertNotIn(forbidden, transport)


if __name__ == "__main__":
    unittest.main()
