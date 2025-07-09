import React, { useEffect, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader'

// import components:
import BackButton from '../components/BackButton'
import VTOButton from '../components/VTOButton'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_HEADPHONESL_2.json'

// import WebARRocksMirror, a helper
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import mirrorHelper from '../contrib/WebARRocksFace/helpers/WebARRocksMirror.js'

// ASSETS:
// import 3D model of hat:
import GLTFModel from '../../assets/VTOHat/models3D/hatDraco.glb'
//const GLTFModel = 'VTOHat/models3D/hatDraco.glb'

// import occluder
import GLTFOccluderModel from '../../assets/VTOHat/models3D/occluder.glb'

// import envMap:
import envMap from '../../assets/VTOHat/envmaps/venice_sunset_512.hdr'



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
    const threeObject3D = threeObject3DParent.children[0]
    const model = threeObject3D.children[0]

    mirrorHelper.set_faceFollower(threeObject3DParent, threeObject3D, props.faceIndex)
  }, [props.GLTFModel, props.sizing]) 
  
  // import main model:
  console.log('IMPORT ' + props.GLTFModel)
  const gltf = useLoader(GLTFLoader, props.GLTFModel, (loader) => {
    const dracoLoader = new DRACOLoader()
    dracoLoader.setDecoderPath('/draco/') // public path with draco loader
    loader.setDRACOLoader(dracoLoader)
  })
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
      <boxGeometry args={[s, s, s]} />
      <meshNormalMaterial />
    </mesh>
    )
}


const VTOHat = (props) => {
  const PI = 3.1415
  const scale = 100
  // state:
  const [sizing, setSizing] = useState(compute_sizing())
  const [model, setModel] = useState(GLTFModel)
  const [isInitialized] = useState(true)

  // refs:
  const togglePauseRef = useRef()
  const canvasFaceRef = useRef()
  
  // misc private vars:
  const _settings = {
    lighting: {
      envMap,
      isLightReconstructionEnabled: true
    },
    
    // occluder 3D model:
    GLTFOccluderModel
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
      canvasFace: canvasFaceRef.current,
      scanSettings: {
        threshold: 0.6 // detection threshold, between 0 and 1
      },
      landmarksStabilizerSpec: { // increase stabilization
        beta: 20,
        forceFilterNNInputPxRange: [1.5, 4]
      },
      maxFacesDetected: 1,
      solvePnPObjPointsPositions: {
        "noseLeft": [21.862150,-0.121031,67.803383], // 1791
        "noseRight": [-20.539499,0.170727,69.944778], // 2198

        "leftEyeExt": [44.507431,34.942841,38.750019], // 1808
        "rightEyeExt": [-44.064968,35.399670,39.362930], // 2214
       
        "leftEarTop": [89.165428,16.312811,-49.064980], // 3870
        "leftEarBase": [78.738243,-6.044550,-23.177490], // 2994
        "leftEarBottom": [78.786850,-41.321789,-24.603769], // 1741

        "rightEarTop": [-88.488602,17.271400,-48.199409], // 5622
        "rightEarBase": [-78.156998,-5.305619,-22.164619], // 4779
        "rightEarBottom": [-78.945511,-41.255100,-26.536131], // 5641

        "leftTemple": [60.262970,83.790382,-13.540310], // 108
        "rightTemple": [-60.034760,83.584427,-13.248530], // 286

        "foreHead": [-1.057755,97.894547,24.654940], // 696
      },
      solvePnPImgPointsLabels: [
        "foreHead",
        "leftTemple", "rightTemple",
        "leftEarTop", "rightEarTop",
        "leftEyeExt", "rightEyeExt",
        "rightEarBottom", "leftEarBottom",
      ]
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
      >
        <ThreeGrabber sizing={sizing} lighting={_settings.lighting} />
        
        <Suspense fallback={<DebugCube />}>
          <VTOModelContainer
            GLTFModel={model}
            GLTFOccluderModel={_settings.GLTFOccluderModel}
            faceIndex={0}
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

      <div className="VTOButtons">
        <VTOButton ref={togglePauseRef} onClick={toggle_pause}>{get_pauseButtonText(_isPaused)}</VTOButton>
        <VTOButton onClick={capture_image}>Capture</VTOButton>
      </div>
    </div>
  )
  
} 

export default VTOHat
