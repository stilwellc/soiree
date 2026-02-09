from PIL import Image

def remove_background(input_path, output_path, bg_color=None, tolerance=30):
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()
    
    new_data = []
    
    # If bg_color is none, assume top-left corner is background
    if not bg_color:
        first_pixel = datas[0]
        bg_color = first_pixel[:3] # RGB
        
    for item in datas:
        r, g, b, a = item
        # Simple distance check
        dist = abs(r - bg_color[0]) + abs(g - bg_color[1]) + abs(b - bg_color[2])
        if dist < tolerance:
            new_data.append((255, 255, 255, 0)) # Make transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    # Crop to content for nicer logo
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

# Run
remove_background("assets/images/soiree-logo.jpg", "assets/images/soiree-logo-transparent.png", tolerance=50)
