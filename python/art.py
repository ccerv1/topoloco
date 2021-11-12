import gdal
import json
import matplotlib.pyplot as plt
from matplotlib.colors import LinearSegmentedColormap as LSC
from matplotlib.colors import ListedColormap as LC
import numpy as np
import os
from PIL import Image
import sys

from dem import box_around_point, make_DEM


DEM_DIR = os.path.join(os.getcwd(), "../DEMs/")
IMG_DIR = os.path.join(os.getcwd(), "../img/")

META_PATH = os.path.join(os.getcwd(), "../data/metadata.json")
METADATA = json.load(open(META_PATH)) 

COLORS_PATH =os.path.join(os.getcwd(), "../data/mymind_colorpalette.json")
COLORS = json.load(open(COLORS_PATH)) 

BGCOLOR = "#FFFFFF"
DPI = 72
FS = 15

def hex_to_rgb(h):
    return tuple(int(h.lstrip('#')[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(r):
    return '#%02x%02x%02x' % r

def color_distance(rgb1, rgb2):
    return ((rgb1[0]-rgb2[0])**2 + (rgb1[1]-rgb2[1])**2 + (rgb1[2]-rgb2[2])**2)**.5

def opposite_color(hex_color):
    r1 = hex_to_rgb(hex_color)
    r2 = sorted(COLORS.values(), key = lambda x: color_distance(x, r1), reverse = True)[0]
    return rgb_to_hex(r2).upper()

def custom_cmap(maxcol, mincol=None, name='custom_cmap', numcolors=50):
    
    """ 
    Create a custom diverging colormap with TWO colors
    Colors can be specified in any way understandable by
    matplotlib.colors.ColorConverter.to_rgb()
    
    """
    import random
    #return LC(random.sample(list(COLORS), numcolors), N=numcolors)
    #return LC(sorted(list(COLORS)), N=numcolors)
    #return LC(sorted(list(COLORS)))
    
    if mincol is None: mincol = opposite_color(maxcol)        
    return LSC.from_list(name=name, colors=[mincol, maxcol], N=numcolors)


def ingest_DEM(filename):
    
    """
    Ingests a DEM and converts to an array
    
    """
    
    gdal_data = gdal.Open(filename)
    gdal_band = gdal_data.GetRasterBand(1)
    nodataval = gdal_band.GetNoDataValue()

    # convert to a numpy array
    data_array = gdal_data.ReadAsArray().astype(np.float64)

    # replace missing values if necessary
    if np.any(data_array == nodataval):
        data_array[data_array == nodataval] = np.nan
        
    data_array = data_array[::-1]
    return data_array


def make_title(data):

    name = data["Name"].replace("_"," ").upper() + f" [{data['uid']}]"
    box = box_around_point(
        data["Latitude"], 
        data["Longitude"],
        radius=data["Radius"], 
        decimals=2
    )
    label = {
        "Name": name,
        "Country": data["Country"],
        "Coords": " ".join(str(p) for p in box),
        "Palette": " - ".join([data["min_color"], data["max_color"]])
    }
    title = "\n".join([f"{k}: {v}" for k,v in label.items()])
    return title


def masked_cmap(cmap, mask_level, reverse):

    bgcolor = tuple([x/255. for x in hex_to_rgb(BGCOLOR)] + [1])
    if reverse:
        cmap_list = [
            cmap(i) if i >= mask_level else bgcolor
            for i in range(cmap.N)
        ]
    else:
        cmap_list = [
            cmap(i) if i < mask_level else bgcolor
            for i in range(cmap.N)
        ]
    return LSC.from_list("masked_cmap", cmap_list)


def make_print(data, data_array, mask_level=None, reverse=False):

    title = make_title(data)
    name = data["Name"]
    
    fig, (ax, footer) = plt.subplots(2, 1, gridspec_kw={'height_ratios': [FS, 1]}, 
                                     figsize=(FS,FS), dpi=DPI, facecolor=BGCOLOR)
    
    # make contour maps
    num_levels = data["Levels"]
    levels = np.linspace(data_array.min(), data_array.max(), num_levels)
    cmap = custom_cmap(data["max_color"], mincol=data["min_color"], numcolors=num_levels)
    
    if mask_level:
        cmap = masked_cmap(cmap, mask_level, reverse)

    ax.contourf(data_array, cmap=cmap, levels=levels)
    ax.contour(data_array, levels=levels, **data["line_kwargs"])
    
    # make footer
    n, bins, patches = footer.hist(data_array.flatten(), num_levels)
    footer.text(s=title,  va='top', ha='left', x=0, y=footer.get_ylim()[1])

    # scale values to interval [0,1]
    bin_centers = 0.5 * (bins[:-1] + bins[1:])
    col = bin_centers - min(bin_centers)
    col /= max(col)
    for c, p in zip(col, patches):
        p.set(facecolor=cmap(c))
    
    # add title
    ax.tick_params(bottom=False, top=False, left=False, right=False, labelleft=False, labelbottom=False)    
    footer.tick_params(bottom=True, top=False, left=False, right=False, labelleft=False, labelbottom=True)    
    footer.spines['top'].set_visible(False)
    footer.spines['right'].set_visible(False)
    footer.spines['left'].set_visible(False)
    footer.set_xlim(0,)
    footer.set_facecolor(BGCOLOR)
    fig.tight_layout()

    outdir = os.path.join(IMG_DIR, name)
    if not os.path.isdir(outdir):
        os.mkdir(outdir)
    if mask_level:
        name += " " + str(mask_level).zfill(2)
    outpath = os.path.join(outdir, f"{name}.png")
    fig.savefig(outpath, bbox_inches='tight', pad_inches=0.1)
    plt.close("all")
    return outpath
    

def locate_record(name):

    matching_records = [
        m for m in METADATA
        if m["Name"] == name or m["uid"] == name
    ]
    if len(matching_records) > 1:
        print("More than one match found:")
        for m in matching_records:
            print(m)
            print("---")
        return None
    
    data = matching_records[0]
    return data


def make_gif(name, img_paths):

    outpath = os.path.join(IMG_DIR, name, f"{name}.gif")
    
    # f.resize((1000,1000),Image.ANTIALIAS)
    img, *imgs = [Image.open(f) for f in img_paths]
    img.save(fp=outpath, format='GIF', append_images=imgs,
             save_all=True, duration=100, loop=0)

def main():
    print("\n*********************")
    if len(sys.argv) == 1:
        data = METADATA[-1]
    else:
        try:
            name = sys.argv[1]
            data = locate_record(name)
        except:
            raise ValueError("Could not locate a record.")
    try:
        data_array = ingest_DEM(data["Path"])
    except Exception as e:
        raise e

    if "gif" in data["Type"]:
        imgs = []
        runs = data["Levels"]
        reverse = "reverse" in data["Type"]
        for i in range(1,runs+1):
            print(str(i))                
            img = make_print(data, data_array, mask_level=i, reverse=reverse)
            imgs.append(img)
        
        if reverse:
            make_gif(data["Name"], reversed(imgs))
        else:
            make_gif(data["Name"], imgs)

    else:
        make_print(data, data_array)
        print("Success! Added generated new fig.")


if __name__ == "__main__":
    main()    