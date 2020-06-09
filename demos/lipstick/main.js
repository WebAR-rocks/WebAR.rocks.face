let _canvasVideo = null, _canvasAR = null;

function start(){
  WebARRocksFaceShape2DHelper.init({
    NNCpath: '../../../../../../saves/saves/faceFilterLMLipstick0_2020-05-29_2_1.json',
    canvasVideo: _canvasVideo,
    canvasAR:_canvasAR,
    shapes: [{
      tesselation: [
        // upper lip:
        0,1,12,
        1,12,13,
        1,13,2,
        2,13,14,
        2,3,14,
        3,4,14,
        14,15,4,
        4,5,15,
        15,5,16,
        5,6,16,

        // lower lip:
        0,12,11,
        12,19,11,
        11,10,19,
        10,18,19,
        10,9,18,
        8,9,18,
        8,17,18,
        7,8,17,
        16,7,17,
        6,7,16
      ],

      GLSLFragmentSource: "gl_FragColor = vec4(1.0, 0.0, 0.0, 0.5);"
    }]

  }).then(function(){

  }).catch(function(err){
    throw new Error(err);
  });
}


// entry point:
function main(){
  _canvasAR = document.getElementById('WebARRocksFaceCanvasAR');
  _canvasVideo = document.getElementById('WebARRocksFaceCanvasVideo');
  
  WebARRocksResizer.size_canvas({
    canvas: _canvasVideo,
    overlayCanvas: [_canvasAR],
    callback: start,
    isFullScreen: true
  });
}