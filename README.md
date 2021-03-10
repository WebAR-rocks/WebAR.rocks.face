# JavaScript/WebGL lightweight and robust face tracking library based on landmark detection and tracking


This JavaScript library detects and tracks the face in real time from the webcam video feed captured with WebRTC. Then it is possible to overlay 3D content for augmented reality applications. This library is lightweight and it does not include any 3D engine or third party library. We want to keep it framework agnostic so the outputs of the library are raw: if a face is detected or not, the position and the scale of the detected face and the rotation Euler angles.

Facial landmarks positions are also among the neuron network outputs. There is still a balance between the number of detected keypoints and the accuracy/weights of the neuron network: the fewer keypoints, the best is the detection accuracy because the neuron network can be more focused.


## Table of contents

* [Features](#features)
* [Architecture](#architecture)
* [Demonstrations](#demonstrations)
* [Specifications](#specifications)
  * [Get started](#get-started)
  * [Optional init arguments](#optional-init-arguments)
  * [Error codes](#error-codes)
  * [The returned objects](#the-returned-objects)
  * [Miscellaneous methods](#miscellaneous-methods)
  * [Multiple faces](#multiple-faces)
  * [Optimization](#optimization)
  * [Using Module](#using-module)
* [Hosting](#hosting)
* [About the tech](#about-the-tech)
  * [Under the hood](#under-the-hood)
  * [Compatibility](#compatibility)
* [License](#license)
* [References](#references)


## Features

Here are the main features of the library:

* face detection,
* face tracking,
* face rotation detection,
* facial landmark detection,
* multiple faces detection and tracking,
* very robust for all lighting conditions,
* video acquisition with HD video ability,
* mobile friendly.


## Architecture

* `/demos/`: source code of the demonstrations, sorted by 2D/3D engine used,
* `/dist/`: core of the library: 
  * `WebARRocksFace.js`: main minified script,
  * `WebARRocksFace.module.js`: main minified script for module use (with `import` or `require`),
* `/helpers/`: scripts which can help you to use this library in some specific use cases,
* `/neuralNets/`: neural networks models,
* `/libs/`: 3rd party libraries and 3D engines used in the demos,
* `/reactThreeFiberDemos`: Demos with Webpack/NPM/React/Three Fiber,
* `/blenderPluginFlexibleMaskExporter`: Blender plugin to export the metadata JSON file used in the *flexibleMask2* demo.


## Demonstrations

The best demos have been ported to a modern front-end development environment (NPM / Webpack / React / Three Fiber / ES6) in  the [/reactThreeFiberDemos](/reactThreeFiberDemos) directory. This is a standalone directory.


Here are the static JavaScript demos:

* basic debug view (displays the face landmarks): [live demo](https://webar.rocks/demos/face/demos/basic/), [source code](/demos/basic/)
* advanced debug view: [live demo](https://webar.rocks/demos/face/demos/debug/), [source code](/demos/debug/)
* expressions detection debug view: [live demo](https://webar.rocks/demos/face/demos/expressionsDetection/), [source code](/demos/expressionsDetection/)
* earrings VTO 2D: [live demo](https://webar.rocks/demos/face/demos/earrings2D/), [source code](/demos/earrings2D/)
* earrings VTO 3D: [live demo](https://webar.rocks/demos/face/demos/earrings3D/), [source code](/demos/earrings3D/)
* glasses VTO: [live demo](https://webar.rocks/demos/face/demos/VTOGlasses/), [source code and specific documentation](/demos/VTOGlasses/),
* headphones/helmet VTO: [live demo](https://webar.rocks/demos/face/demos/VTOHelmet/), [source code](/demos/VTOHelmet/)
* necklace VTO: [live demo](https://webar.rocks/demos/face/demos/VTONecklace/), [source code](/demos/VTONecklace/)
* 3D flexible mask 2: [live demo](https://webar.rocks/demos/face/demos/flexibleMask2/), [source code](/demos/flexibleMask2/)
* makeup lipstick VTO: [live demo](https://webar.rocks/demos/face/demos/makeupLipstick/), [source code](/demos/makeupLipstick/)
* makeup shapes based VTO: [live demo](https://webar.rocks/demos/face/demos/makeupShapes/), [source code](/demos/makeupShapes/)
* makeup texture based VTO: [live demo](https://webar.rocks/demos/face/demos/makeupTexture/), [source code](/demos/makeupTexture/)
* sport makeup: [live demo](https://webar.rocks/demos/face/demos/makeupSport/), [source code](/demos/makeupSport/)


* GIF Face replacement: [live demo](https://webar.rocks/demos/face/demos/faceReplacement/gif), [source code](/demos/faceReplacement/gif/)


## Specifications

### Get started

The best way to get started is to take a look at our [boilerplate demo](/demos/basic/). It uses some handful helpers from [/helpers path](/helpers/). Here we describe the initialization of the core library without the helpers. But we strongly advise to use them.


On your HTML page, you first need to include the main script between the tags `<head>` and `</head>`:

```html
 <script src="dist/WebARRocksFace.js"></script>
```

Then you should include a `<canvas>` HTML element in the DOM, between the tags `<body>` and `</body>`. The `width` and `height` properties of the `<canvas>` element should be set. They define the resolution of the canvas and the final rendering will be computed using this resolution. Be careful to not enlarge too much the canvas size using its CSS properties without increasing its resolution, otherwise it may look blurry or pixelated. We advise to fix the resolution to the actual canvas size. Do not forget to call `WEBARROCKSFACE.resize()` if you resize the canvas after the initialization step. We strongly encourage you to use our helper `/helpers/WebARRocksResizer.js` to set the width and height of the canvas (see [Optimization/Canvas and video resolutions](#optimization) section).

```html
<canvas width="600" height="600" id='WebARRocksFaceCanvas'></canvas>
```

This canvas will be used by WebGL both for the computation and the 3D rendering. When your page is loaded you should launch this function:
```javascript
WEBARROCKSFACE.init({
  canvasId: 'WebARRocksFaceCanvas',
  NNCPath: '../../../neuralNets/NN_FACE_0.json', // neural network model
  callbackReady: function(errCode, spec){
    if (errCode){
      console.log('AN ERROR HAPPENS. ERROR CODE =', errCode);
      return;
    }
    [init scene with spec...]
    console.log('INFO: WEBARROCKSFACE IS READY');
  }, //end callbackReady()

  // called at each render iteration (drawing loop)
  callbackTrack: function(detectState){
    // render your scene here
    [... do something with detectState]
  } //end callbackTrack()
});//end init call
```



### Optional init arguments

* `<integer> maxFacesDetected`: Only for multiple face detection - maximum number of faces which can be detected and tracked. Should be between `1` (no multiple detection) and `8`. See [Multiple face section](#multiple-faces) for more details,
* `<integer> animateDelay`: With this statement you can set accurately the number of milliseconds during which the browser wait at the end of the rendering loop before starting another detection. If you use the canvas of this API as a secondary element (for example in *PACMAN* or *EARTH NAVIGATION* demos) you should set a small `animateDelay` value (for example 2 milliseconds) in order to avoid rendering lags.
* `<function> onWebcamAsk`: Function launched just before asking for the user to allow its webcam sharing,
* `<function> onWebcamGet`: Function launched just after the user has accepted to share its video. It is called with the video element as argument,
* `<dict> videoSettings`: override WebRTC specified video settings, which are by default:
```javascript
{
  'videoElement' // not set by default. <video> element used
   // If you specify this parameter,
   // all other settings will be useless
   // it means that you fully handle the video aspect

  'deviceId'            // not set by default
  'facingMode': 'user', // to use the rear camera, set to 'environment'

  'idealWidth': 800,  // ideal video width in pixels
  'idealHeight': 600, // ideal video height in pixels
  'minWidth': 480,    // min video width in pixels
  'maxWidth': 1280,   // max video width in pixels
  'minHeight': 480,   // min video height in pixels
  'maxHeight': 1280,  // max video height in pixels,
  'rotate': 0         // rotation in degrees possible values: 0,90,-90,180
},
```

If the user has a mobile device in portrait display mode, the width and height of these parameters are automatically inverted for the first camera request. If it does not succeed, we invert the width and height.


* `<dict> scanSettings`: overrides face scan settings - see `set_scanSettings(...)` method for more information.
* `<dict> stabilizationSettings`: overrides tracking stabilization settings - see `set_stabilizationSettings(...)` method for more information.
* `<boolean> isKeepRunningOnWinFocusLost`: Whether we should keep the detection loop running even if the user switches the browser tab or minimizes the browser window. Default value is `false`. This option is useful for a videoconferencing app, where a face mask should be still computed if the *FaceFilter* window is not the active window. Even with this option toggled on, the face tracking is still slowed down when the FaceFilter window is not active.





### Error codes

The initialization function ( `callbackReady` in the code snippet ) will be called with an error code ( `errCode` ). It can have these values:
* `false`: no error occurs,
* `"GL_INCOMPATIBLE"`: WebGL is not available, or this WebGL configuration is not enough (there is no WebGL2, or there is WebGL1 without OES_TEXTURE_FLOAT or OES_TEXTURE_HALF_FLOAT extension),
* `"ALREADY_INITIALIZED"`: the API has been already initialized,
* `"NO_CANVASID"`: no canvas ID was specified,
* `"INVALID_CANVASID"`: cannot find the `<canvas>` element in the DOM,
* `"INVALID_CANVASDIMENSIONS"`: the dimensions `width` and `height` of the canvas are not specified,
* `"WEBCAM_UNAVAILABLE"`: cannot get access to the webcam (the user has no webcam, or it has not accepted to share the device, or the webcam is already busy),
* `"GLCONTEXT_LOST"`: The WebGL context was lost. If the context is lost after the initialization, the `callbackReady` function will be launched a second time with this value as error code,
* `"MAXFACES_TOOHIGH"`: The maximum number of detected and tracked faces, specified by the optional init argument `maxFacesDetected`, is too high.


### The returned objects

We detail here the arguments of the callback functions like `callbackReady` or `callbackTrack`. The reference of these objects do not change for memory optimization purpose. So you should copy their property values if you want to keep them unchanged outside the callback functions scopes.

#### The initialization returned object

The initialization callback function ( `callbackReady` in the code snippet ) is called with a second argument, `spec`, if there is no error. `spec` is a dictionnary having these properties:
* `GL`: the WebGL context. The rendering 3D engine should use this WebGL context,
* `canvasElement`: the `<canvas>` element,
* `videoTexture`: a WebGL texture displaying the webcam video. It has the same resolution as the camera video,
* `[<float>, <float>, <float>, <float>]` videoTransformMat2: flatten 2x2 matrix encoding a scaling and a rotation. We should apply this matrix to viewport coordinates to render `videoTexture` in the viewport,
* `<HTMLVideoElement> video`: the video used as source for the webgl texture `videoTexture`,
* `<int> maxFacesDetected`: the maximum number of detected faces,
* `[<string> landmarksLabels]`: the list of the landmark labels. This list depends on the neural network model.


#### The detection state

At each render iteration a callback function is executed ( `callbackTrack` in the code snippet ). It has one argument ( `detectState` ) which is a dictionnary with these properties:
* `<float> detected`: the face detection probability, between `0` and `1`,
* `<float> x`, `<float> y`: The 2D coordinates of the center of the detection frame in the viewport (each between -1 and 1, `x` from left to right and `y` from bottom to top),
* `<float> s`: the scale along the horizontal axis of the detection frame, between 0 and 1 (1 for the full width). The detection frame is always square,
* `<float> rx`, `<float> ry`, `<float> rz`: the Euler angles of the head rotation in radians.
* `<array> landmarks`: `[[<float> x_0, <float> y_0],...,[<float> x_n, <float> y_n]]`: detected landmarks. `x_i` and `y_i` are the relative coordinates of the `i`th landmark in the viewport coordinates (between `-1` and `1`, from left to right and from bottom to top).

In multiface detection mode, `detectState` is an array. Its size is equal to the maximum number of detected faces and each element of this array has the format described just before.


### Miscellaneous methods

After the initialization (ie after that `callbackReady` is launched ) , these methods are available:

* `WEBARROCKSFACE.resize()`: should be called after resizing the `<canvas>` element to adapt the cut of the video,

* `WEBARROCKSFACE.toggle_pause(<boolean> isPause)`: pauses/resumes,

* `WEBARROCKSFACE.set_animateDelay(<integer> delay)`: Changes the `animateDelay` (see `init()` arguments),

* `WEBARROCKSFACE.set_inputTexture(<WebGLTexture> tex, <integer> width, <integer> height)`: Changes the video input by a WebGL Texture instance. The dimensions of the texture, in pixels, should be provided,

* `WEBARROCKSFACE.reset_inputTexture()`: Comes back to the user's video as input texture,

* `WEBARROCKSFACE.get_videoDevices(<function> callback)`: Should be called before the `init` method. 2 arguments are provided to the callback function:
  * `<array> mediaDevices`: an array with all the devices founds. Each device is a javascript object having a `deviceId` string attribute. This value can be provided to the `init` method to use a specific webcam. If an error happens, this value is set to `false`,
  * `<string> errorLabel`: if an error happens, the label of the error. It can be: `NOTSUPPORTED`, `NODEVICESFOUND` or `PROMISEREJECTED`.

* `WEBARROCKSFACE.set_scanSettings(<object> scanSettings)`: Overrides scan settings. `scanSettings` is a dictionnary with the following properties:
  * `<float> threshold`: detection threshold, between `0` and `1`. Default value is `0.75`. You can decrease it if you want to make the detection more sensitive (but it will increase the false positive detections),
  * `<int> nDetectsPerLoop`: specifies the number of detections per drawing loop. `0` for adaptative value. Default: `0`
  * `<int> nScaleLevels`: number of detection steps for the scale. Default: `3`,
  * `[<float>, <float>, <float>] overlapFactors`: overlaps between 2 scan positions for `X`, `Y` and `scale`. Default: `[2, 2, 3]`,
  * `<float> scale0Factor`: scale factor for the largest scan level. Default is `0.8`.

* `WEBARROCKSFACE.set_stabilizationSettings(<object> stabilizationSettings)`: Overrides detection stabilization settings. The output of the neural network is always noisy, so we need to stabilize it using a floating average to avoid shaking artifacts. The internal algorithm computes first a stabilization factor `k` between `0` and `1`. If `k==0.0`, the detection is bad and we favor responsivity against stabilization. It happens when the user is moving quickly, rotating the head or when the detection is bad. On the contrary, if `k` is close to `1`, the detection is nice and the user does not move a lot so we can stabilize a lot. `stabilizationSettings` is a dictionnary with the following properties:
  * `[<float> minValue, <float> maxValue] translationFactorRange`: multiply `k` by a factor `kTranslation` depending on the translation speed of the head (relative to the viewport). `kTranslation=0` if `translationSpeed<minValue` and `kTranslation=1` if `translationSpeed>maxValue`. The regression is linear. Default value: `[0.0015, 0.005]`,
  * `[<float> minValue, <float> maxValue] rotationFactorRange`: analogous to `translationFactorRange` but for rotation speed. Default value: `[0.12, 0.25]`,
  * `[<float> minValue, <float> maxValue] qualityFactorRange`: analogous to `translationFactorRange` but for the head detection coefficient. Default value: `[0.85, 0.95]`,
  * `[<float> minValue, <float> maxValue] alphaRange`: it specifies how to apply `k`. Between 2 successive detections, we blend the previous `detectState` values with the current detection values using a mixing factor `alpha`. `alpha=<minValue>` if `k<0.0` and `alpha=<maxValue>` if `k>1.0`. Between the 2 values, the variation is quadratic. Default value is `[0.05, 0.9]`,
It only applies to global pose stabilization. Landmarks are stabilized using helpers (`/helpers/WebARRocksLMStabilizer<X>.js`).

* `WEBARROCKSFACE.update_videoElement(<video> vid, <function|False> callback)`: changes the video element used for the face detection (which can be provided via `VIDEOSETTINGS.videoElement`) by another video element. A callback function can be called when it is done.

* `WEBARROCKSFACE.update_videoSettings(<object> videoSettings)`: dynamically change the video settings (see [Optional init arguments](optional-init-arguments) for the properties of `videoSettings`). It is useful to change the camera from the selfie camera (user) to the back (environment) camera. A `Promise` is returned.

* `WEBARROCKSFACE.destroy()`: Cleans both graphic memory and JavaScript memory, uninit the library. After that you need to init the library again. A `Promise` is returned.

* `WEBARROCKSFACE.is_winFocus()`: Return if the current window has focus or not (For example if the user has changed the browser tab if will return `false`). This function works only if init option `isKeepRunningOnWinFocusLost` is set to `true`.


### Multiple faces

It is possible to detect and track several faces at the same time. To enable this feature, you only have to specify the optional init parameter `maxFacesDetected`. Its maximum value is `8`. Indeed, if you are tracking for example 8 faces at the same time, the detection will be slower because there is 8 times less computing power per tracked face. If you have set this value to `8` but if there is only `1` face detected, it should not slow down too much compared to the single face tracking.

If multiple face tracking is enabled, the `callbackTrack` function is called with an array of detection states (instead of being executed with a simple detection state). The detection state format is still the same.


### Using module

`/dist/WebARRocksFace.module.js` is exactly the same as `/dist/WebARRocksFace.js` except that it works as a module, so you can import it directly using:

```javascript
import 'dist/WebARRocksFace.module.js'
```

or using `require`.



## Hosting

You should host the content of this repository using a HTTPS static server.

Be careful to enable gzip HTTP/HTTPS compression for JSON and JS files. Indeed, the neuron network JSON file, `neuralNets/NN_<xxx>.json` is quite heavy, but very well compressed with GZIP. You can check the gzip compression of your server [here](https://checkgzipcompression.com/).

The neuron network file, `neuralNets/NN_<xxx>.json` is loaded using an ajax `XMLHttpRequest` after calling `WEBARROCKSFACE.init()`. This loading is proceeded after the user has accepted to share its camera. So we won't load this quite heavy file if the user refuses to share it or if there is no webcam available. The loading can be faster if you systematically preload `neuralNets/NN_<xxx>.json` using a service worker or a simple raw `XMLHttpRequest` just after the HTML page loading. Then the file will be already in the browser cache when WebAR.rocks.face will request it.

Some directories of the latest version of this library are hosted on `https://cdn.webar.rocks/face/` and served through a content delivery network (CDN):

* [/dist](/dist/)
* [/helpers](/helpers/)



## About the tech

### Under the hood

This API uses [WebAR.rocks](https://webar.rocks) WebGL Deep Learning technology to detect and track the user's face using a neural network. The accuracy is adaptative: the best is the hardware, the more detections are processed per second. All is done client-side.

### Compatibility

* If `WebGL2` is available, it uses `WebGL2` and no specific extension is required,
* If `WebGL2` is not available but `WebGL1`, we require either `OES_TEXTURE_FLOAT` extension or `OES_TEXTURE_HALF_FLOAT` extension,
* If `WebGL2` is not available, and if `WebGL1` is not available or neither `OES_TEXTURE_FLOAT` or `OES_HALF_TEXTURE_FLOAT` are implemented, the user is not compatible.

In all cases, WebRTC should be implemented in the web browser, otherwise WebAR.rocks.face will not be able to get the webcam video feed. Here are the compatibility tables from [caniuse.com](https://caniuse.com/) here: [WebGL1](https://caniuse.com/#feat=webgl), [WebGL2](https://caniuse.com/#feat=webgl2), [WebRTC](https://caniuse.com/#feat=stream).

If a compatibility error is triggered, please post an issue on this repository. If this is a problem with the webcam access, please first retry after closing all applications which could use your device (Skype, Messenger, other browser tabs and windows, ...). Please include:
* a screenshot of [webglreport.com - WebGL1](http://webglreport.com/?v=1) (about your `WebGL1` implementation),
* a screenshot of [webglreport.com - WebGL2](http://webglreport.com/?v=2) (about your `WebGL2` implementation),
* the log from the web console,
* the steps to reproduce the bug, and screenshots.


## License

The license does not apply for all directories, files and subdirectories of `/libs/`.

This application is NOT released under open license.
The use of this library is granted by specific development contracts in a case by case basis.


## References

* [WebAR.rocks website](https://webar.rocks)
* [Webgl Academy: tutorials about WebGL and THREE.JS](http://www.webglacademy.com)
