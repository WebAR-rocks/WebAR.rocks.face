# Stabilizers

Since the raw output of a neural network is almost always noisy, we need to stabilize the 2D positions of the landmarks using a stabilizer.

All the classes in this directory are equivalent and have the same interface. They are 2D stabilizers to filter the position of the landmarks provided by the neural network, to avoid jittering.

There is always a balance between stabilization and responsiveness. If the outputs are too stabilized, it may add latency to the tracking.

To use a stabilizer, just call:
```
const stabilizerInstance = WebARRocksLMStabilizer.instance({...options});
<array> stabilizedLandmarks = stabilizerInstance.update(<array>landmarks, <int>widthPx, <int>heightPx);
```

Where:

* `options` are stabilizer option, depending on the stabilizer. It can be `{}` to keep default options,
* `landmarks` is the array of landmarks position provided by *WebAR.rocks.face*, usually `detectState.landmarks`,
* `widthPx` and `heightPx` are the dimensions of the rendering canvas.

This function returns an array which has the same format as the input `landmarks` array. You can use it to compute the face pose.