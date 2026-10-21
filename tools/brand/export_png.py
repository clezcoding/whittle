import pathlib, re
from playwright.sync_api import sync_playwright
B = pathlib.Path("../../assets/brand").resolve()
(B/"png").mkdir(exist_ok=True)
jobs=[("app-icon.svg","icon-1024.png",1024),("app-icon.svg","icon-512.png",512),("mark.svg","mark-512.png",512),("lockup.svg","lockup-1200.png",None)]
with sync_playwright() as p:
    b=p.chromium.launch()
    for src,dst,size in jobs:
        svg=(B/src).read_text()
        w=int(re.search(r'width="(\d+)"',svg).group(1)); h=int(re.search(r'height="(\d+)"',svg).group(1))
        if size is None: vw=1200; vh=round(h*1200/w)
        else: vw=vh=size
        wrap=pathlib.Path("wrap.html"); wrap.write_text(f'<html><body style="margin:0;background:transparent"><img src="{B/src}" style="width:{vw}px;height:{vh}px;display:block"></body></html>')
        pg=b.new_page(viewport={"width":vw,"height":vh})
        pg.goto("file://"+str(wrap.resolve())); pg.wait_for_timeout(200)
        pg.screenshot(path=str(B/"png"/dst),omit_background=True)
    b.close()
print("ok")
