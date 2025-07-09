import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import * as THREE from 'three'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// import SkeletonUtils, useful to clone a THREE instance with a skeleton
import { clone as SkeletonUtilsClone } from 'three/examples/jsm/utils/SkeletonUtils'

// import some UI components:
import BackButton from '../components/BackButton'
import VTOButton from '../components/VTOButton'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_FACE_3.json'

// import main script:
import WEBARROCKSFACE from '../contrib/WebARRocksFace/dist/WebARRocksFace.module.js'

// import THREE Helper
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import threeHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceThreeHelper.js'

// ZboingZboing physics:
import { ZboingZboingPhysics } from '../contrib/threeZboingZboing/ZboingZboingPhysics.js'

// import expressions detector:
import expressionsDetector from '../misc/PiepackerExpressionsDetector'

// ASSETS:
// import 3D model:
import GLTFModel1 from '../../assets/piepacker/HeroMageWithUselessBone.glb'
import GLTFModel2 from '../../assets/piepacker/HeroMageOrange.glb'

import TWEEN from '@tweenjs/tween.js'



let _GLTFOccluderModel = null

let _threeCamera = null, _threeScene = null, _threeRenderer = null
let _threeObject3D = null
let _physics = null

const _animationActions = {
  openMouth: null,
  blinkLeft: null,
  blinkRight: null
}
let _threeAnimationMixer = null, _threeClock = null


// size a three renderer:
const size_threeRenderer = (threeRenderer, sizing) => {
  const dpr = window.devicePixelRatio || 1
  threeRenderer.setSize(sizing.width / dpr, sizing.height / dpr, false)
  const canvasStyle = threeRenderer.domElement.style
  canvasStyle.removeProperty('width')
  canvasStyle.removeProperty('height')
}


// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const ThreeGrabber = (props) => {
  const threeFiber = useThree()
  _threeCamera = threeFiber.camera
  _threeScene = threeFiber.scene
  _threeRenderer = threeFiber.gl
  size_threeRenderer(threeFiber.gl, props.sizing)
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
  threeHelper.clean()

  const objRef = useRef()
  useEffect(() => {
    const threeObject3DParent = objRef.current
    const threeObject3D = threeObject3DParent.children[0]    
    
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
  }, [props.sizing, props.GLTFModel])
  
  // import main model:
  const gltf = useLoader(GLTFLoader, props.GLTFModel)
  const model = SkeletonUtilsClone(gltf.scene)

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
      <boxGeometry args={[s, s, s]} />
      <meshNormalMaterial />
    </mesh>
    )
}


