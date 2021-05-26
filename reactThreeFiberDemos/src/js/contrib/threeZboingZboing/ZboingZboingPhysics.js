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

/* eslint-disable */

import * as THREE from 'three';
import { SkeletonUtils } from '../three/v126/examples/jsm/utils/SkeletonUtils.js';


// allocate intermediary vectorz here, not in the rendering loop:
const strengthSpring = new THREE.Vector3();
const strengthDamper = new THREE.Vector3();
const strength = new THREE.Vector3();
const strengthInternal = new THREE.Vector3();
const strengthSum = new THREE.Vector3();
const dv = new THREE.Vector3();
const dp = new THREE.Vector3();

const boneVecFrom = new THREE.Vector3();
const boneVecTo = new THREE.Vector3();

const quat = new THREE.Quaternion();



function pick_randomFloatInRange(range){
  return range[0] + Math.random() * (range[1] - range[0]);
}


function update_worldPosition(bone){
  bone.getWorldPosition(bone.userData.startWorldPosition);
  if (bone.children.length === 0) return;

  bone.userData.endWorldPosition.set(0,0,0);
  bone.children.forEach(function(child){
    child.getWorldPosition(dp);
    bone.userData.endWorldPosition.add(dp);
  });
  bone.userData.endWorldPosition.divideScalar(bone.children.length);
}


function compute_strength(physicsSettings, restPosition, position, velocity, strength){
  // compute strengths:
  // spring:
  strengthSpring.copy(position).sub(restPosition).multiplyScalar(-physicsSettings.spring);

  // damper:
  strengthDamper.copy(velocity).multiplyScalar(-physicsSettings.damper);

  // total force:
  strength.copy(strengthSpring).add(strengthDamper);
}


function update_physicsPosition(dt, strength, position, velocity){ 

  // apply fundamental principle of dynamics with mass = 1
  const accl = strength;

  // Euler integration:
  dv.copy(accl).multiplyScalar(2*dt); // dv / 2 in fact
  velocity.add(dv); // mean velocity during simulation step

  dp.copy(velocity).multiplyScalar(dt);
  position.add(dp);

  velocity.add(dv); // velocity at the end of simulation step
}


function update_bonePhysics(dt, k, bone, rigidBone){
  if (bone.userData.physicsSettings === null) {
    bone.position.copy(rigidBone.userData.startWorldPosition);
    return;
  }  
  const physicsSettings = bone.userData.physicsSettings;
  
  // apply physics to update world bone start position:
  // compute strength pulling to rigid rest pose:
  compute_strength(physicsSettings, rigidBone.userData.startWorldPosition, bone.position, bone.userData.startWorldVelocity, strength);
  strengthSum.copy(strength);

  // compute strength pulling to parent:
  if (bone.userData.parent){
    compute_strength(physicsSettings, bone.userData.parent.userData.endWorldPosition, bone.position, bone.userData.startWorldVelocity, strength);
    strength.multiplyScalar(k);
    strengthSum.add(strength);
  }

  // internal strength pulling the start from the end of the bone:
  if (rigidBone.children.length > 0){
    compute_strength(physicsSettings, bone.userData.endWorldPosition, bone.position, bone.userData.endWorldVelocity, strengthInternal);
    strengthInternal.multiplyScalar(k);
    strengthSum.add(strengthInternal);
  }

  update_physicsPosition(dt, strengthSum, bone.userData.nextStartWorldPosition, bone.userData.startWorldVelocity);

  // apply physics to update world bone end position:
  if (rigidBone.children.length > 0){
    // internal strength pulling the end from the start of the bone:
    strengthSum.copy(strengthInternal).multiplyScalar(-1);

    // compute strength pulling to rigid rest pose:
    compute_strength(physicsSettings, rigidBone.userData.endWorldPosition, bone.userData.endWorldPosition, bone.userData.endWorldVelocity, strength);
    strengthSum.add(strength);

    // compute strength pulling to children:
    bone.userData.children.forEach(function(boneChild){
      compute_strength(physicsSettings, boneChild.position, bone.userData.endWorldPosition, bone.userData.endWorldVelocity, strength);
      strength.multiplyScalar(k / bone.userData.children.length);
      strengthSum.add(strength);
    });    

    update_physicsPosition(dt, strengthSum, bone.userData.nextEndWorldPosition, bone.userData.endWorldVelocity);
  }
}


