class AttendanceRecord {
  final String date;
  final String status;

  AttendanceRecord({required this.date, required this.status});

  // Factory constructor to create an AttendanceRecord from JSON
  factory AttendanceRecord.fromJson(Map<String, dynamic> json) {
    return AttendanceRecord(
      date: json['date'] as String,
      status: json['status'] as String,
    );
  }
}