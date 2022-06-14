// doc about viewer API:
//   https://sketchfab.com/developers/viewer/functions#api-section-general

const VTO4SketchfabHelper = (function(){
  const _defaultSpec = {
    iframe: null, // DOM element of the Iframe

    // UID of the Sketchfab object:
    uid: '96bb6b6ef7664d2a936192f138fa0507',
    isSetFullScreen: true,

    // Sketchfab settings:
    VTOFoVMobile: 60,
    VTOFoVDesktop: 30,
    cameraLookAtDuration: 1,
    backgroundColor: [0xdd/0xff, 0xdd/0xff, 0xdd/0xff],
    
    fovFactor: 1.0, // fov factor between computation and display => dirty tweak if no focal correction (should be around 0.9 then)
    isFocalCorrection: true,

    // WebAR.rocks.face settings:
    solvePnPImgPointsLabels: [
      //'chinLeft', 'chinRight',

      'leftEarBottom',
      'rightEarBottom',
      'noseBottom',
      'noseLeft', 'noseRight',
      'leftEyeExt',
      'rightEyeExt'
    ],
    solvePnPObjPointsPositions: {
      'leftEyeExt': [0.55, 0.071,-0.212],  // 1808
      'rightEyeExt':[-0.55, 0.071,-0.212], // 2214
  
      'leftEarBottom': [0.9, -0.263, -1.1], // 65
      'rightEarBottom': [-0.9, -0.263, -1.1], // 245

      'noseLeft': [0.283656,-0.531859,-0.008442],
      'noseRight': [-0.283656,-0.531859,-0.008442],
      'noseBottom': [0,-0.618806,0.140511]// 468
    },
    specWebARRocksFace: {
      NNCPath: './neuralNets/NN_GLASSES_6.json',
      scanSettings: {
        threshold: 0.94
      }
    },
    landmarksStabilizerSpec: {},

    // model adjustment:
    rx: 5, // rotation around X axis (look up/down), in Deg. + -> branches up
    dy: -0.05, // vertical translation (+ -> up)
    dz: 0.07, // depth translation (+ -> forward)
    scale: 1.0, // scale. + -> bigger

    // debug flags:
    debugWebARCv: false
  };

  let _spec = null;
  let _client = null;
  let _api = null;
  let _rootNode = null;

  const _states = {
    notLoaded: -1,
    loading: 0,
    transition: 1,
    viewer: 2,
    VTO: 3
  }
  let _state = _states.notLoaded;

  const _viewerState = {
    fov: -1,
    cameraPosition: null,
    cameraTarget: null,
    rootNodeMatrix: null
  };

  const _dims = {
    dpr: 1.0,
    width: -1,
    height: -1,
    top: 0,
    left: 0
  };

  const _computePose = {    
    objPoints: [], // will be sorted by solver
    imgPointsLMIndices: [], // will be sorted by solver
    imgPointsPx: []
  };

  const _focals = [0, 0];
  const _deg2rad = Math.PI / 180;
  const create_mat4Identity = function(){
    return new Float32Array([
      1,0,0,0,
      0,1,0,0,
      0,0,1,0,
      0,0,0,1
    ]);
  }
  const _mat = create_mat4Identity();
  const _preMat = create_mat4Identity();
  const _matProd = create_mat4Identity();
  
  let _webARCanvas = null;
  let _video = null;
  let _isWebARRocksFaceInitialized = false;
  let _landmarksStabilizer = null;

  let _isSetMatrixBusy = false;
  let _VTOFoV = 0;
  let _isRootNodeVisible = true;


  function check_isMobile(){
    let check = false;
    (function(a){if(/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4))) check = true;})(navigator['userAgent']||navigator['vendor']||window['opera']);
    return check;
  }


  function set_iframeFullScreen(){
    //_spec.iframe.width = 300; _spec.iframe.height = 600; return;
    // -0.1 to fix a weird bug with chrome iphone emulator:
    _spec.iframe.width = window.innerWidth-0.1;
    _spec.iframe.height = screen.availHeight-0.1;  
  }


  function create_adjustMatrix(rxRad, dy, dz, scale){
    const cos = Math.cos(rxRad);
    const sin = Math.sin(rxRad)
    const s = scale;
    return new Float32Array([
      s,    0.0,    0.0,   0.0,
      0.0,  s*cos,  s*sin, 0.0,
      0.0,  -s*sin, s*cos, 0.0,
      0.0,  dy,     dz,    1.0
    ]);
  }


  function create_rotYMatrix(angleDeg){
    const angleRad = _deg2rad * angleDeg;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return new Float32Array([
      cos, 0.0, sin, 0.0,
      0.0, 1.0, 0.0, 0.0,
      -sin,0.0, cos, 0.0,
      0.0, 0.0, 0.0, 1.0
    ]);
  }


  function create_rotZMatrix(angleDeg){
    const angleRad = _deg2rad * angleDeg;
    const cos = Math.cos(angleRad);
    const sin = Math.sin(angleRad);
    return new Float32Array([
      cos, sin, 0.0, 0.0,
     -sin, cos, 0.0, 0.0,
      0.0, 0.0, 1.0, 0.0,
      0.0, 0.0, 0.0, 1.0
    ]);
  }


  function multiply_mats(m, n, r){
    r[0] = m[0]*n[0] + m[4]*n[1] + m[8]*n[2],
    r[1] = m[1]*n[0] + m[5]*n[1] + m[9]*n[2],
    r[2] = m[2]*n[0] + m[6]*n[1] + m[10]*n[2],
    //r[3] = 0.0;

    r[4] = m[0]*n[4] + m[4]*n[5] + m[8]*n[6],
    r[5] = m[1]*n[4] + m[5]*n[5] + m[9]*n[6],
    r[6] = m[2]*n[4] + m[6]*n[5] + m[10]*n[6],
    //r[7] = 0.0;
    
    r[8] = m[0]*n[8] + m[4]*n[9] + m[8]*n[10],
    r[9] = m[1]*n[8] + m[5]*n[9] + m[9]*n[10],
    r[10] = m[2]*n[8] + m[6]*n[9] + m[10]*n[10],
    //r[11] = 0.0;

    r[12] = m[0]*n[12] + m[4]*n[13] + m[8]*n[14] + m[12],
    r[13] = m[1]*n[12] + m[5]*n[13] + m[9]*n[14] + m[13],
    r[14] = m[2]*n[12] + m[6]*n[13] + m[10]*n[14] + m[14];
    //r[15] = 1.0;
  }


  function callbackTrack(detectState){
    if (_spec.debugWebARCv){
      WEBARROCKSFACE.render_video();
    }

    if (_isSetMatrixBusy || _state !== _states.VTO){
      //console.log('callbackTrack not ready');
      return;
    }

    if (detectState.isDetected && !_isRootNodeVisible){
      toggle_rootNodeVisibility(true);
    } else if (!detectState.isDetected){
      if (_isRootNodeVisible){
        toggle_rootNodeVisibility(false);
      }
      return;
    }

    const landmarks  = detectState.landmarks;
    const landmarksStabilized = (_landmarksStabilizer === null) ? landmarks : _landmarksStabilizer.update(landmarks, _dims.width, _dims.height);
    
    const w2 = -_dims.width * 0.5;
    const h2 = _dims.height * 0.5;
    const imgPointsPx = _computePose.imgPointsPx;

    _computePose.imgPointsLMIndices.forEach(function(ind, i){
      const imgPointPx = imgPointsPx[i];
      imgPointPx[0] = - landmarks[ind][0] * w2,  // X in pixels
      imgPointPx[1] = - landmarks[ind][1] * h2;  // Y in pixels
    });

    const objectPoints = _computePose.objPoints;
    const solved = WEBARROCKSFACE.compute_pose(objectPoints, imgPointsPx, _focals[0], _focals[1]);

    if (_rootNode && solved){

      const m = _mat;
      const r = solved.rotation, t = solved.translation;

      // set translation part:
      m[12] = -t[0], m[13] = -t[1], m[14] = -t[2];

      // set rotation part:
      m[0] = r[0][0], m[4] =  r[0][1], m[8] =  r[0][2],
      m[1] = r[1][0], m[5] =  r[1][1], m[9] =  r[1][2],
      m[2] = r[2][0], m[6] =  r[2][1], m[10] =  r[2][2];

      multiply_mats(_mat, _preMat, _matProd);
      set_rootNodeMatrixSync(_matProd);
    }

  }


  function set_stylePropPx(elt, prop, val){
    elt.style[prop] = val.toString() + 'px';
  }


  function set_dims(){
    const br = _spec.iframe.getBoundingClientRect();
    _dims.top = br.top;
    _dims.left = br.left;
    _dims.width = br.width;
    _dims.height = br.height;
    _dims.dpr = window.devicePixelRatio || 1.0;
  }

  function set_video(video){
    if (!_video){
      _video = video;
      document.body.appendChild(video);
      video.classList.add('cameraVideo');
    }

    // match video with iframe:
    const br = _spec.iframe.getBoundingClientRect();
    set_stylePropPx(_video, 'top', _dims.top);
    set_stylePropPx(_video, 'left', _dims.left);
    set_stylePropPx(_video, 'width', _dims.width);
    set_stylePropPx(_video, 'height', _dims.height);
  }


  function init_WebARRocksFace(){
    if (_isWebARRocksFaceInitialized){
      return Promise.resolve();
    }
    console.log('INIT WebAR.rocks.face...');

    // create canvas used for computation (hidden):
    set_dims();
    const _webARCanvas = document.createElement('canvas');
    _webARCanvas.setAttribute('width', _dims.width*_dims.dpr);
    _webARCanvas.setAttribute('height', _dims.height*_dims.dpr);
    if (_spec.debugWebARCv){
      document.body.appendChild(_webARCanvas);
      _webARCanvas.style.position = 'fixed';
      _webARCanvas.style.left = '0';
      _webARCanvas.style.bottom = '0';
      _webARCanvas.style.zIndex = '6';
      _webARCanvas.style.maxWidth = '30vw';
    }

    // init stabilizer:
    if (typeof(WebARRocksLMStabilizer) !== 'undefined'){
      _landmarksStabilizer = WebARRocksLMStabilizer.instance(_spec.landmarksStabilizerSpec);
    }

    return new Promise(function(accept, reject){
      const wSpec = Object.assign({
        callbackReady: function(err, vals){
          if (err){
            reject(err);
            return;
          }

          set_video(vals.video);
          update_focals();
          init_PnPSolver(vals.landmarksLabels);
          _isWebARRocksFaceInitialized = true;
          accept();
        },
        callbackTrack: callbackTrack,
        canvas: _webARCanvas
      }, _spec.specWebARRocksFace);
      WEBARROCKSFACE.init(wSpec);
    }); // end returned promise
  }


  function play_WebARRocksFace(){
    if (_isWebARRocksFaceInitialized){
      return WEBARROCKSFACE.toggle_pause(false, true).then(function(){
        if (_video){
          _video.style.display = 'block';
          set_video(null);
        }
      });
    } else {
      return init_WebARRocksFace();
    }
  }


  function pause_WebARRocksFace(){
    if (!_isWebARRocksFaceInitialized){
      return Promise.resolve();
    }
    if (_video){
      _video.style.display = 'none';
    }
    return WEBARROCKSFACE.toggle_pause(true, true);
  }


  function update_focals(){
    // COMPUTE CAMERA PARAMS (FOCAL LENGTH)
    // see https://docs.opencv.org/3.0-beta/modules/calib3d/doc/camera_calibration_and_3d_reconstruction.html?highlight=projectpoints
    // and http://ksimek.github.io/2013/08/13/intrinsic/

    const halfFovYRad = 0.5 * _VTOFoV * _deg2rad;
    
    // settings with EPnP:
    let fy = 0.5 * _dims.height / Math.tan(halfFovYRad);
    const fx = fy;

    if (_spec.isFocalCorrection){
      fy *= Math.cos(halfFovYRad);
    }

    _focals[0] = fy, _focals[1] = fy;
  }


  function init_PnPSolver(landmarksLabels){
    const imgPointsLabels = _spec.solvePnPImgPointsLabels;
    const objPointsPositions = _spec.solvePnPObjPointsPositions;

    const imgPointsPx = [];
    for (let i=0; i<imgPointsLabels.length; ++i){
      imgPointsPx.push([0, 0]);
    }
    _computePose.imgPointsPx = imgPointsPx;

    _computePose.imgPointsLMIndices = imgPointsLabels.map(
      function(label){
        const ind = landmarksLabels.indexOf(label);
        if (ind === -1){
          throw new Error('This neuron network model does not have any point with label=' + label);
        }
        return ind;
      });

    _computePose.objPoints = imgPointsLabels.map(
      function(label){
        const pos = objPointsPositions[label].slice(0);
        pos[0] *= -1.0; // mirror around X axis
        return pos;
      });
  }


  function get_rootNodeMatrix(){
    if (!_rootNode){
      return Promise.reject('Cannot find root node');
    }
    return new Promise(function(accept, reject){
      _api.getMatrix(_rootNode.instanceID, function(err, matrix) {
        if (err) {
          reject(err);
          return;
        }
        accept(matrix);
      });
    }); //end returned promise
  }


  function set_rootNodeMatrixSync(mat){
    if (_isSetMatrixBusy || !_rootNode){
      return;
    }
    _isSetMatrixBusy = true;
    _api.setMatrix(_rootNode.instanceID, mat, function(err) {
      if (err){
        throw new Error(err);
      }
      _isSetMatrixBusy = false;
    });
  }


  function set_rootNodeMatrix(mat){
    return new Promise(function(accept, reject){
      _api.setMatrix(_rootNode.instanceID, mat, function(err) {
        if (err){
          reject(err);
          return;
        }
        accept();
      });
    }); //end returned promise
  }
  window.set_rootNodeMatrix = set_rootNodeMatrix;


  function set_FoV(fov){
    return new Promise(function(accept, reject){
      _api.setFov(fov, function(err, angle) {
        if (err) {
          reject(err);
          return;
        }
        console.log('FoV set to', angle);
        accept();
      });
    }); //end returned promise
  }


  function get_FoV(){
    return new Promise(function(accept, reject){
      _api.getFov(function(err, fov) {
        if (err) {
          reject(err);
          return;
        }
        accept(fov);
      });
    }); //end returned promise
  }


  function toggle_rootNodeVisibility(isVisible){
    console.log('Toggle root node visibility to', isVisible);
    return new Promise(function(accept, reject){
      const setVisibilityFunc = (isVisible) ? _api.show : _api.hide;
      setVisibilityFunc(_rootNode.instanceID, function(err) {
        if (err) {
          reject(err);
          return;
        }
        _isRootNodeVisible = isVisible;
        accept();
      });
    }); //end returned promise
  }


  function get_cameraLookAt(){
    return new Promise(function(accept, reject){
      _api.getCameraLookAt(function(err, camera) {
        if (err){
          reject(err);
          return;
        }
        window.debugCamera = camera;
        accept(camera);
      });
    }); //end returned promise
  }


  function inv_YZ(pos){
    return [pos[0], -pos[2], pos[1]];
  }


  function set_cameraLookAt(position, target){
    return new Promise(function(accept, reject){
      _api.setCameraLookAt(position, target, _spec.cameraLookAtDuration, function(err) {
        if (err) {
          reject(err);
          return;
        }
        accept();
      });

    }); //end returned promise
  }


  function save_viewerState(){
    return Promise.all([
        get_FoV(),
        get_cameraLookAt(),
        get_rootNodeMatrix()
      ]).then(function(answers){
        _viewerState.fov = answers[0];
        console.log('Viewer FoV = ', _viewerState.fov);
        const camera = answers[1];
        _viewerState.cameraPosition = camera.position;
        _viewerState.cameraTarget = camera.target;
        console.log('Viewer camera lookAt = ', camera.position, camera.target);
        _viewerState.rootNodeMatrix = answers[2].local;
        console.log('Root node matrix = ', _viewerState.rootNodeMatrix);
      });
  }


  function restore_viewerState(){
    return Promise.all([
      set_FoV(_viewerState.fov),
      set_cameraLookAt(_viewerState.cameraPosition, _viewerState.cameraTarget),
      set_rootNodeMatrix(_viewerState.rootNodeMatrix)
    ]);
  }


  function set_backgroundTransparency(transparency){
    return Promise.resolve();
    /*return new Promise(function(accept, reject){
      const bgColor = _spec.backgroundColor;// (transparency === 1) ? [0,0,0] : (_spec.backgroundColor);
      _api.setBackground({color: bgColor, transparent: transparency}, function() {
        accept();
      });
    }); //end returned promise*/
  }


  function toggle_userInteraction(isEnabled){
    return new Promise(function(accept, reject){
      _api.setUserInteraction(isEnabled, function(err) {
        if (err) {
          reject(err);
          return;
        }
        accept();
      });
    }); //end returned promise
  }


  function toggle_toVTOMode(){
    _state = _states.transition;
    _spec.iframe.style.pointerEvents = 'none';
    return save_viewerState().then(function(){
      return Promise.all([
        play_WebARRocksFace(),
        set_backgroundTransparency(1),
        toggle_userInteraction(false),
        set_FoV(_VTOFoV*_spec.fovFactor),
        set_cameraLookAt(inv_YZ([0,0,0]), inv_YZ([0,0,-1]))
      ]); 
    });
  }


  function back_toViewerMode(){
    console.log('Back to viewer mode');
    _state = _states.transition;
    _spec.iframe.style.pointerEvents = 'auto';
    return Promise.all([
      restore_viewerState(),
      set_backgroundTransparency(0),
      toggle_userInteraction(true),
      pause_WebARRocksFace(),
      toggle_rootNodeVisibility(true)
      ]);
  }


  function get_rootNode(){
    return new Promise(function(accept, reject){
      _api.getSceneGraph(function(err, graph) {
        if (err) {
          reject(err);
          return;
        }
        if (!graph.children){
          reject('Cannot find rootNode');
          return;
        }
        window.debugGraph = graph;
        accept(graph.children[0].children[0]);
      });

    }); //end returned promise
  }


  const that = {
    init: function(spec){
      if (_state !== _states.notLoaded){
        return Promise.reject('VTO4Sketchfab Already initialized');
      }
      _spec = Object.assign({}, _defaultSpec, spec);
      _state = _states.loading;

      if (_spec.isSetFullScreen){
        set_iframeFullScreen();
      }

      _VTOFoV = (check_isMobile()) ? _spec.VTOFoVMobile : _spec.VTOFoVDesktop;

      const adjustMat = create_adjustMatrix(_spec.rx * _deg2rad, _spec.dy, _spec.dz, _spec.scale);
      const rot0Mat = create_rotZMatrix(180);
      multiply_mats(rot0Mat, adjustMat, _preMat);

      _client = new Sketchfab( _spec.iframe );

      return new Promise(function(accept, reject){
        _client.init( _spec.uid, {
          ui_stop: 0,
          transparent: true, // requires pro account
          ui_controls: 0, // requires premium account
          ui_help: 0,
          ui_general_controls: 0,
          ui_hint: 0,
          ui_infos: 0,
          ui_inspector: 0,
          ui_loading: 0,
          ui_settings: 0,
          ui_sound: 0,
          ui_start: 0,
          ui_vr: 0,
          ui_watermark: 0,
          dnt: 1,
          //scrollwheel: 0,
          success: function onSuccess( api ){
            _api = api;
            window.debugApi = _api;
            api.start();
            api.addEventListener( 'viewerready', function() {

              // API is ready to use
              _state = _states.viewer;

              Promise.all([
                  get_rootNode()
                ]).then(function(answers){
                  _rootNode = answers[0];
                  window.debugRootNode = _rootNode;
                  accept();
                })
              
            } );
          },
          error: function onError() {
            console.log( 'Viewer error' );
            reject();
          }
        }); //end client.init
      }) // end returned promise
    },


    toggle_VTO: function(isVTO){
      if (_state !== _states.viewer && _state !== _states.VTO){
        return Promise.reject();
      }
      if (_state === _states.viewer && isVTO){
        return toggle_toVTOMode().then(function(){
          _state = _states.VTO;
        });
      } else if (_state === _states.VTO && !isVTO){
        return back_toViewerMode().then(function(){
          _state = _states.viewer;
        });
      } else {
        return Promise.resolve();
      }
    }

  }; //end that
  return that;
})();
