
import bpy
from bpy.props import (
    BoolProperty,
    EnumProperty,
    StringProperty,
)

class JSONExporter(bpy.types.Operator):
    """
    Export to the JSON format
    """
    bl_idname = "export.json"
    bl_label = "Flexible Mask metadata JSON"
    filepath: StringProperty(subtype='FILE_PATH')

    def execute(self, context):
        filePath = bpy.path.ensure_ext(self.filepath, ".json")
        config = {
            
        }

        from .export_json import exportJSON
        exportJSON(context, filePath, config)
        return {'FINISHED'}

    def invoke(self, context, event):
         # CHECK THAT MEASURE-IT BLENDER EXTENSION IS ENABLED
        enabledAddons = bpy.context.preferences.addons.keys()
        if not 'measureit' in enabledAddons:
          bpy.utils.register_class(MessageBox)
          bpy.ops.message.messagebox('INVOKE_DEFAULT', message = "Please enable MEASURE-IT add-on (in Edit/Preferences/Add-ons, look for \"3D View MeasureIt\", check it. Operation aborted.")
          return {'FINISHED'}

        if not self.filepath:
            self.filepath = bpy.path.ensure_ext(bpy.data.filepath, ".json")
        WindowManager = context.window_manager
        WindowManager.fileselect_add(self)

        return {'RUNNING_MODAL'}



class MessageBox(bpy.types.Operator):
    bl_idname = "message.messagebox"
    bl_label = ""
 
    message = bpy.props.StringProperty(
        name = "message",
        description = "message",
        default = ''
    )
 
    def execute(self, context):
        self.report({'INFO'}, self.message)
        print(self.message)
        return {'FINISHED'}
 
    def invoke(self, context, event):
        return context.window_manager.invoke_props_dialog(self, width = 400)
 
    def draw(self, context):
        self.layout.label(text = self.message)
        self.layout.label(text = "")
 