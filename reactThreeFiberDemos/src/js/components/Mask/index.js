
import './style.scss';

import React, { useRef, useState, useEffect, useLayoutEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree, useUpdate, useLoader } from 'react-three-fiber'
import { useWindowSize } from '@react-hook/window-size';

// import neural network model:
import NN from '../../contrib/WebARRocksFace/neuralNets/NN_FACE_0.json'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../../contrib/three/v119/GLTFLoader.js'

// import main script:
import WEBARROCKSFACE from '../../contrib/WebARRocksFace/dist/WebARRocksFace.module.js'

// import THREE Helper
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import threeHelper from '../../contrib/WebARRocksFace/helpers/WebARRocksFaceThreeHelper.js'

// lighting helper
import lightingHelper from '../../contrib/WebARRocksFace/helpers/WebARRocksFaceLightingHelper.js'

// import flexible mask helper
import flexibleMaskHelper from '../../contrib/WebARRocksFace/helpers/WebARRocksFaceFlexibleMaskHelper.js'

// MASK FILES (IMPORT THEM DYNAMICALLY)
import getMask from './getMask';

// import ModelContainer from './ModelContainer';
import ModelFallback from './ModelFallback';

let flexibleMaskMesh = null;
let threeCamera = null;

function ModelContainer({
    GLTFModel,
    GLTFOccluderModel,
    faceIndex,
    ARTrackingExperience
}) {

    const maskRef = useUpdate((threeObject3DParent) => {
        const threeObject3D = threeObject3DParent.children[0]
        const allLandmarksLabels = WEBARROCKSFACE.get_LMLabels()
        if (flexibleMaskMesh && flexibleMaskMesh.parent) {
            flexibleMaskMesh.parent.remove(flexibleMaskMesh)
        }
        flexibleMaskMesh = flexibleMaskHelper.build_flexibleMaskFromStdMetadata(allLandmarksLabels, threeObject3D, ARTrackingExperience, false)
        threeObject3D.add(flexibleMaskMesh)
        threeHelper.set_faceFollower(threeObject3DParent, threeObject3D, faceIndex)
    })

    // import main model:
    const gltf = useLoader(GLTFLoader, GLTFModel)
    const model = gltf.scene.clone()

    // import and create occluder:
    const isDebugOccluder = false // true to debug the occluder
    const gltfOccluder = useLoader(GLTFLoader, GLTFOccluderModel)
    const occluderModel = gltfOccluder.scene.clone()
    const occluderMesh = threeHelper.create_occluderMesh(occluderModel, isDebugOccluder)

    return (
        <object3D ref={maskRef}>
            <object3D>
                <primitive object={model} />
                <primitive object={occluderMesh} />
            </object3D>
        </object3D>
    )
}

// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = ({
    width,
    height,
    lighting,
    maskRef
}) => {
    const threeFiber = useThree()
    threeCamera = threeFiber.camera
    useFrame(threeHelper.update_threeCamera.bind(null, {width, height}, threeFiber.camera))
    lightingHelper.set(threeFiber.gl, threeFiber.scene, lighting)

    maskRef.current = threeFiber.gl.domElement;

    return null
}

export default function Mask({
    className,
    deviceId,
    maskId,
}) {

    const faceCanvasRef = useRef(null);
    const wrapper = useRef(null);
    const composedCanvasRef = useRef(null)
    const maskCanvasRef = useRef(null);
    const [sizing, setSizing] = useState({ width: 100, height: 100 });
    const [windowWidth, windowHeight] = useWindowSize();
    const [ isMaskReady, setIsMaskReady ] = useState(false);

    const {
        envMap,
        model,
        metadata,
        occluder
    } = getMask(maskId);

    const lighting = {
        envMap,
        pointLightIntensity: 0.8,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
    }


    // look for Face tracking metadata among ARMetadata:
    const ARTrackingFaceMetadata = metadata['ARTRACKING'].filter((ARTrackingExperience) => {
        return (ARTrackingExperience['TYPE'] === "FACE")
    })
    if (ARTrackingFaceMetadata.length === 0) {
        throw new Error('No Face AR tracking experience where found')
    }
    const ARTrackingExperience = ARTrackingFaceMetadata[0]

    useEffect( () => {

        threeHelper.init(WEBARROCKSFACE, {
            NN,
            canvas: faceCanvasRef.current,
            maxFacesDetected: 1,
            callbackReady: (err) => {
                if (err) throw new Error(err)
                console.log('threeHelper has been initialized successfully')
                setIsMaskReady(true);
            },
            callbackTrack: (detectStates, landmarksStabilized) => {
                if (flexibleMaskMesh && threeCamera) {
                    flexibleMaskHelper.update_flexibleMask(
                        threeCamera, 
                        flexibleMaskMesh, 
                        detectStates, 
                        landmarksStabilized
                    )
                }
            },
            videoSettings: {
                deviceId: deviceId
            }
        })

        return () => {
            flexibleMaskMesh = null;
            threeCamera = null;
            WEBARROCKSFACE.destroy();
        }   
    }, [faceCanvasRef])

    useEffect(() => {
        let requestId;
        const render = () => {

            const canvas = composedCanvasRef.current;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(faceCanvasRef.current, 0, 0);
            ctx.drawImage(maskCanvasRef.current, 0, 0);

            requestId = requestAnimationFrame(render);
        };

        if (isMaskReady) render();

        return () => {
            cancelAnimationFrame(requestId);
        };
    }, [composedCanvasRef, faceCanvasRef, maskCanvasRef, isMaskReady]);

    useLayoutEffect( () => {
        const wrapperSizing = wrapper.current.getBoundingClientRect()
        setSizing({
            width: wrapperSizing.width,
            height: wrapperSizing.height,
        })
    }, [windowWidth, windowHeight, wrapper])

    useEffect( () => {
        threeHelper.resize()
    }, [sizing])

    let classNames = ['camera']
    if (className) classNames.push(className)

    return (
        <div 
            className={classNames.join(" ")}
            ref={wrapper}
        >

            <canvas 
                className='merge' 
                ref={composedCanvasRef}
                {...sizing}
            />
            
            {/* Canvas managed by three fiber, for AR: */}
            <Canvas
                className='mask' 
                gl={{
                    preserveDrawingBuffer: true // allow image capture
                }}
            >
                <DirtyHook
                    lighting={lighting} 
                    maskRef={maskCanvasRef}
                    {...sizing} 
                />

                <Suspense fallback={<ModelFallback />}>
                    <ModelContainer
                        GLTFModel={model}
                        GLTFOccluderModel={occluder}
                        faceIndex={0} 
                        ARTrackingExperience={ARTrackingExperience}
                    />
                </Suspense>
            </Canvas>

            {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
            <canvas 
                className='face' 
                ref={faceCanvasRef} 
                {...sizing}
            />
        </div>
    )
}