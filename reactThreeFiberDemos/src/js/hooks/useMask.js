import React, { Component, Suspense, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree, useLoader, useUpdate } from 'react-three-fiber'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../contrib/three/v119/GLTFLoader.js'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_FACE_0.json'
// import main script:
import WEBARROCKSFACE from '../contrib/WebARRocksFace/dist/WebARRocksFace.module.js'

// import THREE Helper
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import threeHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceThreeHelper.js'

// import flexible mask helper
import flexibleMaskHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceFlexibleMaskHelper.js'

// lighting helper
import lightingHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceLightingHelper.js'

// ASSETS:
// import 3D model:
import GLTFModel from '../../assets/flexibleMask2/foolMask.glb'

// import AR Metadatas (tells how to deform GLTFModel)
import ARTrackingMetadata from '../../assets/flexibleMask2/foolMaskARMetadata.json'

// import occluder
import GLTFOccluderModel from '../../assets/flexibleMask2/occluder.glb'

// import envMap:
import envMap from '../../assets/flexibleMask2/venice_sunset_512.hdr'

let _flexibleMaskMesh = null, _threeCamera = null;

// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = (props) => {
    const threeFiber = useThree()
    _threeCamera = threeFiber.camera
    useFrame(threeHelper.update_threeCamera.bind(null, props.sizing, threeFiber.camera))
    lightingHelper.set(threeFiber.gl, threeFiber.scene, props.lighting)
    return null
}

const VTOModelContainer = (props) => {
    const objRef = useUpdate((threeObject3DParent) => {
        const threeObject3D = threeObject3DParent.children[0]
        const allLandmarksLabels = WEBARROCKSFACE.get_LMLabels()
        if (_flexibleMaskMesh && _flexibleMaskMesh.parent) {
            _flexibleMaskMesh.parent.remove(_flexibleMaskMesh)
        }
        _flexibleMaskMesh = flexibleMaskHelper.build_flexibleMaskFromStdMetadata(allLandmarksLabels, threeObject3D, props.ARTrackingExperience, false)
        threeObject3D.add(_flexibleMaskMesh)
        threeHelper.set_faceFollower(threeObject3DParent, threeObject3D, props.faceIndex)
    })

    // import main model:
    const gltf = useLoader(GLTFLoader, props.GLTFModel)
    const model = gltf.scene.clone()

    // import and create occluder:
    const isDebugOccluder = false // true to debug the occluder
    const gltfOccluder = useLoader(GLTFLoader, props.GLTFOccluderModel)
    const occluderModel = gltfOccluder.scene.clone()
    const occluderMesh = threeHelper.create_occluderMesh(occluderModel, isDebugOccluder)

    return (
        <object3D ref={objRef}>
            <object3D>
                <primitive object={model} />
                <primitive object={occluderMesh} />
            </object3D>
        </object3D>
    )
}

const DebugCube = (props) => {
    const s = props.size || 1
    return (
        <mesh name="debugCube">
            <boxBufferGeometry args={[s, s, s]} />
            <meshNormalMaterial />
        </mesh>
    )
}

export default function useMask({
    canvasRef, 
    maskId, // NOT USED FOR NOT, It will be used to import the mask resources
    sizing
}) {

    const ARTrackingFaceMetadata = ARTrackingMetadata['ARTRACKING'].filter((ARTrackingExperience) => {
        return (ARTrackingExperience['TYPE'] === "FACE")
    })
    if (ARTrackingFaceMetadata.length === 0) {
        throw new Error('No Face AR tracking experience where found')
    }
    const ARTrackingExperience = ARTrackingFaceMetadata[0];
    const lighting = {
        envMap,
        pointLightIntensity: 0.8,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
    }

    useEffect( () => {
        if (canvasRef) {
            threeHelper.init(WEBARROCKSFACE, {
                NN,
                canvas: canvasRef,
                maxFacesDetected: 1,
                callbackReady: (err) => {
                    if (err) throw new Error(err)
                    console.log('threeHelper has been initialized successfully')
                },
                callbackTrack: (detectStates, landmarksStabilized) => {
                    if (_flexibleMaskMesh && _threeCamera) {
                        flexibleMaskHelper.update_flexibleMask(_threeCamera, _flexibleMaskMesh, detectStates, landmarksStabilized)
                    }
                }
            })  
        }
        
        return () => {
            _flexibleMaskMesh = null
            _threeCamera = null
            WEBARROCKSFACE.destroy()
        }
    }, [maskId, canvasRef]);

    useEffect( () => {
        // Not sure about this. Maybe at first render it will break
        if (canvasRef) {
            threeHelper.resize();
        }
    }, [canvasRef, sizing])

    return ( { 
        Canvas: (
            <Canvas 
                className='mirrorX' 
                style={{
                    position: 'fixed',
                    zIndex: 2,
                    ...sizing
                }}
                gl={{
                    preserveDrawingBuffer: true // allow image capture
                }}
            >
                <DirtyHook sizing={sizing} lighting={lighting} />

                <Suspense fallback={<DebugCube />}>
                    <VTOModelContainer
                        GLTFModel={GLTFModel}
                        GLTFOccluderModel={GLTFOccluderModel}
                        faceIndex={0} 
                        ARTrackingExperience={ARTrackingExperience} 
                    />
                </Suspense>
            </Canvas>
        ),
        mediaStream: null
    });
}