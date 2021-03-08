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

let _flexibleMaskMesh = null, _threeCamera = null

// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = (props) => {
  const threeFiber = useThree()
  _threeCamera = threeFiber.camera
  useFrame(threeHelper.update_threeCamera.bind(null, props.sizing, threeFiber.camera))
  lightingHelper.set(threeFiber.gl, threeFiber.scene, props.lighting)

  // XAVIER: cancel CSS properties set by THREE.js to the canvas:
  threeFiber.gl.domElement.style.removeProperty('width');
  threeFiber.gl.domElement.style.removeProperty('height');

  // XAVIER: the THREE.js canvas resolution depends on the device pixel ratio
  // that's why the canvas resolution is not always = to props.sizing after this call:
  threeFiber.gl.setSize(props.sizing.width, props.sizing.height, false)

  // XAVIER: Only recompute aspect of the video
  threeHelper.resize()
  return null
}

const VTOModelContainer = (props) => {
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
      sizing: {
        width: 640,
        height: 360,
      },

      isContainerWide: true,

      // 3D model:
      GLTFModel,

      // AR Metadatas
      ARTrackingExperience,

      // occluder 3D model:
      GLTFOccluderModel,

      lighting: {
        envMap,
        pointLightIntensity: 0.8,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
      }
    }
  }

  componentDidMount(){
    // init WEBARROCKSFACE through the helper:
    const canvasFace = this.refs.canvasFace
    threeHelper.init(WEBARROCKSFACE, {
      NN,
      canvas: canvasFace,
      /*spec:  {
        videoSettings: {
          minWidth: 480, maxWidth: 1024, idealWidth: 800,
          minHeight: 600, maxHeight: 1024, idealHeight: 600
        }
      },*/
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

  componentWillUnmount() {
    _timerResize = null
    _flexibleMaskMesh = null
    _threeCamera = null
    return WEBARROCKSFACE.destroy()
  }

  shouldComponentUpdate(nextProps, nextState){
    // XAVIER: the resizing should work even without this optimization
    // XAVIER: the user has just changed the size of the container
    // we don't rerender the whole stuff
    if (nextState.isContainerWide !== this.state.isContainerWide){
      console.log('Just change the CSS of the container, do not rerender the whole stuff');
      this.refs.container.className = this.get_containerClass(nextState.isContainerWide);
      return false;
    }

    return true;
  }

  get_containerClass(isContainerWide){
    return `container ${isContainerWide ? "" : "container--small"}`
  }

  render(){
    // generate canvases:
    // XAVIER: THREE-Fiber does not append an HTML5 canvas element directly
    // but it wraps it into a <div> element.
    // add a ref to the container
    return (
      <div ref='container' className={this.get_containerClass(this.state.isContainerWide)}>
        {/* Canvas managed by three fiber, for AR: */}
        <Canvas className='mirrorX mask'
        gl = {{
          preserveDrawingBuffer: true // allow image capture
        }}
        updateDefaultCamera = {false}
        width={this.state.sizing.width}
        height={this.state.sizing.height}
        >
          <DirtyHook sizing={this.state.sizing} lighting={this.state.lighting} />
          
          <Suspense fallback={<DebugCube />}>
            <VTOModelContainer
              GLTFModel={this.state.GLTFModel}
              GLTFOccluderModel={this.state.GLTFOccluderModel}
              faceIndex={0} ARTrackingExperience={this.state.ARTrackingExperience} />
          </Suspense>
        </Canvas>

      {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
        <canvas 
          className='mirrorX face' 
          ref='canvasFace'
          width={this.state.sizing.width} 
          height={this.state.sizing.height} 
        />

        <BackButton />        
        <button 
          className="toggleDivSize"
          onClick={ () => {
            /*
            React paradigm is working great with standard DOM elements:
            When you change the state, only components which need to be re-rendered are re-rendered.
            Here, without using shouldComponentUpdate, the whole component will be rerendered
            WebAR.rocks.face and the THREE fiber scene will be re-initialized
            Which is very costly
             */
            this.setState((state) => { return {
              isContainerWide: !state.isContainerWide
            }})
          }}
        >
          Toggle Container size
        </button>
      </div>
    )
  }
} 

export default FlexibleMask
