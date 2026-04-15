from PIL import Image, ImageDraw

def draw_icon(size):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Colors
    BG       = (74,  46, 26)   # #4A2E1A dark brown
    CREAM    = (245, 230, 211) # #F5E6D3
    ORANGE   = (232, 120, 74)  # #E8784A
    DARK     = (74,  46, 26)   # same as bg for screen

    # -- Background with rounded corners --
    radius = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=BG)

    # -- Dimensions for the body --
    body_w = int(size * 0.65)
    body_h = int(size * 0.55)
    body_x = (size - body_w) // 2
    # Position body in lower portion; leave room for receipt above
    body_y = int(size * 0.38)
    body_r = int(size * 0.04)

    # -- Receipt sticking up from top-center of body --
    receipt_w = int(size * 0.08)
    receipt_h = int(size * 0.12)
    receipt_x = (size - receipt_w) // 2
    receipt_y = body_y - receipt_h + int(size * 0.01)
    draw.rectangle([receipt_x, receipt_y, receipt_x + receipt_w, body_y + int(size * 0.01)], fill=(255, 255, 255))

    # -- Main body --
    draw.rounded_rectangle(
        [body_x, body_y, body_x + body_w, body_y + body_h],
        radius=body_r,
        fill=CREAM
    )

    # -- Screen: top of body --
    screen_margin_x = int(body_w * 0.10)
    screen_w = int(body_w * 0.80)
    screen_h = int(body_h * 0.20)
    screen_x = body_x + screen_margin_x
    screen_y = body_y + int(body_h * 0.06)
    screen_r = int(size * 0.02)
    draw.rounded_rectangle(
        [screen_x, screen_y, screen_x + screen_w, screen_y + screen_h],
        radius=screen_r,
        fill=DARK
    )

    # -- Keys: 3 columns x 4 rows of orange squares --
    cols, rows = 3, 4
    keys_area_x = body_x + int(body_w * 0.12)
    keys_area_y = screen_y + screen_h + int(body_h * 0.08)
    keys_area_w = int(body_w * 0.76)
    # Leave room for drawer at bottom
    keys_area_h = int(body_h * 0.46)

    gap = int(size * 0.015)
    key_w = (keys_area_w - gap * (cols - 1)) // cols
    key_h = (keys_area_h - gap * (rows - 1)) // rows
    key_r = int(size * 0.01)

    for row in range(rows):
        for col in range(cols):
            kx = keys_area_x + col * (key_w + gap)
            ky = keys_area_y + row * (key_h + gap)
            draw.rounded_rectangle(
                [kx, ky, kx + key_w, ky + key_h],
                radius=key_r,
                fill=ORANGE
            )

    # -- Cash drawer: thin rectangle at very bottom of body --
    drawer_margin = int(body_w * 0.06)
    drawer_w = body_w - 2 * drawer_margin
    drawer_h = int(body_h * 0.10)
    drawer_x = body_x + drawer_margin
    drawer_y = body_y + body_h - drawer_h - int(body_h * 0.04)
    drawer_r = int(size * 0.015)
    draw.rounded_rectangle(
        [drawer_x, drawer_y, drawer_x + drawer_w, drawer_y + drawer_h],
        radius=drawer_r,
        fill=CREAM
    )
    # thin border to distinguish from body background
    draw.rounded_rectangle(
        [drawer_x, drawer_y, drawer_x + drawer_w, drawer_y + drawer_h],
        radius=drawer_r,
        outline=(200, 185, 170),
        width=max(1, int(size * 0.004))
    )

    # Drawer handle: small orange circle centered on drawer
    handle_r = int(size * 0.018)
    hx = drawer_x + drawer_w // 2
    hy = drawer_y + drawer_h // 2
    draw.ellipse(
        [hx - handle_r, hy - handle_r, hx + handle_r, hy + handle_r],
        fill=ORANGE
    )

    return img


for size, filename in [(192, "icon-pos.png"), (512, "icon-pos-512.png")]:
    path = f"C:/Users/USUARIO/Downloads/CLUB M/{filename}"
    img = draw_icon(size)
    img.save(path, "PNG")
    print(f"Saved {path}")

print("Done.")
