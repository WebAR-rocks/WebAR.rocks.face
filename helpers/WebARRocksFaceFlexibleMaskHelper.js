"use strict"


const WebARRocksFaceFlexibleMaskHelper = (function(){
  const _settings = {
    debugMaskMesh: false,
    debugKeypointInfluencesCoeffs: -1,  // -1 -> disabled, otherwise indice of the point to debug
    debugKeypointInfluencesRendering: false,
    debugKeypointInfluencesKeepOnlyMostInfluencial: false,
    debugKeypointDisplacement: -1 // Indice of kp: -1 -> disabled, 2 -> nose outer
  };

  const _defaultBuildOptions = {
    kpInfluenceDecay: [+Infinity, +Infinity]
  };


  //BEGIN MISC THREE.JS HELPERS
  function tweak_threeShaderAdd(code, chunk, glslCode){
    return code.replace(chunk, chunk+"\n"+glslCode);
  }
  function tweak_threeShaderDel(code, chunk){
    return code.replace(chunk, '');
  }
  function tweak_threeShaderRepl(code, chunk, glslCode){
    return code.replace(chunk, glslCode);
  }
  //END MISC THREE.JS HELPERS


  // BEGIN EDGEGRAPH FUNCTIONS
  function is_edgeNotBrowsedForKp(kpInd, edge){
    return (edge.browsedFor.indexOf(kpInd) === -1);
  }
  function get_edgeOtherPointIndice(edge, pointIndice){
    return (pointIndice === edge.from) ? edge.to : edge.from;
  }
  function get_connectedEdges(edgeGraph, eqs, ind){
    const connectedEdges = [];
    eqs.forEach(function(i){
      const edges = edgeGraph[i];
      edges.forEach(function(edge){
        if (connectedEdges.indexOf(edge) === -1){
          connectedEdges.push(edge);
        }
      });
    }); //end forEach equivalent point
    return connectedEdges;
  }
  //END EDGEGRAPH FUNCTIONS

  const that = {
    load_geometryFromGLTF: function(loadingManager, GLTFUrl){
      return new Promise(function(resolve, reject){
        new THREE.GLTFLoader(loadingManager).load(GLTFUrl, function(model){
          let threeGeom = null, threeGeomParent = null, isFucked = false;
          model.scene.traverse(function(threeStuff){
            if (threeStuff.type !== 'Mesh' || !threeStuff.geometry){
              return;
            }
            if (threeGeom === null){
              threeGeomParent = threeStuff;
              threeGeom = threeStuff.geometry;
            } else if (threeGeom !== threeStuff.geometry){
              reject('MULTIPLE_GEOMETRIES');
              isFucked = true;
            }
          }); //end scene traversal

          if (isFucked){
            return;
          }
          if (threeGeom){
            threeGeom.userData.originalMaterial = threeGeomParent.material;
            resolve(threeGeom);
          } else {
            reject('NO_GEOMETRY');
          }
        }); //end GLTF loading
      }); //end return new Promise
    },


    preprocess_geom: function(geom){
      // Build vertices array:
      const vertices = [];
      for (let i=0; i<geom.attributes.position.count; ++i){
        vertices.push(new THREE.Vector3().fromArray(geom.attributes.position.array.slice(3*i, 3*i+3)));
      }
      geom.userData.vertices = vertices;

      // Compute vertex equivalences
      // Useful when the geometry is textured. Then some vertice are duplicated because their
      // UV is different even if they have the same position
      const verticesEqs = [];
      const verticesByPosition = {};
      const prec = 6;
      vertices.forEach(function(v, vi){
        const posKey = [v.x.toFixed(prec), v.y.toFixed(prec), v.z.toFixed(prec)].join('_');
        if (!(posKey in verticesByPosition)){
          verticesByPosition[posKey] = [];
        }
        verticesByPosition[posKey].push(vi);
        verticesEqs.push([vi]);
      });
      for (let posKey in verticesByPosition){
        const eqVerticesInds = verticesByPosition[posKey];
        for (let i = 0; i<eqVerticesInds.length; ++i){
          const eqVerticeInd = eqVerticesInds[i];
          for (let j=0; j<eqVerticesInds.length; ++j){
            const jVInd = eqVerticesInds[j];
            const vertexEq = verticesEqs[eqVerticeInd]; // equivalents of this vertex
            if (vertexEq.indexOf(jVInd)!==-1){ // do not add twice the same element
              continue;
            }
            vertexEq.push(jVInd);
          } //end loop on j
        } //end loop on equivalent vertices
      } // end loop on vertices
      geom.userData.verticesEqs = verticesEqs;


      // Init edges graph:
      const edgeGraph = new Array(vertices.length);
      for (let i=0; i<vertices.length; ++i){
        edgeGraph[i] = [];
      }
      const edges = [];


      // Build edges graph:
      const add_edge = function(ia, ib){
        // orient edge by sorting indices:
        const ifrom = (ia < ib) ? ia : ib;
        const ito = (ia < ib) ? ib : ia;

        // test if the edge is already registered:
        if (edgeGraph[ifrom].some(function(edge){
          return edge.to === ito;
        })){
          return;
        }

        const edge = {
          from: ifrom,
          to: ito,
          browsedFor: [],
          data: null
        };

        // add the edge to the edgegraph:
        edgeGraph[ifrom].push(edge);
        edgeGraph[ito].push(edge);
        edges.push(edge);
      };
      const nFaces = geom.index.count / 3;
      for (let i=0; i<nFaces; ++i){
        const ia = geom.index.array[3*i];
        const ib = geom.index.array[3*i + 1];
        const ic = geom.index.array[3*i + 2];
        
        add_edge(ia, ib);
        add_edge(ib, ic);
        add_edge(ic, ia);  
      }

      geom.userData.edgeGraph = edgeGraph;
      geom.userData.edges = edges;
    },


    reset_edgeGraphBrowse: function(geom){
      geom.userData.edges.forEach(function(edge){
        edge.data = null;
        edge.browsedFor.splice(0);
      });
    },


    select_keypoints: function(geom, allFace3DKeypoints){
      const vertices = geom.userData.vertices;
      
      // get available keypoints and their position:
      const availableLabels = WEBARROCKSFACE.get_LMLabels();
      const keypoints = [];
      availableLabels.forEach(function(label, labelIndice){
        if (!allFace3DKeypoints[label]){
          return;
        }
        
        // instantiate keypoint:
        const keypoint = {
          label: label,
          ind: labelIndice,
          position: new THREE.Vector3().fromArray(allFace3DKeypoints[label]),
          positionMesh: new THREE.Vector3(),
          positionView: new THREE.Vector3(),
          positionClip: new THREE.Vector4(),
          positionVpProjected: new THREE.Vector2(),
          positionVpMeasured: new THREE.Vector2(),
          displacementVp: new THREE.Vector2(),
          displacementView: new THREE.Vector4(),
          displacementObj: new THREE.Vector4(),
          closestIndice: -1,
          smallestDistance: Infinity
        };
        keypoints.push(keypoint);
      }); //end loop on availableLabels
      
      // for each keypoint, find the closest point in the geometry:
      vertices.forEach(function(vertice, indice){
        keypoints.forEach(function(keypoint){

          const distanceToKeypoint = keypoint.position.distanceTo(vertice);
          if (distanceToKeypoint < keypoint.smallestDistance){
            keypoint.smallestDistance = distanceToKeypoint;
            keypoint.closestIndice = indice;
            keypoint.positionMesh.copy(vertice);
          }

        }); //end loop on keypoints
      }); //end loop on vertices

      return keypoints;
    },


    compute_keypointsInfluences: function(geom, keypoints){
      // for each point of geom, get between 1 and 3 closest keypoints
      // and their influence.
      // 
      // do an edgegraph browse in width starting by keypoints
      
      // init keypoint influences:
      const vertices = geom.userData.vertices;
      const keypointsInfluences = new Array(vertices.length);
      for (let i = 0; i<vertices.length; ++i){
        keypointsInfluences[i] = [];
      }

      // get vertices equivalences:
      const verticesEqs = geom.userData.verticesEqs;

      // init browsing:
      let borderPointIndicesByKp = keypoints.map(function(keypoint, keypointIndice){
        verticesEqs[keypoint.closestIndice].forEach(function(ind){
          keypointsInfluences[ind].push({
            kpIndice: keypointIndice,
            edgeDistance: 0
          });
        });
        return [keypoint.closestIndice];
      });

      // main browsing loop:
      const edgeGraph = geom.userData.edgeGraph;
      let edgeDistance = 1;
      let borderPointsCount = 0;

      do {
        borderPointsCount = 0;

        const newBorderPointIndicesByKp = borderPointIndicesByKp.map(function(borderPointIndices, kpIndice){
          const newBorderPointIndices = [];
          // browse neighboors of borderPointIndices:
          borderPointIndices.forEach(function(borderPointIndice){
            const connectedEdges = get_connectedEdges(edgeGraph, verticesEqs[borderPointIndice], borderPointIndice);
            const edgesNotBrowsed = connectedEdges.filter(is_edgeNotBrowsedForKp.bind(null, kpIndice));
            edgesNotBrowsed.forEach(function(edge){
              // set edge as browsed for this kp:
              edge.browsedFor.push(kpIndice);

              const neighborIndice = get_edgeOtherPointIndice(edge, borderPointIndice);
              if (keypointsInfluences[neighborIndice].length === 3){
                return; // nothing to do
              }
              if (keypointsInfluences[neighborIndice].some(function(kpInfluence){
                return ( kpInfluence.kpIndice === kpIndice );
              })){
                return; // kp already added for a smaller edgeDistance, so do nothing
              }

              verticesEqs[neighborIndice].forEach(function(neighborIndiceOrEq){
                keypointsInfluences[neighborIndiceOrEq].push({
                  kpIndice: kpIndice,
                  edgeDistance: edgeDistance
                });
              });
              newBorderPointIndices.push(neighborIndice);

            }); //end loop on unbrowsed edges
          }); //end loop on border points

          borderPointsCount += newBorderPointIndices.length;
          return newBorderPointIndices;
        }); //end map on borderPointIndicesByKp
        borderPointIndicesByKp = newBorderPointIndicesByKp;

        ++edgeDistance;
      } while(borderPointsCount > 0);
      that.reset_edgeGraphBrowse(geom);
      
      return keypointsInfluences;
    }, //end compute_keypointsInfluences()


    normalize_keypointsInfluences: function( keypointsInfluences ){
      // normalize, pad keypointsInfluences
      // build VBO ready array
      
      const n = keypointsInfluences.length;
      const keypointsIndices = new Float32Array(3 * n);
      const keypointsMorphInfluences = new Float32Array(3 * n);

      keypointsInfluences.forEach(function(influences, i){
        // initialize keypointsStuffs:
        keypointsIndices [ 3 * i ] = 0;
        keypointsIndices [ 3 * i + 1 ] = 0;
        keypointsIndices [ 3 * i + 2 ] = 0;

        keypointsMorphInfluences[ 3 * i ] = 0;
        keypointsMorphInfluences[ 3 * i + 1 ] = 0;
        keypointsMorphInfluences[ 3 * i + 2 ] = 0;

        if (influences.length === 0){
          // if there is no inflence, keep initialization value:
          return;
        } else if (influences.length === 1){
          // if there is only 1 influence, bind to KP:
          keypointsIndices [ 3 * i ] = influences[0].kpIndice;
          keypointsMorphInfluences[ 3 * i ] = 1;
          return;
        }

        // keep only the nearest keypoint, for debugging only:
        if (_settings.debugKeypointInfluencesKeepOnlyMostInfluencial){
          const biggestInfluence = influences.sort(function(infA, infB){
            return infA.edgeDistance - infB.edgeDistance;
          })[0];
          keypointsIndices [ 3 * i ] = biggestInfluence.kpIndice;
          keypointsMorphInfluences[ 3 * i ] = 1;
          return;
        }

        // if one of the influences has edgeDistance === 0 (match with a keypoint), only keep that keypoint:
        const nullEdgesInfluences = influences.filter(function(influence){
          return (influence.edgeDistance === 0);
        });
        if (nullEdgesInfluences.length === 1){
          const influence = nullEdgesInfluences[0];
          keypointsIndices [ 3 * i ] = influence.kpIndice;
          keypointsMorphInfluences[ 3 * i ] = 1;
          return;
        } else if (nullEdgesInfluences.length > 0){
          const nInfls = Math.min(nullEdgesInfluences.length, 3);
          for (let iInfl = 0; iInfl<nInfls; ++iInfl){
            const influence = nullEdgesInfluences[iInfl];
            keypointsIndices [ 3 * i ] = influence.kpIndice;
            keypointsMorphInfluences[ 3 * i ] = 1 / nInfls;
          }
          return;
          //throw new Error ('invalid influences');
        }

        // now we have 2 or 3 keypoints and none has a null edgeDistance
        keypointsIndices [ 3 * i ] = influences[0].kpIndice;
        keypointsIndices [ 3 * i + 1 ] = influences[1].kpIndice;

        if (influences.length === 2){
          const sumEdgeDistances = influences[1].edgeDistance + influences[0].edgeDistance;
          keypointsMorphInfluences[ 3 * i ] = influences[1].edgeDistance / sumEdgeDistances;
          keypointsMorphInfluences[ 3 * i + 1 ] = influences[0].edgeDistance / sumEdgeDistances;
          return;
        }

        keypointsIndices [ 3 * i + 2 ] = influences[2].kpIndice;

        const ea = influences[0].edgeDistance, eb = influences[1].edgeDistance, ec = influences[2].edgeDistance;
        const denom = ea*eb + ea*ec + eb*ec;

        keypointsMorphInfluences[ 3 * i ] = eb*ec / denom;
        keypointsMorphInfluences[ 3 * i + 1] = ea*ec / denom;
        keypointsMorphInfluences[ 3 * i + 2] = ea*eb / denom;
      }); //end loop on keypointsInfluences

      // check keypointsMorphInfluences:
      /*for (let i=0; i<keypointsMorphInfluences.length; ++i){
        const k = keypointsMorphInfluences[i];
        if (isNaN(k) || k<0 || k>1){
          debugger;
        }
      }*/

      return {
        indices: keypointsIndices,
        morphInfluences: keypointsMorphInfluences
      };
    }, //end normalize_keypointsInfluences()


    decay_keypointsMorphInfluences: function(geom, keypoints, keypointsMorphInfluences, decayRange){
      const decayStart = decayRange[0], decayEnd = decayRange[1];
      const positions = geom.attributes.position.array;
      const n = keypointsMorphInfluences.indices.length;
      const position = new THREE.Vector3();
      for (let i=0; i<n; ++i){ // loop on mesh points:
        const pointIndice = Math.floor(i / 3);

        // decay each weight independantly:
        const kpIndice = keypointsMorphInfluences.indices[i];
        const influence = keypointsMorphInfluences.morphInfluences[i];
        if (kpIndice <= 0 && influence <= 0){
          continue;
        }

        // the influence is effective. Compute the distance d between the point and the keypoint:
        const keypointPosition = keypoints[kpIndice].positionMesh;
        position.fromArray(positions.slice(3*pointIndice, 3*pointIndice + 3));
        const d = position.distanceTo(keypointPosition);

        // compare this distance to decay metrics:
        if (d < decayStart){ // no decay, too close to the keypoint
          continue;
        } else if (d > decayEnd){ // cancel keypoint influence because too far from the keypoint:
          keypointsMorphInfluences.indices[i] = 0;
          keypointsMorphInfluences.morphInfluences[i] = 0;
          continue;
        }
        
        // the point is inside the decay range. Apply a linear decay:
        const decayFactor = (decayEnd - d) / (decayEnd - decayStart);
        keypointsMorphInfluences.morphInfluences[i] *= decayFactor;
      } //end loop on mesh points
    },


    debug_keypointInfluencesCoeffs: function(keypoints, keypointsInfluences, keypointsMorphInfluences, indice){
      const iStart = 3 * indice;
      const iEnd = iStart + 3;
      // slice and untype the array:
      const indices = Array.prototype.slice.call(keypointsMorphInfluences.indices.slice(iStart, iEnd));
      const influences = Array.prototype.slice.call(keypointsMorphInfluences.morphInfluences.slice(iStart, iEnd));
      const labels = indices.map(function(ind){
        const infl = influences[ind];
        return (ind === 0 && infl === 0) ? 'none' : keypoints[ind].label;
      });
      console.log('INFO in debug_keypointInfluencesCoeffs(): debug point with indice', indice);
      console.log('influences =', influences);
      console.log('keypoints =', labels);
      console.log('keypointsInfluences =', keypointsInfluences[indice]);
    },


    bind_keypointsMorphInfluenceToGeom: function(geom, keypointsMorphInfluences){
      // build bufferAttributes:
      const kpIndicesBA = new THREE.BufferAttribute(keypointsMorphInfluences.indices, 3, false);
      const kpMorphInfluenceBA = new THREE.BufferAttribute(keypointsMorphInfluences.morphInfluences, 3, false);
      
      // bind BA to geometry:
      geom.setAttribute( 'kpIndices', kpIndicesBA );
      geom.setAttribute( 'kpMorphInfluences', kpMorphInfluenceBA );
    },


    build_debugKeypointsMorphMesh: function(geom, keypointsCount){
      // pick colors for keypoints on the hue circle:
      const colors = [];
      for (let i=0; i<keypointsCount; ++i){
        const hue = i / keypointsCount;
        const threeColor = new THREE.Color().setHSL(hue, 1, 0.5);
        colors.push(threeColor);
      }

      // shuffle colors:
      colors.sort(function(){ return Math.random() - 0.5; });

      // build material:
      const vertexShader = "\
        attribute vec3 kpIndices, kpMorphInfluences;\n\
        uniform vec3 kpColors[" + keypointsCount.toString() + "];\n\
        varying vec3 vCol;\n\
        void main() {\n\
          gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );\n\
          vCol = vec3(0.0, 0.0, 0.0);\n\
          vCol += kpMorphInfluences.x * kpColors[int(kpIndices.x + 0.1)];\n\
          vCol += kpMorphInfluences.y * kpColors[int(kpIndices.y + 0.1)];\n\
          vCol += kpMorphInfluences.z * kpColors[int(kpIndices.z + 0.1)];\n\
        }";

      const fragmentShader = "\
        varying vec3 vCol;\n\
        void main() {\n\
          gl_FragColor = vec4(vCol, 1.0);\n\
        }";

      const debugMat = new THREE.ShaderMaterial({
        uniforms: {
          'kpColors': {value: colors}
        },
        vertexShader: vertexShader,
        fragmentShader: fragmentShader
      });

      return new THREE.Mesh(geom, debugMat);
    },


    build_flexibleMaskMaterial: function(originalMaterial, keypointsCount){
      // build kp displacement array:
      const kpDisplacements = [];
      for (let i=0; i<keypointsCount; ++i){
        kpDisplacements.push(new THREE.Vector3());
      }

      // build material parameters:
      const baseMat = THREE.ShaderLib.standard;
      const uniforms = Object.assign({
        'kpDisplacements': { value: kpDisplacements }
      }, baseMat.uniforms);
      let vertexShader = baseMat.vertexShader;

      // tweak vertex shader:
      const GLSLDeclareVars = "attribute vec3 kpIndices, kpMorphInfluences;\n\
        uniform vec3 kpDisplacements[" + keypointsCount.toString() + "];\n";
      vertexShader = tweak_threeShaderAdd(vertexShader, '#include <common>', GLSLDeclareVars);
      const GLSLDisplace = "vec3 displaced = vec3(0.0, 0.0, 0.0);\n\
        displaced += kpMorphInfluences.x * kpDisplacements[int(kpIndices.x + 0.1)];\n\
        displaced += kpMorphInfluences.y * kpDisplacements[int(kpIndices.y + 0.1)];\n\
        displaced += kpMorphInfluences.z * kpDisplacements[int(kpIndices.z + 0.1)];\n\
        transformed += displaced;";
      vertexShader = tweak_threeShaderAdd(vertexShader, '#include <begin_vertex>', GLSLDisplace);
      
      // instantiate material:
      const mat = new THREE.ShaderMaterial({
        uniforms: uniforms,
        vertexShader: vertexShader,
        fragmentShader: baseMat.fragmentShader,
        lights: true,
        fog: false,
        extensions: {
          derivatives: true
        }
      });

      // copy texture if necessary:
      if (originalMaterial){
        if (originalMaterial.map){
          uniforms.map = {
            value: originalMaterial.map
          };
          mat.map = originalMaterial.map;
        }
      }

      return mat;
    },


    build_flexibleMask: function(geom, face3DKeypointsPositions, optionsArg){

      const options = Object.assign({}, _defaultBuildOptions, optionsArg);

      if (_settings.debugMaskMesh){
        return new THREE.Mesh(geom, new THREE.MeshNormalMaterial({side: THREE.DoubleSide}));
      }

      that.preprocess_geom(geom); // build edge graph, vertices array, ...
      const keypoints = that.select_keypoints(geom, face3DKeypointsPositions);
      const keypointsCount = keypoints.length;
      const keypointsInfluences = that.compute_keypointsInfluences(geom, keypoints);
      const keypointsMorphInfluences = that.normalize_keypointsInfluences(keypointsInfluences);
      if (_settings.debugKeypointInfluencesCoeffs !== -1){
        that.debug_keypointInfluencesCoeffs(keypoints, keypointsInfluences, keypointsMorphInfluences, _settings.debugKeypointInfluencesCoeffs);
      }
      that.decay_keypointsMorphInfluences(geom, keypoints, keypointsMorphInfluences, options.kpInfluenceDecay);
      that.bind_keypointsMorphInfluenceToGeom(geom, keypointsMorphInfluences);

      if (_settings.debugKeypointInfluencesRendering){
        return that.build_debugKeypointsMorphMesh(geom, keypointsCount);
      }

      // original material:
      const originalMaterial = geom.userData.originalMaterial;

      // build new material and mesh:
      const mat = that.build_flexibleMaskMaterial(originalMaterial, keypointsCount);
      const mesh = new THREE.Mesh(geom, mat);
      mesh.userData.keypoints = keypoints;
      return mesh;
    },


    // compute the position of the keypoints without flexible material:
    compute_face3DKeypointsPositionsVp: function(camera, mesh){
      const matMV = mesh.modelViewMatrix;
      const matProj = camera.projectionMatrix;
      const keypoints = mesh.userData.keypoints;
      keypoints.forEach(function(kp){
        kp.positionView.copy(kp.position);
        kp.positionView.applyMatrix4(matMV);
        kp.positionClip.copy(kp.positionView);
        kp.positionClip.applyMatrix4(matProj);
        kp.positionVpProjected.set(kp.positionClip.x / kp.positionClip.w, kp.positionClip.y / kp.positionClip.w);
      });
    },


    copy_keypointPositionsMeasured: function(mesh, detectState){
      const keypoints = mesh.userData.keypoints;
      keypoints.forEach(function(kp){
        const ind = kp.ind;
        const posVpMeasured = detectState.landmarks[ind];
        kp.positionVpMeasured.fromArray(posVpMeasured);
      });
    },


    debug_keypointsDisplacement: function(mesh){
      const keypoints = mesh.userData.keypoints;
      keypoints.forEach(function(kp, kpInd){
        if (kpInd === _settings.debugKeypointDisplacement){
          kp.positionVpMeasured.set(0,0); // center of the viewport
        } else {
          kp.positionVpProjected.copy(kp.positionVpMeasured);
        }
      });
    },


    compute_keypointsDisplacements: function(camera, mesh){
      const keypoints = mesh.userData.keypoints;
      const matProj = camera.projectionMatrix;
      const matMVInv = new THREE.Matrix4().getInverse(mesh.modelViewMatrix);

      keypoints.forEach(function(kp){
        // compute the displacement of the keypoint in the viewport:
        kp.displacementVp.copy(kp.positionVpMeasured).sub(kp.positionVpProjected);
        kp.displacementVp.multiplyScalar(-1);

        // unproject this displacement to get it in the view 3D ref, in the plane (XY):
        const zClip = 2 * kp.positionClip.z;
        kp.displacementView.setX( -zClip * kp.displacementVp.x / matProj.elements[0] );
        kp.displacementView.setY( -zClip * kp.displacementVp.y / matProj.elements[5] );        
        kp.displacementView.setZ( 0 );
        kp.displacementView.setW( 0 );

        // transform from view ref to object ref:
        kp.displacementObj.copy(kp.displacementView);
        kp.displacementObj.applyMatrix4(matMVInv);
      });
    },


    apply_keypointsDisplacements: function(mesh){
      const keypoints = mesh.userData.keypoints;
      const kpDisplacementUniform = mesh.material.uniforms.kpDisplacements.value;
      keypoints.forEach(function(kp, kpIndice){
        kpDisplacementUniform[kpIndice].copy(kp.displacementObj);
      });
    },


    update_flexibleMask: function(camera, mesh, detectState){
      if (!detectState.isDetected || _settings.debugKeypointInfluencesRendering){
        return;
      }

      that.compute_face3DKeypointsPositionsVp(camera, mesh);
      that.copy_keypointPositionsMeasured(mesh, detectState);
      if (_settings.debugKeypointDisplacement !== -1){
        that.debug_keypointsDisplacement(mesh);
      }
      that.compute_keypointsDisplacements(camera, mesh);
      that.apply_keypointsDisplacements(mesh);
    }
  }
  return that;
})();
