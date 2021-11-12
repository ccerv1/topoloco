# topoloco

1. Run `python build_dem.py`
2. Enter a Google map location in the form: `NAME/LAT,LON,ZOOM`
-  NAME: Any text (spaces or '+' are ok)
-  LAT, LON: as floats (negative for E or S coords)
-  ZOOM: 11z, 12z, 13z, 14z
-  Example: `Test Site/30.37,9.05,13z`
3. The script will execute and download a geotif and create metadata
4. Edit the metadata to apply styling/settings:
```
{
      "uid": "00001",
      "Name": "Yosemite",
      "Country": "United States",
      "Path": "../DEMs/yosemite.tif",
      "Latitude": 37.8651,
      "Longitude": -119.5383,
      "Radius": 50,
      "Levels": 50,
      "Type": "gif",
      "max_color": "#0BBCD6",
      "min_color": "#340B0B",
      "line_kwargs": {
          "linewidths": 0.25
      }
  }
  ```
5. Run `art.py`
