from typing import Iterable, List, Optional, Sequence, Tuple


def _encode_value(value: int) -> List[str]:
    value = ~(value << 1) if value < 0 else value << 1
    chars: List[str] = []
    while value >= 0x20:
        chars.append(chr((0x20 | (value & 0x1F)) + 63))
        value >>= 5
    chars.append(chr(value + 63))
    return chars


def normalize_latlng_points(points: Iterable[Sequence[float]]) -> List[Tuple[float, float]]:
    cleaned: List[Tuple[float, float]] = []
    last_point: Optional[Tuple[float, float]] = None
    for point in points:
        if not point or len(point) < 2:
            continue
        lat = float(point[0])
        lng = float(point[1])
        if not (-90.0 <= lat <= 90.0 and -180.0 <= lng <= 180.0):
            continue
        if last_point and abs(lat - last_point[0]) < 1e-6 and abs(lng - last_point[1]) < 1e-6:
            continue
        cleaned.append((lat, lng))
        last_point = (lat, lng)
    return cleaned


def encode_polyline(points: Iterable[Sequence[float]], precision: int = 5) -> Optional[str]:
    coords = normalize_latlng_points(points)
    if len(coords) < 2:
        return None
    factor = 10 ** precision
    prev_lat = 0
    prev_lng = 0
    encoded: List[str] = []
    for lat, lng in coords:
        lat_i = int(round(lat * factor))
        lng_i = int(round(lng * factor))
        encoded.extend(_encode_value(lat_i - prev_lat))
        encoded.extend(_encode_value(lng_i - prev_lng))
        prev_lat = lat_i
        prev_lng = lng_i
    return "".join(encoded)
