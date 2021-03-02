import React, { Component, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader, useUpdate } from 'react-three-fiber'
import * as THREE from 'three'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../contrib/three/v119/GLTFLoader.js'


// import components:
import BackButton from '../components/BackButton.js'

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



let _timerResize = null, _flexibleMaskMesh = null, _threeCamera = null


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

const ModelContainer = (props) => {

  if (!props.isVisible){
    return null
  }

  const objRef = useUpdate((threeObject3DParent) => {
    const threeObject3D = threeObject3DParent.children[0]
    const allLandmarksLabels = WEBARROCKSFACE.get_LMLabels()
    if (_flexibleMaskMesh && _flexibleMaskMesh.parent){
      _flexibleMaskMesh.parent.remove(_flexibleMaskMesh)
    }
    _flexibleMaskMesh = flexibleMaskHelper.build_flexibleMaskFromStdMetadata(allLandmarksLabels, threeObject3D,  props.ARTrackingExperience, false)
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


class FlexibleMask extends Component {
  constructor(props) {
    super(props)

    // look for Face tracking metadata among ARMetadata:
    const ARTrackingFaceMetadata = ARTrackingMetadata['ARTRACKING'].filter((ARTrackingExperience) => {
      return (ARTrackingExperience['TYPE'] === "FACE")
    })
    if (ARTrackingFaceMetadata.length === 0){
      throw new Error('No Face AR tracking experience where found')
    }
    const ARTrackingExperience = ARTrackingFaceMetadata[0]

    // initialize state:
    this.state = {
      isPaused: false,

      // size of the canvas:
      sizing: compute_sizing(),

      // 3D model:
      GLTFModel,

      // AR Metadatas
      ARTrackingExperience,

      // occluder 3D model:
      GLTFOccluderModel,

      isMaskEnabled: false,
      isTrackingEnabled: true,

      lighting: {
        envMap,
        pointLightIntensity: 0.8,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
      }
    }

    // handle resizing / orientation change:
    this.handle_resize = this.handle_resize.bind(this)
    this.do_resize = this.do_resize.bind(this)
    window.addEventListener('resize', this.handle_resize)
    window.addEventListener('orientationchange', this.handle_resize)
  }

  handle_resize() {
    // do not resize too often:
    if (_timerResize){
      clearTimeout(_timerResize)
    }
    _timerResize = setTimeout(this.do_resize, 200)
  }

  do_resize(){
    _timerResize = null
    const newSizing = compute_sizing()
    this.setState({sizing: newSizing}, () => {
      if (_timerResize) return
      threeHelper.resize()
    })
  }

  componentDidMount(){
    // init WEBARROCKSFACE through the helper:
    const canvasFace = this.refs.canvasFace
    threeHelper.init(WEBARROCKSFACE, {
      NN,
      canvas: canvasFace,
      maxFacesDetected: 1,
      callbackReady: (err) => {
        if (err) throw new Error(err)
        console.log('threeHelper has been initialized successfully')
      },
      callbackTrack: (detectStates, landmarksStabilized) => {
        if (_flexibleMaskMesh && _threeCamera){
          flexibleMaskHelper.update_flexibleMask(_threeCamera, _flexibleMaskMesh, detectStates, landmarksStabilized)
        }
      }
    })
  }

  shouldComponentUpdate(nextProps, nextState){
    return true
  }

  componentWillUnmount() {
    _timerResize = null
    _flexibleMaskMesh = null
    _threeCamera = null
    return WEBARROCKSFACE.destroy()
  }

  componentDidUpdate() {
    const isMaskVisible = this.state.isMaskEnabled && this.state.isTrackingEnabled

    // number of face detection per rendering loop. 0 -> auto (adaptative)
    const nDetectsPerLoop = (isMaskVisible) ? 0 : 1
    console.log('INFO in FlexibleMask2.js - componentDidUpdate(): set nDetectsPerLoop =', nDetectsPerLoop)
    WEBARROCKSFACE.set_scanSettings({
      'nDetectsPerLoop': nDetectsPerLoop
    });
    /*if (!this.state.isMaskEnabled) {
      // Cleaning up some resources
      // Expected behaviour: release the Object mesh resources. We may need to enable/disable/change the masks
      _flexibleMaskMesh = null;
    }*/
    
    // FIXME: This will stop the camera render in the canvas 
    // Expected behaviour: disable face tracking features (stop callbackTrack) but continue render the camera feed in the canvas so it won't freeze
    // The second parameter is not working -- the camera light is green in both situations (second parameter = true|false)
    //WEBARROCKSFACE.toggle_pause(!this.state.isTrackingEnabled, false);
  }

  render(){
    // generate canvases:
    return (
      <div>
        {/* Canvas managed by three fiber, for AR: */}
        <Canvas className='mirrorX' style={{
          position: 'fixed',
          zIndex: 2,
          ...this.state.sizing
        }}
        gl={{
          preserveDrawingBuffer: true // allow image capture
        }}>
          <DirtyHook sizing={this.state.sizing} lighting={this.state.lighting} />
          
          <Suspense fallback={<DebugCube />}>
            <ModelContainer
              isVisible={this.state.isMaskEnabled && this.state.isTrackingEnabled}
              GLTFModel={this.state.GLTFModel}
              GLTFOccluderModel={this.state.GLTFOccluderModel}
              faceIndex={0} ARTrackingExperience={this.state.ARTrackingExperience} 
            />
          </Suspense>
        </Canvas>

      {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
        <canvas className='mirrorX' ref='canvasFace' style={{
          position: 'fixed',
          zIndex: 1,
          ...this.state.sizing
        }} width = {this.state.sizing.width} height = {this.state.sizing.height} />

        <BackButton />        


        <button
          className="Button1"
          onClick={() => {
            this.setState({ isMaskEnabled: true })
          }}
        >
          Wear Mask
        </button>

        <button
          className="Button2"
          onClick={() => {
            this.setState({ isMaskEnabled: false })
          }}
        >
          Remove Mask
        </button>


        <button
          className="Button3"
          onClick={() => {
            this.setState({ isTrackingEnabled: !this.state.isTrackingEnabled })
          }}
        >
          { this.state.isTrackingEnabled? "Disable tracking" : "Enable tracking" }
        </button>
      </div>
    )
  }
} 

export default FlexibleMask
