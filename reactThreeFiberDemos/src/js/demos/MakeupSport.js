import React, { Component, useRef, useState, Suspense } from 'react'

// import components:
import BackButton from '../components/BackButton.js'

// import neural network model:
import NN from '../contrib/WebARRocksFace/neuralNets/NN_FULLMAKEUP_2.json'

// import Shape2D helper:
import shape2DHelper from '../contrib/WebARRocksFace/helpers/WebARRocksFaceShape2DHelper.js'

// ASSETS:
import makeupTextureImage from '../../assets/makeupSport/sportMakeup.png'


const borderHardness = {
  eyes: 0.6,
  forehead: 0.8,
  chin: 0.3,
  mouth: 0.0
}

const SHAPEFACE = {
  // list of the points involved in this shape.
  // each point is given as its label
  // the label depends on the used neural network
  // run WEBARROCKSFACE.get_LMLabels() to get all labels
  points: [
    // LIPS:
    "lipsExt0", // 0

    "lipsExtTop1",
    "lipsExtTop2",
    "lipsExtTop3",
    "lipsExtTop4",
    "lipsExtTop5",
    
    "lipsExt6",
   
    "lipsExtBot7",
    "lipsExtBot8",
    "lipsExtBot9",
    "lipsExtBot10", // 10
    "lipsExtBot11",
    
    "lipsInt12",
    
    "lipsIntTop13",
    "lipsIntTop14",
    "lipsIntTop15",
    
    "lipsInt16",

    "lipsIntBot17",
    "lipsIntBot18",
    "lipsIntBot19",

    // EYES:
    "eyeRightInt0", // 20
    "eyeRightTop0",
    "eyeRightTop1",
    "eyeRightExt0",
    "eyeRightBot0",
    "eyeRightBot1",
    "eyeRightOut0",
    "eyeRightOut1",
    "eyeRightOut2",
    "eyeRightOut3",

    "eyeLeftInt0", // 30
    "eyeLeftTop0",
    "eyeLeftTop1",
    "eyeLeftExt0",
    "eyeLeftBot0",
    "eyeLeftBot1",
    "eyeLeftOut0",
    "eyeLeftOut1",
    "eyeLeftOut2",
    "eyeLeftOut3",

    // CHEEKS:
    "cheekRightExt0", // 40
    "cheekRightExt1",
    "cheekRightExt2",
    "cheekRightExt3",
    "cheekRightExt4",
    "cheekRightExt5",
    "cheekRightInt0",

    "cheekLeftExt0",
    "cheekLeftExt1",
    "cheekLeftExt2",
    "cheekLeftExt3", // 50
    "cheekLeftExt4",
    "cheekLeftExt5",
    "cheekLeftInt0",

    // CONTOUR:
    "contourChinCtr0", // 54

    "contourRightChin0",
    "contourRightJaw0",
    "contourRightEar0",
    "contourRightEar1",
    "contourRightTemple0",
    "contourRightForehead0", // 60

    "contourLeftChin0",
    "contourLeftJaw0",
    "contourLeftEar0",
    "contourLeftEar1",
    "contourLeftTemple0",
    "contourLeftForehead0",

    "contourForheadCtr0" // 67
  ],

  // iVals are interpolated values
  // a value is given for each shape point
  // in the same order as points array
  // a value can have between 0 and 4 elements
  // the value will be retrieved in the fragment shader used to color the shape
  // as a float, vec2, vec3 or vec4 depending on its components count
  // it is useful to not color evenly the shape
  // we can apply gradients, smooth borders, ...
  // 
  // Here iVals are UV coordinates. To get them:
  //   * Open dev/faceTextured.blend
  //   * Select the face mesh in OBJECT mode
  //   * Open the Blender console and copy/paste dev/BlenderGetUVs.py
  //   
  // then I added the 2 values before each UV coordinate:
  //  * the 1st is whether the point belongs to a border (0 if on the border, 1 otherwise)
  //  * the second is the border hardness (0 -> smooth border, 1 -> hard border)
  // 
  iVals: [
    [1, borderHardness.mouth, 0.38919299840927124, 0.3237859904766083], // 0
    [1, borderHardness.mouth, 0.4305570125579834, 0.35324400663375854],
    [1, borderHardness.mouth, 0.4704410135746002, 0.3655099868774414],
    [1, borderHardness.mouth,  0.49974799156188965, 0.36793699860572815],
    [1, borderHardness.mouth, 0.5290539860725403, 0.36551299691200256],
    [1, borderHardness.mouth, 0.5689389705657959, 0.35325300693511963], // 5
    [1, borderHardness.mouth, 0.6103219985961914, 0.32381001114845276],
    [1, borderHardness.mouth, 0.5616750121116638, 0.3025819957256317],
    [1, borderHardness.mouth, 0.5328940153121948, 0.2971160113811493],
    [1, borderHardness.mouth, 0.49974799156188965, 0.2952269911766052],
    [1, borderHardness.mouth, 0.466607004404068, 0.2971140146255493], // 10
    [1, borderHardness.mouth, 0.4378330111503601, 0.3025769889354706],
    [0, borderHardness.mouth, 0.43960699439048767, 0.3253540098667145],
    [0, borderHardness.mouth, 0.46800699830055237, 0.335191011428833],
    [0, borderHardness.mouth, 0.49974799156188965, 0.33763501048088074],
    [0, borderHardness.mouth, 0.5314909815788269, 0.335193008184433], // 15
    [0, borderHardness.mouth, 0.5587869882583618, 0.32603898644447327],
    [0, borderHardness.mouth, 0.5313119888305664, 0.3223080039024353],
    [0, borderHardness.mouth, 0.49974900484085083, 0.3212139904499054],
    [0, borderHardness.mouth, 0.46818798780441284, 0.3223069906234741],
    [0, borderHardness.eyes, 0.39028099179267883, 0.5844590067863464], // 20
    [0, borderHardness.eyes, 0.3610830008983612, 0.5894529819488525],
    [0, borderHardness.eyes, 0.31834501028060913, 0.5864850282669067],
    [0, borderHardness.eyes, 0.2996639907360077, 0.5829010009765625],
    [0, borderHardness.eyes, 0.3231379985809326, 0.5792419910430908],
    [0, borderHardness.eyes, 0.3505229949951172, 0.5755299925804138], // 25
    [1, borderHardness.eyes, 0.24607500433921814, 0.5751919746398926],
    [1, borderHardness.eyes, 0.286965012550354, 0.6318539977073669],
    [1, borderHardness.eyes, 0.378248006105423, 0.6521350145339966],
    [1, borderHardness.eyes, 0.4497089982032776, 0.6134210228919983],
    [0, borderHardness.eyes, 0.6100460290908813, 0.5844659805297852], // 30
    [0, borderHardness.eyes, 0.6385059952735901, 0.5894529819488525],
    [0, borderHardness.eyes, 0.6832119822502136, 0.5887060165405273],
    [0, borderHardness.eyes, 0.6999220252037048, 0.5829010009765625],
    [0, borderHardness.eyes, 0.6764460206031799, 0.5792409777641296],
    [0, borderHardness.eyes, 0.6490600109100342, 0.575531005859375], // 35
    [1, borderHardness.eyes, 0.7581250071525574, 0.5751889944076538],
    [1, borderHardness.eyes, 0.7126079797744751, 0.6318539977073669],
    [1, borderHardness.eyes, 0.6213319897651672, 0.6521350145339966],
    [1, borderHardness.eyes, 0.5498589873313904, 0.6134210228919983],
    [1, borderHardness.chin, 0.3263629972934723, 0.3199169933795929], // 40
    [1, borderHardness.chin, 0.38306599855422974, 0.4545249938964844],
    [1, borderHardness.chin, 0.38513800501823425, 0.529017984867096],
    [1, borderHardness.chin, 0.23065899312496185, 0.5072849988937378],
    [1, borderHardness.chin, 0.2066890001296997, 0.3882339894771576],
    [1, borderHardness.chin, 0.2624650001525879, 0.2924579977989197], // 45
    [1, borderHardness.chin, 0.26894301176071167, 0.40658798813819885],
    [1, borderHardness.chin, 0.6733589768409729, 0.3199169933795929],
    [1, borderHardness.chin, 0.6164309978485107, 0.4545249938964844],
    [1, borderHardness.chin, 0.6164789795875549, 0.5275689959526062],
    [1, borderHardness.chin, 0.7690550088882446, 0.5072849988937378], // 50
    [1, borderHardness.chin, 0.7945070266723633, 0.3857809901237488],
    [1, borderHardness.chin, 0.7375400066375732, 0.2924579977989197],
    [1, borderHardness.chin, 0.7310709953308105, 0.40658798813819885],
    [0, borderHardness.chin, 0.5, 0.16923600435256958],
    [0, borderHardness.chin, 0.4147990047931671, 0.17605599761009216], // 55
    [0, borderHardness.chin, 0.2763719856739044, 0.20104800164699554],
    [0, borderHardness.chin, 0.11736500263214111, 0.29304400086402893],
    [0, borderHardness.forehead, 0.15203000605106354, 0.5684999823570251],
    [0, borderHardness.forehead, 0.2633129954338074, 0.7315890192985535],
    [0, borderHardness.forehead, 0.34400901198387146, 0.7739139795303345], // 60
    [0, borderHardness.chin, 0.585178017616272, 0.17605599761009216],
    [0, borderHardness.chin, 0.7236279845237732, 0.20104800164699554],
    [0, borderHardness.chin, 0.8826900124549866, 0.29291799664497375],
    [0, borderHardness.forehead, 0.850246012210846, 0.5677970051765442],
    [0, borderHardness.forehead, 0.7317180037498474, 0.7325220108032227], // 65
    [0, borderHardness.forehead, 0.6494290232658386, 0.7746469974517822],
    [0, borderHardness.forehead, 0.496410995721817, 0.7962639927864075]
  ],


  frontFacing: 'CCW', // for backface culling

  // how to group shape points to draw triangles
  // each value is an index in shape points array
  tesselation: [
    // upper lip:
    0,13,1, // each group of 3 indices is a triangular face
    0,12,13,
    1,13,2,
    2,13,14,
    2,14,3,
    3,14,4,
    14,15,4,
    4,15,5,
    15,6,5,
    15,16,6,

    // lower lip:
    0,19,12,
    0,11,19,
    11,10,19,
    10,18,19,
    10,9,18,
    9,8,18,
    8,17,18,
    8,7,17,
    7,6,17,
    6,16,17, //*/

    // upper right eye:
    20,29,28,
    20,28,21,
    21,28,27,
    21,27,22,
    22,27,26,
    22,26,23,
    
    // upper left eye:
    30,38,39,
    30,31,38,
    31,37,38,
    31,32,37,
    32,36,37,
    32,33,36,

    // right cheek:
    40,41,46,
    41,42,46,
    42,43,46,
    43,44,46,
    44,45,46,
    45,40,46,

    // left cheek:
    47,53,48,
    48,53,49,
    49,53,50,
    50,53,51,
    51,53,52,
    52,53,47,

    // chin right:
    54,9,10,
    54,10,11,
    55,11,0,
    55,54,11,
    56,55,0,
    56,0,40,
    56,40,45,
    56,45,57,
    57,45,44,

    // chin left:
    54,8,9,
    54,7,8,
    54,61,7,
    61,6,7,
    61,62,6,
    62,47,6,
    62,52,47,
    62,63,52,
    63,51,52,

    // nose area right:
    0,1,40,
    1,41,40,
    1,2,41,
    2,3,41,
    41,29,42,
    42,29,20,
    42,20,25,
    42,25,24,
    3,29,41,

    // nose area left:
    6,47,5,
    5,47,48,
    4,5,48,
    3,4,48,
    3,48,39,
    48,49,39,
    49,30,39,
    49,35,30,
    49,34,35,
    
    // nose center:
    3,39,29,
    29,39,67,

    // forehead right:
    29,67,28,
    28,67,60,
    27,28,60,
    27,60,59,
    58,27,59,
    58,26,27,

    // forehead left:
    39,38,67,
    38,66,67,
    38,37,66,
    37,65,66,
    37,64,65,
    36,64,37,

    // temple right:
    43,42,24,
    43,24,23,
    43,23,26,
    43,26,58,
    44,43,58,
    57,44,58,

    // temple left:
    49,50,34,
    34,50,33,
    50,36,33,
    50,64,36,
    50,51,64,
    51,63,64
  ],

   // interpolated points:
  // to make shape border smoother, we can add computed points
  // each value of this array will insert 2 new points
  // 
  // the first point will be between the first 2 points indices 
  // the second point will be between the last 2 points indices
  // 
  // the first value of ks controls the position of the first interpolated point
  // if -1, it will match the first point, if 0 it will match the middle point
  // the second value of ks controls the position of the second interpolated point
  // if 1, it will match the last point, if 0 it will match the middle point
  // 
  // computed using Cubic Hermite interpolation
  // the point is automatically inserted into the tesselation
  // points are given by their indices in shape points array
  interpolations: [
    // top of right eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [20, 21, 22],
      ks: [-0.5, 0.33] // between -1 and 1
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [21, 22, 23],
      ks: [-0.33, 0.5]
    },

    // bottom of right eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [24, 25, 20],
      ks: [-0.33, 0.5]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [23, 24, 25],
      ks: [-0.5, 0.33]
    },

    // top of left eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [32, 31, 30],
      ks: [-0.33, 0.5]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [33, 32, 31],
      ks: [-0.5, 0.33]
    },

    // bottom of left eye smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [30, 35, 34],
      ks: [-0.5, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [35, 34, 33],
      ks: [-0.33, 0.5]
    },

    // right forehead smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [60, 67, 66],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [59, 60, 67],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [58, 59, 60],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [57, 58, 59],
      ks: [-0.33, 0.33]
    },

    // left forehead smoother:
    {
      tangentInfluences: [2, 2, 2],
      points: [67, 66, 65],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [66, 65, 64],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [65, 64, 63],
      ks: [-0.33, 0.33]
    },

    // right lower jaw:
    {
      tangentInfluences: [2, 2, 2],
      points: [54, 55, 56],
      ks: [-0.5, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [55, 56, 57],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [56, 57, 58],
      ks: [-0.33, 0.33]
    },

    // left lower jaw:
    {
      tangentInfluences: [2, 2, 2],
      points: [62, 61, 54],
      ks: [-0.33, 0.5]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [63, 62, 61],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [64, 63, 62],
      ks: [-0.33, 0.33]
    },

    // mouth top:
    {
      tangentInfluences: [2, 2, 2],
      points: [14, 13, 12],
      ks: [-0.33, 0.5]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [15, 14, 13],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [16, 15, 14],
      ks: [-0.5, 0.33]
    },

    // mouth bottom:
    {
      tangentInfluences: [2, 2, 2],
      points: [12, 19, 18],
      ks: [-0.5, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [19, 18, 17],
      ks: [-0.33, 0.33]
    },
    {
      tangentInfluences: [2, 2, 2],
      points: [18, 17, 16],
      ks: [-0.33, 0.5]
    }
  ],

  // we can move points along their normals using the outline feature.
  // an outline is specified by the list of point indices in shape points array
  // it will be used to compute the normals, the inside and the outside
  // 
  // displacement array are the displacement along normals to apply
  // for each point of the outline.
   outlines: [
    // right top eye higher:
    {
      points: [20,21,22,23,24,25],
      displacements: [0.07,0.06,0.02,0.05,0,0,0,0]
    },
    // left top eye higher:
    {
      points: [30,31,32,33,34,35],
      displacements: [0.07,0.06,0.02,0.05,0,0,0,0]
    }
  ],

  // RENDERING:
  // GLSLFragmentSource is the GLSL source code of the shader used
  // to fill the shape:
  
  GLSLFragmentSource: "void main(void){\n\
    float borderThreshold = 1. - iVal.y;\n\
    float isInside = smoothstep(0., borderThreshold, iVal.x);\n\
    // compute makeup color:\n\
    vec3 color = texture2D(color, iVal.zw).rgb;\n\
    vec3 videoColor = texture2D(samplerVideo, vUV).rgb;\n\
    // compute transparency:\n\
    float brighness = 1.5 * dot(videoColor, vec3(0.299, 0.587, 0.114));\n\
    brighness = clamp(brighness, 0.3, 1.0);\n\
    float alpha = brighness * isInside;\n\
    // output color:\n\
    gl_FragColor = vec4(color, alpha);\n\
    \n\
    // DEBUG ZONE:\n\
    //gl_FragColor = vec4(0., 1., 0., 1.);\n\
  }",
  
  textures: [{
    id: 'color',
    src: makeupTextureImage
  }]
} // END SHAPEFACE