function apply_bonePhysics(bone){
  if (bone.userData.physicsSettings === null) {
    return;
  }
  bone.position.copy(bone.userData.nextStartWorldPosition);
  bone.userData.endWorldPosition.copy(bone.userData.nextEndWorldPosition);
}


function update_boneRotation(bone, rigidBone){
  if (rigidBone.children.length === 0 || bone.userData.physicsSettings === null) {
    rigidBone.getWorldQuaternion(bone.quaternion);
    return;
  }

  rigidBone.getWorldQuaternion(bone.quaternion);

  //if (bone.userData.physicsSettings === null) return;
  const endPosition = bone.userData.endWorldPosition;
  const endRestPosition = rigidBone.userData.endWorldPosition;
  const startPosition = bone.position;
  const startRestPosition = rigidBone.userData.startWorldPosition;

  boneVecFrom.copy(endRestPosition).sub(startRestPosition).normalize();
  boneVecTo.copy(endPosition).sub(startPosition).normalize();
  
  // set bone quaternion so that bone will point toward endPosition:
  quat.setFromUnitVectors ( boneVecFrom, boneVecTo );
  bone.quaternion.multiply(quat);
}


/*function compute_endBonePosition(threeBone, result){
  result.set(0, 0, 0);
  threeBone.children.forEach(function(threeBoneChild){
    result.add(threeBoneChild.position);
  });
  result.divideScalar(threeBone.children.length);
}*/


