# VTO for Sketchfab glasses demo

**WARNING: This is an experimental demo. To this day, there are still concerns (detailed below) for using WebAR.rocks.face combined with Sketchfab for production.**


## Presentation

This demo displays [this glasses 3D model](https://sketchfab.com/3d-models/glasses2-96bb6b6ef7664d2a936192f138fa0507) using Sketchfab viewer.
The 3D model is controlled using [Sketchfab viewer API](https://sketchfab.com/developers/viewer).

Technically, the Sketchfab viewer is displayed using an `<iframe>`. The `<video>` element is displayed below.
It requires a Sketchfab pro account to set the background of the Sketchfab viewer to transparent. It is currently not transparent since the 3D model is hosted on a free account.


## Usage

This demo is standalone (it does not require parent directories). You just need to serve this directory through a static HTTPs server. You can [try it here](https://webar.rocks/demos/face/VTO4Sketchfab/glasses/).


## 3D Model

In [assets](assets) path you will find the model which has been uploaded on Sketchfab.
Its 3D pose (position, orientation, scale) should follow the [same guidelines as the THREE.js Glasses VTO demo](/demos/VTOGlasses#positioning-and-scaling).

The glasses model should be uploaded in the *worn position*, i.e. with branches slightly apart instead of being parallel like in rest position.


## Issues

Issues are discussed on Sketchfab forum here: [Glasses virtual try-on with Sketchfab + viewer API](https://forum.sketchfab.com/t/glasses-virtual-try-on-with-sketchfab-viewer-api/41816/4)



### Slow matrix update

To update the pose of the glasses, We use the `setMatrix` function ([Viewer API - Functions - Sketchfab](https://sketchfab.com/developers/viewer/functions#api-setMatrix)). But it is slow. The callback function takes a long time to be called and during this time the pose is not updated. So the movement of the glasses is jerky.


### Lack of depth occluder

To hide the glasses branches, we to add a adepth occluder 3D object, i.e. a 3D object with the shape of the face, which will be rendered with a material writting into the depth buffer, but not in the color buffer. The goal is to reproduce the occlusion effect of the head of the user (in this demo for example there is such an occluder: [WebAR.rocks.face glasses VTO demo](https://webar.rocks/demos/face/demos/VTOGlasses/).