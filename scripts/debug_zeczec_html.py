"""Zeczecのページ構造を確認するデバッグスクリプト"""
from playwright.sync_api import sync_playwright

URL = "https://www.zeczec.com/categories?category=11&scope=active"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.set_extra_http_headers({"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"})
    page.goto(URL, wait_until="networkidle", timeout=90000)
    page.wait_for_timeout(8000)

    for _ in range(4):
        page.mouse.wheel(0, 1200)
        page.wait_for_timeout(1000)
    page.wait_for_timeout(2000)

    data = page.evaluate("""
        () => {
            // 全aタグのhref（全部）
            const allA = [...document.querySelectorAll('a')];
            const hrefs = allA.map(a => a.href).filter(h => h.includes('zeczec.com') && !h.includes('categories') && !h.includes('sign'));

            // NT$を含む要素の親のaタグを探す
            const ntEls = [...document.querySelectorAll('*')]
                .filter(el => el.children.length === 0 && (el.innerText || '').includes('NT$'))
                .slice(0, 5);
            const projectLinks = ntEls.map(el => {
                let node = el;
                while (node && node.tagName !== 'A') node = node.parentElement;
                return node ? { href: node.href, text: node.innerText.slice(0, 80) } : null;
            }).filter(Boolean);

            // imgタグを持つaタグ
            const aWithImg = [...document.querySelectorAll('a img')].slice(0, 5).map(img => ({
                aHref: img.closest('a')?.href,
                src: img.src,
            }));

            return { hrefs: hrefs.slice(0, 20), projectLinks, aWithImg };
        }
    """)

    import json
    print(json.dumps(data, ensure_ascii=False, indent=2))
    browser.close()
