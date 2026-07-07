"""Zeczecの画像URL取得デバッグスクリプト"""
from playwright.sync_api import sync_playwright
import json

URL = "https://www.zeczec.com/categories?category=11&scope=active"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto(URL, wait_until="domcontentloaded", timeout=60000)
    page.wait_for_timeout(5000)

    for _ in range(6):
        page.mouse.wheel(0, 1200)
        page.wait_for_timeout(1000)
    page.wait_for_timeout(2000)

    data = page.evaluate("""
        () => {
            const anchors = [...document.querySelectorAll('a[href*="/projects/"]')].slice(0, 5);
            return anchors.map(a => {
                const imgEl = a.querySelector('img');
                const allImgs = [...a.querySelectorAll('img')].map(i => ({
                    src: i.src,
                    dataSrc: i.getAttribute('data-src'),
                    lazyS: i.getAttribute('data-lazy-src'),
                    srcset: i.getAttribute('srcset'),
                    style: i.getAttribute('style'),
                    className: i.className,
                }));
                // background-image on any child
                const allEls = [...a.querySelectorAll('*')];
                const bgImages = allEls
                    .map(el => getComputedStyle(el).backgroundImage)
                    .filter(b => b && b !== 'none' && b.includes('http'))
                    .slice(0, 3);
                const bgAttrs = allEls
                    .map(el => el.getAttribute('style') || '')
                    .filter(s => s.includes('background'))
                    .slice(0, 3);

                return {
                    url: a.href.split('?')[0],
                    title: (a.innerText || '').split('\\n')[0].trim().slice(0, 40),
                    imgs: allImgs,
                    bgImages,
                    bgAttrs,
                };
            });
        }
    """)

    print(json.dumps(data, ensure_ascii=False, indent=2))
    browser.close()
