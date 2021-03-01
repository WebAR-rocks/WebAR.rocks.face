bl_info = {
    "name": "Export Flexible Mask metadata (JSON)",
    "author": "Some guys from Piepacker & WebAR.rocks",
    "version": (2, 2, 3),
    "blender": (2, 80, 0),
    "location": "File > Export > Flexible Mask metadata (JSON)",
    "description": "The script exports metadata for flexible mask used by WebAR.rocks.face",
    "warning": "This is a warning buddy!",
    "doc_url": "https://www.google.fr",
    "category": "Import-Export",
}

if "bpy" in locals():
    from importlib import reload
    reload(operator)
    del reload

import bpy
from . import operator

def menu_func(self, context):
    self.layout.operator(operator.JSONExporter.bl_idname, text="Flexible Mask metadata JSON")

classes = (
    operator.JSONExporter,
)

def register():
    from bpy.utils import register_class
    for cls in classes:
        register_class(cls)
    bpy.types.TOPBAR_MT_file_export.append(menu_func)


def unregister():
    from bpy.utils import unregister_class
    for cls in reversed(classes):
        unregister_class(cls)
    bpy.types.TOPBAR_MT_file_export.remove(menu_func)

if __name__ == "__main__":
    register()