const Mask = (props) => {
  // XAVIER: not all masks have a flexible part
   // state:
  const [sizing, setSizing] = useState({
      width: 640,
      height: 480
    })
  const [GLTFModel, setGLTFModel] = useState(GLTFModel1)
  const [isInitialized] = useState(true)

  // refs:
  const canvasFaceRef = useRef()
  const canvasCompositeRef = useRef()
  const layerCanvasesRef = useRef()

  // misc private vars:
  const _settings = {
    isToonShaded: true,    

    // occluder 3D model:
    GLTFOccluderModel: _GLTFOccluderModel,

    physics: {
      skinnedMeshName: 'The_Hood', // physics should be applied to this skinnedMesh
      bonesSettings: {
        The_Hood_Rig: null, // this bone should not move
        DEFAULT: { // applied to all other bones:
          damper: 20,
          spring: 70
        }
      }
    }
  }
  let _compositeCtx = null   
  let _isFaceDetected = false
  let _isMaskVisible = true
  const _faceDetectedTweenAlpha = {
    value: 0
  }


  const onFaceDetected = (isFaceDetected) => {
    _isFaceDetected = isFaceDetected
    TWEEN.removeAll()

    if (_isFaceDetected){
      console.log('FACE DETECTED')
      _faceDetectedTweenAlpha.value = 1
      if (_physics){ // avoid big zboingzboing when mask appears
        _physics.needsReset = true
      }
      threeHelper.reset_landmarksStabilizers()
    } else { 
      console.log('FACE LOST')

      const tweenMaskFadeOut = new TWEEN.Tween(_faceDetectedTweenAlpha)
        .to({value: 0}, 600)
        .easing(TWEEN.Easing.Quadratic.Out)
        .start()
    }
  }


  const update_compositeCanvas = () => {
    const ctx = _compositeCtx
    // draw the video:
    ctx.globalAlpha = 1
    ctx.drawImage(canvasFaceRef.current, 0, 0)

    // draw the 3D:
    if (_faceDetectedTweenAlpha.value > 0){
      ctx.globalAlpha = _faceDetectedTweenAlpha.value
      ctx.drawImage(_threeRenderer.domElement, 0, 0)
    }
  }


  const switch_mask = () => {
    const newGLTFModel = (GLTFModel === GLTFModel1) ? GLTFModel2 : GLTFModel1
    setGLTFModel(newGLTFModel)
  }


  const toggle_maskVisibility = () => {
    _isMaskVisible = !_isMaskVisible
    if (_threeObject3D){
      _threeObject3D.visible = _isMaskVisible
    }

    const nDetectsPerLoop = (_isMaskVisible) ? 0 : 1
    WEBARROCKSFACE.set_scanSettings({
      'nDetectsPerLoop': nDetectsPerLoop
    })
  }


  useEffect(() => {
    console.log('Init threeHelper...')

    // create a 2D context for the composite canvas:
    _compositeCtx = canvasCompositeRef.current.getContext('2d')

    // init WEBARROCKSFACE through the helper:
    threeHelper.init(WEBARROCKSFACE, {
      NN,
      solvePnPImgPointsLabels: ['chin', 'leftEarBottom', 'rightEarBottom', 'noseBottom', 'leftEyeExt', 'rightEyeExt'],
      isVisibilityAuto: false,
      isKeepRunningOnWinFocusLost: true,
      rxOffset: -15 * (Math.PI / 180),
      scanSettings: {
        threshold: 0.8,
        isCleanGLStateAtEachIteration: false,
        animateProcessOrder: 'DSAR'
      },
      canvas: canvasFaceRef.current,
      maxFacesDetected: 1,
      callbackReady: (err) => {
        if (err) throw new Error(err)
        console.log('threeHelper has been initialized successfully')
      },
      callbackTrack: (detectStates, landmarksStabilized) => {
        if (landmarksStabilized){
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
        }

        // force rendering of the scene if the tab has lost focus:
        if (!WEBARROCKSFACE.is_winFocus()){
          _threeRenderer.render(_threeScene, _threeCamera)
        }

        if (detectStates.isDetected && !_isFaceDetected){
          onFaceDetected(true)
        } else if (!detectStates.isDetected && _isFaceDetected){
          onFaceDetected(false)
        }

        // update TWEEN:
        TWEEN.update()

        // update composite canvas:
        update_compositeCanvas()
      }
    })

    return () => {
      _threeCamera = null
      return WEBARROCKSFACE.destroy()
    }
  }, [isInitialized])


  return (
    <div>
      {/* We hide the 2 canvas since we only display the compositing canvas */}
      <div ref={layerCanvasesRef}
           style={{
             position: 'fixed' /* this is important since this element will be hidden using
                       visibility property and not display property
                       so it keeps its place in the DOM. */,
             PointerEvent: 'none',
          }}>
        {/* Canvas managed by three fiber, for AR: */}
        <Canvas
          gl = {{
            preserveDrawingBuffer: true // allow image capture
          }}
          onCreated = {(threeFiber) => {
            // should fix the race condition where everything is black:
            size_threeRenderer(threeFiber.gl, sizing)
            // DO NOT USE display = none because then THREE-Fiber will measure the canvas
            // as null size, and will resize it crappily
            layerCanvasesRef.current.style.visibility = 'hidden'
          }}>
          <ThreeGrabber sizing={sizing} />
          
          <Suspense fallback={<DebugCube />}>
            <ModelContainer
              GLTFModel={GLTFModel}
              GLTFOccluderModel={_settings.GLTFOccluderModel}
              faceIndex={0}
              physics={_settings.physics}
              isMaskVisible={_isMaskVisible}
              isToonShaded={_settings.isToonShaded}
              sizing={sizing}
              />
          </Suspense>

          <ambientLight />
          <pointLight position={[0, 200, 0]} />
        </Canvas>

        {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
        <canvas ref={canvasFaceRef} width = {sizing.width} height = {sizing.height} />
      </div>

      { /* Compositing canvas */}
      <canvas className='mirrorX' ref={canvasCompositeRef} width = {sizing.width} height = {sizing.height} />

      <BackButton />
      <div className="VTOButtons">
        <VTOButton onClick={switch_mask} >Switch mask</VTOButton>
        <VTOButton onClick={toggle_maskVisibility} >Toggle visibility</VTOButton>
      </div>
    </div>
  )
  
} 

export default Mask