const ZboingZboingPhysics = function(threeScene, threeSkinnedMesh, bonesPhysicsSettings, optionsArg){

  const options = Object.assign({
    simuStepsCount: 3,
    isDebug: false,
    internalStrengthFactor: 0.5,
    bonesNamesShouldContain: null
  }, optionsArg || {});

  this.threeClock = new THREE.Clock();
  this.threeClock.start();

  // copy the skeleton to a rigid, invisible skeleton
  this.skinnedMesh = threeSkinnedMesh;
  this.rigidSkeleton = this.skinnedMesh.skeleton;
  this.parent = this.skinnedMesh.parent;

  //this.rigidSkeleton.pose();
  this.rigidSkinnedMesh =  SkeletonUtils.clone(this.skinnedMesh);
  this.skeleton = this.rigidSkinnedMesh.skeleton;

  // force skeleton update;
  this.parent.add(this.rigidSkinnedMesh);
  this.skeleton.pose();
  this.parent.remove(this.rigidSkinnedMesh);


  this.skeleton.bones = this.rigidSkeleton.bones.map(function(rigidBone){
    // bones loose their linking, so they are positionned in the world space now
    const bone = new THREE.Bone();
    bone.name = rigidBone.name;
    //console.log('[INFO] in ZboingZboingPhysics: bone.name =', bone.name);
    rigidBone.getWorldScale(bone.scale);
    threeScene.add(bone);

    return bone;
  });
  

  // for debugging purpose, display the rigid mesh in red:
  if (options.isDebug){
    this.rigidSkinnedMesh.material = this.rigidSkinnedMesh.material.clone();
    this.rigidSkinnedMesh.material.color.setRGB(0xff0000);
    this.parent.add(this.rigidSkinnedMesh);
    window.debugPhysics = this;
    window.THREE = THREE;
  }

   // swap skeletons:
  const bindMatrix = this.skinnedMesh.bindMatrix;
  this.rigidSkinnedMesh.bind(this.rigidSkeleton, bindMatrix);
  this.skinnedMesh.bind(this.skeleton, bindMatrix);

  // booooh this is really dirty:
  const that = this;

  // init custom bone data:
  this.skeleton.bones.forEach(function(bone, boneIndex){
    let physicsSettings = bonesPhysicsSettings[bone.name] || bonesPhysicsSettings['DEFAULT'] || null;
    if (bonesPhysicsSettings[bone.name] === null
      || (options.bonesNamesShouldContain !== null && bone.name.indexOf(options.bonesNamesShouldContain) === -1)){
      physicsSettings = null;
    }

    let debugEndPositionMesh = null;
    if (options.isDebug && physicsSettings){
      debugEndPositionMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.1,0.5), new THREE.MeshNormalMaterial());
      threeScene.add(debugEndPositionMesh);
    }

    if (physicsSettings){
      physicsSettings = Object.assign({
        damper: (physicsSettings.damperRange) ? pick_randomFloatInRange(physicsSettings.damperRange) : physicsSettings.damper,
        spring: (physicsSettings.springRange) ? pick_randomFloatInRange(physicsSettings.springRange) : physicsSettings.spring,
      });
    }

    Object.assign(bone.userData, {
      physicsSettings: physicsSettings,
      startWorldVelocity: new THREE.Vector3(),
      endWorldVelocity: new THREE.Vector3(),
      endWorldPosition: (options.isDebug && debugEndPositionMesh) ? debugEndPositionMesh.position : new THREE.Vector3(),
      nextStartWorldPosition: new THREE.Vector3(),
      nextEndWorldPosition: new THREE.Vector3(),
      ind: boneIndex,
      parent: null,
      children: []
    });
  });

  this.rigidSkeleton.bones.forEach(function(bone, boneIndex){
    Object.assign(bone.userData, {
      startWorldPosition: new THREE.Vector3(),
      endWorldPosition: new THREE.Vector3(),
      ind: boneIndex
    });
  });

  // set parent and children of this.skeleton:
  this.skeleton.bones.forEach(function(bone, boneIndex){    
    const rigidBone = that.rigidSkeleton.bones[boneIndex];
    if (rigidBone.parent && rigidBone.parent.isBone){
      const parentInd = rigidBone.parent.userData.ind;
      bone.userData.parent = that.skeleton.bones[parentInd];
    }
    rigidBone.children.forEach(function(child){
      const childInd = child.userData.ind;
      bone.userData.children.push(that.skeleton.bones[childInd]);
    });
  });


  this.needsReset = true;

  
  // if we need to run a skeleton animation
  // we should run it on the rigid (unvisible mesh)
  // not directly on the skinnedmesh otherwise it will mess with physics
  this.create_animationMixer = function(){
    return new THREE.AnimationMixer(this.rigidSkinnedMesh);
  }


  this.update = function(){

    const dt = Math.min(this.threeClock.getDelta(), 0.1); // in seconds
    // dt should not be too large otherwise physics may diverge
    
    //this.rigidSkeleton.pose();
    this.rigidSkeleton.bones.forEach(update_worldPosition);

    if (this.needsReset){
      this.reset();
      this.needsReset = false;
      return;
    }

    const dtStep = dt / options.simuStepsCount;
    for(let i = 0; i<options.simuStepsCount; ++i){
      this.skeleton.bones.forEach(function(bone, boneIndex){
        const rigidBone = that.rigidSkeleton.bones[boneIndex];
        update_bonePhysics(dtStep, options.internalStrengthFactor, bone, rigidBone);
      });
      this.skeleton.bones.forEach(apply_bonePhysics);
    }

    // apply endbonepositions by changing bone orientations:
    this.skeleton.bones.forEach(function(bone, boneIndex){
      update_boneRotation(bone, that.rigidSkeleton.bones[boneIndex]);
    });
  }


  this.reset = function(){
    this.skeleton.bones.forEach(function(bone, boneIndex){
      const rigidBone = that.rigidSkeleton.bones[boneIndex];

      // reset positions:
      bone.userData.endWorldPosition.copy(rigidBone.userData.endWorldPosition);
      bone.position.copy(rigidBone.userData.startWorldPosition);

      // reset next positions:
      bone.userData.nextStartWorldPosition.copy(bone.position);
      bone.userData.nextEndWorldPosition.copy(bone.userData.endWorldPosition);

      // reset rotation:
      rigidBone.getWorldQuaternion(bone.quaternion);

      // reset velocities:
      bone.userData.startWorldVelocity.set(0, 0, 0);
      bone.userData.endWorldVelocity.set(0, 0, 0);
    });
  }


  this.destroy = function(){
    this.threeClock.stop();
    this.skeleton.bones.forEach(function(bone){
      threeScene.remove(bone);
    });

    // bind the rigid skeleton to the mesh:
    this.skinnedMesh.bind(this.rigidSkeleton, new THREE.Matrix4());
    this.skeleton.dispose();
  }
}




export { ZboingZboingPhysics }
