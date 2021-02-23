const WebARRocksFaceExpressionsEvaluator = (function(){


  const _evaluators = [], _expressions = {}, _triggers = {};


  // private funcs:
  function compute_distancePx(relPos0, relPos1){
    const wPx = WEBARROCKSFACE.get_widthPx();
    const hPx = WEBARROCKSFACE.get_heightPx();

    const dxPx = (relPos0[0] - relPos1[0]) * 0.5 * wPx;
    const dyPx = (relPos0[1] - relPos1[1]) * 0.5 * hPx;

    return Math.sqrt(dxPx*dxPx + dyPx*dyPx);
  }

  function clamp(x, min, max){ // analog to GLSL clamp function
    return Math.min(Math.max(x, min), max);
  }


  const that = {
    EASING: { // EASING functions:
      smoothStep: function(edge0, edge1, t) { // equivalent of GLSL smoothstep
        const u =  Math.min(Math.max((t - edge0) / (edge1 - edge0), 0), 1);
        return u * u * (3.0 - 2.0 * u);
      },
      linStep: function(edge0, edge1, t){
        const u = (t - edge0) / (edge1 - edge0);
        return Math.min(Math.max(u, 0), 1);
      },
      easeInStep: function(edge0, edge1, pow, t){ // 0 before edge0, 1 after edge1, #pow between edge0 and edge1 
        const u =  Math.min(Math.max((t - edge0) / (edge1 - edge0), 0), 1);
        return Math.pow(u, pow);
      },
      zero: function(t){ return 0;},
      one: function(t){ return 1;},
      // no easing, no acceleration
      linear: function (t) { return t },
      // accelerating from zero velocity
      easeInQuad: function (t) { return t*t },
      // decelerating to zero velocity
      easeOutQuad: function (t) { return t*(2-t) },
      // acceleration until halfway, then deceleration
      easeInOutQuad: function (t) { return t<.5 ? 2*t*t : -1+(4-2*t)*t },
      // accelerating from zero velocity 
      easeInCubic: function (t) { return t*t*t },
      // decelerating to zero velocity 
      easeOutCubic: function (t) { return (--t)*t*t+1 },
      // acceleration until halfway, then deceleration 
      easeInOutCubic: function (t) { return t<.5 ? 4*t*t*t : (t-1)*(2*t-2)*(2*t-2)+1 },
      // accelerating from zero velocity 
      easeInQuart: function (t) { return t*t*t*t },
      // decelerating to zero velocity 
      easeOutQuart: function (t) { return 1-(--t)*t*t*t },
      // acceleration until halfway, then deceleration
      easeInOutQuart: function (t) { return t<.5 ? 8*t*t*t*t : 1-8*(--t)*t*t*t },
      // accelerating from zero velocity
      easeInQuint: function (t) { return t*t*t*t*t },
      // decelerating to zero velocity
      easeOutQuint: function (t) { return 1+(--t)*t*t*t*t },
      // acceleration until halfway, then deceleration 
      easeInOutQuint: function (t) { return t<.5 ? 16*t*t*t*t*t : 1+16*(--t)*t*t*t*t }
    }, // end EASING

    evaluate_expressions: function(detectState){
      if (!detectState.isDetected){
        return _expressions;
      }
      
      // relative positions of landmarks:
      const landmarkRelPos = detectState.landmarks;

      _evaluators.forEach(function(evaluator){
        const id = evaluator.id;

        // compute distances between landmarks in pixels:
        const distance = compute_distancePx(landmarkRelPos[evaluator.landmarksInd[0]], landmarkRelPos[evaluator.landmarksInd[1]]);
        let refDistance = compute_distancePx(landmarkRelPos[evaluator.refLandmarksInd[0]], landmarkRelPos[evaluator.refLandmarksInd[1]]);
        
        // refDistance should be at least 0.5 pixel to avoid a division by 0:
        refDistance = Math.max(0.5, refDistance);

        // compute clamped distances ratio:
        const distanceRatio = distance / refDistance;
        const distanceRatioNormalized = (distanceRatio - evaluator.range[0]) / (evaluator.range[1] - evaluator.range[0]);
        const distanceRatioClamped = clamp(distanceRatioNormalized, 0, 1);

        // apply easing:
        let expressionValue = evaluator.easing(distanceRatioClamped);
        if (evaluator.isInv){
          expressionValue = 1.0 - expressionValue;
        }
        _expressions[id] = expressionValue;

        // Debug mode - display value on the DOM:
        if (evaluator.debugInputRange !== null){
          evaluator.debugInputRange.value = expressionValue;
          //console.log(id + ': ' + expressionValue.toFixed(2));
        }
      });

      return _expressions;
    },

    add_expressionEvaluator: function(id, argParams){
      // params properties:
      //  * <[<string>, <string>]> refLandmarks: reference face landmarks labels
      //  * <[<string>, <string>]> landmarks: measured face landmarks labels
      //  * <[<float>, <float>]> range: range where the distance ratios will be clamped
      //  * <function> easing: easing function to apply
      //  * <bool> isInv: whether we should invert the value or not
      //  * <bool> isDebug: append a range slider to the DOM to debug the value

      // add an expression evaluator whose id = id
      // landmarks and refLandmarks are 2-array of landmarks labels
      // compute the 2D distance in pixels between refLandmarks and landmarks, refDistancePx and distancePx
      // then compute distancePx / refDistancePx and clamp it to range
      // and apply easing function (if provided)
      
      const params = Object.assign({
        refLandmarks: null,
        landmarks: null,
        range: [0, 1],
        easing: that.EASING.linear,
        isInv: false,
        isDebug: false
      }, argParams);

      const get_LMInd = function(label){
        const landmarksLabels = WEBARROCKSFACE.get_LMLabels();
        const ind = landmarksLabels.indexOf(label);
        if (ind === -1){
          throw new Error('ERROR in WebARRocksFaceExpressionsEvaluator - add_expressionEvaluator(): cannot find landmark whose label = ' + label);
        }
        return ind;
      }

      let debugInputRange = null;
      if (params.isDebug){
        const topPx = 50 * _evaluators.length;
        debugInputRange = document.createElement('input');
        debugInputRange.setAttribute('type', 'range');
        debugInputRange.setAttribute('min', '0');
        debugInputRange.setAttribute('max', '1');
        debugInputRange.setAttribute('step', '0.01');
        debugInputRange.setAttribute('title', id);
        debugInputRange.setAttribute('style', 'position: fixed; z-index: 1000; left: 0; border: 1px solid red; top: ' + topPx.toString()+'px');
        document.body.appendChild(debugInputRange);
      }

      _evaluators.push ({
        id: id,
        refLandmarksInd: [get_LMInd(params.refLandmarks[0]), get_LMInd(params.refLandmarks[1])],
        landmarksInd: [get_LMInd(params.landmarks[0]), get_LMInd(params.landmarks[1])],
        range: params.range,
        isInv: params.isInv,
        easing: params.easing,
        debugInputRange: debugInputRange
      });

      _expressions[id] = -1;
      _triggers[id] = [];
    },

    add_trigger: function(id, params){
      const trigger = Object.assign({
        threshold: 0.5,
        hysteresis: 0.1,
        onStart: null,
        onEnd: null,
        delayMinMs: 0,
        state: false,
        timestampLastFired: -1
      }, params);

      _triggers[id].push(trigger);
    },

    run_triggers: function(expressionsValues){
      for (let expressionId in expressionsValues){
        const expressionValue = expressionsValues[expressionId];
        _triggers[expressionId].forEach(function(trigger){
          const state = trigger.state;
          const hysteresisOffset = (state) ? -trigger.hysteresis : trigger.hysteresis; 
          const threshold = trigger.threshold + hysteresisOffset;
          const targetState = (expressionValue > threshold);

          // still the same state:
          if (state === targetState) {
            return;
          }

          // look if we should wait a bit:
          const currentTimestamp = Date.now();
          if (trigger.delayMinMs !== 0){
            const dt = currentTimestamp - trigger.timestampLastFired;
            if (dt < trigger.delayMinMs){
              return;
            }
          }

          let isFired = false;
          if (targetState && trigger.onStart !== null){
            trigger.onStart();
            isFired = true;
          } else if (!targetState && trigger.onEnd !== null){
            trigger.onEnd();
            isFired = true;
          }

          if (isFired){
            trigger.timestampLastFired = currentTimestamp;
          }

          trigger.state = targetState;
        });
      }
    }
  };

  return that;
})();
