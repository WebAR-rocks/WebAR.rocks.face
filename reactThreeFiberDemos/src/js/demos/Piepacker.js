import React, { Component, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader, useUpdate } from 'react-three-fiber'
import * as THREE from 'three'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../contrib/three/v119/GLTFLoader.js'

// import SkeletonUtils, useful to clone a THREE instance with a skeleton
import { SkeletonUtils } from '../contrib/three/v126/examples/jsm/utils/SkeletonUtils.js'

// import some UI components:
import BackButton from '../components/BackButton.js'
import VTOButton from '../components/VTOButton.js'

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

// ZboingZboing physics:
import { ZboingZboingPhysics } from '../contrib/threeZboingZboing/ZboingZboingPhysics.js'

// import expressions detector:
import expressionsDetector from '../misc/PiepackerExpressionsDetector'

// ASSETS:
// import 3D model:
import GLTFModel1 from '../../assets/piepacker/HeroMage.glb'
import GLTFModel2 from '../../assets/piepacker/HeroMageOrange.glb'

// import AR Metadatas (tells how to deform GLTFModel)
//import ARTrackingMetadata from '../../assets/flexibleMask2/foolMaskARMetadata.json'

// import occluder
//import GLTFOccluderModel from '../../assets/flexibleMask2/occluder.glb'



let _ARTrackingMetadata = null

let _GLTFOccluderModel = null

let _timerResize = null, _flexibleMaskMesh = null, _threeCamera = null, _threeScene = null
let _threeObject3D = null
let _physics = null

const _animationActions = {
  openMouth: null,
  blinkLeft: null,
  blinkRight: null
}
let _threeAnimationMixer = null, _threeClock = null

// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = (props) => {
  const threeFiber = useThree()
  _threeCamera = threeFiber.camera
  _threeScene = threeFiber.scene
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


const onMouthOpen = () => {
  if (_animationActions.openMouth !== null) {
    _animationActions.openMouth.stop()
    _animationActions.openMouth.play()
  }
}


const onEyeClose = (animationAction) => {
  if (!animationAction) return
  animationAction.stop()
  animationAction.clampWhenFinished = true
  animationAction.timeScale = 1
  animationAction.play()
}


const onEyeOpen = (animationAction) => {
  if (!animationAction) return
  animationAction.stop()
  animationAction.clampWhenFinished = false
  animationAction.timeScale = -1
  animationAction.play()
}

const onEyeLeftClose = () => {
  onEyeClose(_animationActions.blinkLeft)
}
const onEyeLeftOpen = () => {
  onEyeOpen(_animationActions.blinkLeft)
}
const onEyeRightClose = () => {
  onEyeClose(_animationActions.blinkRight)
}
const onEyeRightOpen = () => {
  onEyeOpen(_animationActions.blinkRight)
}




