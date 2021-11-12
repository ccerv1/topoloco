import elevation
import os
import sys



DEFAULT_DIR = os.path.join(os.getcwd(), "../DEMs/")


def box_around_point(latitude, longitude, radius=10, decimals=4):
    
    """
    
    Returns the coordinates and a rectangle patch 
    for a box centered at (longitude, latitude) 
    with a hypotenuse to each corner given by radius. 
    
    """
    
    # convert the radius from km to degrees
    r = float(radius)/111.
    
    # calculate the length of each side
    side = ((r**2)/2)**(1/2)
    
    # create the box coordinates
    lat, lon = float(latitude), float(longitude)
    box = (lon-side, lat-side, lon+side, lat+side)
    
    # round the coordinates
    box = tuple(map(lambda x: round(x, decimals), box))

    return box

def make_DEM(coords, radius, dem_name, dem_dir=DEFAULT_DIR):
    
    """
    
    Calculates the DEM's lat/lon boundaries and makes a call to the 
    elevation (eio) API to generate a DEM raster file in .tif format
    
    """
    
    
    # turns the filename into a path
    dem_path = f"{dem_dir}{dem_name}.tif"
    
    # turn coords into a box (with values as strings)
    box = box_around_point(*coords, radius=radius)
    
    # try to call the API directly
    elevation.clip(bounds=box, output=dem_path)
    elevation.clean()

    # create the elevation api call shell command
    coords_lst = [str(x) for x in box]
    map_cmd = " ".join(['eio clip -o', dem_path, '--bounds', *coords_lst])
    result = {'path': dem_path, 'call': map_cmd}
    
    return result    


def main():
    print("\n*********************")
    try:
        lat, lon, rad, name = sys.argv[1:]
        r = make_DEM((lat,lon), rad, name)
        path = r['path']
        print("Success! Added new DEM:", path)
    except Exception as e:
        print("\nExpects four arguments: latitude, longitude, radius, name.\n")
        raise e


if __name__ == "__main__":
    main()    