from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "web" / "index.html"
APP = ROOT / "web" / "app.js"


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

    def test_mode_switcher_implements_tabs_keyboard_contract(self):
        script = APP.read_text(encoding="utf-8")

        for expected in (
            "tabList.setAttribute('role', 'tablist')",
            "tab.setAttribute('role', 'tab')",
            "panels[index].setAttribute('role', 'tabpanel')",
            "tab.setAttribute('aria-controls', panels[index].id)",
            "panels[index].setAttribute('aria-labelledby', tab.id)",
            "setAttribute('aria-selected'",
            "event.key === 'ArrowRight'",
            "event.key === 'ArrowLeft'",
            "event.key === 'Home'",
            "event.key === 'End'",
            "tabs[nextIndex].focus()",
        ):
            self.assertIn(expected, script)


if __name__ == "__main__":
    unittest.main()
