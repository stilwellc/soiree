from PIL import Image

def analyze_image(path):
    try:
        img = Image.open(path).convert("RGBA")
        width, height = img.size
        print(f"Image size: {width}x{height}")
        
        corners = [
            (0, 0),
            (width-1, 0),
            (0, height-1),
            (width-1, height-1)
        ]
        
        print("Corner pixel values (RGBA):")
        for x, y in corners:
            pixel = img.getpixel((x, y))
            print(f"  ({x}, {y}): {pixel}")
            
        # Sample a few pixels from the middle edge to see if we missed the background
        print("Sample edge pixels:")
        print(f"  (0, {height//2}): {img.getpixel((0, height//2))}")
        print(f"  ({width//2}, 0): {img.getpixel((width//2, 0))}")
        
    except Exception as e:
        print(f"Error: {e}")

analyze_image("assets/images/soiree-logo-transparent.png")
