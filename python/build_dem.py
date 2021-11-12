import json
import os

from dem import box_around_point, make_DEM


DEM_DIR = "../DEMs/"
META_PATH = os.path.join(os.getcwd(), "../data/metadata.json")
METADATA = json.load(open(META_PATH)) 

COLORS_PATH = os.path.join(os.getcwd(), "../data/mymind_colorpalette.json")
COLORS = json.load(open(COLORS_PATH)) 


def main():
    s = input("Enter Google map location: ")
    try:
        args = s.strip('/').replace('@','').split('/')
        if len(args) != 2:
            print("Invalid entry. Try again.")
            return
        
        name = args[0]
        name = name.replace('+', ' ')
        title = name.title().replace(' ', '')

        lat, lon, z = args[1].split(',')
        lat, lon = float(lat), float(lon)
        zooms = {'11z': 50, '12z': 20, '13z': 10, '14z': 5}
        radius = zooms.get(z,10)
        j = {
            "uid": str(len(METADATA)+1).zfill(5),
            "Name": name,
            "Path": f"{DEM_DIR}{title}.tif",
            "Country": "Unknown",
            "Latitude": lat,
            "Longitude": lon,
            "Radius": radius,
            "Levels": 50,
            "Type": "png",
            "max_color": "#0BBCD6",
            "min_color": "#340B0B",
            "line_kwargs": {"linewidths": 0.25, "cmap": "viridis"}
        }
        c = input("Country: ")
        if c:
            j.update({"Country": c})
        
        make_DEM((lat, lon), radius, title)
        
        with open(META_PATH,'r+') as file:            
            records = json.load(file)
            records.append(j)
            file.seek(0)
            json.dump(records, file, indent=4)
        

    except Exception as e:
        raise e


if __name__ == "__main__":
    main()    