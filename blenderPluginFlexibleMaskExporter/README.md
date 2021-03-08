 
# Blender Flexible Mask Exporter


Plugin for Blender to export the [JSON metadata file](../demos/flexibleMask2/assets/foolMaskARMetadata.json) used in the [flexibleMask2 demo](../demos/flexibleMask2).
This plugin was tested with Blender v2.90


## Architecture

* `io_export_flexibleMask`: Blender plugin
* `models3D`: 3D models to test this exporter
* `exported`: exported JSON files


## Install

To run this script,

Copy `io_export_flexibleMask` to your Blender script directory:

 * `/usr/share/blender/<version>/scripts/addons/` for Ubuntu

In Blender, go to Edit / Preferences / Add-ons and check `Import-Export: Export Flexible Mask metadata (JSON)`

Then the script should be here in File / Export / Flexible Mask metadata (JSON).

If you have updated the script, on Blender, reload scripts by hitting F3 to bring up the search popup, type in `reload`, and scroll down to `reload scripts`. Hit `Enter` to execute the command.

This script relies on *Measure-it* Blender addon to label keypoints.
You need to enable this addon by going to Edit / Preferences / Add-ons, search for *3D View MeasureIt* and check it.


## Usage

* Open you mesh. Only 1 geometry can be labeled,
* The geometry should have a specific and unique name, different from *Mesh*,
* Go to EDIT mode,
* Open Blender properties (N), *View* tab, *Measure-it* drawer (at the bottom),
* Ensure that the *Show* option is *Measure-it* toolbox is enabled,
* Select the face landmark to assign and specify its label in *Measure-it* toolbox,
* Go back to OBJECT mode, select the geometry, then export it using this plugin (*File/Export/Flexible Mask metadata JSON*),
* At least 4 landmarks should be labelled. Each label should be attributed once.


## Available labels

* `LEFT_EYEBROW_INSIDE`
* `RIGHT_EYEBROW_INSIDE`
* `LEFT_EYE_INSIDE`
* `RIGHT_EYE_INSIDE`
* `LEFT_EYE_OUTSIDE`
* `RIGHT_EYE_OUTSIDE`
* `LEFT_EYE_BOTTOM`
* `RIGHT_EYE_BOTTOM`
* `LEFT_EAR_BOTTOM`
* `RIGHT_EAR_BOTTOM`
* `LEFT_NOSE`
* `RIGHT_NOSE`
* `NOSE_BOTTOM`
* `LEFT_MOUTH`
* `RIGHT_MOUTH`
* `MOUTH_TOP`
* `MOUTH_BOTTOM`
* `CHIN_BOTTOM`


## References

* [Blender help for Measure-it tool](https://docs.blender.org/manual/en/latest/addons/3d_view/measureit.html)
* [Youtube video: use Blender 2.9 Measure-it tool](https://youtu.be/md403NhvwGg). Labelling of a point at 1:23
* [github.com/xavierjs/GLTFARMetadata](https://github.com/xavierjs/GLTFARMetadata): Some details about the exported JSON file format

