
import os
import bpy
import bmesh
import json

DEBUG = os.environ.get('BLENDER_DEBUG', False) #activates debug mode
if DEBUG:
    import sys
    sys.path.append(os.environ['PYDEV_DEBUG_PATH'])
    import pydevd

SUPPORTED_LANDMARKS_LABELS = [
  "LEFT_EYEBROW_INSIDE",
  "RIGHT_EYEBROW_INSIDE",
  "LEFT_EYE_INSIDE",
  "RIGHT_EYE_INSIDE",
  "LEFT_EYE_OUTSIDE",
  "RIGHT_EYE_OUTSIDE",
  "LEFT_EYE_BOTTOM",
  "RIGHT_EYE_BOTTOM",
  "LEFT_EAR_BOTTOM",
  "RIGHT_EAR_BOTTOM",
  "LEFT_NOSE",
  "RIGHT_NOSE",
  "NOSE_BOTTOM",
  "LEFT_MOUTH",
  "RIGHT_MOUTH",
  "MOUTH_TOP",
  "MOUTH_BOTTOM",
  "CHIN_BOTTOM"
]

def exportJSON(context, filePath, settings):
    global SUPPORTED_LANDMARKS_LABELS
    """
    Main entry point into export facility.
    """
    print("----------\nExporting to {}".format(filePath))
    scene = context.scene

    # GET ELEMENTS:
    bpy.ops.object.mode_set(mode='EDIT') # go to edit mode

    obj = bpy.context.object    
    me = obj.data
    bm = bmesh.from_edit_mesh(me)
    vertices = [e for e in bm.verts]

    # EXTRACT GEOMETRY NAME:
    geometryName = me.name
    if geometryName == 'Mesh' or not geometryName:
        raise Exception('ERROR: Invalid geometry name')
        return False

    # GET LANDAMRKS:
    landmarks = []    
    op = obj.MeasureGenerator[0]

    # loop over the number of annotated measures
    measuresCount = op.measureit_num
    print('Found raw measureIt measures: %i' % measuresCount)
    for idx in range(measuresCount):
        ms = op.measureit_segments[idx]
        label =  ms.gltxt
        if not label:
          continue
        vertexInd = ms.glpointa
        print('Vertex point %i has label %s' % (vertexInd, label))
        co = vertices[vertexInd].co
        coArray = [co.x, co.y, co.z]
        # coArray = [co.x, co.z, -co.y] # Inv YZ
        # format landmark data:
        landmark = {
          'label': label,
          'co': coArray
        }
        landmarks.append(landmark)

    # CHECK THAT THERE ARE AT LEAST 4 LANDMARKS:
    landmarksCount = len(landmarks)
    if landmarksCount < 4:
        raise Exception("ERROR: You should label at least 4 points")
        return False

    # CHECK THAT NO LANDMARKS IS DECLARED TWICE:
    # dirty way to do that
    for i in range(landmarksCount):
        landmarkLabel = landmarks[i]['label']
        for j in range(landmarksCount):
            if i == j:
                continue
            otherLandmarkLabel = landmarks[j]['label']
            if landmarkLabel == otherLandmarkLabel:
                raise Exception('ERROR: this landmark is labeled twice or more: %s' % landmarkLabel)
                return False
   
    # CHECK THAT ALL LANDMARKS DECLARATIONS ARE VALID:
    for i in range(landmarksCount):
        landmarkLabel = landmarks[i]['label']
        if not landmarkLabel in SUPPORTED_LANDMARKS_LABELS:
            raise Exception('ERROR: this landmark is not valid: %s' % landmarkLabel)
            return False

    # FORMAT JSON:
    jsonDataARFaceTracking = {
      "ID": "trackingParentMask",
      "NAME": "Exported from Blender", 
      "TYPE": "FACE",
      "MATRIX": [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],

      "DEFORMEDID": geometryName,
      "DEFORMEDKEYPOINTS": landmarks
    }
    jsonData = {
      "ARTRACKING": [ jsonDataARFaceTracking ]
    }
    
    # EXPORT AS JSON:
    with open(filePath, 'w') as outfile:
       json.dump(jsonData, outfile)

    print("Finished")
