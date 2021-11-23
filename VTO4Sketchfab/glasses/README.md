# VTO for Sketchfab glasses demo


## Presentation

This demo is standalone (it does not require parent directories).
It displays the glasses 3D model using Sketchfab viewer.
The 3D model is controlled using [Sketchfab viewer API](https://sketchfab.com/developers/viewer)

Technically, the Sketchfab viewer is displayed using an `<iframe>`. The `<video>` element is displayed below.
It requires a Sketchfab pro account to set the background of the Sketchfab viewer to transparent.


## 3D Model

In [assets](assets) path you will find the model which has been uploaded on Sketchfab.
Its 3D pose (position, orientation, scale) should follow the [same guidelines as the THREE.js Glasses VTO demo](/demos/VTOGlasses#positioning-and-scaling).

The glasses model should be uploaded in the *worn position*, i.e. with branches slightly apart instead of being parallel like in rest position.
