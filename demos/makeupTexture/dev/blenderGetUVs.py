# return the list of UVs coordinates of an array of points
# should be launched in OBJECT mode
# if multiple UVs are available, display a warning

# ref: https://blenderartists.org/t/accessing-uv-data-in-python-script/540440/10

import bmesh

def getPointUV(vertexInd):
  # go to OBJECT mode and get the right mesh:
  bpy.ops.object.mode_set(mode='OBJECT') # Can't access coordinate data in edit mode currently 
  obj = bpy.context.object
  me = obj.data
  # get all UVs available for this point
  uvs = []
  for f in me.polygons:
    for i in f.loop_indices: # &lt;-- python Range object with the proper indices already set
      l = me.loops[i] # The loop entry this polygon point refers to
      vi = l.vertex_index
      if vi != vertexInd:
        continue
      v = me.vertices[vi] # The vertex data that loop entry refers to
      for j,ul in enumerate(me.uv_layers):      
        uv = ul.data[l.index].uv
        uvs.append(uv)
  # check if there are UVs:
  if len(uvs) == 0:
    print('ERROR: no UVs found for vertex with index = %i' % vertexInd)
    return [0, 0]
  # check if UVs are the same:
  uv0 = uvs.pop()
  for uv in uvs:
    if uv0.x != uv.x or uv0.y != uv.y:
      print('WARNING: multiple UVS found for vertex with index = %i' % vertexInd)
  return [uv0.x, uv0.y]


def getPointsUVs(vertexInds):
  uvs = []
  for vertexInd in vertexInds:
    uv = getPointUV(vertexInd)
    uvs.append(uv)
  return uvs


# MAIN RUNTIME:

# indices of the points in main.js:
pointsIndices = [4601, 1912, 4521, 595, 2725, 1511, 2812, 103, 2805, 620, 4596, 280, 1886, 4599, 718, 2811, 1483, 3650, 2771, 5406, 1874, 4390, 4920, 2214, 1125, 4464, 4364, 4922, 4337, 1117, 1478, 2592, 553, 1808, 572, 2664, 2565, 3158, 2537, 567, 5784, 334, 4346, 1845, 5279, 1007, 4168, 4038, 156, 2548, 1448, 3523, 444, 2357, 446, 2091, 4985, 263, 5308, 4968, 4890, 1679, 3226, 82, 3552, 3207, 3126, 3022]
uvs = getPointsUVs(pointsIndices)
print(uvs)