"""يبني icons/sprite.svg من أيقونات Lucide (رخصة ISC).

الاستخدام:
  npm pack lucide-static@0.460.0 && tar xzf lucide-static-0.460.0.tgz
  python3 tools/build-icons.py package/icons
"""
import pathlib
import re
import shutil
import sys

# أيقونات الواجهة + أيقونات التصنيفات. لإضافة أيقونة: أضف اسمها هنا وأعد التشغيل
NAMES = """
house list plus hand-coins menu chevron-right chevron-left chevron-down search x check clock target
triangle-alert octagon-alert moon-star trash-2 pencil repeat calendar calendar-days tags briefcase save
folder-open sheet eye eye-off thumbs-up thumbs-down bell settings-2 wallet arrow-up-right arrow-down-left
piggy-bank zap sparkles share-2 info undo-2 delete
key-round utility-pole plug-zap droplets flame spray-can wrench sofa
shopping-basket croissant drumstick carrot utensils coffee
fuel car-taxi-front car
smartphone wifi
graduation-cap baby shirt scissors
pill stethoscope
party-popper flower gift hand-heart heart-handshake
ticket cigarette package users tag
receipt shopping-bag plane dumbbell dog book-open bus bike tv gamepad-2 heart sparkles landmark
baby milk egg fish apple sandwich pizza ice-cream-cone beer cake gem watch glasses hammer paint-roller
lamp plug building-2 train-front ship truck tractor graduation-cap backpack pen-line music camera
banknote credit-card coins hand-heart moon star sun cloud umbrella dice-5 trophy
""".split()
NAMES = list(dict.fromkeys(NAMES))

src = pathlib.Path(sys.argv[1])
root = pathlib.Path(__file__).resolve().parent.parent
symbols = []
for name in NAMES:
    svg = (src / f"{name}.svg").read_text()
    inner = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    inner = re.sub(r"<!--.*?-->", "", inner, flags=re.S)
    inner = re.sub(r"\s+", " ", inner).strip()
    symbols.append(f'<symbol id="i-{name}" viewBox="0 0 24 24">{inner}</symbol>')

sprite = (
    "<!-- Lucide icons (https://lucide.dev), ISC License: icons/LUCIDE-LICENSE.txt -->\n"
    '<svg xmlns="http://www.w3.org/2000/svg">\n' + "\n".join(symbols) + "\n</svg>\n"
)
(root / "icons" / "sprite.svg").write_text(sprite)
shutil.copy(src.parent / "LICENSE", root / "icons" / "LUCIDE-LICENSE.txt")
print(f"{len(symbols)} icons -> icons/sprite.svg")