let _timerResize = null

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


class MakeupSport extends Component {
  constructor(props) {
    super(props)

    const PI = 3.1415
    const scale = 100
    this.state = {
      // size of the canvas:
      sizing: compute_sizing(),
      shapes: [SHAPEFACE]
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
      shape2DHelper.resize()
    })
  }

  componentDidMount(){
    // init WEBARROCKSFACE through the helper:
    const canvasAR = this.refs.canvasAR
    const canvasVideo = this.refs.canvasVideo
    shape2DHelper.init({
      NN,
      canvasVideo,
      canvasAR,
      shapes: this.state.shapes
    }).then(() => {
      console.log('READY')
    }).catch((err) => {
      throw new Error(err)
    })
  }

  componentWillUnmount() {
    return shape2DHelper.destroy()
  }

  render(){
    // generate canvases:
    return (
      <div>
        <canvas ref='canvasAR' className='mirrorX' style={{
          position: 'fixed',
          zIndex: 2,
          ...this.state.sizing
        }} width = {this.state.sizing.width} height = {this.state.sizing.height} />

        <canvas className='mirrorX' ref='canvasVideo' style={{
          position: 'fixed',
          zIndex: 1,
          ...this.state.sizing
        }} width = {this.state.sizing.width} height = {this.state.sizing.height} />

        <BackButton />
      </div>
    )
  }
} 

export default MakeupSport
