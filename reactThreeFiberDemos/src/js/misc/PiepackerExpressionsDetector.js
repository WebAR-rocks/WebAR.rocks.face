
import FaceExpressionsEvaluator from '../contrib/WebARRocksFace/helpers/WebARRocksFaceExpressionsEvaluator.js'


let _spec = null;
const _defaultSpec = {
  onMouthOpen: null,
  onMouthClose: null,

  onEyeLeftClose: null,
  onEyeLeftOpen: null,

  onEyeRightClose: null,
  onEyeRightOpen: null,
};


function init_evaluators(WEBARROCKSFACE) {
  // run WEBARROCKSFACE.get_LMLabels() in the web console
  // to get landmarks labels provided by the current neural network

  // MOUTH:
  FaceExpressionsEvaluator.add_expressionEvaluator(WEBARROCKSFACE, "OPEN_MOUTH", {
    refLandmarks: ["lowerLipTop", "chin"],
    landmarks: ["lowerLipTop", "upperLipBot"],
    range: [0.05, 0.45],
    isInv: false,
    isDebug: false
  });

  // OPEN/CLOSE EYES:
  const closeEyeEvaluatorParams = {
    isInv: true,
    isDebug: false,
    delayMinMs: 500,
  };
  FaceExpressionsEvaluator.add_expressionEvaluator(WEBARROCKSFACE, 
    "CLOSE_LEFT_EYE",
    Object.assign(
      {
        range: [0.18, 0.21],
        refLandmarks: ["leftEyeInt", "leftEyeExt"],
        landmarks: ["leftEyeTop", "leftEyeBot"],
      },
      closeEyeEvaluatorParams
    )
  );
  FaceExpressionsEvaluator.add_expressionEvaluator(WEBARROCKSFACE, 
    "CLOSE_RIGHT_EYE",
    Object.assign(
      {
        range: [0.18, 0.21],
        refLandmarks: ["rightEyeInt", "rightEyeExt"],
        landmarks: ["rightEyeTop", "rightEyeBot"],
      },
      closeEyeEvaluatorParams
    )
  );
}


function init_triggers() {
  FaceExpressionsEvaluator.add_trigger("OPEN_MOUTH", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: _spec.onMouthOpen,
    onEnd: _spec.onMouthClose
  });

  FaceExpressionsEvaluator.add_trigger("CLOSE_LEFT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart:_spec.onEyeLeftClose,
    onEnd: _spec.onEyeLeftOpen,
  });

  FaceExpressionsEvaluator.add_trigger("CLOSE_RIGHT_EYE", {
    threshold: 0.5,
    hysteresis: 0.1,
    onStart: _spec.onEyeRightClose,
    onEnd: _spec.onEyeRightOpen
  });
}


const that = {
  init: function(WEBARROCKSFACE, spec){
    _spec = Object.assign({}, _defaultSpec, spec);
    FaceExpressionsEvaluator.destroy();
    init_evaluators(WEBARROCKSFACE);
    init_triggers();
  },

  update(WEBARROCKSFACE, detectState){
    const expressionsValues = FaceExpressionsEvaluator.evaluate_expressions(
      WEBARROCKSFACE,
      detectState
    );
    FaceExpressionsEvaluator.run_triggers(expressionsValues);
  }
}

export default that;