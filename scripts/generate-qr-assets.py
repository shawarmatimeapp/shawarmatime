from pathlib import Path
from xml.etree import ElementTree

from PIL import Image, ImageDraw
from reportlab.graphics.barcode import qr


TARGET_URL = "https://shawarmatimeapp.github.io/shawarmatime/index.html"
OUT_DIR = Path("public/qr")
QUIET_MODULES = 4
PNG_SCALE = 20
BLACK = "#000000"
ORANGE = "#b45309"
WHITE = "#ffffff"


def qr_matrix():
    widget = qr.QrCodeWidget(TARGET_URL, barLevel="H")
    widget.qr.make()
    return [[bool(cell) for cell in row] for row in widget.qr.modules]


def write_png(matrix, path, dark_hex):
    size = len(matrix)
    image_size = (size + QUIET_MODULES * 2) * PNG_SCALE
    image = Image.new("RGB", (image_size, image_size), WHITE)
    draw = ImageDraw.Draw(image)
    dark = tuple(int(dark_hex[i:i + 2], 16) for i in (1, 3, 5))
    for y, row in enumerate(matrix):
        for x, is_dark in enumerate(row):
            if is_dark:
                x0 = (x + QUIET_MODULES) * PNG_SCALE
                y0 = (y + QUIET_MODULES) * PNG_SCALE
                draw.rectangle([x0, y0, x0 + PNG_SCALE - 1, y0 + PNG_SCALE - 1], fill=dark)
    image.save(path)


def write_svg(matrix, path, dark_hex):
    size = len(matrix)
    full = size + QUIET_MODULES * 2
    rects = []
    for y, row in enumerate(matrix):
        for x, is_dark in enumerate(row):
            if is_dark:
                rects.append(
                    f'<rect x="{x + QUIET_MODULES}" y="{y + QUIET_MODULES}" width="1" height="1"/>'
                )
    svg = "\n".join([
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {full} {full}" width="980" height="980" shape-rendering="crispEdges">',
        f'  <rect width="{full}" height="{full}" fill="{WHITE}"/>',
        f'  <g fill="{dark_hex}">',
        *[f"    {rect}" for rect in rects],
        "  </g>",
        "</svg>",
        ""
    ])
    path.write_text(svg, encoding="utf-8")


def read_bits(matrix, mask):
    size = len(matrix)
    version = (size - 17) // 4
    reader = qr.qrencoder.QRCode(version, qr.qrencoder.QRErrorCorrectLevel.H)
    reader.moduleCount = size
    mask_fn = qr.qrencoder.QRUtil.getMask(mask)
    bits = []
    for col, row in reader.dataPosIterator():
        bit = matrix[row][col] ^ mask_fn(row, col)
        bits.append(1 if bit else 0)
    return bits


def take(bits, pos, count):
    value = 0
    for bit in bits[pos:pos + count]:
        value = (value << 1) | bit
    return value


def decode_matrix(matrix):
    version = (len(matrix) - 17) // 4
    expected_len = len(TARGET_URL.encode("utf-8"))
    for mask in range(8):
        bits = read_bits(matrix, mask)
        codewords = [take(bits, pos, 8) for pos in range(0, len(bits) - 7, 8)]
        bits = deinterleaved_data_bits(codewords, version)
        pos = 0
        mode = take(bits, pos, 4)
        pos += 4
        if mode != 4:
            continue
        length = take(bits, pos, 8)
        pos += 8
        if length != expected_len:
            continue
        data = bytearray()
        for _ in range(length):
            data.append(take(bits, pos, 8))
            pos += 8
        try:
            decoded = data.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if decoded == TARGET_URL:
            return decoded
    raise ValueError("QR matrix did not decode to the target URL")


def deinterleaved_data_bits(codewords, version):
    blocks = qr.qrencoder.QRRSBlock.getRSBlocks(version, qr.qrencoder.QRErrorCorrectLevel.H)
    data = [[0] * block.dataCount for block in blocks]
    index = 0
    max_data_count = max(block.dataCount for block in blocks)
    for i in range(max_data_count):
        for block_index, block in enumerate(blocks):
            if i < block.dataCount:
                data[block_index][i] = codewords[index]
                index += 1
    data_codewords = [value for block in data for value in block]
    bits = []
    for codeword in data_codewords:
        for shift in range(7, -1, -1):
            bits.append((codeword >> shift) & 1)
    return bits


def matrix_from_png(path):
    image = Image.open(path).convert("RGB")
    full_modules = image.width // PNG_SCALE
    size = full_modules - QUIET_MODULES * 2
    matrix = []
    for y in range(size):
        row = []
        for x in range(size):
            px = (x + QUIET_MODULES) * PNG_SCALE + PNG_SCALE // 2
            py = (y + QUIET_MODULES) * PNG_SCALE + PNG_SCALE // 2
            r, g, b = image.getpixel((px, py))
            row.append((r + g + b) < 640)
        matrix.append(row)
    return matrix


def matrix_from_svg(path):
    tree = ElementTree.parse(path)
    root = tree.getroot()
    view_box = root.attrib["viewBox"].split()
    full = int(float(view_box[2]))
    size = full - QUIET_MODULES * 2
    matrix = [[False] * size for _ in range(size)]
    ns = "{http://www.w3.org/2000/svg}"
    for rect in root.findall(f".//{ns}g/{ns}rect"):
        x = int(float(rect.attrib["x"])) - QUIET_MODULES
        y = int(float(rect.attrib["y"])) - QUIET_MODULES
        if 0 <= x < size and 0 <= y < size:
            matrix[y][x] = True
    return matrix


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    matrix = qr_matrix()
    files = {
        "black_png": OUT_DIR / "shawarmatime-menu-black.png",
        "orange_png": OUT_DIR / "shawarmatime-menu-orange.png",
        "black_svg": OUT_DIR / "shawarmatime-menu-black.svg",
        "orange_svg": OUT_DIR / "shawarmatime-menu-orange.svg",
        "example_svg": OUT_DIR / "shawarmatime-menu.svg",
    }
    write_png(matrix, files["black_png"], BLACK)
    write_png(matrix, files["orange_png"], ORANGE)
    write_svg(matrix, files["black_svg"], BLACK)
    write_svg(matrix, files["orange_svg"], ORANGE)
    write_svg(matrix, files["example_svg"], BLACK)

    checks = {
        "matrix_decoder": decode_matrix(matrix),
        "png_pixel_decoder_black": decode_matrix(matrix_from_png(files["black_png"])),
        "png_pixel_decoder_orange": decode_matrix(matrix_from_png(files["orange_png"])),
        "svg_vector_decoder_black": decode_matrix(matrix_from_svg(files["black_svg"])),
        "svg_vector_decoder_orange": decode_matrix(matrix_from_svg(files["orange_svg"])),
    }
    for name, decoded in checks.items():
        print(f"{name}: {decoded}")


if __name__ == "__main__":
    main()
