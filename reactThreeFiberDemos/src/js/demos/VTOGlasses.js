import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// import components:
import BackButton from '../components/BackButton.js'
import VTOButton from '../components/VTOButton.js'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_GLASSES_9.json'

// import WebARRocksMirror, a helper
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import mirrorHelper from '../contrib/WebARRocksFace/helpers/WebARRocksMirror.js'

// ASSETS:
// import 3D models of sunglasses
import GLTFModel1 from '../../assets/VTOGlasses/models3D/glasses1.glb'
import GLTFModel2 from '../../assets/VTOGlasses/models3D/glasses2.glb'

// import occluder
import GLTFOccluderModel from '../../assets/VTOGlasses/models3D/occluder.glb'

// import envMap:
import envMap from '../../assets/VTOGlasses/envmaps/venice_sunset_1k.hdr'



let _threeFiber = null

const get_pauseButtonText = (isPaused) => {
  return (isPaused) ? 'Resume' : 'Pause'
}


// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const ThreeGrabber = (props) => {
  const threeFiber = useThree()
  _threeFiber = threeFiber

  useFrame(mirrorHelper.update.bind(null, props.sizing, threeFiber.camera))  
  mirrorHelper.set_lighting(threeFiber.gl, threeFiber.scene, props.lighting)

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
  mirrorHelper.clean()

  const objRef = useRef()
  useEffect(() => {
    const threeObject3DParent = objRef.current
    if (threeObject3DParent.children.length === 0) return
    const threeObject3D = threeObject3DParent.children[0]
    if (threeObject3D.children.length === 0) return
    const model = threeObject3D.children[0]

    mirrorHelper.set_glassesPose(model)
    mirrorHelper.tweak_materials(model, props.glassesBranches)
    mirrorHelper.set_faceFollower(threeObject3DParent, threeObject3D, props.faceIndex)
    //return mirrorHelper.clean;
  }, [props.GLTFModel, props.sizing])  

  // import main model:
  const gltf = useLoader(GLTFLoader, props.GLTFModel)
  const model = gltf.scene.clone()
  
  // import and create occluder:
  const isDebugOccluder = false // true to debug the occluder
  const gltfOccluder = useLoader(GLTFLoader, props.GLTFOccluderModel)
  const occluderModel = gltfOccluder.scene.clone()
  const occluderMesh = mirrorHelper.create_occluderMesh(occluderModel, isDebugOccluder)
  
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


const VTOGlasses = (props) => {
  const PI = 3.1415
  const scale = 100

  // state:
  const [sizing, setSizing] = useState(compute_sizing())
  const [model, setModel] = useState(GLTFModel1)
  const [isInitialized] = useState(true)

  // refs:
  const togglePauseRef = useRef()
  const canvasFaceRef = useRef()

  // misc private vars:
  const _settings = {
    glassesBranches: {
      // Branch fading parameters (branch become transparent near the ears)
      fadingZ: -0.9, // where to start branch fading. - -> to the back
      fadingTransition: 0.6, // 0 -> hard transition

      // Branch bending (glasses branches are always bent to slightly tighten the head):
      bendingAngle: 5, //in degrees. 0 -> no bending
      bendingZ: 0, //start brench bending at this position. - -> to the back
    },

    lighting: {
      envMap,
      pointLightIntensity: 0.8, // intensity of the point light. Set to 0 to disable
      pointLightY: 200, // larger -> move the pointLight to the top
      hemiLightIntensity: 0 // intensity of the hemispheric light. Set to 0 to disable (not really useful if we use an envmap)
    },

    // occluder 3D model:
    GLTFOccluderModel,
    
    bloom: {
      threshold: 0.5, // apply bloom is light intensity is above this threshold
      intensity: 8, // intensity of the effect
      kernelSizeLevel: 0, // 0 -> SMALL kernel
      computeScale: 0.5, // 0.5 -> compute using half resolution
      luminanceSmoothing: 0.7
    }
  }
  let _timerResize = null
  let _isPaused = false


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
    if (_timerResize === null) {
      mirrorHelper.resize()
    }
  }, [sizing])


  const toggle_pause = () => {
    if (_isPaused){
      // we are in paused state => resume
      mirrorHelper.resume(true)
    } else {
      mirrorHelper.pause(true)
    }
    _isPaused = !_isPaused
    togglePauseRef.current.innerHTML = get_pauseButtonText(_isPaused)
  }


  const capture_image = () => {
    const threeCanvas = _threeFiber.gl.domElement    
    mirrorHelper.capture_image(threeCanvas).then((cv) => {
      // download the image in a new window:
      const dataURL = cv.toDataURL('image/png')
      const img = new Image()
      img.src = dataURL
      img.onload = () => {
        const win = window.open("")
        win.document.write(img.outerHTML)
      }
    })
  }


  useEffect(() => {
    // init WEBARROCKSFACE through the helper:
    mirrorHelper.init({
      NN,
      scanSettings: {
        threshold: 0.8 // detection threshold, between 0 and 1
      },
      landmarksStabilizerSpec: {
        beta: 10,
        minCutOff: 0.001,
        freqRange: [2, 144],
        forceFilterNNInputPxRange: [2.5, 6],//[1.5, 4],
      },
      solvePnPImgPointsLabels: [
        //'chinLeft', 'chinRight',

        'leftEarBottom',
        'rightEarBottom',
        'noseBottom',
        'noseLeft', 'noseRight',
        'leftEyeExt',
        'rightEyeExt'
      ],
      canvasFace: canvasFaceRef.current,
      maxFacesDetected: 1
    }).then(() => {
      // handle resizing / orientation change:
      window.addEventListener('resize', handle_resize)
      window.addEventListener('orientationchange', handle_resize)

      console.log('WEBARROCKSMIRROR helper has been initialized')
    })

    return () => {
      _threeFiber = null
      return mirrorHelper.destroy()
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
      gl={{
        preserveDrawingBuffer: true // allow image capture
      }}
      updateDefaultCamera = {false}
      >
        <ThreeGrabber sizing={sizing} lighting={_settings.lighting} />
        
        <Suspense fallback={<DebugCube />}>
          <VTOModelContainer
            sizing={sizing}
            GLTFModel={model}
            GLTFOccluderModel={_settings.GLTFOccluderModel}
            faceIndex={0} glassesBranches={_settings.glassesBranches} />
        </Suspense>          
       
        <EffectComposer>
          <Bloom luminanceThreshold={_settings.bloom.threshold} luminanceSmoothing={_settings.bloom.luminanceSmoothing} intensity={_settings.bloom.intensity}
            kernelSize={_settings.bloom.kernelSizeLevel}
            height={_settings.bloom.computeScale * sizing.height}/>
        </EffectComposer>

      </Canvas>

    {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
      <canvas className='mirrorX' ref={canvasFaceRef} style={{
        position: 'fixed',
        zIndex: 1,
        ...sizing
      }} width = {sizing.width} height = {sizing.height} />

      <BackButton />

      <div className="VTOButtons">
        <VTOButton onClick={setModel.bind(null, GLTFModel1)}>Glasses 1</VTOButton>
        <VTOButton onClick={setModel.bind(null, GLTFModel2)}>Glasses 2</VTOButton>
        <VTOButton ref={togglePauseRef} onClick={toggle_pause}>{get_pauseButtonText(_isPaused)}</VTOButton>
        <VTOButton onClick={capture_image}>Capture</VTOButton>
      </div>
    </div>
  )
} 

export default VTOGlasses