const ModelContainer = (props) => {
  const objRef = useUpdate((threeObject3DParent) => {
    const threeObject3D = threeObject3DParent.children[0]    
    
    // remove previous flexible mask:
    if (_flexibleMaskMesh && _flexibleMaskMesh.parent){
      _flexibleMaskMesh.parent.remove(_flexibleMaskMesh)
    }

    // if there is a flexible mask only (fitting to face landmarks):
    if (props.ARTrackingExperience){
      const allLandmarksLabels = WEBARROCKSFACE.get_LMLabels()
      _flexibleMaskMesh = flexibleMaskHelper.build_flexibleMaskFromStdMetadata(allLandmarksLabels, threeObject3D,  props.ARTrackingExperience, false)
      threeObject3D.add(_flexibleMaskMesh)
    }

    // set shadows and extract skinnedMesh:
    let skinnedMesh = null
    threeObject3D.traverse(function (node) {      
      if (node.isSkinnedMesh || node.isMesh) {
        node.castShadow = true
        node.receiveShadow = true        
      }     
      if (node.isSkinnedMesh && node.name === props.physics.skinnedMeshName){
        skinnedMesh = node
      }
    })
   
    // set physics:
    if (_physics){
      _physics.destroy()
      _physics = null
    }
    if (skinnedMesh){
      _physics = new ZboingZboingPhysics(_threeScene, skinnedMesh, props.physics.bonesSettings, {
        isDebug: false
      })
    }

    // set predefined animations:
    expressionsDetector.init(WEBARROCKSFACE, {
      onMouthOpen,
      onMouthClose: null,
      onEyeLeftClose,
      onEyeLeftOpen,
      onEyeRightClose,
      onEyeRightOpen,
    })

    // append to face follower object:
    _threeObject3D = threeObject3D
    _threeObject3D.visible = props.isVisible
    threeHelper.set_faceFollower(threeObject3DParent, threeObject3D, props.faceIndex)
  })
  
  // import main model:
  const gltf = useLoader(GLTFLoader, props.GLTFModel)
  const model = SkeletonUtils.clone(gltf.scene)

  // extract animations:
  if (gltf.animations.length > 0){
    _threeAnimationMixer = new THREE.AnimationMixer(model)
    const extract_animation = (ind) => {
      if (gltf.animations.length <= ind) return null
      const threeAction = _threeAnimationMixer.clipAction(gltf.animations[ind])
      threeAction.setLoop(THREE.LoopOnce)
      return threeAction
    }
    _animationActions.openMouth = extract_animation(0)
    _animationActions.blinkLeft = extract_animation(1)
    _animationActions.blinkRight = extract_animation(2)
    _threeClock = new THREE.Clock()
  } else {
    _threeAnimationMixer = null
    _threeClock = null
  }

  // import and create occluder:
  let occluderMesh = null
  if (props.GLTFOccluderModel){
    const isDebugOccluder = false // true to debug the occluder
    const gltfOccluder = useLoader(GLTFLoader, props.GLTFOccluderModel)
    const occluderModel = gltfOccluder.scene.clone()
    occluderMesh = threeHelper.create_occluderMesh(occluderModel, isDebugOccluder)
  }

  return (
    <object3D ref={objRef}>
      <object3D>
        <primitive object={model} />
        { (occluderMesh) && 
          <primitive object={occluderMesh} />
        }
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

    // XAVIER: not all masks have a flexible part
    let ARTrackingExperience = null

    if (_ARTrackingMetadata){
      // look for Face tracking metadata among ARMetadata:
      const ARTrackingFaceMetadata = _ARTrackingMetadata['ARTRACKING'].filter((ARTrackingExperience) => {
        return (ARTrackingExperience['TYPE'] === "FACE")
      })
      if (ARTrackingFaceMetadata.length === 0){
        throw new Error('No Face AR tracking experience where found')
      }
      ARTrackingExperience = ARTrackingFaceMetadata[0]
    }

    // initialize state:
    this.state = {
      isVisible: true,

      // size of the canvas:
      sizing: compute_sizing(),

      // 3D model:
      GLTFModel: GLTFModel1,

      // AR Metadatas
      ARTrackingExperience,

      // occluder 3D model:
      GLTFOccluderModel: _GLTFOccluderModel,

      lighting: {
        pointLightIntensity: 0,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
      },

      physics: {
        skinnedMeshName: 'The_Hood', // physics should be applied to this skinnedMesh
        bonesSettings: {
          The_Hood_Rig: null, // this bone should not move
          Tail_2: {
            damper: 0.02,
            spring: 0.00004
          },
          Tail_3: {
            damper: 0.01,
            spring: 0.00003
          },
          DEFAULT: { // applied to all other bones:
            damper: 0.002,
            spring: 0.00002
          }
        }
      }
    }

    // handle resizing / orientation change:
    this.handle_resize = this.handle_resize.bind(this)
    this.do_resize = this.do_resize.bind(this)
    window.addEventListener('resize', this.handle_resize)
    window.addEventListener('orientationchange', this.handle_resize)
  }


  switch_mask() {
    const newGLTFModel = (this.state.GLTFModel === GLTFModel1) ? GLTFModel2 : GLTFModel1
    this.setState({GLTFModel: newGLTFModel})
  }


  toggle_maskVisibility(){
    this.setState({isVisible: !this.state.isVisible})
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
        // update physics:
        if (_physics){
          _physics.update()
        }

        // update expressions triggers:
        expressionsDetector.update(WEBARROCKSFACE, detectStates)

        // update predefined animations:
        if (_threeAnimationMixer){
          _threeAnimationMixer.update(_threeClock.getDelta())
        }

        // update flexible geometry (follow face landmarks):
        if (_flexibleMaskMesh && _threeCamera){
          flexibleMaskHelper.update_flexibleMask(_threeCamera, _flexibleMaskMesh, detectStates, landmarksStabilized)
        }
      }
    })
  }


  shouldComponentUpdate(nextProps, nextState){
    if (nextState.isVisible !== this.state.isVisible){
      const nDetectsPerLoop = (nextState.isVisible) ? 0 : 1
      WEBARROCKSFACE.set_scanSettings({
        'nDetectsPerLoop': nDetectsPerLoop
      })
      if (_threeObject3D){
        _threeObject3D.visible = nextState.isVisible
      }
      return false
    }
    return true
  }


  componentWillUnmount() {
    _timerResize = null
    _flexibleMaskMesh = null
    _threeCamera = null
    return WEBARROCKSFACE.destroy()
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
        gl = {{
          preserveDrawingBuffer: true // allow image capture
        }}>
          <DirtyHook sizing={this.state.sizing} lighting={this.state.lighting} />
          
          <Suspense fallback={<DebugCube />}>
            <ModelContainer
              GLTFModel={this.state.GLTFModel}
              GLTFOccluderModel={this.state.GLTFOccluderModel}
              faceIndex={0}
              ARTrackingExperience={this.state.ARTrackingExperience}
              physics={this.state.physics}
              isVisible={this.state.isVisible}
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
        <div className="VTOButtons">
          <VTOButton onClick = {this.switch_mask.bind(this)} >Switch mask</VTOButton>
          <VTOButton onClick = {this.toggle_maskVisibility.bind(this)} >Toggle visibility</VTOButton>
        </div>
      </div>
    )
  }
} 

export default FlexibleMask
