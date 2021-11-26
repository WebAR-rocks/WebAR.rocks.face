import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../contrib/three/v126/examples/jsm/loaders/GLTFLoader.js'

// import components:
import BackButton from '../components/BackButton.js'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_FACE_1.json'

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



let _threeCamera = null, _flexibleMaskMesh = null


// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = (props) => {
  const threeFiber = useThree()
  _threeCamera = threeFiber.camera
  useFrame(threeHelper.update_threeCamera.bind(null, props.sizing, threeFiber.camera))
  lightingHelper.set(threeFiber.gl, threeFiber.scene, props.lighting)
  return null
}


const compute_sizing = () => {
  // compute  size of the canvas:
  const height = window.innerHeight
  const wWidth = window.innerWidth
  const width = Math.min(wWidth, height)

  // compute position of the canvas:
  const top = 0
  const left = (wWidth - width ) / 2
  return {width, height, top, left}
}


const VTOModelContainer = (props) => {
  threeHelper.clean()

  const objRef = useRef()
  useEffect(() => {
    const threeObject3DParent = objRef.current
    const threeObject3D = threeObject3DParent.children[0]
    const allLandmarksLabels = WEBARROCKSFACE.get_LMLabels()

    if (_flexibleMaskMesh && _flexibleMaskMesh.parent){
      _flexibleMaskMesh.parent.remove(_flexibleMaskMesh)
    }

    _flexibleMaskMesh = flexibleMaskHelper.build_flexibleMaskFromStdMetadata(allLandmarksLabels, threeObject3D,  props.ARTrackingExperience, false)
    threeObject3D.add(_flexibleMaskMesh)
    
    threeHelper.set_faceFollower(threeObject3DParent, threeObject3D, props.faceIndex)
  }, [props.GLTFModel, props.sizing])
  
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


const FlexibleMask = (props) => {
  // look for Face tracking metadata among ARMetadata:
  const ARTrackingFaceMetadata = ARTrackingMetadata['ARTRACKING'].filter((ARTrackingExperience) => {
    return (ARTrackingExperience['TYPE'] === "FACE")
  })
  if (ARTrackingFaceMetadata.length === 0){
    throw new Error('No Face AR tracking experience where found')
  }
  const ARTrackingExperience = ARTrackingFaceMetadata[0]

  // state:
  const [sizing, setSizing] = useState(compute_sizing())
  const [model, setModel] = useState(GLTFModel)
  const [isInitialized] = useState(true)

  // refs:
  const canvasFaceRef = useRef()

  // misc private vars:
  const _settings = {
    // occluder 3D model:
    GLTFOccluderModel,

    lighting: {
      envMap,
      pointLightIntensity: 0.8,
      pointLightY: 200, // larger -> move the pointLight to the top
      hemiLightIntensity: 0.8
    }
  }    
  let _timerResize = null
  

  const handle_resize = () => {
    // do not resize too often:
    if (_timerResize){
      clearTimeout(_timerResize)
    }
    _timerResize = setTimeout(do_resize, 200)
  }


  const do_resize = () => {
    _timerResize = null
    const newSizing = compute_sizing()
    setSizing(newSizing)    
  }


  useEffect(() => {
    if (!_timerResize){
      threeHelper.resize()
    }
  }, [sizing])


  useEffect(() => {
    // init WEBARROCKSFACE through the helper:
    threeHelper.init(WEBARROCKSFACE, {
      NN,
      canvas: canvasFaceRef.current,
      maxFacesDetected: 1,
      callbackReady: (err) => {
        if (err) throw new Error(err)

        // handle resizing / orientation change:
        window.addEventListener('resize', handle_resize)
        window.addEventListener('orientationchange', handle_resize)

        console.log('threeHelper has been initialized successfully')
      },
      callbackTrack: (detectStates, landmarksStabilized) => {
        if (_flexibleMaskMesh && _threeCamera){
          flexibleMaskHelper.update_flexibleMask(_threeCamera, _flexibleMaskMesh, detectStates, landmarksStabilized)
        }
      }
    })

    return () => {
      _threeCamera = null
      return WEBARROCKSFACE.destroy()  
    }
  }, [isInitialized])
  

  return (
    <div>
      {/* Canvas managed by three fiber, for AR: */}
      <Canvas className='mirrorX' style={{
        position: 'fixed',
        zIndex: 2,
        ...sizing
      }}
      gl = {{
        preserveDrawingBuffer: true // allow image capture
      }}
      updateDefaultCamera = {false}
      >
        <DirtyHook sizing={sizing} lighting={_settings.lighting} />
        
        <Suspense fallback={<DebugCube />}>
          <VTOModelContainer
            GLTFModel={model}
            GLTFOccluderModel={_settings.GLTFOccluderModel}
            faceIndex={0} ARTrackingExperience={ARTrackingExperience}
            sizing={sizing} />
        </Suspense>
      </Canvas>

    {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
      <canvas className='mirrorX' ref={canvasFaceRef} style={{
        position: 'fixed',
        zIndex: 1,
        ...sizing
      }} width = {sizing.width} height = {sizing.height} />

      <BackButton />        
    </div>
  )

} 

export default FlexibleMask
