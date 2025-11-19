from marshmallow import Schema, fields

class UserPublicSchema(Schema):
    user_id = fields.Int()
    username = fields.Str()
    role = fields.Str()
    created_at = fields.DateTime()

class StudentSchema(Schema):
    student_id = fields.Int()
    roll_no = fields.Str()
    name = fields.Str()
    class_code = fields.Str()
    email = fields.Str()
    phone = fields.Str()

class AttendanceSchema(Schema):
    attendance_id = fields.Int()
    student_id = fields.Int()
    session_id = fields.Int()
    timestamp = fields.DateTime()
    status = fields.Str()
    method = fields.Str()
    geo_lat = fields.Float()
    geo_long = fields.Float()
