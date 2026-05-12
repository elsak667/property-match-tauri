#!/usr/bin/env python3
"""
浦易达 Bearer Token 刷新工具
使用方法：python get_pudong_token.py
"""
import json, sys, time
from playwright.sync_api import sync_playwright

TARGET_URL = "https://pyd.pudong.gov.cn/pd-api/dataCenterXcx/special/list"

def main():
    print("=" * 60)
    print("浦易达 Bearer Token 刷新工具")
    print("=" * 60)
    print()
    print("将自动打开浏览器，请勿操作页面...")
    print("抓到 Token 后会自动显示在下方")
    print()

    token_found = None

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=False)
        context = browser.new_context(
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 26_4_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.73(0x18004923) NetType/WIFI Language/zh_CN"
        )
        page = context.new_page()

        def on_request(request):
            nonlocal token_found
            if not request.url.startswith("https://pyd.pudong.gov.cn/pd-api/"):
                return
            auth_header = None
            for name, value in request.headers.items():
                if name.lower() == "authorization" and value.startswith("Bearer "):
                    auth_header = value
                    break
            if auth_header and not token_found:
                token_found = auth_header
                print()
                print("=" * 60)
                print("抓到 Token！")
                print("=" * 60)
                print()
                print("Bearer Token:")
                print(auth_header)
                print()

        page.on("request", on_request)

        print(f"正在打开页面: {TARGET_URL}")
        try:
            page.goto(TARGET_URL, timeout=15000)
        except Exception as e:
            print(f"页面加载超时（正常）: {e}")

        for i in range(20):
            if token_found:
                break
            time.sleep(1)
            sys.stdout.write(f"\r等待中... ({i+1}/20)")
            sys.stdout.flush()

        if not token_found:
            print("\n未能在 20 秒内捕捉到 Token")

        browser.close()

    if not token_found:
        print()
        print("提示：可能需要先在手机上打开浦易达小程序获取最新 Token")

if __name__ == "__main__":
    main()
