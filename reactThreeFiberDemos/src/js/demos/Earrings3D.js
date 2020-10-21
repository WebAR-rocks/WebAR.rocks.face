import React, { Component, useRef, useState, Suspense } from 'react'
import { Canvas, useFrame, useThree, useLoader, useUpdate } from 'react-three-fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'

// import GLTF loader - originally in examples/jsm/loaders/
import { GLTFLoader } from '../contrib/three/v119/GLTFLoader.js'


// import components:
import BackButton from '../components/BackButton.js'
import VTOButton from '../components/VTOButton.js'

// import main script:
import WEBARROCKSFACE from '../contrib/WebARRocksFace/dist/WebARRocksFace.module.js'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_EARS_2.json'

// import THREE.js earrings 3D helper, useful to compute pose
// This helper is not minified, feel free to customize it (and submit pull requests bro):
import earrings3DHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceEarrings3DHelper.js'

// import THREE.js light helper, useful to apply lighting
import lightingHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceLightingHelper.js'


// ASSETS:
// import 3D model of earrings:
import GLTFEarringsModel from '../../assets/earrings3D/earringsSimple.glb'

// import envMap:
import envMap from '../../assets/earrings3D/venice_sunset_512.hdr'





let _timerResize = null, _earrings3DHelper = null

// fake component, display nothing
// just used to get the Camera and the renderer used by React-fiber:
const DirtyHook = (props) => {
  const threeFiber = useThree()
  useFrame(_earrings3DHelper.update_threeCamera.bind(null, props.sizing, threeFiber.camera))
  
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

const set_shinyMetal = (model) => {
  model.traverse((threeStuff) => {
    if (!threeStuff.isMesh){
      return
    }
    const mat = threeStuff.material
    mat.roughness = 0
    mat.metalness = 1
    mat.refractionRatio = 1
  })
}

const create_occluderMesh = (occluderCylinder, side) => {
  // create occluder geometry for right ear:
  const occluderRightGeom = new THREE.CylinderGeometry(occluderCylinder.radius, occluderCylinder.radius, occluderCylinder.height)
  const matrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler().fromArray(occluderCylinder.euler))
  matrix.setPosition(new THREE.Vector3().fromArray(occluderCylinder.offset))
  occluderRightGeom.applyMatrix4(matrix)
  
  // create the occluder mesh (invert geometry if side == LEFT):
  const occluderMesh = _earrings3DHelper.create_threeOccluderMesh(occluderRightGeom, side)
  return occluderMesh
}

const EarringContainer = (props) => {
  const objRef = useUpdate((threeObject3D) => {
    _earrings3DHelper.set_earring(threeObject3D, props.side)
    const occluderMesh = create_occluderMesh(props.occluderCylinder, props.side)
    if (props.occluderCylinder.debug){
      occluderMesh.material = new THREE.MeshNormalMaterial()
    }
    threeObject3D.add(occluderMesh)
  })
  
  const gltf = useLoader(GLTFLoader, props.GLTFModel)

  // clone the model to handle separately right and left earrings:
  const model = gltf.scene.clone()

  // tweak the model:
  set_shinyMetal(model)

  return (
    <object3D ref={objRef}>
      <primitive object={model} scale={props.scale} />
    </object3D>
    )
}

const DebugCube = () => {
  return (
    <mesh name="debugCube">
      <boxBufferGeometry args={[1, 1, 1]} />
      <meshNormalMaterial />
    </mesh>
    )
}


class Earrings3D extends Component {
  constructor(props) {
    super(props)

    const PI = 3.1415
    const scale = 100
    this.state = {
      // size of the canvas:
      sizing: compute_sizing(),

      // 3D model:
      GLTFModelRight: GLTFEarringsModel,
      GLTFModelLeft: GLTFEarringsModel,

      // 3D model scale:
      scale: [scale, scale, scale],

      lighting: {
        envMap,
        pointLightIntensity: 0.8,
        pointLightY: 200, // larger -> move the pointLight to the top
        hemiLightIntensity: 0.8
      },

      bloom: {
        threshold: 0.5, // apply bloom is light intensity is above this threshold
        intensity: 8, // intensity of the effect
        kernelSizeLevel: 0, // 0 -> SMALL kernel
        computeScale: 0.5, // 0.5 -> compute using half resolution
        luminanceSmoothing: 0.7
      },

      // occluder parameters:
      earsOccluderCylinder: {
        radius: 2,
        height: 0.5, // height of the cylinder, so depth in fact
        offset: [0, 1, 0], // +Y -> pull up
        euler: [0,PI/6, PI/2, 'XYZ'],
        debug: false // set to true to tune earsOccluderCylinder* settings
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
      WEBARROCKSFACE.resize()
    })
  }

  componentDidMount(){
    // init WEBARROCKSFACE through the helper:
    const canvasFace = this.refs.canvasFace
    _earrings3DHelper = earrings3DHelper()
    _earrings3DHelper.init(WEBARROCKSFACE, {
      NN,
      canvasFace,
      debugOccluder: this.state.debugOccluder
    }).then(() => {
      console.log('WEBARROCKSFACE has been initialized')
    })
  }

  componentWillUnmount() {
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
        gl={{
          preserveDrawingBuffer: true // allow image capture
        }}>
          <DirtyHook sizing={this.state.sizing} lighting={this.state.lighting} />
          
          <Suspense fallback={<DebugCube />}>
            <EarringContainer side='RIGHT' scale={this.state.scale} GLTFModel={this.state.GLTFModelRight} occluderCylinder={this.state.earsOccluderCylinder}/>
          </Suspense>          
          <Suspense fallback={<DebugCube />}>
            <EarringContainer side='LEFT'  scale={this.state.scale} GLTFModel={this.state.GLTFModelLeft} occluderCylinder={this.state.earsOccluderCylinder}/>
          </Suspense>

          <EffectComposer>
            <Bloom luminanceThreshold={this.state.bloom.threshold} luminanceSmoothing={this.state.bloom.luminanceSmoothing} intensity={this.state.bloom.intensity}
              kernelSize={this.state.bloom.kernelSizeLevel}
              height={this.state.bloom.computeScale * this.state.sizing.height}/>
          </EffectComposer>

        </Canvas>

      {/* Canvas managed by WebAR.rocks, just displaying the video (and used for WebGL computations) */}
        <canvas className='mirrorX' ref='canvasFace' style={{
          position: 'fixed',
          zIndex: 1,
          ...this.state.sizing
        }} width = {this.state.sizing.width} height = {this.state.sizing.height} />

        <BackButton />

      </div>
    )
  }
} 

export default Earrings3D
