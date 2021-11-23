# VTO for Sketchfab glasses demo


## Presentation

This demo displays [this glasses 3D model](https://sketchfab.com/3d-models/glasses2-96bb6b6ef7664d2a936192f138fa0507) using Sketchfab viewer.
The 3D model is controlled using [Sketchfab viewer API](https://sketchfab.com/developers/viewer).

Technically, the Sketchfab viewer is displayed using an `<iframe>`. The `<video>` element is displayed below.
It requires a Sketchfab pro account to set the background of the Sketchfab viewer to transparent.


## Usage

This demo is standalone (it does not require parent directories). You just need to serve this directory through a static HTTPs server. You can [try it here](https://webar.rocks/demos/face/VTO4Sketchfab/glasses/).


## 3D Model

In [assets](assets) path you will find the model which has been uploaded on Sketchfab.
Its 3D pose (position, orientation, scale) should follow the [same guidelines as the THREE.js Glasses VTO demo](/demos/VTOGlasses#positioning-and-scaling).

The glasses model should be uploaded in the *worn position*, i.e. with branches slightly apart instead of being parallel like in rest position.
