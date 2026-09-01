#!/usr/bin/env python3
"""生成 app 图标 icon.ico"""
import io
import os
from PIL import Image, ImageDraw, ImageFont

SIZES = [16, 32, 48, 64, 128, 256]
os.makedirs('resources', exist_ok=True)

images = []

for size in SIZES:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方块背景（蓝）
    radius = int(size * 0.22)
    draw.rounded_rectangle(
        [0, 0, size - 1, size - 1], radius=radius, fill=(22, 119, 255, 255)
    )

    # 白色手机轮廓
    m = int(size * 0.28)  # margin
    bw = size - 2 * m     # 手机宽
    bh = size - 2 * m     # 手机高
    body = [m, m, m + bw, m + bh]
    r = int(size * 0.08)
    draw.rounded_rectangle(body, radius=r, outline=(255, 255, 255, 255), width=max(2, int(size * 0.06)))

    # 喇叭
    speaker_w = int(size * 0.22)
    speaker_h = max(2, int(size * 0.04))
    sx = (size - speaker_w) // 2
    sy = int(size * 0.12)
    draw.rounded_rectangle([sx, sy, sx + speaker_w, sy + speaker_h], radius=1, fill=(255, 255, 255, 255))

    # home 键
    if size >= 32:
        hw = int(size * 0.08)
        hx = (size - hw) // 2
        hy = size - m - int(size * 0.10)
        ch = max(2, int(size * 0.06))
        draw.rounded_rectangle([hx, hy, hx + hw, hy + ch], radius=1, fill=(255, 255, 255, 255))

    images.append(img)

# 保存 ICO
img.save(
    'resources/icon.ico',
    format='ICO',
    sizes=[(s, s) for s in SIZES],
    append_images=images
)
print('resources/icon.ico created')