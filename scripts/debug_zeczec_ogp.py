"""Zeczecプロジェクトページからog:imageを取得できるか確認"""
from playwright.sync_api import sync_playwright

URLS = [
    "https://www.zeczec.com/projects/chimei-tower-fan",
    "https://www.zeczec.com/projects/hypershell",
]

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})

    for url in URLS:
        page.goto(url, wait_until="domcontentloaded", timeout=30000)
        page.wait_for_timeout(3000)
        result = page.evaluate("""() => {
            const og = document.querySelector('meta[property="og:image"]');
            const img = document.querySelector('img.main-image, img[class*="hero"], img[class*="cover"], .project-cover img');
            return {
                ogImage: og?.content || null,
                firstImg: img?.src || null,
            };
        }""")
        print(f"{url}")
        print(f"  og:image = {result['ogImage']}")
        print(f"  first img = {result['firstImg']}")

    browser.close()
