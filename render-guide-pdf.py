#!/usr/bin/env python3
"""Render an HTML guide to PDF honoring its @page CSS size."""
import sys
from playwright.sync_api import sync_playwright

src, out = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page()
    page.goto(f"file://{src}")
    page.wait_for_load_state("networkidle")
    page.pdf(path=out, print_background=True, prefer_css_page_size=True)
    browser.close()
print(f"OK {out}")
