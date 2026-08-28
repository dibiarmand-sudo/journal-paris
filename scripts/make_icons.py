import struct
import zlib
import os

BG = (20, 24, 31)        # --bg #14181f
BAR_INFO = (91, 124, 153)  # --info #5b7c99
BAR_GOOD = (107, 144, 128) # --good #6b9080

def make_png(path, size):
    width = height = size
    margin = 0.20
    gap = 0.07
    n = 3
    total_w = 1 - 2 * margin
    bar_w = (total_w - (n - 1) * gap) / n
    heights = [0.30, 0.52, 0.76]
    colors = [BAR_INFO, BAR_INFO, BAR_GOOD]
    baseline = 1 - margin
    top_area = margin

    bars = []
    for i in range(n):
        bx0 = margin + i * (bar_w + gap)
        bx1 = bx0 + bar_w
        by1 = baseline
        by0 = baseline - heights[i] * (baseline - top_area)
        bars.append((bx0, bx1, by0, by1, colors[i]))

    raw = bytearray()
    for y in range(height):
        raw.append(0)  # filter: none
        py = (y + 0.5) / height
        for x in range(width):
            px = (x + 0.5) / width
            color = BG
            for bx0, bx1, by0, by1, c in bars:
                if bx0 <= px <= bx1 and by0 <= py <= by1:
                    color = c
                    break
            raw += bytes(color)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)  # 8-bit RGB
    idat = zlib.compress(bytes(raw), 9)

    with open(path, 'wb') as f:
        f.write(sig)
        f.write(chunk(b'IHDR', ihdr))
        f.write(chunk(b'IDAT', idat))
        f.write(chunk(b'IEND', b''))

out_dir = os.path.join(os.path.dirname(__file__), '..', 'icons')
make_png(os.path.join(out_dir, 'icon-192.png'), 192)
make_png(os.path.join(out_dir, 'icon-512.png'), 512)
make_png(os.path.join(out_dir, 'apple-touch-icon.png'), 180)
print('icons written to', os.path.abspath(out_dir))
