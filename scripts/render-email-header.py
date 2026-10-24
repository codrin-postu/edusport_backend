#!/usr/bin/env python3
"""Render the e-mail header image: small "CLUBUL SPORTIV" above the EDUSPORT wordmark.

Mirrors the approved mockup email-e-v2.html (option E1): label Inter Bold 9px, letter-spacing .34em,
uppercase; wordmark Climate Crisis 20px (axis Year 1979, as on the website), letter-spacing .04em;
both navy #0e1a3c on white. Fonts are the ones plan 2D bundles in assets/fonts (OFL).
Drawn at 2x for sharp rendering on high-density screens; the e-mail shows it at 176x32.

Usage: python3 scripts/render-email-header.py [--out PATH]
Needs Pillow (pip install pillow). Run once; the PNG is committed.
"""
import argparse
from PIL import Image, ImageDraw, ImageFont

SCALE = 2
WIDTH, HEIGHT = 176 * SCALE, 32 * SCALE
NAVY = (14, 26, 60, 255)
WHITE = (255, 255, 255, 255)
LABEL_FONT = 'assets/fonts/Inter-Bold.ttf'
WORDMARK_FONT = 'assets/fonts/ClimateCrisis-Variable.ttf'
WORDMARK_YEAR = 1979


def draw_spaced(draw, x, y, text, font, spacing):
    for ch in text:
        draw.text((x, y), ch, font=font, fill=NAVY)
        x += font.getlength(ch) + spacing
    return x


def render(out):
    img = Image.new('RGBA', (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(img)
    label = ImageFont.truetype(LABEL_FONT, 9 * SCALE)
    wordmark = ImageFont.truetype(WORDMARK_FONT, 20 * SCALE)
    wordmark.set_variation_by_axes([WORDMARK_YEAR])
    draw_spaced(draw, 0, 0, 'CLUBUL SPORTIV', label, 0.34 * 9 * SCALE)
    label_bottom = label.getbbox('CLUBUL SPORTIV')[3]
    glyph_top = wordmark.getbbox('EDUSPORT')[1]
    draw_spaced(draw, 0, label_bottom + 4 * SCALE - glyph_top, 'EDUSPORT', wordmark, 0.04 * 20 * SCALE)
    img.convert('RGB').save(out, 'PNG', optimize=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default='public/email/edusport-header.png')
    args = parser.parse_args()
    render(args.out)
    print(f'wrote {args.out} ({WIDTH}x{HEIGHT})')
