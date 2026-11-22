"""Build the static demonstration campus atlas. No third-party dependencies."""
import json
from pathlib import Path


OUTPUT = Path(__file__).resolve().parents[1] / "public" / "campus-map.json"

# Previously published campus places keep their IDs, names and timetable room codes.
# Each position is the original local ID used by the navigator.
LANDMARKS = {
    'main': {
        1: [
            ('0', 'work', 'Переговорная', 'Б-108', 'Б-108'),
            ('1', 'work', 'Проектный зал', 'Б-120', 'Б-120'),
            ('2', 'office', 'Студенческий офис', '', 'Студофис'),
            ('3', 'food', 'Кафе «Галерея»', '', 'Кафе'),
            ('4', 'library', 'Научная библиотека', '', 'Библиотека'),
            ('5', 'work', 'Студия', 'Б-122', 'Б-122'),
            ('6', 'cloakroom', 'Гардероб', '', 'Гардероб'),
            ('7', 'entrance', 'Главный вход', '', 'Вход'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
        2: [
            ('0', 'class', 'Аудитория', 'Б-205', 'Б-205'),
            ('1', 'class', 'Лаборатория статистики', 'Б-213', 'Б-213'),
            ('2', 'class', 'Языковая аудитория', 'Б-218', 'Б-218'),
            ('3', 'class', 'Семинарская', 'Б-231', 'Б-231'),
            ('4', 'class', 'Аудитория', 'Б-240', 'Б-240'),
            ('5', 'library', 'Читальный зал', '', 'Читальный зал'),
            ('6', 'work', 'Коворкинг', 'Б-214', 'Б-214'),
            ('7', 'stairs', 'Лестничный холл', '', 'Лестница'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
        3: [
            ('0', 'class', 'Семинарская', 'Б-301', 'Б-301'),
            ('1', 'class', 'Языковая аудитория', 'Б-305', 'Б-305'),
            ('2', 'class', 'Аудитория', 'Б-310', 'Б-310'),
            ('3', 'office', 'Методический кабинет', 'Б-318', 'Б-318'),
            ('4', 'class', 'Лекционный зал', 'Б-322', 'Б-322'),
            ('5', 'office', 'Деканат', '', 'Деканат'),
            ('6', 'office', 'Консультационная', '', 'Консультации'),
            ('7', 'stairs', 'Лестничный холл', '', 'Лестница'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
        4: [
            ('0', 'class', 'Семинарская', 'Б-402', 'Б-402'),
            ('1', 'class', 'Компьютерный класс', 'Б-406', 'Б-406'),
            ('2', 'class', 'Аудитория', 'Б-412', 'Б-412'),
            ('3', 'class', 'Лаборатория аналитики', 'Б-418', 'Б-418'),
            ('4', 'class', 'Лекционный зал', 'Б-420', 'Б-420'),
            ('5', 'work', 'Коворкинг', '', 'Коворкинг'),
            ('6', 'library', 'Медиатека', '', 'Медиатека'),
            ('7', 'stairs', 'Лестничный холл', '', 'Лестница'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
    },
    'modern': {
        1: [
            ('0', 'sport', 'Спортзал', 'Н-101', 'Н-101'),
            ('1', 'work', 'Переговорная', 'Н-102', 'Н-102'),
            ('2', 'class', 'Аудитория', 'Н-110', 'Н-110'),
            ('3', 'work', 'Проектный зал', 'Н-120', 'Н-120'),
            ('4', 'work', 'Студия', 'Н-122', 'Н-122'),
            ('5', 'food', 'Столовая', '', 'Столовая'),
            ('6', 'cloakroom', 'Гардероб', '', 'Гардероб'),
            ('7', 'entrance', 'Вход в корпус A', '', 'Вход'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
        2: [
            ('0', 'class', 'Медиалаборатория', 'Н-201', 'Н-201'),
            ('1', 'class', 'Аудитория', 'Н-205', 'Н-205'),
            ('2', 'class', 'Лингафонный класс', 'Н-208', 'Н-208'),
            ('3', 'class', 'Семинарская', 'Н-215', 'Н-215'),
            ('4', 'class', 'Лаборатория перевода', 'Н-224', 'Н-224'),
            ('5', 'library', 'Медиацентр', '', 'Медиацентр'),
            ('6', 'work', 'Проектная гостиная', '', 'Коворкинг'),
            ('7', 'stairs', 'Лестничный холл', '', 'Лестница'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
        3: [
            ('0', 'class', 'Лекционный зал', 'Н-301', 'Н-301'),
            ('1', 'class', 'Семинарская', 'Н-306', 'Н-306'),
            ('2', 'class', 'Мультимедийный класс', 'Н-311', 'Н-311'),
            ('3', 'class', 'Аудитория', 'Н-318', 'Н-318'),
            ('4', 'class', 'Конференц-зал', 'Н-326', 'Н-326'),
            ('5', 'office', 'Центр карьеры', '', 'Центр карьеры'),
            ('6', 'work', 'Коворкинг', '', 'Коворкинг'),
            ('7', 'stairs', 'Лестничный холл', '', 'Лестница'),
            ('8', 'wc', 'Санузел', '', 'WC'),
            ('9', 'lift', 'Лифтовый холл', '', 'Лифты'),
            ('water', 'water', 'Питьевая вода', '', ''),
        ],
    },
}

# Levels specify the floor and its teaching-room target. Modern levels also give the two wing spans.
# The low glazed wing of the modern building steps back towards the rotunda.
MODERN_WINGS = ((75, 1376), (122, 1432))
BUILDINGS = {
    "main": {
        "name": "Корпус B", "prefix": "Б",
        "aliases": ["главный корпус", "основной корпус", "корпус б"],
        "levels": [(1, 48), (2, 48), (3, 48), (4, 48), (5, 18)],
    },
    "modern": {
        "name": "Корпус A", "prefix": "Н", "core": 1080, "bridges": (320, 785, 1330),
        "aliases": ["корпус а", "новый", "корпус н", "новый корпус"],
        "levels": [(n, 50, *MODERN_WINGS) for n in (1, 2, 3)] + [
            (4, 30, (652, 1376), (699, 1432)), (5, 24, (896, 1376), (878, 1432)),
        ],
    },
}
GALLERIES = (158, 426)
HALL_HALF = 15
DEMO_METERS_PER_UNIT = 3 / (2 * HALL_HALF)
CORE_HALF = 27
WING_Y = ((61, 242), (344, 527))
FACILITIES = {
    "lift": ("Лифтовый холл", "Лифт"), "stairs": ("Лестничный холл", "Лестница"),
    "wc": ("Санузел", "WC"), "water": ("Питьевая вода", ""),
}
ROOM_TYPES = {
    "main": (
        ("Семинарская", 26, "экран"), ("Лингафонный класс", 24, "языковые станции"),
        ("Аудитория", 32, "проектор"), ("Лекционная аудитория", 52, "экран и микрофон"),
        ("Кабинет деловых игр", 30, "интерактивная панель"), ("Компьютерный класс", 24, "компьютеры"),
    ),
    "modern": (
        ("Проектная аудитория", 30, "интерактивная панель"), ("Компьютерный класс", 26, "компьютеры"),
        ("Семинарская", 24, "экран"), ("Мультимедийная аудитория", 36, "видеосвязь"),
        ("Языковая лаборатория", 20, "языковые станции"), ("Лекционная аудитория", 54, "экран и микрофон"),
    ),
}


def rounded(n):
    n = round(n, 1)
    return int(n) if n == int(n) else n


def poly_path(points, closed=True):
    return "M" + "L".join(f"{rounded(x)} {rounded(y)}" for x, y in points) + ("Z" if closed else "")


def box_path(box):
    left, top, right, bottom = box
    return poly_path([(left, top), (right, top), (right, bottom), (left, bottom)])


def footprint(boxes):
    """Trace the outer perimeter and courtyard holes of a union of axis-aligned footprints."""
    xs = sorted({x for l, _, r, _ in boxes for x in (l, r)})
    ys = sorted({y for _, t, _, b in boxes for y in (t, b)})
    edges = set()
    for left, right in zip(xs, xs[1:]):
        for top, bottom in zip(ys, ys[1:]):
            if not any(l <= left < right <= r and t <= top < bottom <= b for l,t,r,b in boxes):
                continue
            corners = [(left, top), (right, top), (right, bottom), (left, bottom)]
            for a,b in zip(corners, corners[1:] + corners[:1]):
                if (b,a) in edges:
                    edges.remove((b,a))
                else:
                    edges.add((a,b))
    next_point = dict(edges)
    assert len(next_point) == len(edges), "Footprint touches itself at a corner"
    loops = []
    while next_point:
        first = min(next_point)
        points = [first]
        node = next_point.pop(first)
        while node != first:
            points.append(node)
            node = next_point.pop(node)
        keep = []
        for i, (x,y) in enumerate(points):
            prev, nxt = points[i-1], points[(i+1) % len(points)]
            if not (prev[0] == x == nxt[0] or prev[1] == y == nxt[1]):
                keep.append((x,y))
        loops.append(poly_path(keep))
    return "".join(loops)


def floor_rooms(building, number, count):
    config = BUILDINGS[building]
    landmarks = LANDMARKS[building].get(number, [])
    rooms = {}
    services = {}
    for key, kind, name, code, label in landmarks:
        place = dict(id=f"{building}-{number}-{key}", kind=kind, name=name)
        if label:
            place["label"] = label
        if code:
            place.update(code=code, label=code.split("-")[1])
            rooms[int(code[-2:])] = place
        else:
            services.setdefault(kind, []).append(place)
    extra = count - sum(place["kind"] == "class" for place in rooms.values())
    index = 1
    while extra:
        if index not in rooms:
            name, seats, equipment = ROOM_TYPES[building][(index + number * 3) % len(ROOM_TYPES[building])]
            label = f"{number}{index:02}" if number > 0 else f"П{abs(number)}{index:02}"
            rooms[index] = dict(id=f"{building}-room-{label}", code=config["prefix"]+"-"+label, kind="class",
                                label=label, name=name, seats=seats, equipment=equipment)
            extra -= 1
        index += 1
    facilities = {}
    for kind, (name, label) in FACILITIES.items():
        rows = services.pop(kind, [])
        facilities[kind] = rows[0] if rows else dict(id=f"{building}-{number}-{kind}", kind=kind, name=name, label=label)
    if "entrance" in services:
        facilities["entrance"] = services.pop("entrance")[0]
    ordered = [place for _,place in sorted(rooms.items())]
    if building == "modern":
        for place in ordered:
            number_part = place["code"].split("-")[-1]
            place["aliases"] = [prefix + sep + number_part for prefix in ("A", "А") for sep in ("", "-")]
    # Separate public services along the galleries instead of placing them all in one corner.
    others = [place for group in services.values() for place in group]
    for i, place in enumerate(others, 1):
        ordered.insert(round(i * len(ordered) / (len(others) + 1)), place)
    return ordered, facilities


def chamber_spans(left, right, gaps):
    cursor = left
    spans = []
    for x, half in sorted(gaps):
        if cursor < x-half:
            spans.append((cursor, x-half))
        cursor = x+half
    if cursor < right:
        spans.append((cursor,right))
    return spans


def allocate(lengths, count):
    # Minimise the spread in classroom widths while reserving at least one room per span.
    allocations = [1] * len(lengths)
    for _ in range(count - len(lengths)):
        section = max(range(len(lengths)), key=lambda i: lengths[i] / (allocations[i] + .5))
        allocations[section] += 1
    return allocations


def modern_floor(number, count, north, south):
    building = "modern"
    config = BUILDINGS[building]
    core = config["core"]
    bridges = [x for x in config["bridges"] if max(north[0],south[0])+40 < x < min(north[1],south[1])-40]
    crossings = [(core,CORE_HALF)] + [(x,16) for x in bridges]
    boxes = [(l,t,r,b) for (l,r),(t,b) in zip((north,south), WING_Y)]
    boxes += [(x-h, WING_Y[0][1]-1, x+h, WING_Y[1][0]+1) for x,h in crossings]
    # Service core occupies the same stack on every floor, at the crossing nearest the entrance.
    service_boxes = {
        "lift": (core+CORE_HALF, 288, core+CORE_HALF+60, 344),
        "stairs": (core-CORE_HALF-62, 256, core-CORE_HALF, 344),
        "wc": (core+CORE_HALF, 243, core+CORE_HALF+60, 288),
    }
    # Join these service blocks into the south gallery volume through its north-facing room row.
    boxes += list(service_boxes.values())
    portico = (core-CORE_HALF-12, 526, core+CORE_HALF+12, 555)
    if number == 1:
        boxes.append(portico)
    # A roofed porch on the ground floor belongs to the footprint, above it the roof stays grey.
    outline = footprint(boxes)
    places, symbols = floor_rooms(building, number, count)
    nodes, links, drawn, windows = {}, [], [], []
    corridor_nodes = {y:{} for y in GALLERIES}

    def node(key, x, y):
        key = f"{number}-{key}"
        nodes[key] = [rounded(x), rounded(y)]
        return key

    def station(x, y):
        x = rounded(x)
        if x not in corridor_nodes[y]:
            corridor_nodes[y][x] = node(f"h{y}-{x}",x,y)
        return corridor_nodes[y][x]

    def identify(place, x, y, zone):
        place.update(anchor=[rounded(x), rounded(y)], zone=zone)
        drawn.append(place)

    rows = []
    for wing, (l,r) in enumerate((north,south)):
        top, bottom = WING_Y[wing]
        hall = GALLERIES[wing]
        for side in (-1,1):
            inside = (wing == 0 and side == 1) or (wing == 1 and side == -1)
            gaps = crossings if inside else ([(core,CORE_HALF+12)] if wing == 1 and number == 1 else [])
            door_y = hall + side*HALL_HALF
            outer_y = top if side == -1 else bottom
            for a,b in chamber_spans(l,r,gaps):
                rows.append((wing, side, a,b, door_y, outer_y))
    amounts = allocate([b-a for _,_,a,b,_,_ in rows],len(places))
    room_index = 0
    for (wing,side,a,b,door_y,outer_y),nrooms in zip(rows,amounts):
        hall = GALLERIES[wing]
        section = places[room_index:room_index+nrooms]
        weights = [1.65 if p["kind"] in ("sport","library","food") else 1.28 if p.get("seats",0) > 40 else 1 for p in section]
        left = a
        for i, (place,weight) in enumerate(zip(section,weights)):
            right = rounded(a+(b-a)*sum(weights[:i+1])/sum(weights))
            x = rounded((left+right)/2)
            top, bottom = sorted((door_y,outer_y))
            place["path"] = box_path((left,top,right,bottom))
            zone = ("Северная галерея" if wing == 0 else "Южная галерея")
            zone += " · " + ("западное крыло" if x < core-100 else "восточное крыло" if x > core+100 else "центральная секция")
            identify(place,x,(door_y+outer_y)/2,zone)
            door = node(f"r{room_index+i}",x,door_y)
            links.append([station(x,hall),door])
            place["node"] = door
            if number > 0:
                for offset in (-.2,.2):
                    wx = x+(right-left)*offset
                    windows.append(poly_path([(wx-6,outer_y),(wx+6,outer_y)],False))
            left = right
        room_index += nrooms

    backbone = {y:station(core,y) for y in GALLERIES}
    for kind,(l,t,r,b) in service_boxes.items():
        place = symbols[kind]
        x = l if kind != "stairs" else r
        y = (t+b)/2
        entry = node(kind,x,y)
        place.update(path=box_path((l,t,r,b)), node=entry)
        identify(place,(l+r)/2,y, "Центральный холл")
        backbone[y] = node("core"+str(y),core,y)
        links.append([backbone[y],entry])
    water = symbols["water"]
    wy = 277
    backbone[wy] = node("core-water",core,wy)
    water["node"] = node("water",core-11,wy)
    identify(water,core-11,wy,"Центральный холл")
    links.append([backbone[wy],water["node"]])
    if number == 1:
        place = symbols["entrance"]
        place.update(path=box_path((portico[0],GALLERIES[1]+HALL_HALF,portico[2],portico[3])),
                     node=node("entry",core,GALLERIES[1]+HALL_HALF))
        identify(place,core,(GALLERIES[1]+portico[3])/2,"Центральный вход")
        outside = node("front-door",core,portico[3])
        links += [[outside,place["node"]],[place["node"],backbone[GALLERIES[1]]]]
    keys = [ident for _,ident in sorted(backbone.items())]
    links.extend([a,b] for a,b in zip(keys,keys[1:]))
    for x in bridges:
        links.append([station(x,GALLERIES[0]),station(x,GALLERIES[1])])
    for track in corridor_nodes.values():
        keys = [ident for _,ident in sorted(track.items())]
        links.extend([a,b] for a,b in zip(keys,keys[1:]))
    return dict(id=str(number),name=f"{number} этаж",outline=outline,
                windows=" ".join(windows),nodes=nodes,links=links,places=drawn)



def main_floor(number, count):
    """An articulated street frontage with transverse teaching wings around separate courts."""
    building = "main"
    teaching_rooms, symbols = floor_rooms(building, number, count)
    half = 16
    upper = number == 5
    front_y, core_x, core_y = 425, 750, 178
    bands, halls = [], []
    boxes, fixtures, windows = [], [], []
    places, nodes, links = [], {}, []

    # A gallery is a walkable centreline plus a strip of floor. A band of classrooms
    # shares its doors with that line; the outside wall can step independently.
    def hall(axis, fixed, start, end):
        halls.append((axis, fixed, start, end))
        if axis == "h":
            boxes.append((start, fixed-half, end, fixed+half))
        else:
            boxes.append((fixed-half, start, fixed+half, end))

    def band(axis, fixed, side, start, end, outer, zone):
        bands.append((axis, fixed, fixed + side*half, start, end, outer, zone))

    hall("h", front_y, 535 if upper else 52, 975 if upper else 1480)
    hall("v", core_x, core_y, front_y)
    hall("h", core_y, 630, 878)

    # Five facade volumes alternating with recessed, narrower links. The centre bay
    # is carried further forward by the entrance canopy at street level.
    facade = [
        (52, 246, 543), (246, 401, 483), (401, 613, 533),
        (613, 684, 499), (684, 816, 540), (816, 898, 499),
        (898, 1119, 531), (1119, 1236, 477), (1236, 1480, 550),
    ]
    for left, right, exterior in facade:
        left, right = max(left, 535 if upper else 52), min(right, 975 if upper else 1480)
        if right <= left or number == 1 and left == 684:
            continue
        band("h", front_y, 1, left, right, exterior, "Парадная галерея")
    for left, right, edge in [(235,395,335), (565,664,353), (845,969,345), (1141,1284,323)]:
        if not upper or left >= 535 and right <= 975:
            band("h", front_y, -1, left, right, edge, "Галерея со стороны двора")

    # The central teaching pavilion is present even where the two lower side wings end.
    for left, right, back in [(630,702,103), (702,805,79), (805,878,112)]:
        band("h",core_y,-1,left,right,back,"Центральный павильон")
    for side, outer, spans in [
        (-1, 664, [(194,254), (326,409)]),
        (1, 845, [(194,242), (327,409)]),
    ]:
        for start, end in spans:
            band("v",core_x,side,start,end,outer,"Центральный павильон")

    if not upper:
        # The western court closes with a stepped low gallery. The eastern court is
        # deeper, has a larger assembly block on its outer side and a shorter rear link.
        for x, back_y, left, right, zone in [
            (145,114,52,235,"Западный торцевой корпус"),
            (480,114,395,565,"Западное поперечное крыло"),
            (1050,135,969,1141,"Восточное поперечное крыло"),
            (1380,135,1284,1480,"Восточный торцевой корпус"),
        ]:
            hall("v",x,back_y,front_y)
            band("v",x,-1,back_y+half,409,left,zone)
            if x == 1380:
                band("v",x,1,back_y+half,272,1507,zone)
                band("v",x,1,272,409,right,zone)
            elif x == 145:
                band("v",x,1,back_y+half,275,right-28,zone)
                band("v",x,1,275,409,right,zone)
            else:
                band("v",x,1,back_y+half,409,right,zone)

        hall("h",114,52,565)
        for left,right,back in [(52,234,33),(234,395,68),(395,565,48)]:
            band("h",114,-1,left,right,back,"Северо-западная галерея")
        band("h",114,1,235,395,177,"Западный двор")
        hall("h",135,969,1480)
        for left,right,back in [(969,1141,82),(1141,1284,97),(1284,1480,28)]:
            band("h",135,-1,left,right,back,"Северо-восточная галерея")
        band("h",135,1,1141,1284,205,"Восточный двор")

    def xy(axis, along, across):
        return (along,across) if axis == "h" else (across,along)

    def route_node(point):
        x,y = point
        key = f"{number}@{x},{y}"
        nodes[key] = [x,y]
        return key

    hall_points = {h:{h[2],h[3]} for h in halls}

    def attach(place, box, anchor, door, axis, fixed, zone, terminal=None):
        left,top,right,bottom = box
        assert right > left and bottom > top, box
        boxes.append(box)
        along = door[0] if axis == "h" else door[1]
        h = next(h for h in halls if h[0] == axis and h[1] == fixed and h[2] <= along <= h[3])
        hall_points[h].add(along)
        place["path"] = box_path(box)
        place["zone"] = zone
        place["anchor"] = anchor
        place["node"] = terminal or route_node(door)
        nodes[place["node"]] = list(door)
        links.append([place["node"],route_node(xy(axis,along,fixed))])
        places.append(place)

    amounts = allocate([end-start for _,_,_,start,end,_,_ in bands],len(teaching_rooms))
    start_index = 0
    for (axis,fixed,wall,start,end,outer,zone),quantity in zip(bands,amounts):
        section = teaching_rooms[start_index:start_index+quantity]
        weights = [1.55 if p["kind"] in ("library","food") else 1.24 if p.get("seats",0)>40 else 1 for p in section]
        before = start
        for i,(place,weight) in enumerate(zip(section,weights)):
            after = rounded(start+(end-start)*sum(weights[:i+1])/sum(weights))
            mid = rounded((before+after)/2)
            low,high = sorted((wall,outer))
            a,b = xy(axis,before,low),xy(axis,after,high)
            attach(place,(*a,*b),list(xy(axis,mid,rounded((wall+outer)/2))),xy(axis,mid,wall),axis,fixed,zone)
            for fraction in (.26,.74):
                wx = rounded(before+(after-before)*fraction)
                windows.append(poly_path([xy(axis,wx-8,outer),xy(axis,wx+8,outer)],False))
            before = after
        start_index += quantity

    core_rooms = {
        "stairs": (664,254,734,326), "lift": (766,279,845,327), "wc": (766,242,835,279),
    }
    for kind,box in core_rooms.items():
        left,top,right,bottom = box
        px,py = rounded((left+right)/2),rounded((top+bottom)/2)
        door_x = right if right < core_x else left
        attach(symbols[kind],box,[px,py],(door_x,py),"v",core_x,"Центральный холл",f"{number}-{kind}")

    water = symbols["water"]
    water.update(anchor=[core_x-5,265],node=route_node((core_x-5,265)),zone="Центральный холл")
    places.append(water)
    hall_points[("v",core_x,core_y,front_y)].add(265)
    links.append([water["node"],route_node((core_x,265))])
    if number == 1:
        # The ceremonial entrance has a deep lobby, a narrower projecting canopy,
        # and four column marks along its apron.
        entrance = symbols["entrance"]
        attach(entrance,(684,441,816,540),[750,485],(750,441),"h",front_y,"Парадный вход","1-entry")
        canopy = (708,538,792,567)
        boxes.append(canopy)
        nodes["1-front-door"] = [750,567]
        links.append(["1-front-door","1-entry"])
        for x in (713,733,767,787):
            fixtures.append(box_path((x-2,558,x+2,562)))
        for y in (546,550,554):
            fixtures.append(poly_path([(714,y),(786,y)],False))

    for horizontal in (line for line in halls if line[0]=="h"):
        _,y,x1,x2 = horizontal
        for vertical in (line for line in halls if line[0]=="v"):
            _,x,y1,y2 = vertical
            if x1 <= x <= x2 and y1 <= y <= y2:
                hall_points[horizontal].add(x)
                hall_points[vertical].add(y)
    for (axis,fixed,_,_),positions in hall_points.items():
        ordered = [route_node(xy(axis,pos,fixed)) for pos in sorted(positions)]
        links.extend([a,b] for a,b in zip(ordered,ordered[1:]))
    return dict(id=str(number), name=f"{number} этаж", outline=footprint(boxes),
                fixtures=" ".join(fixtures),windows=" ".join(windows),nodes=nodes,links=links,places=places)


def make_building(key, config):
    draw_floor = main_floor if key == "main" else modern_floor
    floors = [draw_floor(*level) for level in config["levels"]]
    links = [[a["id"]+"-lift",b["id"]+"-lift","Лифт"] for a,b in zip(floors,floors[1:])]
    return dict(id=key,name=config["name"],aliases=config["aliases"],viewBox=[10,22,1560,565],
                metersPerUnit=DEMO_METERS_PER_UNIT,
                entryFloor="1",entranceNode="1-front-door",footprint=next(f["outline"] for f in floors if f["id"]=="1"),
                connections=links, floors=floors)


if __name__ == "__main__":
    atlas = {"version":1,"buildings":[make_building(key, config) for key,config in BUILDINGS.items()]}
    OUTPUT.write_text(json.dumps(atlas,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
