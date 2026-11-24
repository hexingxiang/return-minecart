from pathlib import Path
base = Path(__file__).resolve().parent
html = (base / "page.html").read_text()
html = html.replace("<!-- EXPRESS_STYLE -->", "\n".join((base / name).read_text() for name in ("express.css", "scout.css", "mobile.css")))
html = html.replace("<!-- EXPRESS_VIEW -->", (base / "express-view.html").read_text())
scripts = [(base / name).read_text() for name in ("levels.js", "express-maps.js", "engine.js", "express.js", "feedback.js", "art.js", "finale-art.js", "ui.js", "scout-ui.js", "express-ui.js")]
assert all("</script" not in code.lower() for code in scripts)
target = base.parent.parent / "outputs" / "回程矿车.html"
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(html.replace("<!-- GAME -->", "\n".join("<script>\n" + code + "\n</script>" for code in scripts)))
print(f"{target.name} · {target.stat().st_size:,} bytes")
