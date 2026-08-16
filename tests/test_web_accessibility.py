from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "web" / "index.html"


class WebAccessibilityTest(unittest.TestCase):
    def test_dynamic_calculation_messages_are_live_regions(self):
        html = INDEX.read_text(encoding="utf-8")

        self.assertIn(
            '<div id="error" class="error" role="alert" aria-atomic="true"></div>',
            html,
        )
        self.assertIn(
            '<div id="result" class="result" role="status" aria-atomic="true">',
            html,
        )


if __name__ == "__main__":
    unittest.main()
