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

import TWEEN from '@tweenjs/tween.js'


let _ARTrackingMetadata = null

let _GLTFOccluderModel = null

let _timerResize = null, _flexibleMaskMesh = null, _threeCamera = null, _threeScene = null, _threeRenderer = null
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
  _threeRenderer = threeFiber.gl
  _threeRenderer.setSize(props.sizing.width, props.sizing.height, false)
  useFrame(threeHelper.update_threeCamera.bind(null, props.sizing, threeFiber.camera))
  return null
}


// create a toon material with outline effect from a random material
// see https://threejs.org/examples/?q=toon#webgl_materials_variations_toon
const create_toonMaterial = (mat) => {
  if (mat.isMeshToonMaterial) return mat
  const colorWhite = new THREE.Color(0xffffff)
  return new THREE.MeshToonMaterial({
    color: mat.color || colorWhite,
    map: mat.map,
    normalMap: mat.normalMap,
    skinning: mat.skinning,
    name: mat.name
  })
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

    // set toon shading:
    if (props.isToonShaded){
      threeObject3D.traverse(function(node){
        if (node.material){
          node.material = create_toonMaterial(node.material)
        }
      })
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
    _threeObject3D.visible = props.isMaskVisible
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
      isMaskVisible: true,

      isToonShaded: true,

      // size of the canvas:
      sizing: {
        width: 640,
        height: 480
      },

      // 3D model:
      GLTFModel: GLTFModel1,

      // AR Metadatas
      ARTrackingExperience,

      // occluder 3D model:
      GLTFOccluderModel: _GLTFOccluderModel,

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

    this.compositeCtx = null
    this.update_compositeCanvas = this.update_compositeCanvas.bind(this)

    this.isFaceDetected = false
    this.onFaceDetected = this.onFaceDetected.bind(this)
    this.faceDetectedTweenAlpha = {
      value: 1
    }
  }


  onFaceDetected(isFaceDetected){
    this.isFaceDetected = isFaceDetected
    TWEEN.removeAll()

    if (isFaceDetected){
      console.log('FACE DETECTED')
      this.faceDetectedTweenAlpha.value = 1
    } else { 
      console.log('FACE LOST')

      const tweenMaskFadeOut = new TWEEN.Tween(this.faceDetectedTweenAlpha)
        .to({value: 0}, 600)
        .easing(TWEEN.Easing.Quadratic.Out)
        .onUpdate(() => {console.log(this.faceDetectedTweenAlpha)})
        .start()
    }
  }


  update_compositeCanvas(){
    const ctx = this.compositeCtx
    // draw the video:
    ctx.globalAlpha = 1
    ctx.drawImage(this.refs.canvasFace, 0, 0)

    // draw the 3D:
    ctx.globalAlpha = this.faceDetectedTweenAlpha.value
    ctx.drawImage(_threeRenderer.domElement, 0, 0)
  }


  switch_mask() {
    const newGLTFModel = (this.state.GLTFModel === GLTFModel1) ? GLTFModel2 : GLTFModel1
    this.setState({GLTFModel: newGLTFModel})
  }


  toggle_maskVisibility(){
    this.setState({isMaskVisible: !this.state.isMaskVisible})
  }


  componentDidMount(){
    // create a 2D context for the composite canvas:
    this.compositeCtx = this.refs.canvasComposite.getContext('2d')

    // init WEBARROCKSFACE through the helper:
    const canvasFace = this.refs.canvasFace
    threeHelper.init(WEBARROCKSFACE, {
      NN,
      isVisibilityAuto: false,
      isKeepRunningOnWinFocusLost: true,
      scanSettings: {
        threshold: 0.8
      },
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

        // force rendering of the scene if the tab has lost focus:
        if (!WEBARROCKSFACE.is_winFocus()){
          _threeRenderer.render(_threeScene, _threeCamera)
        }

        if (detectStates.isDetected && !this.isFaceDetected){
          this.onFaceDetected(true)
        } else if (!detectStates.isDetected && this.isFaceDetected){
          this.onFaceDetected(false)
        }

        // update TWEEN:
        TWEEN.update()

        // update composite canvas:
        this.update_compositeCanvas()
      }
    })
  }


  shouldComponentUpdate(nextProps, nextState){
    if (nextState.isMaskVisible !== this.state.isMaskVisible){
      const nDetectsPerLoop = (nextState.isMaskVisible) ? 0 : 1
      WEBARROCKSFACE.set_scanSettings({
        'nDetectsPerLoop': nDetectsPerLoop
      })
      if (_threeObject3D){
        _threeObject3D.visible = nextState.isMaskVisible
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
        {/* We hide the 2 canvas since we only display the compositing canvas */}
        <div ref='layerCanvases'>
          {/* Canvas managed by three fiber, for AR: */}
          <Canvas
            gl = {{
              preserveDrawingBuffer: true // allow image capture
            }}
            updateDefaultCamera = {false}
            onCreated = {() => { this.refs.layerCanvases.style.display = 'none' }}>
            <DirtyHook sizing={this.state.sizing} />
            
            <Suspense fallback={<DebugCube />}>
              <ModelContainer
                GLTFModel={this.state.GLTFModel}
                GLTFOccluderModel={this.state.GLTFOccluderModel}
                faceIndex={0}
                ARTrackingExperience={this.state.ARTrackingExperience}
                physics={this.state.physics}
                isMaskVisible={this.state.isMaskVisible}
                isToonShaded={this.state.isToonShaded}
                />
            </Suspense>

            <ambientLight />
            <pointLight position={[0, 200, 0]} />
          </Canvas>

          {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
          <canvas ref='canvasFace' width = {this.state.sizing.width} height = {this.state.sizing.height} />
        </div>

        { /* Compositing canvas */}
        <canvas className='mirrorX' ref='canvasComposite' width = {this.state.sizing.width} height = {this.state.sizing.height} />

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
