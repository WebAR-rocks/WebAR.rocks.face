/**
 *
 * Copyright (c) 2021 WebAR.rocks
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


//import * as THREE from '../libs/three/v134/build/three.module.js';

// these imports are useless if you don't use download_currentDeformedModel
//import { GLTFExporter } from '../libs/three/v134/examples/jsm/exporters/GLTFExporter.js';


const BadgerAutobones = function(threeSkinnedMesh, mapBonesToLandmarks, optionsArg){

  const options = Object.assign({
    moveFactor: 1,
    moveFactorsPerAutobone: null,
    isSubMeanDisplacement: true,
    isMoveRootByMeanDisplacement: false
  }, optionsArg || {});

  this.skinnedMesh = threeSkinnedMesh;
  this.isEnabled = true;

  const v4 = new THREE.Vector4(); // working vector 4

  // WebAR.rocks specifics:
  if (options.webARRocksLandmarks){
    this.landmarksInds = {};
    this.landmarksViewportPositions = {};
    for (let boneName in mapBonesToLandmarks){
      const lmLabel = mapBonesToLandmarks[boneName];
      const lmInd = options.webARRocksLandmarks.indexOf(lmLabel);
      if (lmInd !== -1){
        this.landmarksInds[lmLabel] = lmInd;
        this.landmarksViewportPositions[lmLabel] = new THREE.Vector2();
      }
    }
  }

  // extract bones:
  this.boneParents = [];
  this.bonesByLandmark = {};
  for (let boneName in mapBonesToLandmarks){
    const landmarkName = mapBonesToLandmarks[boneName];
    const bone = extract_boneByName(this.skinnedMesh, boneName);
    if (!bone){
      console.log('WARNING in BadgerAutobones constructor: cannot find bone ', boneName);
      continue;
    }

    // enrich bone:
    Object.assign(bone.userData, {
      restPosition: bone.position.clone(),
      restWorldPosition: new THREE.Vector3(),
      displacementWorld: new THREE.Vector3(),
      ray: new THREE.Ray()
    });
    
    this.bonesByLandmark[landmarkName] = bone;

    if (bone.parent){
      if (!this.boneParents.includes(bone.parent)){
        Object.assign(bone.parent.userData, {
          matrixWorldInv: new THREE.Matrix4(),
          parentMatrixWorldInv: new THREE.Matrix4(),
          originalRestPosition: bone.parent.position.clone(),
          childrenMeanDisplacementsWorld: new THREE.Vector3(),
          childrenSumDisplacementsWorld: new THREE.Vector3(),
          childrenCount: 0
        });
        this.boneParents.push(bone.parent);
      }
      ++bone.parent.userData.childrenCount;
    }

    // displacement amplitude factor:
    let moveFactor = options.moveFactor;
    if (options.moveFactorsPerAutobone && options.moveFactorsPerAutobone[boneName]){
      moveFactor *= options.moveFactorsPerAutobone[boneName];
    }
    bone.userData.moveFactor = moveFactor; // save moveFactor
  } //end loop on bones
  //console.log('INFO in BadgerAutobones: ', this.boneParents.length, 'parent bones found');
  if (options.isSubMeanDisplacement){
    this.boneParents.forEach(function(bone){
      bone.userData.rootRestPosition = bone.position.clone();
    })
  }

  
  this.update_parentsMatrixWorldInv = function(){
    this.boneParents.forEach(function(boneParent){
      boneParent.userData.matrixWorldInv.copy(boneParent.matrixWorld).invert();
      if (options.isSubMeanDisplacement){
        boneParent.userData.childrenSumDisplacementsWorld.set(0,0,0);
        if (boneParent.parent){
          boneParent.parent.updateMatrixWorld();
          boneParent.userData.parentMatrixWorldInv.copy(boneParent.parent.matrixWorld).invert();
        }
      }
    });
  }


  this.move_parentsBones = function(){
    this.boneParents.forEach(function(boneParent){
      // compute mean displacement:
      v4.copy(boneParent.userData.childrenSumDisplacementsWorld).divideScalar(boneParent.userData.childrenCount).setW(0.0);
      boneParent.userData.childrenMeanDisplacementsWorld.copy(v4);

      if (options.isMoveRootByMeanDisplacement){
        // put v4 from world to boneParent ref:
        v4.applyMatrix4(boneParent.userData.parentMatrixWorldInv);
        
        // copy to position attribute and add original position:
        boneParent.position.copy(v4).add(boneParent.userData.originalRestPosition);
      }
    });
  }


  this.update = function(threeCamera, landmarksViewportPositions){
    if (!this.isEnabled){
      return;
    }

    this.update_parentsMatrixWorldInv();

    // compute displacements:
    for (let landmarkName in landmarksViewportPositions){
      const viewportPosition = landmarksViewportPositions[landmarkName]; // THREE Vector2
      const bone = this.bonesByLandmark[landmarkName];
      if (!bone) continue;

      compute_boneDisplacementsWorld(threeCamera, bone, viewportPosition);
      if (options.isSubMeanDisplacement && bone.parent){
        bone.parent.userData.childrenSumDisplacementsWorld.add(bone.userData.displacementWorld);
      }
    }

    // if isSubMeanDisplacement enabled, compute mean displacement for each root bone and substract it to bone displacements:
    if (options.isSubMeanDisplacement){
      this.move_parentsBones();
      // remove parent displacement from child displacements:
      for (let landmarkName in landmarksViewportPositions){
        const bone = this.bonesByLandmark[landmarkName];
        if (!bone || !bone.parent) continue;
        bone.userData.displacementWorld.sub(bone.parent.userData.childrenMeanDisplacementsWorld);
      }
    }

    // apply displacements to autobones:
    for (let landmarkName in landmarksViewportPositions){
      const bone = this.bonesByLandmark[landmarkName];
      if (!bone) continue;
      update_bonePosition(bone);
    }
  }


  this.update_fromWebARRocks = function(threeCamera, landmarksViewportPositionsArr){
    for (let lmLabel in this.landmarksViewportPositions){
      const threeLMPos = this.landmarksViewportPositions[lmLabel];
      const LMInd = this.landmarksInds[lmLabel];
      const LMPosArr = landmarksViewportPositionsArr[LMInd];
      threeLMPos.fromArray(LMPosArr);
    }
    this.update(threeCamera, this.landmarksViewportPositions);
  }


  // Debug function, to download the deformed mesh
  // with the current position
  // it can be used to align rest pose with a neutral face expression
  this.download_currentDeformedModel = function(){
    const save_arrayBuffer = function( buffer, filename, cb) {
      cb( new Blob( [ buffer ], { type: 'application/octet-stream' } ), filename);
    }
    const save_string = function( text, filename, cb ) {
      cb( new Blob( [ text ], { type: 'text/plain' } ), filename);
    }

    const exported = new THREE.Object3D();
    const skinnedMesh = this.skinnedMesh;
    this.isEnabled = false;
    const that = this;
    const originalParentSkinnedMesh = skinnedMesh.parent;
    exported.add(skinnedMesh);
    const skeleton = skinnedMesh.skeleton;
    skeleton.bones.forEach(function(bone) {
      if (!bone.parent.isBone){
        bone.parent.userData.originalParent = bone.parent.parent;
        exported.add(bone.parent);
      }
    });

    // restore parenting:
    const restore = function(){
      originalParentSkinnedMesh.add(skinnedMesh);
      skeleton.bones.forEach(function(bone) {
        if (bone.parent.userData.originalParent){
          bone.parent.userData.originalParent.add(bone.parent);
          bone.parent.userData.originalParent = null;
        }
      });
      that.isEnabled = true;
    }

    return new Promise(function(accept, reject){

      const end = function(blob, filename){
        restore();
        accept({
          blob: blob,
          filename: filename
        });
      }

      // do export:
      const gltfExporter = new GLTFExporter();
      gltfExporter.parse(
        exported,
        function ( result ) {
          const filename = 'autobonesCurrentPose';
          if ( result instanceof ArrayBuffer ) {
            save_arrayBuffer( result, filename + '.glb', end );
          } else {
            const output = JSON.stringify( result, null, 2 );
            save_string( result, filename + '.gltf', end );
          }
        },
        {
          onlyVisible: false,
          binary: true,
          animations: []
        }
      ); //end gltfExporter.parse
    }); //end returned promise
  } //end this.download_currentDeformedModel
}


const compute_boneDisplacementsWorld = function(camera, bone, viewportPosition){
  // extract moveFactor
  const moveFactor = bone.userData.moveFactor;

  // compute bone world rest position:
  bone.userData.restWorldPosition.copy(bone.userData.restPosition).applyMatrix4(bone.parent.matrixWorld);

  // update the ray going from camera to landmark in world position:
  const ray = bone.userData.ray;
  camera.getWorldPosition(ray.origin);
  ray.direction.set(viewportPosition.x, viewportPosition.y, 1).unproject(camera).normalize();

  // compute the closest point on ray to bone rest position:
  ray.closestPointToPoint(bone.userData.restWorldPosition, bone.userData.displacementWorld);

  // compute displacement in world ref and apply amplitude factor:
  bone.userData.displacementWorld.sub(bone.userData.restWorldPosition).multiplyScalar(moveFactor);
}


const update_bonePosition = function(bone){
    // compute bone position in world ref:
  bone.position.copy(bone.userData.restWorldPosition).add(bone.userData.displacementWorld);

  // go from world ref to parent bone ref:
  bone.position.applyMatrix4(bone.parent.userData.matrixWorldInv);
}


const extract_boneByName = function(threeObject, boneName){
  let bone = null;
  threeObject.traverse(function(threeStuff){
    if (!threeStuff.isSkinnedMesh || !threeStuff.skeleton || !threeStuff.skeleton.bones){
      return;
    }
    const boneFound = threeStuff.skeleton.bones.find(function(b){
      return (b.name === boneName);
    });
    bone = bone || boneFound;
  });
  return bone;
}


//export { BadgerAutobones }
