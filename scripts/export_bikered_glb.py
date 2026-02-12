import bpy
import mathutils

for obj in bpy.data.objects:
    obj.select_set(False)

selected = 0
for obj in bpy.data.objects:
    if obj.type != 'MESH':
        continue
    bb = [obj.matrix_world @ mathutils.Vector(corner) for corner in obj.bound_box]
    minv = mathutils.Vector((min(v.x for v in bb), min(v.y for v in bb), min(v.z for v in bb)))
    maxv = mathutils.Vector((max(v.x for v in bb), max(v.y for v in bb), max(v.z for v in bb)))
    size = maxv - minv
    max_dim = max(size.x, size.y, size.z)
    if max_dim < 5:
        obj.select_set(True)
        selected += 1

print('Selected mesh objects:', selected)

bpy.ops.export_scene.gltf(
    filepath="/Users/maxhartwig/Desktop/training-dashboard/external/41-bikered/bikered.glb",
    export_format='GLB',
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_texcoords=True,
    export_normals=True,
    export_materials='EXPORT',
    export_cameras=False,
    export_lights=False
)
